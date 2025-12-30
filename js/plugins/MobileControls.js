/*:
 * @target MZ
 * @plugindesc Adds on-screen touch controls (D-Pad and Buttons) for mobile devices.
 * @author Jules
 *
 * @help
 * ============================================================================
 * Jules_MobileControls
 * ============================================================================
 *
 * This plugin adds a virtual D-Pad and Action buttons to the screen.
 * It is designed for Mobile deployment but can be tested on PC.
 *
 * Features:
 * - Virtual D-Pad (Up, Down, Left, Right)
 * - 'OK' Button (Confirm / Interact)
 * - 'Cancel' Button (Menu / Back)
 * - Multi-touch support (Move and run at the same time)
 * - Procedural Graphics (No image files needed)
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param showOnPC
 * @text Show on PC?
 * @type boolean
 * @desc If true, controls appear on PC/Mac for testing. If false, only on Mobile.
 * @default true
 *
 * @param opacity
 * @text Opacity
 * @type number
 * @min 0
 * @max 255
 * @desc The transparency of the buttons (0-255).
 * @default 150
 *
 * @param padScale
 * @text Size Scale
 * @type number
 * @decimals 1
 * @desc Scale size of the controls (1.0 is default).
 * @default 1.0
 *
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_MobileControls";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);
    const SHOW_ON_PC = Parameters["showOnPC"] === "true";
    const OPACITY = Number(Parameters["opacity"]) || 150;
    const SCALE = Number(Parameters["padScale"]) || 1.0;

    // Helper to check if controls should display
    const shouldDisplay = () => {
        return Utils.isMobileDevice() || SHOW_ON_PC;
    };

    //-----------------------------------------------------------------------------
    // Input Injection
    //-----------------------------------------------------------------------------
    // We inject state directly into Input._currentState
    
    const _Input_clear = Input.clear;
    Input.clear = function() {
        _Input_clear.call(this);
        this._virtualButtonState = {};
    };

    const _Input_update = Input.update;
    Input.update = function() {
        _Input_update.call(this);
        // Merge virtual state into actual state
        for (const name in this._virtualButtonState) {
            if (this._virtualButtonState[name]) {
                this._currentState[name] = true;
            }
        }
    };

    Input.setVirtualButton = function(name, active) {
        this._virtualButtonState = this._virtualButtonState || {};
        this._virtualButtonState[name] = active;
    };

    //-----------------------------------------------------------------------------
    // Sprite_VirtualButton
    //-----------------------------------------------------------------------------
    
    class Sprite_VirtualButton extends Sprite {
        constructor(type, keyName) {
            super();
            this._type = type;       // "circle", "rect", "arrow"
            this._keyName = keyName; // "ok", "cancel", "up", "down"...
            this._isPressed = false;
            this.anchor.x = 0.5;
            this.anchor.y = 0.5;
            this.alpha = OPACITY / 255;
            this.scale.x = SCALE;
            this.scale.y = SCALE;
            this.createBitmap();
            this.setupInteractions();
        }

        createBitmap() {
            const size = 96;
            this.bitmap = new Bitmap(size, size);
            const ctx = this.bitmap.context;
            const center = size / 2;
            const color = 'rgba(255, 255, 255, 0.5)';
            const pressColor = 'rgba(200, 200, 200, 0.8)';

            // Draw based on type
            ctx.fillStyle = this._isPressed ? pressColor : color;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;

            ctx.beginPath();
            if (this._type === 'circle') {
                ctx.arc(center, center, 40, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Text
                this.bitmap.fontSize = 24;
                this.bitmap.textColor = '#000000';
                this.bitmap.drawText(this._keyName.toUpperCase(), 0, 0, size, size, 'center');
            } else if (this._type === 'arrow') {
                // Directional Arrow logic
                ctx.arc(center, center, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Draw Arrow
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let symbol = '';
                if (this._keyName === 'up') symbol = '▲';
                if (this._keyName === 'down') symbol = '▼';
                if (this._keyName === 'left') symbol = '◀';
                if (this._keyName === 'right') symbol = '▶';
                this.bitmap.fontSize = 32;
                this.bitmap.drawText(symbol, 0, 0, size, size, 'center');
            }
        }

        setupInteractions() {
            this.interactive = true;
            
            const onPress = (e) => {
                // Prevent map touch
                e.stopPropagation(); 
                this._isPressed = true;
                this.refresh();
                Input.setVirtualButton(this._keyName, true);
            };

            const onRelease = (e) => {
                this._isPressed = false;
                this.refresh();
                Input.setVirtualButton(this._keyName, false);
            };

            this.on('mousedown', onPress);
            this.on('touchstart', onPress);
            
            this.on('mouseup', onRelease);
            this.on('touchend', onRelease);
            this.on('mouseupoutside', onRelease);
            this.on('touchendoutside', onRelease);
        }

        refresh() {
            this.bitmap.clear();
            this.createBitmap();
        }
    }

    //-----------------------------------------------------------------------------
    // Sprite_VirtualPad
    //-----------------------------------------------------------------------------
    
    class Sprite_VirtualPad extends Sprite {
        constructor() {
            super();
            if (!shouldDisplay()) return;
            this.createDPad();
            this.createActionButtons();
        }

        createDPad() {
            const margin = 80 * SCALE;
            const startX = margin + 48; 
            const startY = Graphics.height - margin - 48;
            const offset = 70 * SCALE;

            this._btnUp = new Sprite_VirtualButton('arrow', 'up');
            this._btnUp.x = startX;
            this._btnUp.y = startY - offset;

            this._btnDown = new Sprite_VirtualButton('arrow', 'down');
            this._btnDown.x = startX;
            this._btnDown.y = startY + offset;

            this._btnLeft = new Sprite_VirtualButton('arrow', 'left');
            this._btnLeft.x = startX - offset;
            this._btnLeft.y = startY;

            this._btnRight = new Sprite_VirtualButton('arrow', 'right');
            this._btnRight.x = startX + offset;
            this._btnRight.y = startY;

            this.addChild(this._btnUp);
            this.addChild(this._btnDown);
            this.addChild(this._btnLeft);
            this.addChild(this._btnRight);
        }

        createActionButtons() {
            const margin = 80 * SCALE;
            const startX = Graphics.width - margin;
            const startY = Graphics.height - margin;
            const offset = 90 * SCALE;

            // OK Button (Interact)
            this._btnOk = new Sprite_VirtualButton('circle', 'ok');
            this._btnOk.x = startX;
            this._btnOk.y = startY;

            // Cancel Button (Menu)
            this._btnCancel = new Sprite_VirtualButton('circle', 'cancel');
            this._btnCancel.x = startX;
            this._btnCancel.y = startY - offset - 20;

            // Shift Button (Dash) - Optional, mapped to 'shift'
            this._btnShift = new Sprite_VirtualButton('circle', 'shift');
            this._btnShift.x = startX - offset - 20;
            this._btnShift.y = startY;

            this.addChild(this._btnOk);
            this.addChild(this._btnCancel);
            this.addChild(this._btnShift);
        }
    }

    //-----------------------------------------------------------------------------
    // Scene Integration
    //-----------------------------------------------------------------------------

    // Add to Scene_Map
    const _Scene_Map_createWindowLayer = Scene_Map.prototype.createWindowLayer;
    Scene_Map.prototype.createWindowLayer = function() {
        this._virtualPad = new Sprite_VirtualPad();
        this.addChild(this._virtualPad);
        _Scene_Map_createWindowLayer.call(this);
    };

    // Add to Scene_Battle
    const _Scene_Battle_createWindowLayer = Scene_Battle.prototype.createWindowLayer;
    Scene_Battle.prototype.createWindowLayer = function() {
        this._virtualPad = new Sprite_VirtualPad();
        this.addChild(this._virtualPad);
        _Scene_Battle_createWindowLayer.call(this);
    };

    // Disable standard Touch-to-Move if pressing a button
    const _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function() {
        if (Input._virtualButtonState && Object.values(Input._virtualButtonState).some(v => v)) {
            return;
        }
        _Scene_Map_processMapTouch.call(this);
    };

})();