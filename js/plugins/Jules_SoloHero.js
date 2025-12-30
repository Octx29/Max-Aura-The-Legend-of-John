/*:
 * @target MZ
 * @plugindesc Mechanics designed for Single-Actor games: Stat Boosts, Guts, and Kill Sustain.
 * @author Jules
 * @url https://github.com/
 *
 * @help
 * ============================================================================
 * Jules_SoloHero
 * ============================================================================
 *
 * This plugin is designed for games where the player controls a single character,
 * or for "Last Man Standing" scenarios.
 *
 * It solves the three biggest problems in solo RPGs:
 * 1. Action Economy: You are outnumbered. (Solution: Stat Boosts).
 * 2. Instant Death: One lucky crit ends the game. (Solution: Guts).
 * 3. Sustain: Wasting turns to heal feels bad. (Solution: Bloodthirst).
 *
 * ============================================================================
 * Features
 * ============================================================================
 *
 * 1. Lone Wolf Stats:
 *    When the actor is alone (or the only one alive), their stats increase
 *    by a percentage. This helps them tank groups of enemies.
 *
 * 2. Guts / Second Wind:
 *    Once per battle, if the hero would die, they instead survive with 1 HP
 *    and a sound effect plays.
 *
 * 3. Bloodthirst:
 *    Killing an enemy recovers a percentage of HP and MP. This keeps the
 *    momentum going without stopping to drink potions constantly.
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param condition
 * @text Activation Condition
 * @type select
 * @option Party Size is 1
 * @value size
 * @option Only 1 Alive Member
 * @value alive
 * @desc When do these bonuses apply?
 * @default alive
 *
 * @param --- Stats ---
 *
 * @param atkBoost
 * @parent --- Stats ---
 * @text Attack Boost %
 * @type number
 * @desc Increase Attack by this % when solo.
 * @default 20
 *
 * @param defBoost
 * @parent --- Stats ---
 * @text Defense Boost %
 * @type number
 * @desc Increase Defense by this % when solo.
 * @default 20
 *
 * @param spdBoost
 * @parent --- Stats ---
 * @text Agility Boost %
 * @type number
 * @desc Increase Agility by this % when solo.
 * @default 10
 *
 * @param --- Survival ---
 *
 * @param enableGuts
 * @parent --- Survival ---
 * @text Enable Guts
 * @type boolean
 * @desc Prevent death once per battle?
 * @default true
 *
 * @param gutsAnimation
 * @parent --- Survival ---
 * @text Guts Animation
 * @type animation
 * @desc Animation ID to play when Guts activates.
 * @default 0
 *
 * @param --- Sustain ---
 *
 * @param killHealHp
 * @parent --- Sustain ---
 * @text Kill Heal HP %
 * @type number
 * @desc % of Max HP restored on kill.
 * @default 10
 *
 * @param killHealMp
 * @parent --- Sustain ---
 * @text Kill Heal MP %
 * @type number
 * @desc % of Max MP restored on kill.
 * @default 5
 *
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_SoloHero";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);

    const CONDITION = Parameters["condition"] || "alive";

    // Stats
    const ATK_BOOST = (Number(Parameters["atkBoost"]) || 0) / 100;
    const DEF_BOOST = (Number(Parameters["defBoost"]) || 0) / 100;
    const SPD_BOOST = (Number(Parameters["spdBoost"]) || 0) / 100;

    // Survival
    const ENABLE_GUTS = Parameters["enableGuts"] === "true";
    const GUTS_ANIMATION = Number(Parameters["gutsAnimation"]) || 0;

    // Sustain
    const KILL_HEAL_HP = (Number(Parameters["killHealHp"]) || 0) / 100;
    const KILL_HEAL_MP = (Number(Parameters["killHealMp"]) || 0) / 100;

    // Helper: Check if Solo
    const isSolo = () => {
        if (!$gameParty) return false;
        if (CONDITION === "size") {
            return $gameParty.members().length === 1;
        } else {
            return $gameParty.aliveMembers().length === 1;
        }
    };

    // ============================================================================
    // 1. Lone Wolf Stats
    // ============================================================================

    // Param IDs: 0:MHP, 1:MMP, 2:ATK, 3:DEF, 4:MAT, 5:MDF, 6:AGI, 7:LUK
    // We'll apply boosts to ATK(2), DEF(3), AGI(6).
    // You could expand this easily.

    const _Game_Actor_paramRate = Game_Actor.prototype.paramRate;
    Game_Actor.prototype.paramRate = function(paramId) {
        let rate = _Game_Actor_paramRate.call(this, paramId);

        if (isSolo() && this.isAlive()) {
            // Apply boosts
            if (paramId === 2) rate *= (1 + ATK_BOOST); // ATK
            if (paramId === 3) rate *= (1 + DEF_BOOST); // DEF
            if (paramId === 6) rate *= (1 + SPD_BOOST); // AGI

            // Optional: Apply boost to MAT(4) and MDF(5) if desired,
            // usually scaling same as ATK/DEF or separate params.
            // For simplicity, we stick to the basic physical ones requested + AGI.
        }

        return rate;
    };

    // ============================================================================
    // 2. Guts / Second Wind
    // ============================================================================

    const _Game_Battler_onBattleStart = Game_Battler.prototype.onBattleStart;
    Game_Battler.prototype.onBattleStart = function(advantageous) {
        _Game_Battler_onBattleStart.call(this, advantageous);
        this._gutsUsed = false;
    };

    // We need to intercept damage before it kills the actor.
    // Game_Battler.prototype.gainHp handles logic, but executeDamage calculates it.

    const _Game_Action_executeHpDamage = Game_Action.prototype.executeHpDamage;
    Game_Action.prototype.executeHpDamage = function(target, value) {
        if (ENABLE_GUTS && target.isActor() && isSolo()) {
            if (!target._gutsUsed && target.hp > 0 && value >= target.hp) {
                // Activate Guts
                value = target.hp - 1; // Leave 1 HP
                target._gutsUsed = true;

                // Visual feedback
                if (GUTS_ANIMATION > 0) {
                    target.startAnimation(GUTS_ANIMATION);
                }

                // Log/Message
                if (SceneManager._scene instanceof Scene_Battle) {
                     SceneManager._scene._logWindow.addText(target.name() + " endures!");
                }
            }
        }
        _Game_Action_executeHpDamage.call(this, target, value);
    };

    // ============================================================================
    // 3. Bloodthirst (Sustain on Kill)
    // ============================================================================

    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        const alreadyDead = target.isDead();
        _Game_Action_apply.call(this, target);

        // Check if we killed them
        if (!alreadyDead && target.isDead()) {
            const subject = this.subject();
            if (subject.isActor() && isSolo()) {
                this.performKillHeal(subject);
            }
        }
    };

    Game_Action.prototype.performKillHeal = function(subject) {
        let healed = false;

        if (KILL_HEAL_HP > 0) {
            const healAmount = Math.floor(subject.mhp * KILL_HEAL_HP);
            if (healAmount > 0) {
                subject.gainHp(healAmount);
                healed = true;
            }
        }

        if (KILL_HEAL_MP > 0) {
            const healAmount = Math.floor(subject.mmp * KILL_HEAL_MP);
            if (healAmount > 0) {
                subject.gainMp(healAmount);
                healed = true;
            }
        }

        if (healed) {
            subject.startDamagePopup();
            // Could add a specific animation or sound here
        }
    };

})();
