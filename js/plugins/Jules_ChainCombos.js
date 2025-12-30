/*:
 * @target MZ
 * @plugindesc Adds a Combo/Chain system to battles. High chains increase damage!
 * @author Jules
 * @url https://github.com/
 *
 * @help
 * ============================================================================
 * Jules_ChainCombos
 * ============================================================================
 *
 * This plugin adds a dynamic "Chain Combo" system to your battles, inspired by
 * fighting games and action RPGs.
 *
 * How it works:
 * 1. Every time you hit an enemy, the CHAIN counter increases.
 * 2. Multi-hit skills add to the chain for every hit.
 * 3. The higher the chain, the more DAMAGE your party deals!
 * 4. If a party member takes damage, the chain "Breaks" (resets or halves).
 *
 * This simple loop encourages players to keep the momentum going and play
 * aggressively while managing defense to protect their combo.
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param damageBonus
 * @text Damage Bonus %
 * @type number
 * @desc Percentage of extra damage per chain count. (e.g. 5 means +5% damage per hit).
 * @default 5
 *
 * @param maxChain
 * @text Max Chain Cap
 * @type number
 * @desc The maximum number the chain can reach.
 * @default 99
 *
 * @param breakRule
 * @text Chain Break Rule
 * @type select
 * @option Reset to 0
 * @value reset
 * @option Cut in Half
 * @value half
 * @option Decrease by Fixed Amount
 * @value fixed
 * @desc What happens when a player takes damage?
 * @default reset
 *
 * @param breakAmount
 * @text Break Amount
 * @parent breakRule
 * @type number
 * @desc Only used if Break Rule is "Decrease by Fixed Amount".
 * @default 10
 *
 * @param showGauge
 * @text Show Chain Gauge
 * @type boolean
 * @desc Toggle the visual chain indicator.
 * @default true
 *
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_ChainCombos";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);

    const DAMAGE_BONUS = Number(Parameters["damageBonus"]) || 5;
    const MAX_CHAIN = Number(Parameters["maxChain"]) || 99;
    const BREAK_RULE = Parameters["breakRule"] || "reset";
    const BREAK_AMOUNT = Number(Parameters["breakAmount"]) || 10;
    const SHOW_GAUGE = Parameters["showGauge"] === "true";

    // ============================================================================
    // BattleManager: Manage Chain State
    // ============================================================================

    const _BattleManager_initMembers = BattleManager.initMembers;
    BattleManager.initMembers = function() {
        _BattleManager_initMembers.call(this);
        this._chainCount = 0;
    };

    BattleManager.getChain = function() {
        return this._chainCount || 0;
    };

    BattleManager.addChain = function(amount) {
        this._chainCount = (this._chainCount || 0) + amount;
        if (this._chainCount > MAX_CHAIN) this._chainCount = MAX_CHAIN;
        this.refreshChainGauge();
    };

    BattleManager.breakChain = function() {
        if (!this._chainCount) return;

        // Visual Feedback (Flash screen slightly red?)
        // $gameScreen.startFlash([255, 0, 0, 128], 8);

        switch (BREAK_RULE) {
            case "half":
                this._chainCount = Math.floor(this._chainCount / 2);
                break;
            case "fixed":
                this._chainCount = Math.max(0, this._chainCount - BREAK_AMOUNT);
                break;
            case "reset":
            default:
                this._chainCount = 0;
                break;
        }
        this.refreshChainGauge();
    };

    BattleManager.refreshChainGauge = function() {
        if (SceneManager._scene instanceof Scene_Battle && SceneManager._scene._chainWindow) {
            SceneManager._scene._chainWindow.refresh();
        }
    };

    // ============================================================================
    // Game_Action: Apply Chain Logic
    // ============================================================================

    // 1. Increase Chain on Hit
    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        _Game_Action_apply.call(this, target);

        // Logic:
        // If user is Actor and target is Enemy -> Increase Chain
        // If user is Enemy and target is Actor -> Break Chain (if damage > 0)

        const result = target.result();
        if (result.isHit()) {
            if (this.subject().isActor() && target.isEnemy()) {
                // If damage was dealt (hp or mp)
                if (result.hpDamage > 0 || result.mpDamage > 0) {
                    BattleManager.addChain(1);
                }
            } else if (this.subject().isEnemy() && target.isActor()) {
                if (result.hpDamage > 0) {
                    BattleManager.breakChain();
                }
            }
        }
    };

    // 2. Apply Damage Bonus
    const _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
    Game_Action.prototype.makeDamageValue = function(target, critical) {
        let value = _Game_Action_makeDamageValue.call(this, target, critical);

        // Only apply bonus if Actor is attacking Enemy
        if (this.subject().isActor() && target.isEnemy()) {
            const chain = BattleManager.getChain();
            if (chain > 0) {
                const multiplier = 1 + (chain * (DAMAGE_BONUS / 100));
                value = Math.floor(value * multiplier);
            }
        }

        return value;
    };

    // ============================================================================
    // UI: Chain Gauge Window
    // ============================================================================

    class Window_ChainGauge extends Window_Base {
        constructor(rect) {
            super(rect);
            this.opacity = 0; // Transparent background
            this._currentChain = 0;
            this.refresh();
        }

        refresh() {
            this.contents.clear();
            const chain = BattleManager.getChain();

            if (chain <= 0) {
                this.visible = false;
                return;
            }

            this.visible = true;
            this._currentChain = chain;

            const width = this.contentsWidth();
            const fontSize = 36;

            this.contents.fontSize = fontSize;
            this.changeTextColor(ColorManager.crisisColor()); // Orange/Yellowish
            this.drawText(chain + " HITS!", 0, 0, width, "right");

            this.contents.fontSize = 20;
            this.changeTextColor(ColorManager.normalColor());
            const bonus = Math.floor(chain * DAMAGE_BONUS);
            this.drawText("DMG +" + bonus + "%", 0, 40, width, "right");
        }
    }

    // ============================================================================
    // Scene_Battle: Add UI
    // ============================================================================

    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        if (SHOW_GAUGE) {
            this.createChainWindow();
        }
    };

    Scene_Battle.prototype.createChainWindow = function() {
        const ww = 240;
        const wh = 120;
        const wx = Graphics.boxWidth - ww;
        const wy = this.buttonAreaTop ? this.buttonAreaTop() - wh : 0; // Try to place above buttons

        // If buttonAreaTop doesn't exist (older MZ versions?), default to top right or somewhere visible
        const finalY = (typeof this.buttonAreaTop === 'function') ? this.buttonAreaTop() - wh : 60;

        const rect = new Rectangle(wx, finalY, ww, wh);
        this._chainWindow = new Window_ChainGauge(rect);
        this.addWindow(this._chainWindow);
    };

})();
