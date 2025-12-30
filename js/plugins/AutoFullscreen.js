/*:
 * @target MZ
 * @plugindesc Automatically handles Fullscreen for PC and Landscape Mobile.
 * @author Jules
 *
 * @help
 * ============================================================================
 * Jules_AutoFullscreen
 * ============================================================================
 *
 * This plugin manages screen behavior for better immersion.
 *
 * 1. PC / Mac (NW.js):
 * The game will automatically start in Fullscreen mode.
 *
 * 2. Mobile (Browser/Android/iOS):
 * The plugin listens for orientation changes. If the player rotates the
 * device to "Landscape" (Side-way), the game attempts to enter Fullscreen.
 *
 * NOTE ON MOBILE:
 * Modern mobile browsers protect against "Auto-Fullscreen" without user
 * permission. If the game cannot force fullscreen automatically, it will
 * wait for the player's first touch (tap) on the screen to trigger it.
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 *
 * @param pcAutoStart
 * @text PC Auto Fullscreen
 * @type boolean
 * @desc If true, the game goes fullscreen immediately on PC startup.
 * @default true
 *
 * @param mobileLandscape
 * @text Mobile Landscape Fullscreen
 * @type boolean
 * @desc If true, attempts to go fullscreen when mobile is sideways.
 * @default true
 *
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "Jules_AutoFullscreen";
    const Parameters = PluginManager.parameters(PLUGIN_NAME);
    const PC_AUTO = Parameters["pcAutoStart"] === "true";
    const MOBILE_LANDSCAPE = Parameters["mobileLandscape"] === "true";

    //-----------------------------------------------------------------------------
    // Helper Functions
    //-----------------------------------------------------------------------------

    const isLandscape = () => {
        return window.innerWidth > window.innerHeight;
    };

    const requestMobileFullscreen = () => {
        if (!Utils.isMobileDevice()) return;
        
        // Only proceed if in landscape
        if (!isLandscape()) return;

        // Try standard fullscreen API
        const element = document.body;
        const requestMethod = element.requestFullscreen || 
                              element.webkitRequestFullScreen || 
                              element.mozRequestFullScreen || 
                              element.msRequestFullscreen;

        if (requestMethod) {
            // We suppress errors because this often fails if not triggered by a touch event
            requestMethod.call(element).catch(() => {
                // Fail silently, waiting for touch input
            });
        }
    };

    //-----------------------------------------------------------------------------
    // Boot Logic
    //-----------------------------------------------------------------------------

    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        
        // Handle PC Fullscreen
        if (Utils.isNwjs() && PC_AUTO) {
            Graphics._requestFullScreen();
        }
    };

    //-----------------------------------------------------------------------------
    // Mobile Orientation & Touch Handling
    //-----------------------------------------------------------------------------

    if (MOBILE_LANDSCAPE && Utils.isMobileDevice()) {

        // 1. Listen for orientation changes
        window.addEventListener("resize", () => {
            if (isLandscape()) {
                requestMobileFullscreen();
            }
        });

        // 2. Hook into TouchInput to force fullscreen on first interaction
        // (Browsers require a user gesture to allow fullscreen)
        const _TouchInput_onTrigger = TouchInput._onTrigger;
        TouchInput._onTrigger = function(x, y) {
            _TouchInput_onTrigger.call(this, x, y);
            
            // Try to force fullscreen if we are in landscape and not yet fullscreen
            if (isLandscape() && !document.fullscreenElement) {
                requestMobileFullscreen();
            }
        };
    }

})();