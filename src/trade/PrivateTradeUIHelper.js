import { PrivateTradeUIManager } from './PrivateTradeUIManager.js';
import { PrivateTradeOfferState } from './PrivateTradeOfferState.js';
import { TradeDisplayHelper } from './TradeDisplayHelper.js';

console.log("PrivateTradeUIHelper.js loaded.");

export class PrivateTradeUIHelper {
    constructor(game, privateTradeOfferState, privateTradeUIManager) {
        this.game = game;
        this.privateTradeOfferState = privateTradeOfferState;
        this.privateTradeUIManager = privateTradeUIManager;
    }

    /**
     * Generates the HTML for the entire private trade modal content.
     * This method is the primary entry point for the modal's HTML structure.
     * @param {object} npc - The NPC empire object.
     * @returns {string} Complete HTML string for the private trade modal.
     */
    getPrivateTradeModalHtml(npc) {
        const playerPanel = this.generatePlayerPanelHtml(npc.id);
        const negotiationCenter = this.generateNegotiationCenterHtml(npc.id);
        const npcPanel = this.generateNpcPanelHtml(npc, npc.id);

        return `
            <div class="private-trade-panel">
                ${playerPanel}
                ${negotiationCenter}
                ${npcPanel}
            </div>
        `;
    }

    /**
     * Generates the HTML for the player's trade panel.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {string} HTML for the player's trade panel.
     */
    generatePlayerPanelHtml(npcId) {
        // MODIFIED: Use player's actual profile image and username
        const playerLeaderImg = this.game.profileManager.playerProfile.avatarUrl;
        const playerLeaderName = this.game.profileManager.playerProfile.username;

        return `
            <div class="trade-participant-panel your-panel">
                <div class="leader-portrait-container">
                    <img src="${playerLeaderImg}" alt="Tu Líder" class="leader-portrait">
                    <span class="leader-name">${playerLeaderName}</span>
                </div>
                <h3>Tu Oferta</h3>
                ${this._generateCombinedItemSelectorHtml('player', npcId)}
                <div id="private-trade-player-items" class="trade-items-list"></div>
                <div class="total-value">Valor Total: <span id="private-player-total-value">0</span> 👑</div>
            </div>
        `;
    }

    /**
     * Generates the HTML for the negotiation center section.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {string} HTML for the negotiation center.
     */
    generateNegotiationCenterHtml(npcId) {
        return `
            <div class="trade-negotiation-center">
                <div class="trade-arrow-large">⇄</div>
                <div id="private-trade-summary"></div>
                <button class="medieval-btn propose-trade-btn" onclick="game.tradeSystem.privateTradeManager.proposePrivateTrade('${npcId}')">Proponer Intercambio</button>
                <button class="medieval-btn suggest-counter-btn" onclick="game.tradeSystem.privateTradeManager.suggestCounterOffer('player', '${npcId}')">✨ Sugerir Contraoferta</button>
                <div class="trade-balance-container">
                    <div class="trade-balance-bar"></div>
                    <div class="trade-balance-marker" id="private-balance-marker"></div>
                </div>
                <img id="balance-scale-image" src="/assets/images/ui/balance_scale.png" alt="Balance Scale" style="width: 150px; height: auto; margin-top: 10px; image-rendering: pixelated; filter: drop-shadow(2px 2px 5px rgba(0,0,0,0.7));">
            </div>
        `;
    }

    /**
     * Generates the HTML for the NPC's trade panel.
     * @param {object} npc - The NPC empire object.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {string} HTML for the NPC's trade panel.
     */
    generateNpcPanelHtml(npc, npcId) {
        // NOTE: NPC leader image is currently hardcoded to milicia1.png.
        // If specific NPC avatars are introduced, this should be dynamic.
        const npcLeaderImg = 'assets/images/units/milicia1.png';
        const npcLeaderName = npc.name;

        return `
            <div class="trade-participant-panel npc-panel">
                <div class="leader-portrait-container">
                    <img src="${npcLeaderImg}" alt="Líder NPC" class="leader-portrait">
                    <span class="leader-name">${npcLeaderName}</span>
                </div>
                <h3>Oferta de ${npc.name}</h3>
                ${this._generateCombinedItemSelectorHtml('npc', npcId)}
                <div id="private-trade-npc-items" class="trade-items-list"></div>
                <div class="total-value">Valor Total: <span id="private-npc-total-value">0</span> 👑</div>
            </div>
        `;
    }

