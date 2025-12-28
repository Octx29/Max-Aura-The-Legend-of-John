/*:
 * @target MZ
 * @plugindesc ระบบจัดการ Max Aura: Shield Durability
 * @author Gemini RPG
 *
 * @help
 * ต้องมีโล่ ID ตามที่ระบุใน SHIELD_EQUIP_ID
 * ต้องมี Variable ตามที่ระบุใน SHIELD_VAR_ID
 */

(() => {
    const JOHN_ACTOR_ID = 9;      // ID ของ John
    const SHIELD_VAR_ID = 2;      // ID ของ Variable ความทนทานโล่
    const SHIELD_DECAY_AMOUNT = 20; // โดนตี 1 ที ลด 20 แต้ม (100/20 = 5 ทีแตก)
    // *** แก้เลข 4 ด้านล่างให้ตรงกับ ID ของ Confidence Shield ใน Database คุณ ***
    const SHIELD_EQUIP_ID = 102;    

    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target, action) {
        _Game_Action_apply.call(this, target, action);

        if (target.isActor() && target.actorId() === JOHN_ACTOR_ID && target.result().isHit()) {
            if (target.hasArmor($dataArmors[SHIELD_EQUIP_ID])) {
                let currentDurability = $gameVariables.value(SHIELD_VAR_ID);
                if (currentDurability > 0) {
                    let newDurability = currentDurability - SHIELD_DECAY_AMOUNT;
                    if (newDurability < 0) newDurability = 0;
                    $gameVariables.setValue(SHIELD_VAR_ID, newDurability);
                    console.log("Shield Hit! Durability left: " + newDurability);

                    if (newDurability === 0) {
                        $gameMessage.add("Confidence Shield ของ John แตกสลายแล้ว!");
                        $gameActors.actor(JOHN_ACTOR_ID).changeEquip(1, null); 
                    }
                }
            }
        }
    };
})();