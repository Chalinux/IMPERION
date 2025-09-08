import { MarketSellManager } from './MarketSellManager.js';
import { NpcOfferGenerator } from '../utils/NpcOfferGenerator.js';
import { PublicOfferUIManager } from './PublicOfferUIManager.js';

console.log("PublicTradeManager.js loaded.");

export class PublicTradeManager {
    // NEW: Define server tax rate
    static SERVER_TAX_RATE = 0.10; // 10% tax on Imperion sales

    constructor(game) {
        this.game = game;
        this.marketSellManager = new MarketSellManager(game);
        this.npcOfferGenerator = new NpcOfferGenerator(game);
        this.publicOfferUIManager = new PublicOfferUIManager(game, this);
    }

    /**
     * Initializes public trade offers, including NPC offer generation.
     */
    initPublicTradeOffers() {
        // Delegate NPC technology initialization and initial offer generation
        this.npcOfferGenerator.generateInitialNpcOffers();
        
        // Periodically generate new NPC offers (e.g., every few minutes)
        setInterval(() => {
            this.npcOfferGenerator.generateNpcOffers(2);
            // After generating offers, update the trade view if it's currently active
            if (this.game.currentView === 'trade') {
                this.updatePublicTradeView();
            }
        }, 180000); // Generate 2 new offers every 3 minutes
    }

    /**
     * Validates if an NPC can offer a specific item in a given amount.
     * Delegates to TradeStateManager (via game.tradeSystem.tradeStateManager).
     * @param {object} npc - The NPC empire object.
     * @param {string} category - The category of the item.
     * @param {string} item - The specific item ID.
     * @param {number} amount - The amount of the item.
     * @returns {boolean} - True if the NPC can offer, false otherwise.
     */
    validateNpcCanOffer(npc, category, item, amount) {
        return this.game.tradeSystem.tradeStateManager.validateNpcCanOffer(npc, category, item, amount);
    }

    /**
     * Calculates the number of territories of a specific type owned by an NPC.
     * Delegates to TradeStateManager (via game.tradeSystem.tradeStateManager).
     * @param {string} npcId - The ID of the NPC.
     * @param {string} terrainType - The type of terrain to count.
     * @returns {number} - The count of territories.
     */
    getNpcTerritoryCount(npcId, terrainType) {
        return this.game.tradeSystem.tradeStateManager.getNpcTerritoryCount(npcId, terrainType);
    }

    /**
     * Delegates to MarketSellManager to open the sell modal.
     */
    openSellToMarketModal() {
        this.marketSellManager.openSellToMarketModal();
    }

    /**
     * Accepts a public market offer from an NPC or another player.
     * Applies server tax if the offer is from another player.
     * @param {string} offerId The ID of the offer to accept.
     */
    acceptPublicOffer(offerId) {
        // First check in NPC offers
        let offerIndex = this.game.tradeSystem.npcOffers.findIndex(offer => offer.id === offerId);
        let offerList = this.game.tradeSystem.npcOffers;
        let isPlayerToPlayerOffer = false;

        if (offerIndex === -1) {
            // If not found in NPC offers, check in player's public offers (offers created by other players, displayed in buy tab)
            offerIndex = this.game.tradeSystem.playerOffers.findIndex(offer => offer.id === offerId && offer.creatorId !== this.game.profileManager.playerProfile.userId);
            offerList = this.game.tradeSystem.playerOffers;
            isPlayerToPlayerOffer = true;
        }

        if (offerIndex === -1) {
            this.game.newsManager.addNews('Oferta no encontrada o ya expiró.', 'comercio');
            return;
        }

        const offer = offerList[offerIndex];
        
        // Validate player can afford what's requested - delegate to TradeStateManager
        if (!this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(offer.requestedCategory, offer.requestedItem, offer.requestedAmount)) {
            this.game.newsManager.addNews('No tienes suficientes recursos para aceptar esta oferta.', 'comercio');
            this.game.uiManager.notificationManager.showNotification('error', '¡Recursos insuficientes para aceptar la oferta!');
            return;
        }
        
        // Deduct requested items from player - delegate to TradeStateManager
        this.game.tradeSystem.tradeStateManager.deductPlayerItems(offer.requestedCategory, offer.requestedItem, offer.requestedAmount);
        
        // Give offered items to player - delegate to TradeStateManager
        this.game.tradeSystem.tradeStateManager.givePlayerItems(offer.offeredCategory, offer.offeredItem, offer.offeredAmount);
        
        // --- Apply Server Tax if it's a player-to-player offer ---
        if (isPlayerToPlayerOffer && offer.requestedCategory === 'resources' && offer.requestedItem === 'imperion') {
            // For simplicity, assume player-to-player offers always involve Imperion being requested
            // Give Imperion to the original creator of the offer, minus tax
            const imperionReceivedBySeller = offer.requestedAmount * (1 - PublicTradeManager.SERVER_TAX_RATE);
            
            // Find the seller (the original creator of this offer)
            // For now, we don't have a persistent player wallet for other players,
            // so we will just simulate the tax deduction. The "seller" doesn't actually get funds added.
            // This is a simplification; in a real multiplayer game, seller's wallet would be updated.
            
            const taxAmount = offer.requestedAmount * PublicTradeManager.SERVER_TAX_RATE;
            this.game.newsManager.addNews(`Impuesto de mercado: ${taxAmount.toFixed(1)} 👑 Imperion deducidos de la venta.`, 'comercio');
            this.game.uiManager.notificationManager.showNotification('info', `Impuesto de mercado aplicado.`, 3000);
            
            // News for the original seller would typically go here (e.g., "Your offer of X was sold for Y Imperion (after tax)")
        }

        offerList.splice(offerIndex, 1); // Remove the offer
        
        // Use TradeDisplayHelper for trade description
        this.game.newsManager.addNews(`Intercambio completado: Recibiste ${this.game.tradeSystem.tradeDisplayHelper.getTradeDescription(offer.offeredCategory, offer.offeredItem, offer.offeredAmount)}`, 'comercio');
        this.game.uiManager.notificationManager.showNotification('trade_accepted', `¡Intercambio completado!`);
        this.updatePublicTradeView();
    }

