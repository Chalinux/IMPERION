console.log("NpcOfferGenerator.js loaded.");

export class NpcOfferGenerator {
    constructor(game) {
        this.game = game;
    }

    /**
     * Initializes technologies for all NPC empires.
     * This method is now called from TradeSystem.init() and delegates to TradeStateManager.
     */
    // initializeNpcTechnologies() { /* Moved to TradeStateManager */ }

    /**
     * Generates a specified number of initial NPC public market offers.
     */
    generateInitialNpcOffers() {
        this.generateNpcOffers(8); // Generate 8 initial offers
    }

    /**
     * Generates new NPC public market offers.
     * @param {number} count - The number of offers to generate.
     */
    generateNpcOffers(count) {
        // Use tradeStateManager for item types
        const itemCategories = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes);
        
        for (let i = 0; i < count; i++) {
            // Verificar si hay NPCs disponibles
            if (!this.game.npcEmpires || this.game.npcEmpires.length === 0) {
                console.log('⚠️ No hay NPCs disponibles para generar ofertas');
                return;
            }
            const randomNpc = this.game.npcEmpires[Math.floor(Math.random() * this.game.npcEmpires.length)];
            
            // Choose random offered and requested items
            const offeredCategory = itemCategories[Math.floor(Math.random() * itemCategories.length)];
            let requestedCategory = itemCategories[Math.floor(Math.random() * itemCategories.length)];
            
            // Ensure different categories
            while (offeredCategory === requestedCategory) {
                requestedCategory = itemCategories[Math.floor(Math.random() * itemCategories.length)];
            }
            
            // Use tradeStateManager for item types
            const offeredItems = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes[offeredCategory]);
            const requestedItems = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes[requestedCategory]);
            
            const offeredItem = offeredItems[Math.floor(Math.random() * offeredItems.length)];
            const requestedItem = requestedItems[Math.floor(Math.random() * requestedItems.length)];
            
            // Use tradeStateManager for item values
            const offeredValue = this.game.tradeSystem.tradeStateManager.tradeItemTypes[offeredCategory]?.[offeredItem]?.value || 0;
            const requestedValue = this.game.tradeSystem.tradeStateManager.tradeItemTypes[requestedCategory]?.[requestedItem]?.value || 0;
            
            let offeredAmount, requestedAmount;
            
            if (offeredCategory === 'territories' || requestedCategory === 'territories') {
                offeredAmount = 1;
                requestedAmount = 1;
            } else if (offeredCategory === 'technology' || requestedCategory === 'technology') {
                offeredAmount = 1;
                requestedAmount = Math.max(1, Math.floor(offeredValue / (requestedValue || 1)));
            } else if (offeredCategory === 'special' || requestedCategory === 'special') {
                offeredAmount = 1;
                requestedAmount = Math.max(1, Math.floor(offeredValue / (requestedValue || 1)));
            } else {
                const baseRatio = offeredValue / (requestedValue || 1);
                const multiplier = 0.8 + Math.random() * 0.4; // 80-120% of fair value
                
                offeredAmount = Math.floor(Math.random() * 200) + 50; // 50-249
                requestedAmount = Math.max(1, Math.floor(offeredAmount * baseRatio * multiplier));
            }
            
            // Validate NPC can offer what they're proposing - delegate to TradeStateManager
            if (!this.game.tradeSystem.tradeStateManager.validateNpcCanOffer(randomNpc, offeredCategory, offeredItem, offeredAmount)) {
                continue; // Skip this offer if NPC can't provide it
            }
            
            this.game.tradeSystem.npcOffers.push({
                id: `npc_trade_${this.game.tradeSystem.offerIdCounter++}`,
                creator: randomNpc.name,
                creatorId: randomNpc.id,
                offeredCategory: offeredCategory,
                offeredItem: offeredItem,
                offeredAmount: offeredAmount,
                requestedCategory: requestedCategory,
                requestedItem: requestedItem,
                requestedAmount: requestedAmount,
                // Use tradeStateManager for calculating values
                offeredValue: this.game.tradeSystem.tradeStateManager.calculateTotalValue(offeredCategory, offeredItem, offeredAmount),
                requestedValue: this.game.tradeSystem.tradeStateManager.calculateTotalValue(requestedCategory, requestedItem, requestedAmount)
            });

            // Simulate NPC sending a private offer notification
            if (Math.random() < 0.2) { // 20% chance to notify about a new private offer
                const npcOffersExample = [{ category: 'resources', item: 'food', amount: 500 }];
                const playerRequestsExample = [{ category: 'resources', item: 'wood', amount: 200 }];
                
                this.game.uiManager.notificationManager.showNotification('private_offer_received', 
                    `${randomNpc.name} tiene una nueva oferta comercial para ti.`, 
                    7000, 
                    { 
                        type: 'open_private_trade', 
                        npcId: randomNpc.id, 
                        offerData: {
                            npcOffers: npcOffersExample,
                            playerRequests: playerRequestsExample 
                        }
                    }
                );
            }
        }
        
        // Keep only the most recent 20 offers
        if (this.game.tradeSystem.npcOffers.length > 20) {
            this.game.tradeSystem.npcOffers = this.game.tradeSystem.npcOffers.slice(-20);
        }
    }
}