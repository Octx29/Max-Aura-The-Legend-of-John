/*:
 * @target MZ
 * @plugindesc [v9.0 Extreme] Just Guard: สุ่มความเร็ว 0.01วิ - 1วิ (ยากระดับนรก)
 * @author Plugin Maker
 * @help
 * ----------------------------------------------------------------------------
 * MaxAura_JustGuard.js [v9.0 Extreme Chaos]
 * ----------------------------------------------------------------------------
 * รายละเอียด:
 * ระบบ Just Guard ที่ปรับช่วงเวลาสุ่มให้กว้างและยากที่สุดตามคำขอ
 *
 * การคำนวณเวลา (60 Frames = 1 Second):
 * - Min Duration: 1 Frame (ประมาณ 0.016 วินาที -> เร็วสุดขีด)
 * - Max Duration: 60 Frames (1.0 วินาที -> ช้าปกติ)
 *
 * ความท้าทาย:
 * ในการ Parry แต่ละครั้ง ระบบจะสุ่มความเร็วของวงแหวน
 * คุณอาจจะเจอลูกบอลที่พุ่งมาใน 0.01 วิ หรือลอยมา 1 วิ
 * ต้องใช้ปฏิกิริยาตอบสนองระดับสูง!
 *
 * ----------------------------------------------------------------------------
 * @param --- Game Settings ---
 * * @param StunStateId
 * @text ID สถานะ Stun
 * @desc ID สถานะที่จะยัดใส่ศัตรู (Default: 13)
 * @type state
 * @default 13
 *
 * @param MinDuration
 * @text ความเร็วสูงสุด (เฟรม)
 * @desc เร็วสุดที่วงแหวนจะหด (1 เฟรม = 0.016 วิ). ห้ามใส่ต่ำกว่า 1
 * @type number
 * @default 1
 *
 * @param MaxDuration
 * @text ความเร็วต่ำสุด (เฟรม)
 * @desc ช้าสุดที่วงแหวนจะหด (60 เฟรม = 1.0 วิ)
 * @type number
 * @default 60
 *
 * @param --- Visual Button ---
 * @param PromptX
 * @text ตำแหน่งปุ่ม X
 * @desc กลางจอ = 640
 * @type number
 * @default 640
 *
 * @param PromptY
 * @text ตำแหน่งปุ่ม Y
 * @desc กลางจอ = 360 (หรือ 320)
 * @type number
 * @default 320
 *
 * @param --- Audio & FX ---
 * @param ParrySound
 * @text เสียง Perfect Parry
 * @type file
 * @dir audio/se
 * @default Sword2
 *
 * @param FailSound
 * @text เสียงเมื่อกดพลาด
 * @type file
 * @dir audio/se
 * @default Buzzer1
 */