    /**
     * Cancels a player's public market offer.
     * @param {string} offerId The ID of the offer to cancel.
     */
    cancelPublicOffer(offerId) {
        const offerIndex = this.game.tradeSystem.playerOffers.findIndex(offer => offer.id === offerId);
        if (offerIndex !== -1) {
            const offer = this.game.tradeSystem.playerOffers[offerIndex];
            // Return offered items to player - delegate to TradeStateManager
            this.game.tradeSystem.tradeStateManager.givePlayerItems(offer.offeredCategory, offer.offeredItem, offer.offeredAmount); 
            this.game.tradeSystem.playerOffers.splice(offerIndex, 1);
            // Use TradeDisplayHelper for trade description
            this.game.newsManager.addNews(`Tu oferta de ${this.game.tradeSystem.tradeDisplayHelper.getTradeDescription(offer.offeredCategory, offer.offeredItem, offer.offeredAmount)} ha sido cancelada.`, 'comercio');
            this.game.uiManager.notificationManager.showNotification('info', `Tu oferta ha sido cancelada.`);
            this.updatePublicTradeView();
        }
    }

    /**
     * Helper to get trade item content with image or emoji.
     * @param {string} category - The item category.
     * @param {string} item - The item key.
     * @param {number} amount - The amount.
     * @returns {string} HTML string for the item display.
     */
    _getTradeItemDisplayContent(category, item, amount) {
        const iconPath = this.game.tradeSystem.tradeDisplayHelper.getIconForItem(category, item);
        const displayName = this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item);
        const emojiIcon = this.game.tradeSystem.tradeStateManager.tradeItemTypes[category]?.[item]?.icon;

