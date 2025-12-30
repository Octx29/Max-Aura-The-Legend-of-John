/*:
 * @target MZ
 * @plugindesc Improves player experience with Auto-Save, Battle Turbo, and Smooth Camera.
 * @author Jules
 * @url https://github.com/
 *
 * @help
 * ============================================================================
 * Jules_PlayerComfort
 * ============================================================================
 *
 * This plugin is designed to immediately improve the "Game Feel" and
 * quality of life for your players with zero complex setup.
 *
 * Features:
 * 1. Auto-Save: Automatically saves the game to a specific slot when
 *    moving between maps or finishing battles. Never lose progress again!
 *
 * 2. Battle Turbo: Players can hold the 'Shift' key (or 'Cancel' button)
 *    during battle to speed up the game (animations, messages, etc.).
 *    Great for grinding or replaying sections.
 *
 * 3. Smooth Camera: The camera follows the player with a slight delay/easing
 *    effect, making movement feel more fluid and cinematic compared to
 *    the standard grid-locked camera.
 *
 * ============================================================================
 * Instructions
 * ============================================================================
 * Just install the plugin and it works!
 * You can tweak the settings in the Plugin Parameters if needed.
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param --- Auto Save ---
 *
 * @param enableAutoSave
 * @parent --- Auto Save ---
 * @text Enable Auto-Save
 * @type boolean
 * @desc If true, the game will auto-save on map transfer and battle end.
 * @default true
 *
 * @param autoSaveSlot
 * @parent --- Auto Save ---
 * @text Auto-Save Slot ID
 * @type number
 * @desc The save file slot to use for auto-saves (1 is the first slot).
 * @default 1
 *
 * @param --- Battle Turbo ---
 *
 * @param enableTurbo
 * @parent --- Battle Turbo ---
 * @text Enable Battle Turbo
 * @type boolean
 * @desc If true, players can speed up battle by holding the Turbo Key.
 * @default true
 *
 * @param turboSpeed
 * @parent --- Battle Turbo ---
 * @text Turbo Speed Multiplier
 * @type number
 * @decimals 1
 * @desc How much faster the game runs when turbo is active (e.g. 2.0 = 2x speed).
 * @default 2.5
 *
 * @param --- Smooth Camera ---
 *
 * @param enableSmoothCam
 * @parent --- Smooth Camera ---
 * @text Enable Smooth Camera
 * @type boolean
 * @desc If true, the camera will follow the player smoothly.
 * @default true
 *
 * @param camSpeed
 * @parent --- Smooth Camera ---
 * @text Camera Speed
 * @type number
 * @decimals 2
 * @desc Lower is smoother/slower, Higher is snappier. (0.1 to 0.5 recommended).
 * @default 0.15
 *
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_PlayerComfort";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);

    // --- Params ---
    const ENABLE_AUTOSAVE = Parameters["enableAutoSave"] === "true";
    const AUTOSAVE_SLOT = Number(Parameters["autoSaveSlot"]) || 1;

    const ENABLE_TURBO = Parameters["enableTurbo"] === "true";
    const TURBO_SPEED = Number(Parameters["turboSpeed"]) || 2.5;

    const ENABLE_SMOOTH_CAM = Parameters["enableSmoothCam"] === "true";
    const CAM_SPEED = Number(Parameters["camSpeed"]) || 0.15;

    // ============================================================================
    // 1. Auto-Save System
    // ============================================================================

    if (ENABLE_AUTOSAVE) {
        const performAutoSave = () => {
            if (!$gameSystem.isSaveEnabled()) return;
            // Don't auto-save if an event is running to avoid locking soft-locks
            if ($gameMap.isEventRunning()) return;

            // Save to the specific slot
            DataManager.saveGame(AUTOSAVE_SLOT)
                .then(() => {
                    // Optional: visual indicator or log
                })
                .catch(() => {
                    console.warn("Auto-save failed.");
                });
        };

        // Hook into Map Transfer
        const _Scene_Map_onTransferEnd = Scene_Map.prototype.onTransferEnd;
        Scene_Map.prototype.onTransferEnd = function() {
            _Scene_Map_onTransferEnd.call(this);
            performAutoSave();
        };

        // Hook into Battle End
        const _BattleManager_processVictory = BattleManager.processVictory;
        BattleManager.processVictory = function() {
            _BattleManager_processVictory.call(this);
            $gameSystem._needsAutoSave = true;
        };

        // Check if we need to autosave after battle when back on map
        const _Scene_Map_start = Scene_Map.prototype.start;
        Scene_Map.prototype.start = function() {
            _Scene_Map_start.call(this);
            if ($gameSystem._needsAutoSave) {
                performAutoSave();
                $gameSystem._needsAutoSave = false;
            }
        };
    }

    // ============================================================================
    // 2. Battle Turbo
    // ============================================================================

    if (ENABLE_TURBO) {
        let _turboAccumulator = 0;

        const _Scene_Battle_update = Scene_Battle.prototype.update;
        Scene_Battle.prototype.update = function() {
            const isTurbo = Input.isPressed("shift") || Input.isPressed("cancel") || TouchInput.isCancelled();

            if (isTurbo) {
                // Accumulate speed to handle decimals accurately
                _turboAccumulator += TURBO_SPEED;

                const loops = Math.floor(_turboAccumulator);
                _turboAccumulator -= loops;

                for (let i = 0; i < loops; i++) {
                    _Scene_Battle_update.call(this);
                }
            } else {
                _turboAccumulator = 0;
                _Scene_Battle_update.call(this);
            }
        };
    }

    // ============================================================================
    // 3. Smooth Camera
    // ============================================================================

    if (ENABLE_SMOOTH_CAM) {
        const _Game_Player_updateScroll = Game_Player.prototype.updateScroll;
        Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
            // Check for Event-based Map Scrolling (CRITICAL FIX)
            // If the game is forcing a scroll (e.g. cutscene), do not override.
            if ($gameMap.isScrolling()) {
                 _Game_Player_updateScroll.call(this, lastScrolledX, lastScrolledY);
                 return;
            }

            // Custom Smooth Scroll Logic
            const centerX = (Graphics.width / $gameMap.tileWidth() - 1) / 2;
            const centerY = (Graphics.height / $gameMap.tileHeight() - 1) / 2;

            let targetX = this._realX - centerX;
            let targetY = this._realY - centerY;

            // Boundary checks
            const mapWidth = $gameMap.width();
            const mapHeight = $gameMap.height();
            const screenTileW = Graphics.width / $gameMap.tileWidth();
            const screenTileH = Graphics.height / $gameMap.tileHeight();

            if (!$gameMap.isLoopHorizontal()) {
                targetX = Math.max(0, Math.min(targetX, mapWidth - screenTileW));
            }
            if (!$gameMap.isLoopVertical()) {
                targetY = Math.max(0, Math.min(targetY, mapHeight - screenTileH));
            }

            // Current display pos
            const currentX = $gameMap.displayX();
            const currentY = $gameMap.displayY();

            // Distance
            let dx = targetX - currentX;
            let dy = targetY - currentY;

            // Handle Looping Maps logic (shortest distance)
            if ($gameMap.isLoopHorizontal()) {
                if (dx > mapWidth / 2) dx -= mapWidth;
                if (dx < -mapWidth / 2) dx += mapWidth;
            }
            if ($gameMap.isLoopVertical()) {
                if (dy > mapHeight / 2) dy -= mapHeight;
                if (dy < -mapHeight / 2) dy += mapHeight;
            }

            // Apply easing
            let newX = currentX + dx * CAM_SPEED;
            let newY = currentY + dy * CAM_SPEED;

            // Snap if close enough to prevent jitter
            if (Math.abs(dx) < 0.005) newX = targetX;
            if (Math.abs(dy) < 0.005) newY = targetY;

            $gameMap.setDisplayPos(newX, newY);
        };
    }

})();
