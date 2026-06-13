/*:
 * @target MZ
 * @plugindesc [v9.1 Fixed] Just Guard: Fixed 0 Dmg & Tuned Speed (x1.2 Slower)
 * @author Plugin Maker
 * @help
 * ----------------------------------------------------------------------------
 * MaxAura_JustGuard.js [v9.1 Fixed]
 * ----------------------------------------------------------------------------
 * Patch Notes:
 * 1. Fixed Damage Issue: Player now takes TRUE 0 damage on Perfect Parry.
 * 2. Speed Adjustment: Overall animation speed is 1.2x slower (easier/fairer).
 *
 * Details:
 * - System generates random speed between Min and Max frames.
 * - Multiplier x1.2 is applied to the final result to slow it down.
 * - Perfect Parry = 0 Damage + Stun Enemy + Visual FX.
 *
 * ----------------------------------------------------------------------------
 * @param --- Game Settings ---
 * @param StunStateId
 * @text ID Status Stun
 * @desc ID of the state to apply to the enemy on perfect guard. (Default: 13)
 * @type state
 * @default 13
 *
 * @param MinDuration
 * @text Max Speed (Frames)
 * @desc The fastest the ring can shrink (Base value). 1 Frame = Extremely fast.
 * @type number
 * @default 1
 *
 * @param MaxDuration
 * @text Min Speed (Frames)
 * @desc The slowest the ring can shrink (Base value). 60 Frames = 1 Second.
 * @type number
 * @default 60
 *
 * @param --- Visual Button ---
 * @param PromptX
 * @text Button X Position
 * @desc Center X = 640
 * @type number
 * @default 640
 *
 * @param PromptY
 * @text Button Y Position
 * @desc Center Y = 360 (or 320)
 * @type number
 * @default 320
 *
 * @param --- Audio & FX ---
 * @param ParrySound
 * @text Perfect Parry Sound
 * @type file
 * @dir audio/se
 * @default Sword2
 *
 * @param FailSound
 * @text Fail Sound
 * @type file
 * @dir audio/se
 * @default Buzzer1
 */