        let content = '';
        if (iconPath) {
            content = `<img src="${iconPath}" alt="${displayName}" class="trade-item-inline-icon"> ${amount} ${displayName}`;
        } else if (emojiIcon) {
            content = `${emojiIcon} ${amount} ${displayName}`;
        } else {
            content = `${amount} ${displayName}`;
        }
        return content;
    }

    /**
     * Updates the display of the public trade view (player offers and market offers).
     * Now delegates to PublicOfferUIManager.
     */
    updatePublicTradeView() {
        this.publicOfferUIManager.updatePublicTradeView();
    }

    /**
     * Determines the CSS class for trade fairness based on value ratio.
     * Moved from UIManager.js.
     */
    getTradeFairnessClass(offeredValue, requestedValue) {
        const ratio = offeredValue / requestedValue;
        if (ratio >= 0.9 && ratio <= 1.1) return 'fair-trade';
        if (ratio > 1.1) return 'generous-trade';
        return 'demanding-trade';
    }

    /**
     * Provides a descriptive text for trade fairness.
     * Moved from UIManager.js.
     */
    getTradeFairnessText(offeredValue, requestedValue) {
        const ratio = offeredValue / requestedValue;
        if (ratio >= 0.9 && ratio <= 1.1) return '⚖️ Intercambio Justo';
        if (ratio > 1.1) return '💎 Oferta Generosa';
        return '📈 Solicita Más Valor';
    }

    /**
     * Determines the CSS class for the value badge based on the maximum value.
     * Moved from UIManager.js.
     */
    getValueBadgeClass(offeredValue, requestedValue) {
        const maxValue = Math.max(offeredValue, requestedValue);
        if (maxValue >= 200) return 'high-value';
        if (maxValue >= 100) return 'medium-value';
        return 'low-value';
    }

    /**
     * Generates HTML status indicating if player can afford an item.
     * Moved from UIManager.js.
     */
    getAvailabilityStatus(category, item, amount) {
        const canAfford = this.canAffordTrade(category, item, amount);
        if (canAfford) {
            return '<span class="availability-ok">✅ Puedes realizar este intercambio</span>';
        } else {
            const missing = this.getMissingResources(category, item, amount);
            return `<span class="availability-error">❌ ${missing}</span>`;
        }
    }

    /**
     * Checks if the player can afford a trade item.
     * Delegates to TradeStateManager (via game.tradeSystem.tradeStateManager).
     */
    canAffordTrade(category, item, amount) {
        return this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(category, item, amount);
    }

    /**
     * Generates a message indicating what resources are missing for a trade.
     * Delegates to TradeStateManager (via game.tradeSystem.tradeStateManager).
     */
    getMissingResources(category, item, amount) {
        // Now using tradeDisplayHelper to get item display name
        switch (category) {
            case 'resources':
                const current = Math.floor(this.game.resourceManager.resources[item] || 0);
                const needed = amount - current;
                return `Necesitas ${needed} más de ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}`;
            case 'troops':
                const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
                const troopsOwned = cityTile.troops[item] || 0;
                const troopsNeeded = amount - troopsOwned;
                return `Necesitas ${troopsNeeded} más ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}`;
            case 'territories':
                const owned = this.game.tradeSystem.tradeStateManager.getPlayerTerritoryCount(item);
                const territoriesNeeded = amount - owned;
                return `Necesitas ${territoriesNeeded} más territorios de ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}`;
            case 'technology':
                return `No posees la tecnología: ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}`;
            case 'dragons':
                return `No posees el dragón: ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}`;
            case 'special': // Specific for dragon egg
                if (item === 'dragon_egg') {
                    return this.game.playerDragons.length > 0 ? 'Ya tienes un dragón. No necesitas un huevo.' : 'Huevo de Dragón no disponible para venta directa.';
                }
                return 'Artículo especial no disponible';
            default:
                return 'Recurso no disponible';
        }
    }

    /**
     * Opens a modal for the player to create a new public offer (selling for Imperion).
     * Now delegates to PublicOfferUIManager.
     */
    openCreatePublicOfferModal() {
        this.publicOfferUIManager.openCreatePublicOfferModal();
    }

    /**
     * Creates a new public market offer by the player (selling an item for Imperion).
     * This method remains in PublicTradeManager as it directly modifies game state.
     */
    createPublicOffer(category, item, amount, requestedPrice) {
        if (!item || amount <= 0 || requestedPrice <= 0) {
            this.game.newsManager.addNews('Por favor, selecciona un artículo válido, cantidad y precio para tu oferta.', 'comercio');
            this.game.uiManager.notificationManager.showNotification('error', '¡Oferta inválida!');
            return;
        }

        if (!this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(category, item, amount)) {
            this.game.newsManager.addNews('No tienes suficientes artículos para crear esta oferta pública.', 'comercio');
            this.game.uiManager.notificationManager.showNotification('error', '¡Artículos insuficientes!');
            return;
        }

        // Deduct items immediately when the offer is published
        this.game.tradeSystem.tradeStateManager.deductPlayerItems(category, item, amount);

        const newOffer = {
            id: `player_trade_${this.game.tradeSystem.offerIdCounter++}`,
            creator: this.game.profileManager.playerProfile.username,
            creatorId: this.game.profileManager.playerProfile.userId,
            offeredCategory: category,
            offeredItem: item,
            offeredAmount: amount,
            requestedCategory: 'resources', // Always Imperion for player-to-player public sales
            requestedItem: 'imperion',
            requestedAmount: requestedPrice,
            offeredValue: this.game.tradeSystem.tradeStateManager.calculateTotalValue(category, item, amount),
            requestedValue: requestedPrice // Imperion is its own value
        };

        this.game.tradeSystem.playerOffers.push(newOffer);
        this.game.newsManager.addNews(`Has publicado una oferta de ${this.game.tradeSystem.tradeDisplayHelper.getTradeDescription(category, item, amount)} por ${requestedPrice.toFixed(1)} 👑 Imperion.`, 'comercio');
        this.game.uiManager.notificationManager.showNotification('trade_published', '¡Oferta pública publicada con éxito!');
        this.game.uiManager.closeModal();
        this.updatePublicTradeView(); // Refresh the trade view to show the new offer
    }
}