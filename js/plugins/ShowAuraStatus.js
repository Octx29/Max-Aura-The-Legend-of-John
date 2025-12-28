/*:
 * @target MZ
 * @plugindesc แสดงค่า Aura (Variable 1) ในหน้า Status
 * @help
 * แค่ลง Plugin นี้ ค่า Aura จะไปโผล่ในหน้า Status ต่อจากค่า Luck ทันที
 */

(() => {
    // สั่งให้หน้าจอมี 7 บรรทัด (จากเดิม 6)
    Window_StatusParams.prototype.maxItems = function() {
        return 7;
    };

    // สั่งวาดข้อความ
    const _Window_StatusParams_drawItem = Window_StatusParams.prototype.drawItem;
    Window_StatusParams.prototype.drawItem = function(index) {
        if (index < 6) {
            // ถ้าเป็น 6 บรรทัดแรก (Atk-Luck) ให้วาดตามปกติ
            _Window_StatusParams_drawItem.call(this, index);
        } else {
            // บรรทัดที่ 7 ให้วาด Aura
            const rect = this.itemLineRect(index);
            const paramName = "Aura";     // อยากให้ขึ้นชื่อว่าอะไร แก้ในวงเล็บนี้
            const paramValue = $gameVariables.value(1); // ดึงค่าจากตัวแปร 1
            
            // วาดชื่อ (สีฟ้า)
            this.changeTextColor(this.systemColor());
            this.drawText(paramName, rect.x, rect.y, 160);
            
            // วาดตัวเลข (สีขาว)
            this.resetTextColor();
            this.drawText(paramValue, rect.x + 160, rect.y, 60, 'right');
        }
    };
})();