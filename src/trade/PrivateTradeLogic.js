// NEW FILE: PrivateTradeLogic.js
// This class encapsulates the core business logic for private trade negotiations,
// including suggesting counter-offers and processing trade proposals.

export class PrivateTradeLogic {
    constructor(game, privateTradeOfferState, privateTradeUIManager) {
        this.game = game;
        this.privateTradeOfferState = privateTradeOfferState;
        this.privateTradeUIManager = privateTradeUIManager;
    }

    /**
     * Generates and applies a counter-offer to the private trade.
     * @param {string} requesterType - 'player' if the player requests the counter, 'npc' if NPC initiates.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     */
    suggestCounterOffer(requesterType, npcId) {
        const npc = this.game.getNpcById(npcId);
        if (!npc) return;

        let proposingSideItems; // The items the requesting side is currently offering
        let receivingSideItems; // The items the other side is currently offering (to be replaced by counter-offer)
        let receivingSideTraderType; // 'player' or 'npc' for the side receiving the counter-offer
        let newsMessagePrefix;

        if (requesterType === 'player') {
            proposingSideItems = this.privateTradeOfferState.playerOffers;
            receivingSideItems = this.privateTradeOfferState.npcOffers;
            receivingSideTraderType = 'npc';
            newsMessagePrefix = `Has solicitado una contraoferta a ${npc.name}`;
        } else {
            proposingSideItems = this.privateTradeOfferState.npcOffers;
            receivingSideItems = this.privateTradeOfferState.playerOffers;
            receivingSideTraderType = 'player';
            newsMessagePrefix = `Una contraoferta ha sido sugerida por ${npc.name}`;
        }

        // Calculate the value of what the proposing side is offering
        const valueOfProposingSide = proposingSideItems.reduce((total, offer) =>
            total + this.game.tradeSystem.tradeStateManager.calculateTotalValue(offer.category, offer.item, offer.amount)
        , 0);

        // Generate a new item for the receiving side that roughly matches the value
        // Pass relevantNpcId to generateTradeItemForValue for accurate NPC inventory checks
        const recommendedItem = this.game.tradeSystem.tradeStateManager.generateTradeItemForValue(
            valueOfProposingSide,
            receivingSideTraderType,
            npcId
        );

        // Clear existing offers from the receiving side and add the new recommended item
        receivingSideItems.length = 0; // Clears the array
        if (recommendedItem) {
            receivingSideItems.push(recommendedItem);
            this.game.newsManager.addNews(`${newsMessagePrefix}: ${this.game.tradeSystem.tradeDisplayHelper.getTradeDescription(recommendedItem.category, recommendedItem.item, recommendedItem.amount)}.`, "comercio"); // Use TradeDisplayHelper
            this.game.uiManager.notificationManager.showNotification('info', `Sugerencia de contraoferta generada.`);
        } else {
            this.game.newsManager.addNews(`${newsMessagePrefix}: No se pudo generar una contraoferta equivalente en este momento.`, "comercio");
            this.game.uiManager.notificationManager.showNotification('error', `No se pudo generar una contraoferta.`);
        }

        // Re-render UI to reflect the new offers
        this.privateTradeUIManager.renderPrivateTradeItems(npcId);
        this.privateTradeUIManager.updatePrivateTradeUIElementsVisibility();
    }

