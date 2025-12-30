/*:
 * @target MZ
 * @plugindesc Adds a robust Achievement System with visual popups and a dedicated menu scene.
 * @author Jules
 * @url https://github.com/
 *
 * @help
 * ============================================================================
 * Jules_AchievementSystem
 * ============================================================================
 *
 * This plugin adds a global achievement system to your game.
 * Achievements are saved in the global configuration, meaning they persist
 * across new games and different save files.
 *
 * Features:
 * - Define achievements via Plugin Parameters.
 * - Global saving (achievements persist across save files).
 * - Visual popup when an achievement is unlocked.
 * - Dedicated Achievement Menu.
 *
 * ============================================================================
 * Plugin Commands
 * ============================================================================
 *
 * Command: Unlock Achievement
 *   - Id: The ID of the achievement to unlock (as defined in parameters).
 *
 * Command: Remove Achievement
 *   - Id: The ID of the achievement to lock again (for debugging).
 *
 * Command: Clear All Achievements
 *   - Resets all global achievement progress.
 *
 * ============================================================================
 * Script Calls
 * ============================================================================
 *
 * AchievementManager.unlock(id);
 * AchievementManager.isUnlocked(id);
 * SceneManager.push(Scene_Achievements); // Open the menu manually
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param achievements
 * @text Achievements List
 * @type struct<Achievement>[]
 * @desc Define your achievements here.
 * @default []
 *
 * @param popupDuration
 * @text Popup Duration
 * @type number
 * @desc How long (in frames) the popup stays on screen.
 * @default 180
 *
 * @param menuName
 * @text Menu Command Name
 * @type string
 * @desc The name displayed in the main menu.
 * @default Achievements
 *
 * @param menuSwitch
 * @text Menu Switch ID
 * @type switch
 * @desc If set, the menu command only appears when this switch is ON. 0 = Always visible.
 * @default 0
 *
 * @param unlockSound
 * @text Unlock Sound
 * @type struct<Audio>
 * @desc Sound effect to play when unlocking an achievement.
 * @default {"name":"Recovery","volume":"90","pitch":"100","pan":"0"}
 *
 * @command unlock
 * @text Unlock Achievement
 * @desc Unlocks a specific achievement.
 * @arg id
 * @text Achievement ID
 * @type string
 * @desc The Unique ID of the achievement.
 *
 * @command remove
 * @text Remove Achievement
 * @desc Locks an achievement again.
 * @arg id
 * @text Achievement ID
 * @type string
 * @desc The Unique ID of the achievement.
 *
 * @command clear
 * @text Clear All
 * @desc Resets all achievements.
 *
 */
/*~struct~Achievement:
 * @param id
 * @text ID
 * @type string
 * @desc Unique identifier for this achievement (e.g., "kill_dragon").
 *
 * @param name
 * @text Name
 * @type string
 * @desc Display name of the achievement.
 *
 * @param description
 * @text Description
 * @type string
 * @desc Description shown in the menu.
 *
 * @param iconIndex
 * @text Icon Index
 * @type number
 * @desc The icon index to display.
 * @default 0
 *
 * @param hidden
 * @text Secret?
 * @type boolean
 * @desc If true, details are hidden in the menu until unlocked.
 * @default false
 */
