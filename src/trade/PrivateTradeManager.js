import { PrivateTradeUIManager } from './PrivateTradeUIManager.js';
import { TradeStateManager } from './TradeStateManager.js';
import { PrivateTradeOfferState } from './PrivateTradeOfferState.js';
import { PrivateTradeLogic } from './PrivateTradeLogic.js';

console.log("PrivateTradeManager.js loaded.");

export class PrivateTradeManager {
    constructor(game) {
        this.game = game;
        this.privateTradeOfferState = new PrivateTradeOfferState(game);
        this.privateTradeUIManager = new PrivateTradeUIManager(game, this.privateTradeOfferState, this); // Pass privateTradeOfferState and self to UIManager
        this.privateTradeLogic = new PrivateTradeLogic(game, this.privateTradeOfferState, this.privateTradeUIManager);
    }

    /**
     * Delegates to PrivateTradeUIManager to open the private trade modal.
     * @param {string} npcId - The ID of the NPC for the trade.
     * @param {object} [initialTradeData=null] - Optional initial trade data.
     */
    openPrivateTradeModal(npcId, initialTradeData = null) {
        this.privateTradeUIManager.showPrivateTradeModal(npcId, initialTradeData);
    }

    /**
     * This method is now handled by PrivateTradeUIManager via handleAddItemRequest
     * The logic was moved to PrivateTradeUIManager to directly interact with UI elements for category/item selection
     * and then delegate to privateTradeOfferState for state updates.
     * This method should ideally be removed if it's no longer used, or call the UIManager method.
     * It's cleaner to have the UI-initiated actions go through the UIManager.
     */
    addPrivateTradeItem(traderType, npcId) {
        console.warn("PrivateTradeManager.addPrivateTradeItem is deprecated. Use PrivateTradeUIManager.handleAddItemRequest instead.");
        this.privateTradeUIManager.handleAddItemRequest(traderType, npcId);
    }

    /**
     * Delegates to PrivateTradeLogic to suggest a counter-offer.
     * @param {string} requesterType - 'player' or 'npc'.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     */
    suggestCounterOffer(requesterType, npcId) {
        this.privateTradeLogic.suggestCounterOffer(requesterType, npcId);
    }
    
    /**
     * Delegates to PrivateTradeLogic to propose and execute a private trade.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     */
    async proposePrivateTrade(npcId) {
        await this.privateTradeLogic.proposePrivateTrade(npcId);
    }
}