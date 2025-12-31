/*:
 * @target MZ
 * @plugindesc [v1.0] ระบบ Guts (รอดตาย) และ Life Steal (ฟื้นเลือดเมื่อฆ่า)
 * @author Plugin Maker (For Max Aura Project)
 * @help
 * ----------------------------------------------------------------------------
 * MaxAura_SurvivalInstinct.js
 * ----------------------------------------------------------------------------
 * รายละเอียด:
 * เพิ่มสกิลติดตัวให้กับ Actor ทุกคนในปาร์ตี้ เพื่อช่วยในการยืนระยะ (Sustain)
 * ลดความจำเป็นในการกลับไปนอนโรงแรมบ่อยๆ
 *
 * 1. Guts System (ระบบลูกฮึด):
 * - เมื่อ Actor โดนดาเมจจน HP เหลือ 0 เป็นครั้งแรกในการต่อสู้นั้นๆ
 * - HP จะค้างอยู่ที่ 1 แทนที่จะตาย
 * - มี Effect เสียงและข้อความแจ้งเตือน
 * - รีเซ็ตทุกครั้งที่จบการต่อสู้
 *
 * 2. Life Steal on Kill (ระบบเลือดนักล่า):
 * - เมื่อ Actor เป็นคนลงดาบสุดท้าย (Last Shot) สังหารศัตรูได้
 * - จะได้รับ HP ฟื้นฟูทันที (คิดเป็น % ของ Max HP ตัวเอง)
 * - กระตุ้นให้ผู้เล่นวางแผนว่าใครจะเป็นคนปิดฉาก
 *
 * ----------------------------------------------------------------------------
 * @param --- Guts Settings ---
 * @param EnableGuts
 * @text เปิดใช้ระบบ Guts
 * @type boolean
 * @default true
 *
 * @param GutsSound
 * @text เสียงเมื่อ Guts ทำงาน
 * @type file
 * @dir audio/se
 * @default Powerup
 *
 * @param --- Life Steal Settings ---
 * @param EnableLifeSteal
 * @text เปิดใช้ระบบ Life Steal
 * @type boolean
 * @default true
 *
 * @param HealPercent
 * @text เปอร์เซ็นต์ฟื้นฟู (%)
 * @desc ฟื้นเลือดกี่ % ของ Max HP เมื่อฆ่ามอนสเตอร์ได้ (แนะนำ 5-15%)
 * @type number
 * @min 1
 * @max 100
 * @default 10
 *
 * @param HealSound
 * @text เสียงเมื่อฆ่าและได้เลือด
 * @type file
 * @dir audio/se
 * @default Heal3
 *
 */