/*~struct~Audio:
 * @param name
 * @text Filename
 * @type file
 * @dir audio/se/
 * @desc Sound effect file.
 * @default Recovery
 *
 * @param volume
 * @text Volume
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param pitch
 * @text Pitch
 * @type number
 * @min 50
 * @max 150
 * @default 100
 *
 * @param pan
 * @text Pan
 * @type number
 * @min -100
 * @max 100
 * @default 0
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_AchievementSystem";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);

    // Parse Parameters
    const parseStructArray = (json) => {
        if (!json) return [];
        try {
            return JSON.parse(json).map(str => JSON.parse(str));
        } catch (e) {
            console.error("Error parsing achievements:", e);
            return [];
        }
    };

    const parseAudio = (json) => {
        if (!json) return { name: "Recovery", volume: 90, pitch: 100, pan: 0 };
        try {
            const data = JSON.parse(json);
            return {
                name: data.name || "Recovery",
                volume: Number(data.volume) || 90,
                pitch: Number(data.pitch) || 100,
                pan: Number(data.pan) || 0
            };
        } catch (e) {
            return { name: "Recovery", volume: 90, pitch: 100, pan: 0 };
        }
    };

    const ACHIEVEMENT_LIST = parseStructArray(Parameters["achievements"]);
    const POPUP_DURATION = Number(Parameters["popupDuration"]) || 180;
    const MENU_NAME = Parameters["menuName"] || "Achievements";
    const MENU_SWITCH = Number(Parameters["menuSwitch"]) || 0;
    const UNLOCK_SOUND = parseAudio(Parameters["unlockSound"]);

    //-----------------------------------------------------------------------------
    // AchievementManager
    //-----------------------------------------------------------------------------

    class AchievementManager {
        static init() {
            this._unlockedMap = {}; // id: boolean
            this._queue = []; // Queue for popups
        }

        static getAchievement(id) {
            return ACHIEVEMENT_LIST.find(a => a.id === id);
        }

        static getAll() {
            return ACHIEVEMENT_LIST;
        }

        static isUnlocked(id) {
            return !!this._unlockedMap[id];
        }

        static unlock(id) {
            const achievement = this.getAchievement(id);
            if (!achievement) {
                console.warn(`Achievement ID '${id}' not found.`);
                return;
            }

            if (this.isUnlocked(id)) return;

            this._unlockedMap[id] = true;
            this.playUnlockSound();
            this.showPopup(achievement);
            ConfigManager.save();
        }

        static lock(id) {
            if (this._unlockedMap[id]) {
                delete this._unlockedMap[id];
                ConfigManager.save();
            }
        }

        static clearAll() {
            this._unlockedMap = {};
            ConfigManager.save();
        }

        static playUnlockSound() {
            if (UNLOCK_SOUND && UNLOCK_SOUND.name) {
                AudioManager.playSe(UNLOCK_SOUND);
            }
        }

        static showPopup(achievement) {
            // Add to queue for Scene_Map to process
            this._queue.push(achievement);
        }

        static popPopup() {
            return this._queue.shift();
        }

        // --- Data Persistence (via ConfigManager) ---

        static makeData() {
            return {
                unlocked: this._unlockedMap
            };
        }

        static applyData(data) {
            this._unlockedMap = data.unlocked || {};
        }
    }

    AchievementManager.init();

    // Expose Globally
    window.AchievementManager = AchievementManager;

    //-----------------------------------------------------------------------------
    // ConfigManager (Aliasing)
    //-----------------------------------------------------------------------------

    const _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function() {
        const config = _ConfigManager_makeData.call(this);
        config.achievements = AchievementManager.makeData();
        return config;
    };

    const _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function(config) {
        _ConfigManager_applyData.call(this, config);
        if (config.achievements) {
            AchievementManager.applyData(config.achievements);
        }
    };

    //-----------------------------------------------------------------------------
    // Plugin Commands
    //-----------------------------------------------------------------------------

    PluginManager.registerCommand(PLUGIN_NAME, "unlock", args => {
        AchievementManager.unlock(args.id);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "remove", args => {
        AchievementManager.lock(args.id);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "clear", () => {
        AchievementManager.clearAll();
    });

    //-----------------------------------------------------------------------------
    // Window_AchievementPopup
    //-----------------------------------------------------------------------------

    class Window_AchievementPopup extends Window_Base {
        constructor(rect) {
            super(rect);
            this.opacity = 0;
            this.contentsOpacity = 0;
            this._duration = 0;
            this._achievement = null;
        }

        setup(achievement) {
            this._achievement = achievement;
            this._duration = POPUP_DURATION;
            this.refresh();
            this.y = -this.height; // Start off screen
            this.contentsOpacity = 255;
            this.opacity = 255;
        }

        update() {
            super.update();
            if (this._duration > 0) {
                this._duration--;
                if (this.y < 10) {
                    this.y += 4; // Slide down
                }
                if (this._duration < 30) {
                    this.contentsOpacity -= 8;
                    this.opacity -= 8;
                }
            } else {
                if (this._achievement) {
                    this._achievement = null;
                    this.visible = false;
                }
            }
        }

        refresh() {
            this.contents.clear();
            if (!this._achievement) return;

            const iconIndex = Number(this._achievement.iconIndex) || 0;
            const name = this._achievement.name;

            this.visible = true;
            this.drawBackground();
            this.drawIcon(iconIndex, 10, 10);
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("Achievement Unlocked!", 50, 0, this.innerWidth - 50, "left");
            this.changeTextColor(ColorManager.normalColor());
            this.drawText(name, 50, 32, this.innerWidth - 50, "left");
        }

        drawBackground() {
            const color1 = ColorManager.dimColor1();
            const color2 = ColorManager.dimColor2();
            this.contents.fillRect(0, 0, this.innerWidth, this.innerHeight, color1);
            this.contents.gradientFillRect(0, 0, this.innerWidth / 2, this.innerHeight, color2, color1, true);
        }
    }

    //-----------------------------------------------------------------------------
    // Scene_Map (Aliasing for Popup)
    //-----------------------------------------------------------------------------

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this.createAchievementPopup();
    };

    Scene_Map.prototype.createAchievementPopup = function() {
        const rect = new Rectangle(
            (Graphics.boxWidth - 400) / 2,
            0,
            400,
            100 // Height
        );
        this._achievementPopup = new Window_AchievementPopup(rect);
        this.addWindow(this._achievementPopup);
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        this.updateAchievementPopup();
    };

    Scene_Map.prototype.updateAchievementPopup = function() {
        if (this._achievementPopup && this._achievementPopup._duration <= 0) {
            const next = AchievementManager.popPopup();
            if (next) {
                this._achievementPopup.setup(next);
            }
        }
    };

    //-----------------------------------------------------------------------------
    // Scene_Achievements
    //-----------------------------------------------------------------------------

    class Scene_Achievements extends Scene_MenuBase {
        create() {
            super.create();
            this.createHelpWindow();
            this.createListWindow();
        }

        createListWindow() {
            const rect = this.listWindowRect();
            this._listWindow = new Window_AchievementList(rect);
            this._listWindow.setHandler("cancel", this.popScene.bind(this));
            this._listWindow.setHelpWindow(this._helpWindow);
            this.addWindow(this._listWindow);
            this._listWindow.activate();
            this._listWindow.select(0);
        }

        listWindowRect() {
            const wx = 0;
            const wy = this.mainAreaTop();
            const ww = Graphics.boxWidth;
            const wh = this.mainAreaHeight();
            return new Rectangle(wx, wy, ww, wh);
        }
    }

    // Expose Globally
    window.Scene_Achievements = Scene_Achievements;

    //-----------------------------------------------------------------------------
    // Window_AchievementList
    //-----------------------------------------------------------------------------

    class Window_AchievementList extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this.refresh();
        }

        maxItems() {
            return ACHIEVEMENT_LIST.length;
        }

        itemHeight() {
            return Window_Base.prototype.itemHeight.call(this) * 2;
        }

        drawItem(index) {
            const achievement = ACHIEVEMENT_LIST[index];
            const unlocked = AchievementManager.isUnlocked(achievement.id);
            const rect = this.itemRect(index);

            this.changePaintOpacity(unlocked);

            const iconIndex = unlocked ? (Number(achievement.iconIndex) || 0) : 0;
            this.drawIcon(iconIndex, rect.x + 10, rect.y + (rect.height - ImageManager.iconHeight) / 2);

            const x = rect.x + 50;
            const w = rect.width - 50;

            // Handle "Hidden" logic safely
            const isHidden = JSON.parse(achievement.hidden || "false");

            if (unlocked || !isHidden) {
                this.changeTextColor(ColorManager.systemColor());
                this.drawText(achievement.name, x, rect.y, w, "left");
                this.changeTextColor(ColorManager.normalColor());
                this.drawTextEx(achievement.description, x, rect.y + this.lineHeight());
            } else {
                this.changeTextColor(ColorManager.systemColor());
                this.drawText("??????", x, rect.y, w, "left");
                this.changeTextColor(ColorManager.normalColor());
                this.drawText("Locked Achievement", x, rect.y + this.lineHeight(), w, "left");
            }
            this.changePaintOpacity(true);
        }

        updateHelp() {
            const index = this.index();
            const achievement = ACHIEVEMENT_LIST[index];
            if (!achievement) return;

            const unlocked = AchievementManager.isUnlocked(achievement.id);
            if (unlocked) {
                 this._helpWindow.setText("Unlocked!");
            } else {
                 this._helpWindow.setText("Locked");
            }
        }
    }

    //-----------------------------------------------------------------------------
    // Main Menu Integration
    //-----------------------------------------------------------------------------

    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        const needsSwitch = MENU_SWITCH > 0;
        if (!needsSwitch || $gameSwitches.value(MENU_SWITCH)) {
            this.addCommand(MENU_NAME, "achievements", true);
        }
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler("achievements", this.commandAchievements.bind(this));
    };

    Scene_Menu.prototype.commandAchievements = function() {
        SceneManager.push(Scene_Achievements);
    };

})();
