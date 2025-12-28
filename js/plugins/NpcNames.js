/*:
 * @target MZ
 * @plugindesc แสดงชื่อ NPC บนหัวตัวละคร (Fixed Crash)
 * @author Gemini AI
 *
 * @help NpcNames.js
 *
 * วิธีใช้งาน:
 * ใส่ Note tag ใน Event: <Name:ชื่อที่ต้องการ>
 */

(() => {
    // เก็บฟังก์ชันเดิม
    const _Sprite_Character_setCharacter = Sprite_Character.prototype.setCharacter;
    const _Sprite_Character_update = Sprite_Character.prototype.update;

    // 1. สร้างป้ายชื่อเมื่อกำหนดตัวละคร
    Sprite_Character.prototype.setCharacter = function(character) {
        _Sprite_Character_setCharacter.call(this, character);
        this.createNameSprite();
    };

    // 2. อัปเดตตำแหน่งทุกเฟรม (เพื่อป้องกัน Error ตอนรูปยังไม่มา)
    Sprite_Character.prototype.update = function() {
        _Sprite_Character_update.call(this);
        this.updateNameSpritePosition();
    };

    // ฟังก์ชันสร้างป้ายชื่อ (แค่สร้าง ไม่กำหนดตำแหน่ง Y)
    Sprite_Character.prototype.createNameSprite = function() {
        // ลบอันเก่าถ้ามี
        if (this._nameSprite) {
            this.removeChild(this._nameSprite);
            this._nameSprite = null;
        }

        // เช็คว่าเป็น Event และมี Note tag ไหม
        if (!this._character || !(this._character instanceof Game_Event)) return;
        
        const note = this._character.event().note;
        const match = note.match(/<Name:\s*(.+)>/i);

        if (match) {
            const nameText = match[1];
            const fontSize = 16;
            const spriteWidth = 140; // เพิ่มความกว้างนิดหน่อยเผื่อชื่อยาว
            const spriteHeight = 30;

            const bitmap = new Bitmap(spriteWidth, spriteHeight);
            bitmap.fontSize = fontSize;
            bitmap.fontFace = $gameSystem.mainFontFace();
            bitmap.outlineColor = 'rgba(0, 0, 0, 0.8)';
            bitmap.outlineWidth = 3;
            bitmap.drawText(nameText, 0, 0, spriteWidth, spriteHeight, 'center');

            const sprite = new Sprite(bitmap);
            sprite.anchor.x = 0.5;
            sprite.anchor.y = 1;
            sprite.x = 0;
            // ยังไม่กำหนด y ตรงนี้

            this._nameSprite = sprite;
            this.addChild(this._nameSprite);
        }
    };

    // ฟังก์ชันคำนวณตำแหน่งที่ปลอดภัย
    Sprite_Character.prototype.updateNameSpritePosition = function() {
        if (this._nameSprite) {
            let height = 48; // ค่าเริ่มต้นเผื่อรูปยังไม่มา

            // ตรวจสอบว่ามี Bitmap และโหลดเสร็จแล้วหรือยัง เพื่อกัน Error
            if (this.bitmap && this.bitmap.isReady()) {
                // ถ้ามีรูป ให้ใช้ความสูงจริง
                height = this.patternHeight();
            }

            // กำหนดตำแหน่งความสูง
            this._nameSprite.y = -height;
            
            // ซ่อนชื่อถ้าตัวละครล่องหน (Transparent)
            this._nameSprite.visible = this.visible && (!this._character.isTransparent());
        }
    };
})();