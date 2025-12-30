/*:
 * @target MZ
 * @plugindesc Gives a specific skill to John (or any actor) when a New Game starts.
 * @author Jules
 * @url https://github.com/
 *
 * @help
 * ============================================================================
 * Jules_JohnStartSkill
 * ============================================================================
 *
 * This plugin ensures that "John" (or whichever actor you configure) starts
 * the game with a specific skill learned, regardless of their class/level.
 *
 * It runs once when a New Game is created.
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param actorId
 * @text Actor ID
 * @type actor
 * @desc The ID of the actor to receive the skill. (John is usually ID 1).
 * @default 1
 *
 * @param skillId
 * @text Skill ID
 * @type skill
 * @desc The ID of the skill to learn. (Default: 52 - Heal I).
 * @default 52
 *
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_JohnStartSkill";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);

    const ACTOR_ID = Number(Parameters["actorId"]) || 1;
    const SKILL_ID = Number(Parameters["skillId"]) || 52;

    // Hook into New Game setup
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        _DataManager_setupNewGame.call(this);

        const actor = $gameActors.actor(ACTOR_ID);
        if (actor) {
            actor.learnSkill(SKILL_ID);
            console.log(`${PLUGIN_NAME}: Actor ${ACTOR_ID} learned Skill ${SKILL_ID} on start.`);
        }
    };

})();
