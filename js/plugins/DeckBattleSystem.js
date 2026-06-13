/*:
 * @target MZ
 * @plugindesc v2.2 Deckbuilder System: Menu Input Fix & Stability.
 * @author Chirawat (Enhanced by Plugin Maker)
 *
 * @param Hand Size
 * @desc Number of cards to draw at the start of the turn.
 * @type number
 * @default 5
 *
 * @param Keep Hand
 * @desc If true, cards are not discarded at the end of the turn.
 * @type boolean
 * @default false
 *
 * @param Excluded Skills
 * @desc List of Skill IDs to exclude from the deck entirely.
 * @type skill[]
 * @default ["1","2"]
 *
 * @param --- Deck Mechanics ---
 * * @param Min Deck Size
 * @parent --- Deck Mechanics ---
 * @desc Minimum cards required in a deck (Prevents crashes).
 * @type number
 * @default 5
 *
 * @param Max Deck Size
 * @parent --- Deck Mechanics ---
 * @desc Maximum cards allowed in a deck.
 * @type number
 * @default 30
 *
 * @param --- MP Mechanics ---
 *
 * @param MP Regen Amount
 * @parent --- MP Mechanics ---
 * @desc Amount of MP to restore to each actor at the start of the turn.
 * @type number
 * @default 35
 *
 * @param --- Controls ---
 * * @param Discard Key
 * @parent --- Controls ---
 * @desc The keyboard key to press to discard a selected card. (Default: c)
 * @type string
 * @default c
 *
 * @param --- Draw Mechanic ---
 * * @param Show Draw Command
 * @parent --- Draw Mechanic ---
 * @desc Show a 'Draw Card' button in the hand window?
 * @type boolean
 * @default true
 * * @param Draw Command Name
 * @parent --- Draw Mechanic ---
 * @desc Text displayed for the draw button.
 * @type string
 * @default Draw (+1)
 * * @param Draw MP Cost
 * @parent --- Draw Mechanic ---
 * @desc MP cost to use the Draw command.
 * @type number
 * @default 0
 * * @param Draw TP Cost
 * @parent --- Draw Mechanic ---
 * @desc TP cost to use the Draw command.
 * @type number
 * @default 0
 *
 * @param --- Skip Mechanic ---
 * * @param Show Skip Command
 * @parent --- Skip Mechanic ---
 * @desc Show a 'Skip Turn' button in the hand window?
 * @type boolean
 * @default true
 * * @param Skip Command Name
 * @parent --- Skip Mechanic ---
 * @desc Text displayed for the skip button.
 * @type string
 * @default Skip Turn
 *
 * @param --- HUD Settings ---
 *
 * @param Deck Window X
 * @parent --- HUD Settings ---
 * @desc X Position. Set to 'right' for top-right corner, or a number.
 * @type string
 * @default right
 *
 * @param Deck Window Y
 * @parent --- HUD Settings ---
 * @desc Y Position. 0 is the very top of the screen.
 * @type number
 * @default 0
 *
 * @param Show HUD Background
 * @parent --- HUD Settings ---
 * @desc If true, shows the dark window background. If false, shows only text.
 * @type boolean
 * @default true
 *
 * @param --- Menu Settings ---
 * @param Show Deck Menu
 * @parent --- Menu Settings ---
 * @desc Add 'Deck' command to the Main Menu?
 * @type boolean
 * @default true
 * * @param Deck Menu Name
 * @parent --- Menu Settings ---
 * @desc Text for the Deck command in Main Menu.
 * @type string
 * @default Deck
 *
 * @command DrawCard
 * @text Draw Card
 * @desc Force the current actor to draw 1 card (Free).
 *
 * @help
 * DeckBattleSystem.js v2.2
 *
 * Transforms the battle system into a deckbuilder with Deck Editing and MP Regen.
 *
 * --- v2.2 Fixes ---
 * 1. Fixed "Frozen Menu": The Deck Editor window now properly activates,
 * allowing the cursor to move and select items immediately.
 * 2. Input Handling: Ensured OK/Cancel handlers are bound correctly.
 *
 * --- Features ---
 * 1. Deck Editor (Main Menu):
 * - Edit your deck from the main menu.
 * - Toggle skills In/Out of the deck.
 * - Validates Minimum and Maximum deck sizes.
 *
 * 2. MP Regeneration:
 * - Actors automatically gain MP at the start of every turn.
 *
 * 3. Smart Shuffle (Anti-Repeat):
 * - Prevents drawing the same cards immediately after shuffling.
 *
 * --- Note Tags ---
 * <Exhaust>: Place in Skill Note. Removes card from combat until end of battle.
 */

