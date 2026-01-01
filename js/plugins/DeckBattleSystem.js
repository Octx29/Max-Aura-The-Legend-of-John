/*:
 * @target MZ
 * @plugindesc v1.6 Deckbuilder Battle System.
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
 * @desc List of Skill IDs to exclude from the deck.
 * @type skill[]
 * @default ["1","2"]
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
 * @default 10
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
 * @command DrawCard
 * @text Draw Card
 * @desc Force the current actor to draw 1 card (Free).
 *
 * @help
 * DeckBattleSystem.js v1.6
 *
 * Transforms the battle system into a deckbuilder.
 *
 * --- v1.6 Features ---
 * 1. Draw Command: 
 * - An in-battle button to draw 1 card.
 * - Configure costs (MP/TP) in parameters.
 * - Does NOT end turn, allowing you to fish for combos.
 * * 2. UI Focus:
 * - When the Card Hand is open, the Character Status Window (HP/MP bars)
 * is automatically HIDDEN to provide a clean view of your cards.
 *
 * 3. Manual Discard: 
 * - Highlight a card, press 'C' (or configured key) to discard.
 *
 * --- Parameters ---
 * - Hand Size: Cards drawn per turn.
 * - Draw Mechanic: Configure the cost to manually draw cards.
 *
 * --- Note Tags ---
 * <Exhaust>: Place in Skill Note. Removes card from combat until end of battle.
 */

