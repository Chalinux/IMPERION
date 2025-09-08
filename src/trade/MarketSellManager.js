import { MarketSellUIManager } from './MarketSellUIManager.js';
import { PublicTradeManager } from './PublicTradeManager.js'; // Import PublicTradeManager for SERVER_TAX_RATE

console.log("MarketSellManager.js loaded.");

export class MarketSellManager {
    constructor(game) {
        this.game = game;
        this.marketSellUIManager = new MarketSellUIManager(game);
    }

    /**
     * Opens the modal for players to sell items for Imperion (instant transaction).
     * Now delegates to MarketSellUIManager.
     */
    openSellToMarketModal() {
        this.marketSellUIManager.openSellToMarketModal();
    }

    /**
     * Executes the instant sell transaction.
     * This deducts the item from the player and gives Imperion in return.
     * It does NOT create a persistent public offer on the market.
     * Applies a server tax.
     * Moved from PublicTradeManager.js.
     */
    executeInstantSell() {
        const category = document.getElementById('sell-category-offered').value;
        const item = document.getElementById('sell-item-offered').value;
        const amount = parseInt(document.getElementById('sell-amount-offered').value);
        let price = parseFloat(document.getElementById('sell-price-imperion').value); // The price the player will *receive* initially before tax

        if (!item || amount <= 0 || price <= 0) {
            this.game.newsManager.addNews('Por favor, selecciona un artículo válido, cantidad y precio.', 'comercio');
            this.game.uiManager.notificationManager.showNotification('error', '¡Venta inválida!');
            return;
        }

        // Use PublicTradeManager's canAffordTrade (which internally uses TradeStateManager)
        if (!this.game.tradeSystem.publicTradeManager.canAffordTrade(category, item, amount)) {
            this.game.newsManager.addNews('No tienes suficientes artículos para vender.', 'comercio');
            this.game.uiManager.notificationManager.showNotification('error', '¡Artículos insuficientes!');
            return;
        }
        
        // Calculate tax
        const taxAmount = price * PublicTradeManager.SERVER_TAX_RATE;
        const finalPriceReceived = price - taxAmount;

        // Use TradeStateManager for deducting/giving items
        this.game.tradeSystem.tradeStateManager.deductPlayerItems(category, item, amount);
        this.game.resourceManager.resources.imperion += finalPriceReceived; // Player receives after tax
        this.game.resourceManager.updateResourceDisplay();
        
        // Use TradeDisplayHelper for item display name
        this.game.newsManager.addNews(`Vendiste ${amount} ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)} por ${finalPriceReceived.toFixed(1)} 👑 Imperion (Impuesto: ${taxAmount.toFixed(1)}).`, 'comercio');
        this.game.uiManager.notificationManager.showNotification('trade_accepted', `Vendiste ${amount} ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)} por ${finalPriceReceived.toFixed(1)} Imperion.`);
        this.game.uiManager.closeModal();
        this.game.tradeSystem.publicTradeManager.updatePublicTradeView(); // Refresh trade view after selling
    }
}