    /**
     * Processes a private trade proposal, validating and executing the exchange if accepted.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     */
    async proposePrivateTrade(npcId) {
        const npc = this.game.getNpcById(npcId);
        const playerOffers = this.privateTradeOfferState.playerOffers;
        const npcOffers = this.privateTradeOfferState.npcOffers;

        if (playerOffers.length === 0 && npcOffers.length === 0) {
            this.game.newsManager.addNews("Debes proponer un intercambio.", "comercio");
            return;
        }

        // Validate player's offers
        for (const offer of playerOffers) {
            if (!this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(offer.category, offer.item, offer.amount)) {
                this.game.newsManager.addNews(`No puedes ofrecer ${this.game.tradeSystem.tradeDisplayHelper.getTradeDescription(offer.category, offer.item, offer.amount)}.`, "comercio"); // Use TradeDisplayHelper
                this.game.uiManager.notificationManager.showNotification('error', `¡Fallo en la oferta! No tienes suficientes ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(offer.item)}.`); // Use TradeDisplayHelper
                return;
            }
        }
        
        // Validate NPC's offers
        for (const offer of npcOffers) {
            if (!this.game.tradeSystem.tradeStateManager.validateNpcCanOffer(npc, offer.category, offer.item, offer.amount)) {
                this.game.newsManager.addNews(`${npc.name} no puede ofrecer ${this.game.tradeSystem.tradeDisplayHelper.getTradeDescription(offer.category, offer.item, offer.amount)}.`, "comercio"); // Use TradeDisplayHelper
                this.game.uiManager.notificationManager.showNotification('error', `¡Fallo en la oferta! ${npc.name} no tiene suficientes ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(offer.item)}.`); // Use TradeDisplayHelper
                return;
            }
        }

        // Calculate values and determine acceptance
        const playerValue = playerOffers.reduce((total, offer) => total + this.game.tradeSystem.tradeStateManager.calculateTotalValue(offer.category, offer.item, offer.amount), 0);
        const npcValue = npcOffers.reduce((total, offer) => total + this.game.tradeSystem.tradeStateManager.calculateTotalValue(offer.category, offer.item, offer.amount), 0);
        
        const ratio = playerValue / (npcValue || 1);
        const accepted = ratio >= 0.9; // NPC accepts if player's offer is at least 90% of NPC's requested value

        if (accepted) {
            // Player's items are deducted immediately
            playerOffers.forEach(offer => this.game.tradeSystem.tradeStateManager.deductPlayerItems(offer.category, offer.item, offer.amount));
            
            // Give player items to NPC
            playerOffers.forEach(offer => {
                if (offer.category === 'resources' && npc.inventory) {
                    npc.inventory[offer.item] = (npc.inventory[offer.item] || 0) + offer.amount;
                }
            });

            // --- NEW: DYNAMIC EVENT & CARAVAN ---
            let finalNpcOffers = JSON.parse(JSON.stringify(npcOffers)); // Deep copy to modify
            let eventMessage = null;
            let caravanId = null;

            // Roll for a dynamic event (e.g., bandit ambush)
            if (Math.random() < 0.25) { // 25% chance of an ambush
                eventMessage = "¡Emboscada! Una caravana que se dirigía a tu imperio fue atacada por bandidos y perdió parte de su carga.";
                
                // Reduce resource amounts by 20-50%
                finalNpcOffers.forEach(offer => {
                    if (offer.category === 'resources') {
                        offer.amount = Math.floor(offer.amount * (Math.random() * 0.3 + 0.5)); // Receives 50% to 80% of original
                    }
                });
            }
            
            // --- NPC items are sent via caravan ---
            const onArrival = () => {
                // Deduct items from NPC
                npcOffers.forEach(offer => { // Use original offer amounts for deduction from NPC
                    if (offer.category === 'resources' && npc.inventory) {
                        npc.inventory[offer.item] -= offer.amount;
                    }
                });

                // Give final (potentially reduced) items to player
                finalNpcOffers.forEach(offer => this.game.tradeSystem.tradeStateManager.givePlayerItems(offer.category, offer.item, offer.amount));

                const itemsReceived = finalNpcOffers.map(o => this.game.tradeSystem.tradeDisplayHelper.getTradeDescription(o.category, o.item, o.amount)).join(', ');
                this.game.newsManager.addNews(`Caravana de ${npc.name} ha llegado con: ${itemsReceived || 'nada'}.`, "comercio");
                this.game.uiManager.notificationManager.showNotification('trade_accepted', `¡Caravana de ${npc.name} ha llegado!`);

                 if (eventMessage) {
                    this.game.newsManager.addNews(eventMessage, 'comercio');
                    this.game.uiManager.notificationManager.showNotification('error', eventMessage, 7000);
                }
            };

            const npcCityTile = { x: npc.cityX, y: npc.cityY };
            
            caravanId = this.game.gameActions.animateCaravanMovement(npcCityTile, this.game.playerCity, finalNpcOffers, onArrival);

            this.game.newsManager.addNews(`¡Intercambio con ${npc.name} aceptado! Una caravana está en camino.`, "imperion");
            this.game.uiManager.notificationManager.showNotification(
                'info', 
                `¡Intercambio aceptado! Caravana en camino...`,
                10000,
                { type: 'center_on_caravan', caravanId: caravanId }, // NEW: Clickable action
                true // Make it persistent so player has time to click it
            );
            this.game.uiManager.closeModal();

        } else {
            this.game.newsManager.addNews(`${npc.name} ha rechazado tu oferta. Consideran que no es justa.`, "comercio");
            this.game.uiManager.notificationManager.showNotification('trade_rejected', `${npc.name} ha rechazado tu oferta.`, 7000);
        }
    }
}