(() => {
    "use strict";

    const pluginName = "MaxAura_JustGuard";
    const parameters = PluginManager.parameters(pluginName);

    // Config Setup
    const config = {
        stunStateId: Number(parameters['StunStateId'] || 13),
        promptX: Number(parameters['PromptX'] || 640),
        promptY: Number(parameters['PromptY'] || 320),
        // ป้องกันค่า min ต่ำกว่า 1 (เพราะ 0 จะทำให้บั๊ก)
        minDur: Math.max(1, Number(parameters['MinDuration'] || 1)), 
        maxDur: Number(parameters['MaxDuration'] || 60),
        parrySe: String(parameters['ParrySound'] || 'Sword2'),
        failSe: String(parameters['FailSound'] || 'Buzzer1')
    };

    Input.keyMapper[70] = 'just_guard'; // F Key

    // --- Global State ---
    const _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function() {
        _Game_Temp_initialize.call(this);
        this.clearJustGuardState();
    };

    Game_Temp.prototype.clearJustGuardState = function() {
        this._jgActive = false;
        this._jgTimer = 0;
        this._jgMaxDuration = 0; 
        this._jgResult = null; 
        this._jgVisualRequest = null; 
    };

    // ------------------------------------------------------------------------
    // 1. Visual System: Rotating & Shrinking
    // ------------------------------------------------------------------------
    
    class Sprite_JustGuardRing extends Sprite {
        initialize() {
            super.initialize();
            this.anchor.set(0.5, 0.5);
            this.createBitmap();
            this.visible = false;
            this._rotationSpeed = 0;
        }

        createBitmap() {
            const size = 200;
            this.bitmap = new Bitmap(size, size);
            const ctx = this.bitmap.context;
            
            const radius = 90; 
            const center = size / 2;

            ctx.lineWidth = 6;
            ctx.strokeStyle = '#ffffff';
            
            // วาดลายเส้นประเพื่อให้เห็นการหมุนชัดเจน
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, 1.5 * Math.PI);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(center, center, radius, 1.7 * Math.PI, 1.9 * Math.PI);
            ctx.stroke();
        }

        updateRing(progress, color) {
            // Scale Calculation
            const startScale = 1.6;
            const targetScale = 0.355; 
            const currentScale = targetScale + ((startScale - targetScale) * progress);
            this.scale.set(currentScale, currentScale);
            
            // Rotation based on progress
            this.rotation += 0.2 + (1.0 - progress) * 0.3;

            // Opacity Logic
            // ถ้าเฟรมน้อยมาก (เร็วจัด) ไม่ต้อง Fade Out เพราะจะมองไม่ทันอยู่แล้ว
            if ($gameTemp._jgMaxDuration > 10 && progress < 0.15) {
                this.opacity = 180; 
            } else {
                this.opacity = 255;
            }
            
            // Color Logic
            if (color === 'green') this.setBlendColor([0, 255, 100, 255]);
            else if (color === 'red') this.setBlendColor([255, 50, 50, 255]);
            else this.setBlendColor([0, 0, 0, 0]); 
        }
    }

    class Sprite_JustGuardPrompt extends Sprite {
        initialize() {
            super.initialize();
            this.x = config.promptX;
            this.y = config.promptY;
            this.anchor.set(0.5, 0.5);
            this.createBitmap();
            this.visible = false;
            
            this._ring = new Sprite_JustGuardRing();
            this.addChild(this._ring);
            
            this._feedbackTime = 0;
        }

        createBitmap() {
            const size = 64; 
            this.bitmap = new Bitmap(size, size);
            const ctx = this.bitmap.context;
            const center = size / 2;
            const radius = 30; 

            // BG
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; 
            ctx.fill();
            
            // Border
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Text F
            this.bitmap.fontSize = 32;
            this.bitmap.fontFace = "rmmz-mainfont, sans-serif";
            this.bitmap.textColor = "#ffffff";
            this.bitmap.drawText("F", 0, 0, size, size, "center");
        }

        update() {
            super.update();
            this.updateState();
        }

        updateState() {
            const request = $gameTemp._jgVisualRequest;
            
            if (request === 'start') {
                this.startAnimation();
                $gameTemp._jgVisualRequest = null;
            } else if (request === 'success') {
                this.showFeedback('green');
                $gameTemp._jgVisualRequest = null;
            } else if (request === 'fail') {
                this.showFeedback('red');
                $gameTemp._jgVisualRequest = null;
            }

            if (this._feedbackTime > 0) {
                this._feedbackTime--;
                if (this._feedbackTime <= 0) {
                    this.visible = false;
                }
            } else if ($gameTemp._jgActive) {
                const max = $gameTemp._jgMaxDuration;
                const current = $gameTemp._jgTimer;
                const progress = Math.max(0, current / max);
                
                this._ring.updateRing(progress, 'white');
            } else {
                this.visible = false;
            }
        }

        startAnimation() {
            this.visible = true;
            this.opacity = 255;
            this.scale.set(1, 1);
            this._ring.visible = true;
            this._ring.rotation = Math.random() * Math.PI; 
            this._ring.setBlendColor([0,0,0,0]);
            this._feedbackTime = 0;
        }

        showFeedback(color) {
            this._ring.updateRing(0, color);
            this._ring.opacity = 255; 
            
            if (color === 'green') {
                this.scale.set(1.3, 1.3);
            } else {
                this.scale.set(0.9, 0.9);
            }
            this._feedbackTime = 30; 
        }
    }

    const _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
    Scene_Battle.prototype.createSpriteset = function() {
        _Scene_Battle_createSpriteset.call(this);
        this._justGuardSprite = new Sprite_JustGuardPrompt();
        this.addChild(this._justGuardSprite);
    };

    // ------------------------------------------------------------------------
    // 2. Logic: Randomized Timing (Extreme Range)
    // ------------------------------------------------------------------------

    const _Window_BattleLog_updateWaitMode = Window_BattleLog.prototype.updateWaitMode;
    Window_BattleLog.prototype.updateWaitMode = function() {
        if (this._waitMode === 'justGuard') {
            if ($gameTemp._jgActive) return true;
            this._waitMode = '';
            return false;
        }
        return _Window_BattleLog_updateWaitMode.call(this);
    };

    const _Window_BattleLog_startAction = Window_BattleLog.prototype.startAction;
    Window_BattleLog.prototype.startAction = function(subject, action, targets) {
        _Window_BattleLog_startAction.call(this, subject, action, targets);
        
        if (subject.isEnemy() && targets.some(t => t.isActor()) && (action.isPhysical() || action.isMagical())) {
            
            $gameTemp.clearJustGuardState();
            
            // --- EXTREME RANDOMIZER ---
            // สุ่มค่าระหว่าง 1 (0.01s) ถึง 60 (1.0s)
            const randomDur = Math.floor(Math.random() * (config.maxDur - config.minDur + 1)) + config.minDur;
            
            $gameTemp._jgActive = true;
            $gameTemp._jgMaxDuration = randomDur;
            $gameTemp._jgTimer = randomDur;
            $gameTemp._jgVisualRequest = 'start';
            
            // console.log("Speed:", randomDur); // ไว้ดู log ความเร็ว
            
            this._waitMode = 'justGuard';
        }
    };

    const _BattleManager_update = BattleManager.update;
    BattleManager.update = function() {
        _BattleManager_update.call(this);
        this.updateJustGuardLogic();
    };

    BattleManager.updateJustGuardLogic = function() {
        if ($gameTemp._jgActive) {
            $gameTemp._jgTimer--;
            
            // Check Input
            if (Input.isTriggered('just_guard')) {
                this.processJustGuardInput();
            }

            // Timeout
            // ถ้าความเร็วสูงมาก (น้อยกว่า 5 เฟรม) เราต้องยอมให้ติดลบได้นิดหน่อยไม่งั้นกดไม่ทัน
            const gracePeriod = ($gameTemp._jgMaxDuration < 5) ? -10 : -5;

            if ($gameTemp._jgTimer <= gracePeriod) { 
                $gameTemp._jgActive = false;
                $gameTemp._jgResult = 'miss';
                $gameTemp._jgVisualRequest = 'fail'; 
                AudioManager.playSe({ name: config.failSe, volume: 80, pitch: 100, pan: 0 });
            }
        }
    };

    BattleManager.processJustGuardInput = function() {
        const timer = $gameTemp._jgTimer;
        
        // Window Adjustment
        // ถ้ามาเร็วมาก (<= 10 เฟรม) ให้ Window กว้างหน่อย (+/- 6) เพื่อความยุติธรรม
        // ถ้ามาช้า (ปกติ) ให้ Window แคบ (+/- 4)
        const isSuperFast = $gameTemp._jgMaxDuration <= 10;
        const perfectWindow = isSuperFast ? 6 : 4;
        
        if (Math.abs(timer) <= perfectWindow) {
            // --- PERFECT ---
            $gameTemp._jgResult = 'perfect';
            $gameTemp._jgVisualRequest = 'success';
        } else {
            // --- MISS ---
            $gameTemp._jgResult = 'miss';
            $gameTemp._jgVisualRequest = 'fail';
            AudioManager.playSe({ name: config.failSe, volume: 80, pitch: 100, pan: 0 });
        }
        
        $gameTemp._jgActive = false;
    };

    // ------------------------------------------------------------------------
    // 3. Apply Result
    // ------------------------------------------------------------------------

    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        _Game_Action_apply.call(this, target);
        
        const result = target.result();
        
        if (target.isActor() && result.isHit() && result.hpDamage > 0 && this.subject().isEnemy()) {
            
            const jgResult = $gameTemp._jgResult;
            
            if (jgResult === 'perfect') {
                // No Damage
                result.hpDamage = 0;
                result.mpDamage = 0;
                result.tpDamage = 0;
                
                // Stun (ID 13)
                const subject = this.subject();
                if (subject && subject.isAlive()) {
                    subject.addState(config.stunStateId);
                }

                // FX
                AudioManager.playSe({ name: config.parrySe, volume: 100, pitch: 120, pan: 0 });
                target.requestEffect('whiten');
                $gameScreen.startShake(5, 5, 10);
                
                if (SceneManager._scene._logWindow) {
                     SceneManager._scene._logWindow.addText(`\\C[10]PERFECT BLOCK!\\C[0]`);
                }
            } 
        }
    };

    const _BattleManager_endBattle = BattleManager.endBattle;
    BattleManager.endBattle = function(result) {
        _BattleManager_endBattle.call(this, result);
        $gameTemp.clearJustGuardState();
    };

})();