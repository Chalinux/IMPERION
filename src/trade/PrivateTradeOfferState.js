// NEW FILE: PrivateTradeOfferState.js
// This class manages the internal state of private trade offers (player and NPC)
// and handles modifications to these offers.

export class PrivateTradeOfferState {
    constructor(game) {
        this.game = game;
        this.playerOffers = []; // The player's current items in the private trade offer
        this.npcOffers = [];    // The NPC's current items in the private trade offer
    }

    /**
     * Resets the current private trade offers for both player and NPC.
     * @param {Object} [initialData=null] - Optional initial data to populate the offers.
     */
    resetOffers(initialData = null) {
        if (!initialData) {
            this.playerOffers = [];
            this.npcOffers = [];
        } else {
            this.playerOffers = initialData.playerOffers || [];
            this.npcOffers = initialData.npcOffers || [];
        }
    }

    /**
     * Adds an item to a trader's private trade offer.
     * Performs validation before adding. If the item already exists and is stackable,
     * it updates the amount of the existing item instead of adding a new entry.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {string} category - The category of the item.
     * @param {string} item - The specific item ID.
     * @param {number} amount - The amount to add.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {boolean} True if the item was added or updated, false otherwise.
     */
    addItem(traderType, category, item, amount, npcId) {
        if (!item || amount <= 0 || !category) {
            this.game.newsManager.addNews("Por favor, selecciona un artículo y una cantidad válidos.", "comercio");
            return false;
        }

        const tradeList = (traderType === 'player') ? this.playerOffers : this.npcOffers;
        
        // Check if the item already exists in the trade list
        const existingItemIndex = tradeList.findIndex(entry => entry.category === category && entry.item === item);

        // Determine if the item is stackable (most are, except unique items like dragons/tech/territories)
        const isStackable = !(category === 'dragons' || category === 'technology' || category === 'special' || category === 'territories');

        if (existingItemIndex !== -1 && isStackable) {
            // Item exists and is stackable, update its amount
            const currentAmount = tradeList[existingItemIndex].amount;
            const newTotalAmount = currentAmount + amount;

            // Validate if the new total amount is valid based on available inventory
            // This is crucial to prevent adding more than player or NPC has
            const isValidOffer = traderType === 'player'
                ? this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(category, item, newTotalAmount)
                : this.game.tradeSystem.tradeStateManager.validateNpcCanOffer(this.game.getNpcById(npcId), category, item, newTotalAmount);

            if (!isValidOffer) {
                this.game.newsManager.addNews(`No puedes añadir más ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}. Límite alcanzado o inventario insuficiente.`, "comercio");
                return false;
            }

            tradeList[existingItemIndex].amount = newTotalAmount;
            return true;
        } else if (existingItemIndex !== -1 && !isStackable) {
            // Item exists but is not stackable (e.g., a unique dragon or territory)
            this.game.newsManager.addNews(`Ya tienes ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)} en la oferta. No se puede añadir más.`, "comercio");
            return false;
        } else {
            // Item does not exist, add it as a new entry
            const isValidOffer = traderType === 'player'
                ? this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(category, item, amount)
                : this.game.tradeSystem.tradeStateManager.validateNpcCanOffer(this.game.getNpcById(npcId), category, item, amount);

            if (!isValidOffer) {
                this.game.newsManager.addNews(`No puedes añadir ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}. Verifica tu inventario.`, "comercio");
                return false;
            }

            tradeList.push({ category, item, amount });
            return true;
        }
    }

    /**
     * Removes an item from a trader's private trade offer by index.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item to remove.
     * @returns {boolean} True if the item was removed, false otherwise.
     */
    removeItem(traderType, index) {
        const tradeList = (traderType === 'player') ? this.playerOffers : this.npcOffers;
        if (index >= 0 && index < tradeList.length) {
            tradeList.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Updates the amount of an item in a trade offer.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item to update.
     * @param {number} newAmount - The new amount.
     */
    updateItemAmount(traderType, index, newAmount) {
        const amount = parseInt(newAmount) || 0;
        const tradeList = (traderType === 'player') ? this.playerOffers : this.npcOffers;
        if (index >= 0 && index < tradeList.length) {
            tradeList[index].amount = amount;
        }
    }

    /**
     * Sets the amount of an item in a trade offer to its maximum possible.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item to update.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {number} The new maximum amount.
     */
    setItemMax(traderType, index, npcId) {
        const tradeList = (traderType === 'player') ? this.playerOffers : this.npcOffers;
        if (index >= 0 && index < tradeList.length) {
            const itemData = tradeList[index];
            const maxAmount = this.game.tradeSystem.tradeStateManager.getMaxAmountForListedItem(traderType, itemData.category, itemData.item, npcId);
            itemData.amount = maxAmount;
            return maxAmount;
        }
        return 0;
    }

    /**
     * Sets the amount of an item in a trade offer by a percentage of its maximum.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item to update.
     * @param {number} percentage - The percentage (0.0 to 1.0) to set the amount.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     * @returns {number} The new calculated amount.
     */
    setItemPercentage(traderType, index, percentage, npcId) {
        const tradeList = (traderType === 'player') ? this.playerOffers : this.npcOffers;
        if (index >= 0 && index < tradeList.length) {
            const itemData = tradeList[index];
            const maxAmount = this.game.tradeSystem.tradeStateManager.getMaxAmountForListedItem(traderType, itemData.category, itemData.item, npcId);
            const newAmount = Math.max(0, Math.floor(maxAmount * percentage));
            itemData.amount = newAmount;
            return newAmount;
        }
        return 0;
    }
}