import { PrivateTradeManager } from './PrivateTradeManager.js';
import { PublicTradeManager } from './PublicTradeManager.js';
import { MarketSellManager } from './MarketSellManager.js';
import { TradeStateManager } from './TradeStateManager.js';
import { TradeDisplayHelper } from './TradeDisplayHelper.js';

export class TradeSystem {
    constructor(game) {
        this.game = game;
        this.playerOffers = [];
        this.npcOffers = [];
        this.offerIdCounter = 0;
        
        this.tradeStateManager = new TradeStateManager(game);
        this.tradeDisplayHelper = new TradeDisplayHelper(game);
        
        this.privateTradeManager = new PrivateTradeManager(game);
        this.publicTradeManager = new PublicTradeManager(game);
    }

    init() {
        this.tradeStateManager.initializeNpcTechnologies();
        this.publicTradeManager.initPublicTradeOffers();
    }

    openCreateSellOfferModal() {
        this.publicTradeManager.marketSellManager.openSellToMarketModal();
    }

    openPrivateTradeModal(npcId, initialTradeData = null) {
        // Now delegate to privateTradeManager, which then delegates to privateTradeUIManager
        this.privateTradeManager.openPrivateTradeModal(npcId, initialTradeData);
    }
}