(() => {
    "use strict";

    const pluginName = "DeckBattleSystem";
    const parameters = PluginManager.parameters(pluginName);
    
    // --- Parameters ---
    const handSize = Number(parameters['Hand Size'] || 5);
    const keepHand = (parameters['Keep Hand'] === 'true');
    const excludedSkills = JSON.parse(parameters['Excluded Skills'] || '["1","2"]').map(Number);
    
    // Deck Limits
    const minDeckSize = Number(parameters['Min Deck Size'] || 5);
    const maxDeckSize = Number(parameters['Max Deck Size'] || 30);

    // MP Regen
    const mpRegenAmount = Number(parameters['MP Regen Amount'] || 35);

    // Controls
    const discardKeyChar = String(parameters['Discard Key'] || 'c').toLowerCase();
    
    // Draw Mechanic
    const showDrawCmd = (parameters['Show Draw Command'] !== 'false');
    const drawCmdName = String(parameters['Draw Command Name'] || "Draw (+1)");
    const drawMpCost = Number(parameters['Draw MP Cost'] || 0);
    const drawTpCost = Number(parameters['Draw TP Cost'] || 0);

    // Skip Mechanic
    const showSkipCmd = (parameters['Show Skip Command'] !== 'false');
    const skipCmdName = String(parameters['Skip Command Name'] || "Skip Turn");

    // HUD
    const paramDeckX = String(parameters['Deck Window X'] || 'right').toLowerCase().trim();
    const paramDeckY = Number(parameters['Deck Window Y'] || 0);
    const showBackground = (parameters['Show HUD Background'] !== 'false');

    // Menu
    const showDeckMenu = (parameters['Show Deck Menu'] !== 'false');
    const deckMenuName = String(parameters['Deck Menu Name'] || "Deck");

    // -------------------------------------------------------------------------
    // Input Setup
    // -------------------------------------------------------------------------
    const keyMap = {
        'c': 67, 'd': 68, 's': 83, 'a': 65, 'w': 87, 'shift': 16, 'tab': 9
    };
    const discardKeyCode = keyMap[discardKeyChar] || 67; 
    Input.keyMapper[discardKeyCode] = 'manualDiscard';

    const isExhaustSkill = (skillId) => {
        const skill = $dataSkills[skillId];
        return skill && skill.meta && !!skill.meta.Exhaust;
    };

    // -------------------------------------------------------------------------
    // Global Classes (Required for Save/Load Persistence)
    // -------------------------------------------------------------------------
    
    window.Game_Deck = class Game_Deck {
        constructor() {
            this._cards = [];
        }

        initialize(skills) {
            // Filter global excludes
            this._cards = skills.filter(id => !excludedSkills.includes(id));
            this.shuffle();
        }

        shuffle() {
            for (let i = this._cards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this._cards[i], this._cards[j]] = [this._cards[j], this._cards[i]];
            }
        }

        draw() {
            return this._cards.pop();
        }

        add(card) {
            this._cards.push(card);
        }

        get size() {
            return this._cards ? this._cards.length : 0;
        }

        get cards() {
            return this._cards;
        }
    };

    window.Game_Hand = class Game_Hand {
        constructor() {
            this._cards = [];
            this._reservedIndices = [];
        }

        add(card) {
            this._cards.push(card);
        }

        get(index) {
            if (this._reservedIndices.includes(index)) return null;
            return this._cards[index];
        }

        remove(index) {
            if (index >= 0 && index < this._cards.length) {
                const removed = this._cards.splice(index, 1)[0];
                this._reservedIndices = []; 
                return removed;
            }
            return null;
        }

        reserve(index) {
            if (index >= 0 && index < this._cards.length && !this._reservedIndices.includes(index)) {
                this._reservedIndices.push(index);
                return true;
            }
            return false;
        }

        unreserve() {
            if (this._reservedIndices.length > 0) {
                this._reservedIndices.pop();
            }
        }

        commit() {
            const indices = [...this._reservedIndices].sort((a, b) => b - a);
            const committedCards = [];
            for (const index of indices) {
                committedCards.push(this._cards[index]);
                this._cards.splice(index, 1);
            }
            this._reservedIndices = [];
            return committedCards;
        }

        clear() {
            const cards = this._cards;
            this._cards = [];
            this._reservedIndices = [];
            return cards;
        }

        get cards() {
            return this._cards;
        }

        isReserved(index) {
            return this._reservedIndices.includes(index);
        }
    };

    // -------------------------------------------------------------------------
    // Game_Actor Modifications
    // -------------------------------------------------------------------------
    const _Game_Actor_initMembers = Game_Actor.prototype.initMembers;
    Game_Actor.prototype.initMembers = function() {
        _Game_Actor_initMembers.call(this);
        this._deck = new Game_Deck();
        this._hand = new Game_Hand();
        this._discardPile = [];
        this._exhaustPile = [];
        this._recentDiscards = []; 
        this._deckInitialized = false;
        this._turnCardsDrawn = false;
        this._savedDeck = null; 
    };

    const _Game_Actor_onBattleStart = Game_Actor.prototype.onBattleStart;
    Game_Actor.prototype.onBattleStart = function() {
        _Game_Actor_onBattleStart.call(this);
        this.setupDeck();
    };

    Game_Actor.prototype.setupDeck = function() {
        // If no saved deck exists (first time), populate with all learned skills
        if (!this._savedDeck || this._savedDeck.length === 0) {
            const allSkills = this.skills().map(s => s.id);
            // Remove global excludes
            this._savedDeck = allSkills.filter(id => !excludedSkills.includes(id));
        }

        // Initialize battle deck from saved deck
        this._deck.initialize(this._savedDeck);
        this._discardPile = [];
        this._exhaustPile = [];
        this._recentDiscards = [];
        this._hand.clear();
        this._deckInitialized = true;
        this._turnCardsDrawn = false;
    };

    // --- Deck Editor Methods ---
    
    Game_Actor.prototype.ensureSavedDeckInitialized = function() {
        if (!this._savedDeck) {
            // Safety check: if skills() fails or actor not ready
            const allSkills = this.skills() ? this.skills().map(s => s.id) : [];
            this._savedDeck = allSkills.filter(id => !excludedSkills.includes(id));
        }
    };

    Game_Actor.prototype.isSkillInDeck = function(skillId) {
        this.ensureSavedDeckInitialized();
        return this._savedDeck.includes(skillId);
    };

    Game_Actor.prototype.toggleDeckSkill = function(skillId) {
        this.ensureSavedDeckInitialized();
        if (this._savedDeck.includes(skillId)) {
            const index = this._savedDeck.indexOf(skillId);
            this._savedDeck.splice(index, 1);
            return false; // Removed
        } else {
            this._savedDeck.push(skillId);
            return true; // Added
        }
    };

    Game_Actor.prototype.getDeckSize = function() {
        this.ensureSavedDeckInitialized();
        return this._savedDeck.length;
    };

    // --- Battle Logic ---

    Game_Actor.prototype.drawHand = function() {
        for (let i = 0; i < handSize; i++) {
            this.drawCard();
        }
    };

    Game_Actor.prototype.drawCard = function() {
        if (!this._deck) this._deck = new Game_Deck(); 
        if (!this._hand) this._hand = new Game_Hand(); 

        if (this._deck.size === 0) {
            this.reshuffleDiscard();
        }
        if (this._deck.size > 0) {
            const cardId = this._deck.draw();
            if (cardId) this._hand.add(cardId);
        }
    };

    Game_Actor.prototype.reshuffleDiscard = function() {
        if (this._discardPile.length > 0) {
            this._discardPile.forEach(id => this._deck.add(id));
            this._discardPile = [];
            this._deck.shuffle();

            // Smart Shuffle Logic
            if (!this._recentDiscards) this._recentDiscards = [];
            const deckCards = this._deck.cards;
            const safeZone = handSize; 
            
            if (deckCards.length > safeZone && this._recentDiscards.length > 0) {
                for (let i = 0; i < safeZone; i++) {
                    const cardId = deckCards[i];
                    if (this._recentDiscards.includes(cardId)) {
                        const reserveStartIndex = safeZone;
                        const reserveSize = deckCards.length - reserveStartIndex;
                        if (reserveSize > 0) {
                            const swapIndex = reserveStartIndex + Math.floor(Math.random() * reserveSize);
                            [deckCards[i], deckCards[swapIndex]] = [deckCards[swapIndex], deckCards[i]];
                        }
                    }
                }
            }
            this._recentDiscards = [];
        }
    };

    Game_Actor.prototype.discardHand = function() {
        if (!this._hand) return;
        const cards = this._hand.clear();
        if (!this._recentDiscards) this._recentDiscards = [];
        this._recentDiscards.push(...cards);
        this._discardPile.push(...cards);
    };

    Game_Actor.prototype.manualDiscard = function(handIndex) {
        const cardId = this._hand.remove(handIndex);
        if (cardId) {
            if (!this._recentDiscards) this._recentDiscards = [];
            this._recentDiscards.push(cardId); 
            this._discardPile.push(cardId);
            return true;
        }
        return false;
    };

    Game_Actor.prototype.canPayDrawCost = function() {
        return this.mp >= drawMpCost && this.tp >= drawTpCost;
    };

    Game_Actor.prototype.payDrawCost = function() {
        this._mp -= drawMpCost;
        this._tp -= drawTpCost;
    };

    Game_Actor.prototype.processUsedCards = function(cardIds) {
        if (!this._recentDiscards) this._recentDiscards = [];
        cardIds.forEach(id => {
            if (isExhaustSkill(id)) {
                this._exhaustPile.push(id);
            } else {
                this._recentDiscards.push(id);
                this._discardPile.push(id);
            }
        });
    };

    Game_Actor.prototype.handSkills = function() {
        if (!this._hand) return [];
        return this._hand.cards.map(id => $dataSkills[id]).filter(s => !!s);
    };

    const _Game_Actor_onTurnEnd = Game_Actor.prototype.onTurnEnd;
    Game_Actor.prototype.onTurnEnd = function() {
        _Game_Actor_onTurnEnd.call(this);
        if (!keepHand) {
            this.discardHand();
        }
        this._turnCardsDrawn = false;
    };

    // -------------------------------------------------------------------------
    // BattleManager (MP Regen Implementation)
    // -------------------------------------------------------------------------
    const _BattleManager_startActorInput = BattleManager.startActorInput;
    BattleManager.startActorInput = function() {
        const actor = this._currentActor;
        if (actor) {
            if (!actor._turnCardsDrawn) {
                actor.drawHand();
                actor._turnCardsDrawn = true;
            }
        }
        _BattleManager_startActorInput.call(this);
    };

    const _BattleManager_startTurn = BattleManager.startTurn;
    BattleManager.startTurn = function() {
        $gameParty.battleMembers().forEach(actor => {
            // MP Regen Feature
            if (mpRegenAmount > 0) {
                actor.gainMp(mpRegenAmount);
                actor.startDamagePopup(); // Optional: Visual feedback
            }

            if (actor._hand) {
                const used = actor._hand.commit();
                actor.processUsedCards(used);
            }
        });
        _BattleManager_startTurn.call(this);
    };

    const _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function() {
        const subject = this._subject;
        if (subject && subject.isActor() && subject._hand) {
            const used = subject._hand.commit();
            subject.processUsedCards(used);
        }
        _BattleManager_startAction.call(this);
    };

    // -------------------------------------------------------------------------
    // Scene_Deck (Deck Editor Menu)
    // -------------------------------------------------------------------------
    class Scene_Deck extends Scene_MenuBase {
        create() {
            super.create();
            this.createHelpWindow();
            this.createStatusWindow(); 
            this.createItemWindow();
        }

        createStatusWindow() {
            const rect = this.statusWindowRect();
            this._statusWindow = new Window_Help(rect);
            this._statusWindow.setText("");
            this.addWindow(this._statusWindow);
        }

        statusWindowRect() {
            const wx = 0;
            const wy = this.mainAreaTop();
            const ww = Graphics.boxWidth;
            const wh = this.calcWindowHeight(1, false);
            return new Rectangle(wx, wy, ww, wh);
        }

        createItemWindow() {
            const rect = this.itemWindowRect();
            this._itemWindow = new Window_DeckEdit(rect);
            this._itemWindow.setHelpWindow(this._helpWindow);
            this._itemWindow.setHandler("ok", this.onItemOk.bind(this));
            this._itemWindow.setHandler("cancel", this.popScene.bind(this));
            this.addWindow(this._itemWindow);
            
            // Initialize with the selected actor
            this._itemWindow.setActor(this.actor());
            this.updateStatusHeader();
            
            // --- FIX: Activate Window ---
            this._itemWindow.refresh();
            this._itemWindow.select(0); // Select first item
            this._itemWindow.activate(); // Give focus
        }

        itemWindowRect() {
            const wx = 0;
            const wy = this._statusWindow.y + this._statusWindow.height;
            const ww = Graphics.boxWidth;
            const wh = this.mainAreaBottom() - wy;
            return new Rectangle(wx, wy, ww, wh);
        }

        updateStatusHeader() {
            const size = this.actor().getDeckSize();
            const min = minDeckSize;
            const max = maxDeckSize;
            let text = `Deck Size: ${size} / ${max} (Min: ${min})`;
            
            if (size < min) text += " \\C[2][TOO SMALL]\\C[0]";
            else if (size > max) text += " \\C[2][TOO BIG]\\C[0]";
            else text += " \\C[24][OK]\\C[0]";

            this._statusWindow.setText(text);
        }

        onItemOk() {
            const item = this._itemWindow.item();
            const actor = this.actor();
            const size = actor.getDeckSize();

            if (item) {
                const inDeck = actor.isSkillInDeck(item.id);
                
                if (inDeck) {
                    // Try to remove
                    if (size <= minDeckSize) {
                        SoundManager.playBuzzer();
                    } else {
                        SoundManager.playCursor(); 
                        actor.toggleDeckSkill(item.id);
                    }
                } else {
                    // Try to add
                    if (size >= maxDeckSize) {
                        SoundManager.playBuzzer();
                    } else {
                        SoundManager.playEquip(); 
                        actor.toggleDeckSkill(item.id);
                    }
                }
                
                this._itemWindow.refresh();
                this.updateStatusHeader();
                this._itemWindow.activate();
            }
        }
    }

    // -------------------------------------------------------------------------
    // Window_DeckEdit (The List of Skills)
    // -------------------------------------------------------------------------
    class Window_DeckEdit extends Window_SkillList {
        makeItemList() {
            if (this._actor) {
                // Show learned skills, exclude specific ones
                this._data = this._actor.skills().filter(skill => {
                    return !excludedSkills.includes(skill.id);
                });
            } else {
                this._data = [];
            }
        }

        drawItem(index) {
            // FIX: Ensure data exists before drawing
            const skill = this._data ? this._data[index] : null;
            if (skill) {
                const rect = this.itemLineRect(index);
                const inDeck = this._actor.isSkillInDeck(skill.id);

                this.changePaintOpacity(true);
                
                // Draw Skill Name
                this.drawItemName(skill, rect.x, rect.y, rect.width - 60);

                // Draw Status (Equipped / Empty)
                const statusX = rect.x + rect.width - 50;
                if (inDeck) {
                    this.changeTextColor(ColorManager.mpCostColor());
                    this.drawText("ON", statusX, rect.y, 50, 'right');
                } else {
                    this.changeTextColor(ColorManager.normalColor());
                    this.drawText("-", statusX, rect.y, 50, 'right');
                }
                this.resetTextColor();
            }
        }

        isEnabled(item) {
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // Main Menu Integration
    // -------------------------------------------------------------------------
    if (showDeckMenu) {
        const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
        Window_MenuCommand.prototype.addOriginalCommands = function() {
            _Window_MenuCommand_addOriginalCommands.call(this);
            this.addCommand(deckMenuName, "deck", true);
        };

        const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
        Scene_Menu.prototype.createCommandWindow = function() {
            _Scene_Menu_createCommandWindow.call(this);
            this._commandWindow.setHandler("deck", this.commandDeck.bind(this));
        };

        Scene_Menu.prototype.commandDeck = function() {
            SceneManager.push(Scene_Deck);
        };
    }

    // -------------------------------------------------------------------------
    // Battle HUD & Logic (Unchanged from v1.9 except imports)
    // -------------------------------------------------------------------------
    
    // Window_DeckStatus
    class Window_DeckStatus extends Window_Base {
        constructor(rect) {
            super(rect);
            this._actor = null;
            this.opacity = showBackground ? 255 : 0; 
            this._lastDeckSize = -1;
            this._lastDiscSize = -1;
            this.refresh();
        }

        setActor(actor) {
            if (this._actor !== actor) {
                this._actor = actor;
                this.refresh();
            } else if (actor) {
                const dSize = actor._deck ? actor._deck.size : 0;
                const dpSize = actor._discardPile ? actor._discardPile.length : 0;
                if (dSize !== this._lastDeckSize || dpSize !== this._lastDiscSize) {
                    this.refresh();
                }
            }
        }

        refresh() {
            this.contents.clear();
            if (!showBackground) {
                this.contents.fillRect(0, 0, this.contentsWidth(), this.contentsHeight(), "rgba(0, 0, 0, 0.5)");
            }

            if (!this._actor) return;
            const dSize = this._actor._deck ? this._actor._deck.size : 0;
            const dpSize = this._actor._discardPile ? this._actor._discardPile.length : 0;

            this._lastDeckSize = dSize;
            this._lastDiscSize = dpSize;

            const width = this.contentsWidth();
            
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("Deck:", 0, 0, width, 'left');
            
            this.resetTextColor();
            this.drawText(dSize, 60, 0, width, 'left');

            this.changeTextColor(ColorManager.systemColor());
            this.drawText("| Disc:", 100, 0, width, 'left');

            this.resetTextColor();
            this.drawText(dpSize, 180, 0, width, 'left');
        }
    }

    // Window_BattleHand
    class Window_BattleHand extends Window_ActorCommand {
        initialize(rect) {
            super.initialize(rect);
            this._actor = null;
            this.openness = 0;
            this.backOpacity = 255; 
        }

        actor() {
            return this._actor;
        }

        setup(actor) {
            this._actor = actor;
            this.refresh();
            this.select(0);
            this.activate();
            this.open();
        }

        maxCols() {
            return Math.max(5, this._list ? this._list.length : 1);
        }

        numVisibleRows() {
            return 1;
        }

        makeCommandList() {
            if (!this._actor) return;
            
            // 1. Add Card Skills
            const skills = this._actor.handSkills();
            skills.forEach((skill, index) => {
                const canPay = this._actor.canPaySkillCost(skill);
                const isReserved = this._actor._hand.isReserved(index);
                if (!isReserved) {
                    this.addCommand(skill.name, 'card', canPay, { skill: skill, handIndex: index });
                }
            });

            // 2. Add Draw Button
            if (showDrawCmd) {
                const canDraw = this._actor.canPayDrawCost();
                this.addCommand(drawCmdName, 'draw', canDraw, null);
            }

            // 3. Add Skip Button
            if (showSkipCmd) {
                this.addCommand(skipCmdName, 'skip', true, null);
            }
        }

        drawItem(index) {
            const rect = this.itemRect(index);
            const item = this._list[index];
            const symbol = item.symbol;
            
            rect.x += 4; rect.y += 4; rect.width -= 8; rect.height -= 8;
            this.changePaintOpacity(item.enabled);

            const isSelected = (index === this.index() && this.active);

            // Card borders and backgrounds
            let borderColor = "rgba(165, 180, 252, 0.4)"; // Default indigo
            let backColor = "rgba(15, 10, 36, 0.65)"; // Dark slate

            if (isSelected) {
                borderColor = "#fbbf24"; // Gold glow for selected card
                backColor = "rgba(30, 27, 75, 0.85)";
            } else if (symbol === 'skip') {
                borderColor = "rgba(239, 68, 68, 0.35)"; // Red
                backColor = "rgba(69, 10, 10, 0.5)";
            } else if (symbol === 'draw') {
                borderColor = "rgba(34, 197, 94, 0.35)"; // Green
                backColor = "rgba(6, 78, 59, 0.5)";
            }

            const ctx = this.contents.context;
            ctx.save();
            
            // Selected shadow glow
            if (isSelected) {
                ctx.shadowColor = "rgba(251, 191, 36, 0.7)";
                ctx.shadowBlur = 10;
            }

            // Fill card
            ctx.fillStyle = backColor;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            // Draw primary border
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.strokeStyle = borderColor;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.restore();

            // Inner border detail for cards
            if (symbol === 'card') {
                ctx.save();
                ctx.strokeStyle = isSelected ? "rgba(251, 191, 36, 0.25)" : "rgba(165, 180, 252, 0.15)";
                ctx.lineWidth = 1;
                ctx.strokeRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6);
                ctx.restore();
            }

            if (symbol === 'card') {
                const skill = item.ext.skill;
                const isExhaust = isExhaustSkill(skill.id);
                
                const iconY = rect.y + 8;
                const iconX = rect.x + (rect.width - ImageManager.iconWidth) / 2;
                this.drawIcon(skill.iconIndex, iconX, iconY);

                if (isExhaust) {
                     this.contents.fontSize = 12;
                     this.changeTextColor(ColorManager.deathColor());
                     this.drawText("EXH", rect.x + 4, rect.y + 4, rect.width, 'left');
                }

                this.resetTextColor();
                this.contents.fontFace = "Outfit, sans-serif";
                this.contents.fontSize = 16;
                this.drawText(skill.name, rect.x, rect.y + 42, rect.width, 'center');

                const mpCost = this._actor.skillMpCost(skill);
                const tpCost = this._actor.skillTpCost(skill);
                let costText = "";
                if (mpCost > 0) costText += mpCost + " MP";
                if (tpCost > 0) costText += (costText ? " " : "") + tpCost + " TP";

                this.changeTextColor(mpCost > 0 ? "#38bdf8" : "#4ade80"); // sky-blue for MP, light green for TP
                this.contents.fontSize = 14;
                this.drawText(costText, rect.x, rect.y + 68, rect.width, 'center');

            } else if (symbol === 'draw') {
                this.changeTextColor("#4ade80");
                this.contents.fontFace = "Outfit, sans-serif";
                this.contents.fontSize = 18;
                this.drawText("DRAW", rect.x, rect.y + 12, rect.width, 'center');
                
                this.resetTextColor();
                this.contents.fontSize = 15;
                this.drawText(item.name, rect.x, rect.y + 42, rect.width, 'center');

                let costText = "";
                if (drawMpCost > 0) costText += drawMpCost + " MP";
                if (drawTpCost > 0) costText += (costText ? " " : "") + drawTpCost + " TP";
                
                this.changeTextColor("#38bdf8");
                this.contents.fontSize = 13;
                this.drawText(costText, rect.x, rect.y + 68, rect.width, 'center');

            } else if (symbol === 'skip') {
                this.changeTextColor("#f87171");
                this.contents.fontFace = "Outfit, sans-serif";
                this.contents.fontSize = 18;
                this.drawText("END", rect.x, rect.y + 12, rect.width, 'center');
                
                this.changeTextColor(ColorManager.normalColor());
                this.contents.fontSize = 15;
                this.drawText(item.name, rect.x, rect.y + 42, rect.width, 'center');

                this.contents.fontSize = 24;
                this.drawText("»", rect.x, rect.y + 62, rect.width, 'center');
            }

            this.resetFontSettings();
            this.changePaintOpacity(1);
        }


        itemHeight() {
            return this.innerHeight;
        }

        processHandling() {
            if (this.isOpenAndActive()) {
                if (Input.isTriggered('manualDiscard')) {
                    this.processDiscard();
                }
            }
            super.processHandling();
        }

        processDiscard() {
            const index = this.index();
            const item = this._list[index];
            if (!item || item.symbol !== 'card') return; 
            this.callHandler('discard');
        }
    }

    // -------------------------------------------------------------------------
    // Scene_Battle Modifications
    // -------------------------------------------------------------------------

    Scene_Battle.prototype.createActorCommandWindow = function() {
        const rect = this.actorCommandWindowRect();
        this._actorCommandWindow = new Window_BattleHand(rect);
        this._actorCommandWindow.setHandler("card", this.onHandCard.bind(this));
        this._actorCommandWindow.setHandler("draw", this.onHandDraw.bind(this)); 
        this._actorCommandWindow.setHandler("skip", this.onHandSkip.bind(this)); 
        this._actorCommandWindow.setHandler("cancel", this.commandCancel.bind(this));
        this._actorCommandWindow.setHandler("discard", this.onHandDiscard.bind(this)); 
        this.addWindow(this._actorCommandWindow);
    };

    Scene_Battle.prototype.actorCommandWindowRect = function() {
        const h = 160; 
        const wx = 0;
        const wy = Graphics.boxHeight - h; 
        const ww = Graphics.boxWidth; 
        return new Rectangle(wx, wy, ww, h);
    };

    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        this.createDeckStatusWindow();
    };

    Scene_Battle.prototype.createDeckStatusWindow = function() {
        const w = 240;
        const h = 70;
        let x = 0;
        let y = paramDeckY;

        if (paramDeckX === 'right' || isNaN(parseInt(paramDeckX))) {
            x = Graphics.boxWidth - w - 4;
        } else {
            x = parseInt(paramDeckX);
        }

        const rect = new Rectangle(x, y, w, h);
        this._deckStatusWindow = new Window_DeckStatus(rect);
        this.addWindow(this._deckStatusWindow);
    };

    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        if (this._deckStatusWindow && BattleManager.actor()) {
            this._deckStatusWindow.setActor(BattleManager.actor());
        }

        if (this._statusWindow && this._actorCommandWindow) {
            const isHandOpen = this._actorCommandWindow.isOpen() || this._actorCommandWindow.isOpening();
            this._statusWindow.visible = !isHandOpen;
        }
    };

    Scene_Battle.prototype.onHandCard = function() {
        const item = this._actorCommandWindow.currentExt();
        const skill = item.skill;
        const handIndex = item.handIndex;

        const actor = BattleManager.actor();
        actor._hand.reserve(handIndex);

        const action = BattleManager.inputtingAction();
        action.setSkill(skill.id);

        if (action.needsSelection()) {
            this._actorCommandWindow.deactivate();
             if (action.isForOpponent()) {
                this.startEnemySelection();
            } else {
                this.startActorSelection();
            }
        } else {
            this._actorCommandWindow.refresh();
            this.selectNextCommand();
        }
        if(this._deckStatusWindow) this._deckStatusWindow.refresh();
    };

    Scene_Battle.prototype.onHandDraw = function() {
        const actor = BattleManager.actor();
        
        if (actor.canPayDrawCost()) {
            actor.payDrawCost();
            actor.drawCard();
            SoundManager.playShop(); 
            
            this._actorCommandWindow.refresh();
            this._actorCommandWindow.activate();
            if(this._deckStatusWindow) this._deckStatusWindow.refresh();
        } else {
             SoundManager.playBuzzer();
             this._actorCommandWindow.activate();
        }
    };

    Scene_Battle.prototype.onHandSkip = function() {
        const actor = BattleManager.actor();
        SoundManager.playCancel(); 
        
        actor.clearActions();
        
        BattleManager.selectNextActor();
        
        this.changeInputWindow();
    };

    Scene_Battle.prototype.onHandDiscard = function() {
        const item = this._actorCommandWindow.currentExt();
        if (!item) return;

        const actor = BattleManager.actor();
        const handIndex = item.handIndex;

        actor.manualDiscard(handIndex);
        SoundManager.playEquip(); 

        this._actorCommandWindow.refresh();
        this._actorCommandWindow.activate(); 
        if(this._deckStatusWindow) this._deckStatusWindow.refresh();
    };

    const _Scene_Battle_onActorCancel = Scene_Battle.prototype.onActorCancel;
    Scene_Battle.prototype.onActorCancel = function() {
        BattleManager.actor()._hand.unreserve();
        this._actorCommandWindow.refresh();
        if(this._deckStatusWindow) this._deckStatusWindow.refresh();
        _Scene_Battle_onActorCancel.call(this);
    };

    const _Scene_Battle_onEnemyCancel = Scene_Battle.prototype.onEnemyCancel;
    Scene_Battle.prototype.onEnemyCancel = function() {
        BattleManager.actor()._hand.unreserve();
        this._actorCommandWindow.refresh();
        if(this._deckStatusWindow) this._deckStatusWindow.refresh();
        _Scene_Battle_onEnemyCancel.call(this);
    };

    const _Scene_Battle_selectPreviousCommand = Scene_Battle.prototype.selectPreviousCommand;
    Scene_Battle.prototype.selectPreviousCommand = function() {
        _Scene_Battle_selectPreviousCommand.call(this);
        const actor = BattleManager.actor();
        if (actor) {
            actor._hand.unreserve();
        }
        if (this._actorCommandWindow) {
            this._actorCommandWindow.refresh();
        }
        if(this._deckStatusWindow) this._deckStatusWindow.refresh();
    };

    PluginManager.registerCommand(pluginName, "DrawCard", args => {
        const actor = BattleManager.actor();
        if (actor) {
            actor.drawCard();
            if (SceneManager._scene instanceof Scene_Battle && SceneManager._scene._actorCommandWindow) {
                SceneManager._scene._actorCommandWindow.refresh();
                if(SceneManager._scene._deckStatusWindow) SceneManager._scene._deckStatusWindow.refresh();
            }
        }
    });

})();