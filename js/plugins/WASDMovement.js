/*:
 * @target MZ
 * @plugindesc Enables WASD keys for player movement and menu navigation.
 * @author Jules
 *
 * @help
 * ============================================================================
 * Jules_WASDMovement
 * ============================================================================
 *
 * This plugin simply remaps the keyboard inputs to allow WASD movement.
 *
 * Mappings:
 * W -> Up
 * A -> Left
 * S -> Down
 * D -> Right
 *
 * Note: By default in RPG Maker MZ, 'W' is mapped to "Page Down" (next actor).
 * This plugin overwrites that so 'W' moves the character Up.
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param disableArrows
 * @text Disable Arrow Keys?
 * @type boolean
 * @desc If true, the original Arrow Keys (Up/Down/Left/Right) will no longer work.
 * @default false
 *
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_WASDMovement";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);
    const DISABLE_ARROWS = (Parameters["disableArrows"] === "true");

    //-----------------------------------------------------------------------------
    // Input Mappings
    //-----------------------------------------------------------------------------

    // 1. Map WASD to directional strings
    Input.keyMapper[87] = 'up';    // W (was pagedown)
    Input.keyMapper[65] = 'left';  // A
    Input.keyMapper[83] = 'down';  // S
    Input.keyMapper[68] = 'right'; // D

    // 2. Optional: Disable original Arrow Keys if parameter is true
    if (DISABLE_ARROWS) {
        delete Input.keyMapper[37]; // Left Arrow
        delete Input.keyMapper[38]; // Up Arrow
        delete Input.keyMapper[39]; // Right Arrow
        delete Input.keyMapper[40]; // Down Arrow
    }

})();