(() => {
    "use strict";

    const pluginName = "MaxAura_JustGuard";
    const parameters = PluginManager.parameters(pluginName);

    // Config Setup
    const config = {
        stunStateId: Number(parameters['StunStateId'] || 13),
        promptX: Number(parameters['PromptX'] || 640),
        promptY: Number(parameters['PromptY'] || 320),
        minDur: Math.max(1, Number(parameters['MinDuration'] || 1)), 
        maxDur: Number(parameters['MaxDuration'] || 60),
        parrySe: String(parameters['ParrySound'] || 'Sword2'),
        failSe: String(parameters['FailSound'] || 'Buzzer1')
    };

    Input.keyMapper[70] = 'just_guard'; // F Key

    // --- Global State ---
    const _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function() {
        _Game_Temp_initialize.call(this);
        this.clearJustGuardState();
    };

    Game_Temp.prototype.clearJustGuardState = function() {
        this._jgActive = false;
        this._jgTimer = 0;
        this._jgMaxDuration = 0; 
        this._jgResult = null; 
        this._jgVisualRequest = null; 
    };

    // ------------------------------------------------------------------------
    // 1. Visual System: Rotating & Shrinking
    // ------------------------------------------------------------------------
    
    class Sprite_JustGuardRing extends Sprite {
        initialize() {
            super.initialize();
            this.anchor.set(0.5, 0.5);
            this.createBitmap();
            this.visible = false;
            this._rotationSpeed = 0;
        }

        createBitmap() {
            const size = 220;
            this.bitmap = new Bitmap(size, size);
            const ctx = this.bitmap.context;
            const center = size / 2;
            const radius = 90;

            // Enable glow effect in canvas 2d context
            ctx.shadowColor = "rgba(165, 180, 252, 0.85)";
            ctx.shadowBlur = 8;
            
            // Draw main dashed arc
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#e0e7ff';
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, 1.5 * Math.PI);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(center, center, radius, 1.65 * Math.PI, 1.9 * Math.PI);
            ctx.stroke();
            
            // Draw a subtle inner target ring in gold to make it clear where the target is
            ctx.shadowColor = "rgba(253, 224, 71, 0.6)";
            ctx.shadowBlur = 6;
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(center, center, 32, 0, 2 * Math.PI);
            ctx.stroke();
        }

        updateRing(progress, color) {
            // Scale Calculation
            const startScale = 1.6;
            const targetScale = 0.355; 
            const currentScale = targetScale + ((startScale - targetScale) * progress);
            this.scale.set(currentScale, currentScale);
            
            // Rotation based on progress
            this.rotation += 0.2 + (1.0 - progress) * 0.3;

            // Opacity Logic
            // If very fast, don't fade out completely
            if ($gameTemp._jgMaxDuration > 10 && progress < 0.15) {
                this.opacity = 180; 
            } else {
                this.opacity = 255;
            }
            
            // Color Logic
            if (color === 'green') this.setBlendColor([0, 255, 100, 255]);
            else if (color === 'red') this.setBlendColor([255, 50, 50, 255]);
            else this.setBlendColor([0, 0, 0, 0]); 
        }
    }

    class Sprite_JustGuardPrompt extends Sprite {
        initialize() {
            super.initialize();
            this.x = config.promptX;
            this.y = config.promptY;
            this.anchor.set(0.5, 0.5);
            this.createBitmap();
            this.visible = false;
            
            this._ring = new Sprite_JustGuardRing();
            this.addChild(this._ring);
            
            // Parry Floating Text Sprite
            this._parryText = new Sprite();
            this._parryText.anchor.set(0.5, 0.5);
            this._parryText.y = -70;
            this._parryText.visible = false;
            this.addChild(this._parryText);

            this._feedbackTime = 0;
        }

        createBitmap() {
            const size = 64; 
            this.bitmap = new Bitmap(size, size);
            const ctx = this.bitmap.context;
            const center = size / 2;
            const radius = 30; 

            // BG
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(15, 10, 36, 0.75)'; 
            ctx.fill();
            
            // Border
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#a5b4fc';
            ctx.stroke();

            // Text F
            this.bitmap.fontSize = 32;
            this.bitmap.fontFace = "Outfit, sans-serif";
            this.bitmap.fontBold = true;
            this.bitmap.textColor = "#ffffff";
            this.bitmap.drawText("F", 0, 0, size, size, "center");
        }

        createParryTextBitmap() {
            const bitmap = new Bitmap(180, 48);
            bitmap.fontSize = 28;
            bitmap.fontFace = "Cinzel, serif";
            bitmap.fontBold = true;
            bitmap.textColor = "#fbbf24"; // Amber gold
            bitmap.outlineColor = "rgba(0, 0, 0, 0.85)";
            bitmap.outlineWidth = 6;
            bitmap.drawText("PARRY!", 0, 0, 180, 48, "center");
            this._parryText.bitmap = bitmap;
        }

        update() {
            super.update();
            this.updateState();
            this.updateParryTextAnimation();
        }

        updateParryTextAnimation() {
            if (this._parryText.visible) {
                this._parryText.y -= 1.2;
                this._parryText.opacity -= 6;
                if (this._parryText.opacity <= 0) {
                    this._parryText.visible = false;
                }
            }
        }

        updateState() {
            const request = $gameTemp._jgVisualRequest;
            
            if (request === 'start') {
                this.startAnimation();
                $gameTemp._jgVisualRequest = null;
            } else if (request === 'success') {
                this.showFeedback('green');
                $gameTemp._jgVisualRequest = null;
            } else if (request === 'fail') {
                this.showFeedback('red');
                $gameTemp._jgVisualRequest = null;
            }

            if (this._feedbackTime > 0) {
                this._feedbackTime--;
                if (this._feedbackTime <= 0) {
                    this.visible = false;
                }
            } else if ($gameTemp._jgActive) {
                const max = $gameTemp._jgMaxDuration;
                const current = $gameTemp._jgTimer;
                const progress = Math.max(0, current / max);
                
                this._ring.updateRing(progress, 'white');
            } else {
                if (!this._parryText.visible) {
                    this.visible = false;
                }
            }
        }

        startAnimation() {
            this.visible = true;
            this.opacity = 255;
            this.scale.set(1, 1);
            this._ring.visible = true;
            this._ring.rotation = Math.random() * Math.PI; 
            this._ring.setBlendColor([0,0,0,0]);
            this._parryText.visible = false;
            this._feedbackTime = 0;
        }

        showFeedback(color) {
            this._ring.updateRing(0, color);
            this._ring.opacity = 255; 
            
            if (color === 'green') {
                this.scale.set(1.3, 1.3);
                this._parryText.y = -70;
                this._parryText.opacity = 255;
                this._parryText.visible = true;
                this.createParryTextBitmap();
            } else {
                this.scale.set(0.9, 0.9);
                this._parryText.visible = false;
            }
            this._feedbackTime = 30; 
        }
    }

    const _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
    Scene_Battle.prototype.createSpriteset = function() {
        _Scene_Battle_createSpriteset.call(this);
        this._justGuardSprite = new Sprite_JustGuardPrompt();
        this.addChild(this._justGuardSprite);
    };

    // ------------------------------------------------------------------------
    // 2. Logic: Randomized Timing (Extreme Range)
    // ------------------------------------------------------------------------

    const _Window_BattleLog_updateWaitMode = Window_BattleLog.prototype.updateWaitMode;
    Window_BattleLog.prototype.updateWaitMode = function() {
        if (this._waitMode === 'justGuard') {
            if ($gameTemp._jgActive) return true;
            this._waitMode = '';
            return false;
        }
        return _Window_BattleLog_updateWaitMode.call(this);
    };

    const _Window_BattleLog_startAction = Window_BattleLog.prototype.startAction;
    Window_BattleLog.prototype.startAction = function(subject, action, targets) {
        _Window_BattleLog_startAction.call(this, subject, action, targets);
        
        if (subject.isEnemy() && targets.some(t => t.isActor()) && (action.isPhysical() || action.isMagical())) {
            
            $gameTemp.clearJustGuardState();
            
            // --- EXTREME RANDOMIZER (TUNED) ---
            // 1. Calculate random Base duration
            let randomDur = Math.floor(Math.random() * (config.maxDur - config.minDur + 1)) + config.minDur;
            
            // 2. TUNE SPEED: Slow down by 20% (x1.2) as requested
            randomDur = Math.floor(randomDur * 1.2); 

            $gameTemp._jgActive = true;
            $gameTemp._jgMaxDuration = randomDur;
            $gameTemp._jgTimer = randomDur;
            $gameTemp._jgVisualRequest = 'start';
            
            this._waitMode = 'justGuard';
        }
    };

    const _BattleManager_update = BattleManager.update;
    BattleManager.update = function() {
        _BattleManager_update.call(this);
        this.updateJustGuardLogic();
    };

    BattleManager.updateJustGuardLogic = function() {
        if ($gameTemp._jgActive) {
            $gameTemp._jgTimer--;
            
            // Check Input
            if (Input.isTriggered('just_guard')) {
                this.processJustGuardInput();
            }

            // Timeout
            // If super fast, allow slightly more negative frames (grace period)
            const gracePeriod = ($gameTemp._jgMaxDuration < 6) ? -10 : -5;

            if ($gameTemp._jgTimer <= gracePeriod) { 
                $gameTemp._jgActive = false;
                $gameTemp._jgResult = 'miss';
                $gameTemp._jgVisualRequest = 'fail'; 
                AudioManager.playSe({ name: config.failSe, volume: 80, pitch: 100, pan: 0 });
            }
        }
    };

    BattleManager.processJustGuardInput = function() {
        const timer = $gameTemp._jgTimer;
        
        // Window Adjustment
        // Fast Ring = Easier Window (+/- 6)
        // Slow Ring = Strict Window (+/- 4)
        const isSuperFast = $gameTemp._jgMaxDuration <= 12;
        const perfectWindow = isSuperFast ? 6 : 4;
        
        if (Math.abs(timer) <= perfectWindow) {
            // --- PERFECT ---
            $gameTemp._jgResult = 'perfect';
            $gameTemp._jgVisualRequest = 'success';
        } else {
            // --- MISS ---
            $gameTemp._jgResult = 'miss';
            $gameTemp._jgVisualRequest = 'fail';
            AudioManager.playSe({ name: config.failSe, volume: 80, pitch: 100, pan: 0 });
        }
        
        $gameTemp._jgActive = false;
    };

    // ------------------------------------------------------------------------
    // 3. Apply Result (DAMAGE & EFFECTS FIX)
    // ------------------------------------------------------------------------

    // FIX PART 1: Intercept Damage Calculation BEFORE it happens
    // This ensures HP is not lost if Parry is Perfect.
    const _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
    Game_Action.prototype.makeDamageValue = function(target, critical) {
        const value = _Game_Action_makeDamageValue.call(this, target, critical);
        
        // If Parry was Perfect, override damage to 0 immediately
        if (target.isActor() && this.subject().isEnemy() && $gameTemp._jgResult === 'perfect') {
            return 0;
        }
        
        return value;
    };

    // FIX PART 2: Apply Status Effects & Visuals
    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        _Game_Action_apply.call(this, target); // Original apply runs (damage is already 0 thanks to function above)
        
        // Visuals and Logic for Perfect Block
        const result = target.result();
        
        if (target.isActor() && this.subject().isEnemy()) {
            
            const jgResult = $gameTemp._jgResult;
            
            if (jgResult === 'perfect') {
                // Force result flags to show "Hit" but 0 damage
                // (Optional: result.hpDamage is already 0, but we can reinforce it)
                result.hpDamage = 0;
                result.mpDamage = 0;
                result.tpDamage = 0;
                
                // Add Stun to Enemy (ID 13)
                const subject = this.subject();
                if (subject && subject.isAlive()) {
                    subject.addState(config.stunStateId);
                }

                // FX: Sound & Shake
                AudioManager.playSe({ name: config.parrySe, volume: 100, pitch: 120, pan: 0 });
                target.requestEffect('whiten');
                $gameScreen.startShake(5, 5, 10);
                
                if (SceneManager._scene._logWindow) {
                     SceneManager._scene._logWindow.addText(`\\C[10]PERFECT BLOCK! (0 Dmg)\\C[0]`);
                }
            } 
        }
    };

    const _BattleManager_endBattle = BattleManager.endBattle;
    BattleManager.endBattle = function(result) {
        _BattleManager_endBattle.call(this, result);
        $gameTemp.clearJustGuardState();
    };

})();