(() => {
    "use strict";

    const pluginName = "MaxAura_SurvivalInstinct";
    const parameters = PluginManager.parameters(pluginName);

    const config = {
        enableGuts: parameters['EnableGuts'] === 'true',
        gutsSe: String(parameters['GutsSound'] || 'Powerup'),
        enableLS: parameters['EnableLifeSteal'] === 'true',
        lsPercent: Number(parameters['HealPercent'] || 10) / 100,
        lsSe: String(parameters['HealSound'] || 'Heal3')
    };

    // ========================================================================
    //  System 1: Guts (Survival)
    // ========================================================================

    // 1. Initialize Guts Flag at Battle Start
    const _Game_Battler_onBattleStart = Game_Battler.prototype.onBattleStart;
    Game_Battler.prototype.onBattleStart = function() {
        _Game_Battler_onBattleStart.call(this);
        this._gutsUsed = false; // Reset flag
    };

    // 2. Intercept Damage processing to check for Death
    // เราจะใช้ gainHp ซึ่งเป็นจุดรวมของการเปลี่ยนแปลง HP ทั้งหมด
    const _Game_Battler_gainHp = Game_Battler.prototype.gainHp;
    Game_Battler.prototype.gainHp = function(value) {
        // ถ้าเป็นการลดเลือด (Damage) และระบบ Guts เปิดอยู่ และเป็นฝ่ายผู้เล่น
        if (config.enableGuts && value < 0 && this.isActor()) {
            
            // ถ้า Hp ปัจจุบัน + Damage ที่ได้รับ จะทำให้ตาย (<= 0)
            if (this.hp + value <= 0) {
                // เช็คว่าเคยใช้ Guts ไปหรือยังในรอบนี้
                if (!this._gutsUsed) {
                    this.activateGuts();
                    // แก้ค่า value ให้เลือดเหลือ 1 พอดี
                    value = -this.hp + 1; 
                }
            }
        }
        
        // เรียกฟังก์ชันเดิมทำงานต่อด้วยค่า value ที่อาจถูกแก้แล้ว
        _Game_Battler_gainHp.call(this, value);
    };

    Game_Battler.prototype.activateGuts = function() {
        this._gutsUsed = true;
        
        // Visual Feedback
        if ($gameParty.inBattle()) {
            // Play Sound
            AudioManager.playSe({ name: config.gutsSe, volume: 100, pitch: 100, pan: 0 });
            
            // Animation (ใช้อนิเมชันชุบชีวิต หรือบัฟ)
            $gameTemp.requestAnimation([this], 52); // 52 = Revival animation usually
            
            // Log Window Message
            if (SceneManager._scene._logWindow) {
                SceneManager._scene._logWindow.addText(`\\C[17]GUTS!\\C[0] ${this.name()} กัดฟันสู้ต่อ!`);
            }
            
            // Popup text (ถ้ามีระบบ Popup หรือใช้ Console)
            this.requestEffect('whiten');
        }
    };

    // ========================================================================
    //  System 2: Life Steal on Kill
    // ========================================================================

    // Hook เข้าที่ executeHpDamage เพื่อเช็คว่าศัตรูตายจากการโจมตีนี้หรือไม่
    const _Game_Action_executeHpDamage = Game_Action.prototype.executeHpDamage;
    Game_Action.prototype.executeHpDamage = function(target, value) {
        // เช็คสถานะก่อนโดนดาเมจ (ต้องมีชีวิตอยู่)
        const wasAlive = target.isAlive();
        
        // คำนวณดาเมจตามปกติ
        _Game_Action_executeHpDamage.call(this, target, value);
        
        // เช็คเงื่อนไข Life Steal:
        // 1. ระบบเปิด
        // 2. คนโจมตีเป็น Actor
        // 3. คนโดนเป็น Enemy
        // 4. ก่อนโดนต้องมีชีวิต และ หลังโดนต้องตาย (Hp <= 0)
        // 5. ดาเมจต้องมากกว่า 0 (ไม่ใช่ฮีลให้ศัตรูตาย)
        
        if (config.enableLS && this.subject().isActor() && target.isEnemy() && wasAlive && target.hp <= 0 && value > 0) {
            this.performLifeSteal(this.subject());
        }
    };

    Game_Action.prototype.performLifeSteal = function(actor) {
        // คำนวณเลือดที่ได้รับคืน
        const healAmount = Math.floor(actor.mhp * config.lsPercent);
        
        if (healAmount > 0) {
            // เพิ่มเลือด
            // ใช้ true ใน gainHp เพื่อให้แสดง popup สีเขียว
            actor.gainHp(healAmount);
            
            // Visuals
            actor.startDamagePopup(); // แสดงตัวเลขเด้ง
            
            // ถ้าอยากให้แสดง Animation ฮีล
            // $gameTemp.requestAnimation([actor], 46); // 46 = Heal One
            
            // เล่นเสียง
            AudioManager.playSe({ name: config.lsSe, volume: 80, pitch: 120, pan: 0 });
            
            // Log (Optional - อาจจะรกถ้าฆ่าบ่อย ปิดไว้ก่อน หรือเปิดถ้าชอบ)
            // if (SceneManager._scene._logWindow) {
            //    SceneManager._scene._logWindow.addText(`\\C[24]Life Steal!\\C[0] ${actor.name()} ฟื้นฟู ${healAmount} HP`);
            // }
        }
    };

})();