(() => {
    "use strict";

    const pluginName = "DeckBattleSystem";
    const parameters = PluginManager.parameters(pluginName);
    
    // Parse Parameters
    const handSize = Number(parameters['Hand Size'] || 5);
    const keepHand = (parameters['Keep Hand'] === 'true');
    const excludedSkills = JSON.parse(parameters['Excluded Skills'] || '["1","2"]').map(Number);
    const discardKeyChar = String(parameters['Discard Key'] || 'c').toLowerCase();
    
    // Draw Mechanic Params
    const showDrawCmd = (parameters['Show Draw Command'] !== 'false');
    const drawCmdName = String(parameters['Draw Command Name'] || "Draw (+1)");
    const drawMpCost = Number(parameters['Draw MP Cost'] || 0);
    const drawTpCost = Number(parameters['Draw TP Cost'] || 10);

    // HUD Parameters
    const paramDeckX = String(parameters['Deck Window X'] || 'right').toLowerCase().trim();
    const paramDeckY = Number(parameters['Deck Window Y'] || 0);
    const showBackground = (parameters['Show HUD Background'] !== 'false');

    // -------------------------------------------------------------------------
    // Input Setup (Register Discard Key)
    // -------------------------------------------------------------------------
    const keyMap = {
        'c': 67, 'd': 68, 's': 83, 'a': 65, 'w': 87, 'shift': 16, 'tab': 9
    };
    
    // Auto-register the key defined in parameters
    const discardKeyCode = keyMap[discardKeyChar] || 67; 
    Input.keyMapper[discardKeyCode] = 'manualDiscard';

    const isExhaustSkill = (skillId) => {
        const skill = $dataSkills[skillId];
        return skill && skill.meta && !!skill.meta.Exhaust;
    };

    // -------------------------------------------------------------------------
    // Game_Deck
    // -------------------------------------------------------------------------
    class Game_Deck {
        constructor() {
            this._cards = [];
        }

        initialize(skills) {
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
            return this._cards.length;
        }

        get cards() {
            return this._cards;
        }
    }

    // -------------------------------------------------------------------------
    // Game_Hand
    // -------------------------------------------------------------------------
    class Game_Hand {
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
    }

    // -------------------------------------------------------------------------
    // Game_Actor
    // -------------------------------------------------------------------------
    const _Game_Actor_initMembers = Game_Actor.prototype.initMembers;
    Game_Actor.prototype.initMembers = function() {
        _Game_Actor_initMembers.call(this);
        this._deck = new Game_Deck();
        this._hand = new Game_Hand();
        this._discardPile = [];
        this._exhaustPile = [];
        this._deckInitialized = false;
        this._turnCardsDrawn = false;
    };

    const _Game_Actor_onBattleStart = Game_Actor.prototype.onBattleStart;
    Game_Actor.prototype.onBattleStart = function() {
        _Game_Actor_onBattleStart.call(this);
        this.setupDeck();
    };

    Game_Actor.prototype.setupDeck = function() {
        const skillIds = this.skills().map(s => s.id);
        this._deck.initialize(skillIds);
        this._discardPile = [];
        this._exhaustPile = [];
        this._hand.clear();
        this._deckInitialized = true;
        this._turnCardsDrawn = false;
    };

    Game_Actor.prototype.drawHand = function() {
        for (let i = 0; i < handSize; i++) {
            this.drawCard();
        }
    };

    Game_Actor.prototype.drawCard = function() {
        if (this._deck.size === 0) {
            this.reshuffleDiscard();
        }
        if (this._deck.size > 0) {
            const cardId = this._deck.draw();
            this._hand.add(cardId);
        }
    };

    Game_Actor.prototype.reshuffleDiscard = function() {
        if (this._discardPile.length > 0) {
            this._discardPile.forEach(id => this._deck.add(id));
            this._discardPile = [];
            this._deck.shuffle();
        }
    };

    Game_Actor.prototype.discardHand = function() {
        const cards = this._hand.clear();
        this._discardPile.push(...cards);
    };

    Game_Actor.prototype.manualDiscard = function(handIndex) {
        const cardId = this._hand.remove(handIndex);
        if (cardId) {
            this._discardPile.push(cardId);
            return true;
        }
        return false;
    };

    // Check if actor can pay for the Draw Command
    Game_Actor.prototype.canPayDrawCost = function() {
        return this.mp >= drawMpCost && this.tp >= drawTpCost;
    };

    // Pay the cost
    Game_Actor.prototype.payDrawCost = function() {
        this._mp -= drawMpCost;
        this._tp -= drawTpCost;
    };

    Game_Actor.prototype.processUsedCards = function(cardIds) {
        cardIds.forEach(id => {
            if (isExhaustSkill(id)) {
                this._exhaustPile.push(id);
            } else {
                this._discardPile.push(id);
            }
        });
    };

    Game_Actor.prototype.handSkills = function() {
        return this._hand.cards.map(id => $dataSkills[id]);
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
    // BattleManager
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
    // Window_DeckStatus
    // -------------------------------------------------------------------------
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
                if (actor._deck.size !== this._lastDeckSize || actor._discardPile.length !== this._lastDiscSize) {
                    this.refresh();
                }
            }
        }

        refresh() {
            this.contents.clear();
            if (!showBackground) {
                this.contents.fillRect(0, 0, this.contentsWidth(), this.contentsHeight(), "rgba(0, 0, 0, 0.5)");
            }

            if (!this._actor || !this._actor._deck) return;

            this._lastDeckSize = this._actor._deck.size;
            this._lastDiscSize = this._actor._discardPile.length;

            const width = this.contentsWidth();
            
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("Deck:", 0, 0, width, 'left');
            
            this.resetTextColor();
            this.drawText(this._lastDeckSize, 60, 0, width, 'left');

            this.changeTextColor(ColorManager.systemColor());
            this.drawText("| Disc:", 100, 0, width, 'left');

            this.resetTextColor();
            this.drawText(this._lastDiscSize, 180, 0, width, 'left');
        }
    }

    // -------------------------------------------------------------------------
    // Window_BattleHand
    // -------------------------------------------------------------------------
    class Window_BattleHand extends Window_ActorCommand {
        initialize(rect) {
            super.initialize(rect);
            this._actor = null;
            this.openness = 0;
            this.backOpacity = 255; // Solid background
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

            // 2. Add Draw Button (if enabled)
            if (showDrawCmd) {
                const canDraw = this._actor.canPayDrawCost();
                this.addCommand(drawCmdName, 'draw', canDraw, null);
            }
        }

        drawItem(index) {
            const rect = this.itemRect(index);
            const item = this._list[index];
            const symbol = item.symbol;
            
            rect.x += 4; rect.y += 4; rect.width -= 8; rect.height -= 8;
            this.changePaintOpacity(item.enabled);

            // Background for Card
            this.contents.strokeRect(rect.x, rect.y, rect.width, rect.height, ColorManager.normalColor());
            this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, ColorManager.itemBackColor1());

            if (symbol === 'card') {
                // --- RENDER SKILL CARD ---
                const skill = item.ext.skill;
                const isExhaust = isExhaustSkill(skill.id);
                
                const iconY = rect.y + 8;
                const iconX = rect.x + (rect.width - ImageManager.iconWidth) / 2;
                this.drawIcon(skill.iconIndex, iconX, iconY);

                if (isExhaust) {
                     this.contents.fontSize = 14;
                     this.changeTextColor(ColorManager.deathColor());
                     this.drawText("EXH", rect.x + 2, rect.y + 2, rect.width, 'left');
                }

                this.resetTextColor();
                this.contents.fontSize = 18;
                this.drawText(skill.name, rect.x, rect.y + 42, rect.width, 'center');

                const mpCost = this._actor.skillMpCost(skill);
                const tpCost = this._actor.skillTpCost(skill);
                let costText = "";
                if (mpCost > 0) costText += mpCost + "MP";
                if (tpCost > 0) costText += (costText ? " " : "") + tpCost + "TP";

                this.changeTextColor(ColorManager.systemColor());
                this.contents.fontSize = 16;
                this.drawText(costText, rect.x, rect.y + 68, rect.width, 'center');

            } else if (symbol === 'draw') {
                // --- RENDER DRAW BUTTON ---
                this.changeTextColor(ColorManager.crisisColor());
                this.contents.fontSize = 20;
                this.drawText("ACTION", rect.x, rect.y + 10, rect.width, 'center');
                
                this.resetTextColor();
                this.contents.fontSize = 18;
                this.drawText(item.name, rect.x, rect.y + 40, rect.width, 'center');

                let costText = "";
                if (drawMpCost > 0) costText += drawMpCost + "MP";
                if (drawTpCost > 0) costText += (costText ? " " : "") + drawTpCost + "TP";
                
                this.changeTextColor(ColorManager.systemColor());
                this.contents.fontSize = 16;
                this.drawText(costText, rect.x, rect.y + 68, rect.width, 'center');
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
            if (!item || item.symbol !== 'card') return; // Only discard cards, not buttons
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
        this._actorCommandWindow.setHandler("draw", this.onHandDraw.bind(this)); // Handle Draw
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

        // --- UI FIX: Hide Character Status Window when Hand is Open ---
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

    // New: Handle Draw Button
    Scene_Battle.prototype.onHandDraw = function() {
        const actor = BattleManager.actor();
        
        // Double check cost (though UI should prevent it)
        if (actor.canPayDrawCost()) {
            actor.payDrawCost();
            actor.drawCard();
            SoundManager.playShop(); // Sound effect
            
            // Refresh and Keep Active
            this._actorCommandWindow.refresh();
            this._actorCommandWindow.activate();
            if(this._deckStatusWindow) this._deckStatusWindow.refresh();
        } else {
             SoundManager.playBuzzer();
             this._actorCommandWindow.activate();
        }
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