    /**
     * NEW: Private helper method to generate the HTML for the combined item selection dropdown and filters.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {string} HTML for the combined trade item selector.
     */
    _generateCombinedItemSelectorHtml(traderType, npcId) {
        const categories = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes);
        const categoryFiltersHtml = categories.map(cat => {
            const firstItemKey = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes[cat] || {})[0];
            const categoryName = firstItemKey ? (this.game.tradeSystem.tradeStateManager.tradeItemTypes[cat][firstItemKey]?.category || cat) : cat;
            return `<button class="medieval-btn" onclick="game.tradeSystem.privateTradeManager.privateTradeUIManager.filterTradeItems('${traderType}', '${cat}', '${npcId}', this)">${categoryName}</button>`;
        }).join('');

        return `
            <div class="trade-item-selector-combined">
                <div class="trade-item-filters">
                    <button class="medieval-btn active" onclick="game.tradeSystem.privateTradeManager.privateTradeUIManager.filterTradeItems('${traderType}', 'all', '${npcId}', this)" data-category-filter="all">Todas</button>
                    ${categoryFiltersHtml}
                </div>
                <select id="${traderType}-trade-item-select" class="trade-item-select-dropdown" onchange="game.tradeSystem.privateTradeManager.privateTradeUIManager.handleItemSelectionChange('${traderType}')">
                    <!-- Options will be populated by JavaScript -->
                </select>
                <button class="medieval-btn add-item-btn-combined" id="${traderType}-add-item-btn-combined" onclick="game.tradeSystem.privateTradeManager.privateTradeUIManager.handleAddItemRequest('${traderType}', '${npcId}')">
                    ➕ Añadir
                </button>
            </div>
        `;
    }

    /**
     * This method is now OBSOLETE as category and item selection are handled via separate modals.
     * Its filtering logic has been moved to PrivateTradeUIManager.createItemButtons.
     */
    updatePrivateItemOptions(traderType, npcId) {
        console.warn("PrivateTradeUIHelper.updatePrivateItemOptions is obsolete and should not be called.");
    }

    /**
     * Generates the HTML for the list of trade items for a given trader type.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {string} HTML string for the list of trade items.
     */
    generateTradeItemsListHtml(traderType, npcId) {
        const tradeList = (traderType === 'player') ? this.privateTradeOfferState.playerOffers : this.privateTradeOfferState.npcOffers;

        return tradeList.map((offer, index) => {
            const maxAmount = this.game.tradeSystem.tradeStateManager.getMaxAmountForListedItem(traderType, offer.category, offer.item, npcId);
            const isSingleItem = (offer.category === 'dragons' || offer.category === 'technology' || offer.category === 'special' || offer.category === 'territories');
            const displayName = this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(offer.item);
            const imageSrc = this.game.tradeSystem.tradeDisplayHelper.getIconForItem(offer.category, offer.item);

            return `
                <div class="trade-item-entry">
                    <div class="item-details">
                        <img src="${imageSrc}" alt="Icon">
                        <span>${displayName}</span>
                    </div>
                    <div class="item-amount-controls">
                        <div class="amount-slider-wrapper">
                            <input type="range" 
                                   id="${traderType}-item-${index}-amount" 
                                   class="trade-slider" 
                                   value="${offer.amount}" 
                                   min="0" 
                                   max="${maxAmount}" 
                                   ${isSingleItem ? 'disabled' : ''} 
                                   oninput="game.tradeSystem.privateTradeManager.privateTradeUIManager.updatePrivateListedItemAmount('${traderType}', ${index}, this.value, '${npcId}')">
                            <span id="${traderType}-item-${index}-value" class="slider-value">${offer.amount}</span>
                        </div>
                        <div class="amount-buttons">
                            <button class="medieval-btn compact-btn" ${isSingleItem ? 'disabled' : ''} onclick="game.tradeSystem.privateTradeManager.privateTradeUIManager.setPrivateListedItemPercentage('${traderType}', ${index}, 0.25, '${npcId}')">25%</button>
                            <button class="medieval-btn compact-btn" ${isSingleItem ? 'disabled' : ''} onclick="game.tradeSystem.privateTradeManager.privateTradeUIManager.setPrivateListedItemPercentage('${traderType}', ${index}, 0.50, '${npcId}')">50%</button>
                            <button class="medieval-btn compact-btn" ${isSingleItem ? 'disabled' : ''} onclick="game.tradeSystem.privateTradeManager.privateTradeUIManager.setPrivateListedItemMax('${traderType}', ${index}, '${npcId}')">MAX</button>
                        </div>
                    </div>
                    <button class="medieval-btn compact-remove-btn" onclick="game.tradeSystem.privateTradeManager.privateTradeUIManager.handleRemoveItemRequest('${traderType}', ${index}, '${npcId}')">❌</button>
                </div>
            `;
        }).join('');
    }
}