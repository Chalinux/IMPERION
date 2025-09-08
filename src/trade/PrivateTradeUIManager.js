import { PrivateTradeUIHelper } from './PrivateTradeUIHelper.js';

console.log("PrivateTradeUIManager.js loaded.");

export class PrivateTradeUIManager {
    constructor(game, privateTradeOfferState, privateTradeManager) {
        this.game = game;
        this.privateTradeOfferState = privateTradeOfferState; // Direct reference to the offer state
        this.privateTradeManager = privateTradeManager; // Reference to the PrivateTradeManager instance for delegation
        this.privateTradeUIHelper = new PrivateTradeUIHelper(game, privateTradeOfferState, this); // Pass offer state and self to helper
    }

    /**
     * Opens the private trade modal with a specific NPC.
     * This method now orchestrates the display of the private trade UI.
     * @param {string} npcId - The ID of the NPC for the trade.
     * @param {object} [initialTradeData=null] - Optional initial trade data.
     */
    showPrivateTradeModal(npcId, initialTradeData = null) {
        const npc = this.game.getNpcById(npcId);
        if (!npc) {
            this.game.newsManager.addNews("Imperio no encontrado.", "error");
            return;
        }

        this.privateTradeOfferState.resetOffers(initialTradeData);

        const modalContent = this.privateTradeUIHelper.getPrivateTradeModalHtml(npc);

        this.game.uiManager.showModal(`Comercio Privado con ${npc.name}`, modalContent);

        // NEW: Populate the item selection dropdowns and apply initial filters
        setTimeout(() => { // Use a slight timeout to ensure DOM elements are rendered
            this.populateAndFilterTradeItems('player', 'all', npcId);
            this.populateAndFilterTradeItems('npc', 'all', npcId); // NPC also has a dropdown to add items
            
            // Set initial active state for "Todas" filter buttons
            const playerAllBtn = document.querySelector('#private-trade-panel .your-panel .trade-item-filters .medieval-btn');
            if (playerAllBtn) playerAllBtn.classList.add('active');
            const npcAllBtn = document.querySelector('#private-trade-panel .npc-panel .trade-item-filters .medieval-btn');
            if (npcAllBtn) npcAllBtn.classList.add('active');

            this.renderPrivateTradeItems(npcId);
            this.updatePrivateTradeUIElementsVisibility();
        }, 50);
    }

    /**
     * Handles adding an item to a trader's private trade offer, initiated by UI.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {string} npcId - The ID of the NPC for the trade.
     */
    handleAddItemRequest(traderType, npcId) {
        // NEW: Get selected item from the combined dropdown
        const itemSelect = document.getElementById(`${traderType}-trade-item-select`);
        if (!itemSelect || !itemSelect.value) {
            this.game.newsManager.addNews("Por favor, selecciona un artículo del desplegable.", "comercio");
            this.game.uiManager.notificationManager.showNotification('error', "¡Selecciona un artículo!");
            return;
        }
        
        const [category, item] = itemSelect.value.split(':');
        
        let amount = 1; 

        // Delegate to PrivateTradeOfferState for state modification
        const wasAdded = this.privateTradeOfferState.addItem(traderType, category, item, amount, npcId);

        if (!wasAdded) {
            return; 
        }

        this.renderPrivateTradeItems(npcId);
        this.updatePrivateTradeUIElementsVisibility();
    }

    /**
     * NEW: Populates the item selection dropdown and applies filters based on category.
     * @param {string} traderType - 'player' or 'npc'
     * @param {string} filterCategory - The category to filter by ('all', 'resources', etc.)
     * @param {string} npcId - The NPC ID (relevant for NPC offers)
     */
    populateAndFilterTradeItems(traderType, filterCategory, npcId) {
        const itemSelect = document.getElementById(`${traderType}-trade-item-select`);
        if (!itemSelect) return;

        let availableItems = [];

        // Loop through all categories or just the filtered one
        const categoriesToProcess = filterCategory === 'all' 
            ? Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes)
            : [filterCategory];

        categoriesToProcess.forEach(cat => {
            const itemsInCurrentCategory = this.game.tradeSystem.tradeStateManager.tradeItemTypes[cat];
            if (!itemsInCurrentCategory) return;

            Object.keys(itemsInCurrentCategory).forEach(itemKey => {
                let canOffer = false;
                // Dragons are handled differently as they are dynamically added instances
                if (cat === 'dragons') {
                    if (traderType === 'player') {
                        // Player can offer their own dragons if they have them
                        canOffer = this.game.playerDragons.some(d => d.id === itemKey);
                    } else {
                        // NPCs don't typically offer specific player dragons, only general dragon eggs
                        canOffer = false; 
                    }
                } else {
                    canOffer = traderType === 'player'
                        ? this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(cat, itemKey, 1, true)
                        : this.game.getNpcById(npcId) && this.game.tradeSystem.tradeStateManager.validateNpcCanOffer(this.game.getNpcById(npcId), cat, itemKey, 1);
                }
                
                if (canOffer) {
                    availableItems.push({ category: cat, item: itemKey });
                }
            });
        });

        // Special handling for dynamic player dragons if filterCategory is 'dragons' or 'all'
        if (traderType === 'player' && (filterCategory === 'all' || filterCategory === 'dragons')) {
            this.game.playerDragons.forEach(dragon => {
                // Ensure dragon is not already added to avoid duplicates if it exists in base tradeItemTypes
                if (!availableItems.some(item => item.category === 'dragons' && item.item === dragon.id)) {
                    availableItems.push({ category: 'dragons', item: dragon.id });
                }
            });
        }
        
        // Sort items alphabetically by display name
        availableItems.sort((a, b) => {
            const nameA = this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(a.item).toLowerCase();
            const nameB = this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(b.item).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        itemSelect.innerHTML = availableItems.map(itemData => {
            const displayName = this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(itemData.item);
            let iconHtml = '';
            const imagePath = this.game.tradeSystem.tradeDisplayHelper.getIconForItem(itemData.category, itemData.item);
            const emojiIcon = this.game.tradeSystem.tradeStateManager.tradeItemTypes[itemData.category]?.[itemData.item]?.icon;
            
            if (imagePath) {
                // For select options, we can't directly embed <img>, so we'll use emojis or a custom-styled select.
                // For now, let's use a descriptive text with an emoji placeholder if available.
                iconHtml = emojiIcon || (itemData.category === 'dragons' ? '🐉 ' : '');
            } else if (emojiIcon) {
                iconHtml = emojiIcon;
            } else if (itemData.category === 'dragons') {
                iconHtml = '🐉 '; // Fallback for dragons
            }
            
            return `<option value="${itemData.category}:${itemData.item}">${iconHtml} ${displayName}</option>`;
        }).join('');

        // Disable or enable add button and set dropdown state if no items are available
        const addItemBtn = document.getElementById(`${traderType}-add-item-btn-combined`);
        if (availableItems.length === 0) {
            itemSelect.innerHTML = '<option value="">No disponible</option>';
            itemSelect.disabled = true;
            if (addItemBtn) {
                addItemBtn.classList.add('disabled');
                addItemBtn.disabled = true;
            }
        } else {
            itemSelect.disabled = false;
            if (addItemBtn) {
                addItemBtn.classList.remove('disabled');
                addItemBtn.disabled = false;
            }
            // Ensure a value is selected if there are options
            if (itemSelect.options.length > 0) {
                itemSelect.value = itemSelect.options[0].value;
            }
        }
    }

    /**
     * NEW: Handles filter button clicks for the combined item selector.
     * @param {string} traderType - 'player' or 'npc'
     * @param {string} categoryFilter - The category to filter by ('all', 'resources', etc.)
     * @param {string} npcId - The NPC ID
     * @param {HTMLElement} clickedButton - The button that was clicked, for active state styling.
     */
    filterTradeItems(traderType, categoryFilter, npcId, clickedButton) {
        const filterContainer = clickedButton.closest('.trade-item-filters');
        if (filterContainer) {
            filterContainer.querySelectorAll('.medieval-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            clickedButton.classList.add('active'); // Set the clicked button as active
        }
        // Set a data attribute on the button so populateAndFilterTradeItems can find the current filter if needed by other methods
        clickedButton.dataset.categoryFilter = categoryFilter; 
        this.populateAndFilterTradeItems(traderType, categoryFilter, npcId);
    }

    /**
     * NEW: Handles the change event of the combined item selection dropdown.
     * Currently, this method just logs as selection change doesn't directly trigger UI update,
     * it's mostly for preparing the item to be added.
     * @param {string} traderType - 'player' or 'npc'
     */
    handleItemSelectionChange(traderType) {
        // No specific UI update needed here, as the add button is separate.
        // The selection is read when handleAddItemRequest is called.
        console.log(`${traderType} item selection changed.`);
    }

    /**
     * Handles removing an item from a trader's private trade offer, initiated by UI.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item to remove.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     */
    handleRemoveItemRequest(traderType, index, npcId) {
        // Delegate to PrivateTradeOfferState for state modification
        const wasRemoved = this.privateTradeOfferState.removeItem(traderType, index);
        
        if (wasRemoved) {
            this.renderPrivateTradeItems(npcId);
            this.updatePrivateTradeUIElementsVisibility();
            // Re-populate and filter after removal to reflect available items
            const currentActiveFilterBtn = document.querySelector(`#private-trade-panel .${traderType}-panel .trade-item-filters .medieval-btn.active`);
            const currentFilterCategory = currentActiveFilterBtn ? (currentActiveFilterBtn.dataset.categoryFilter || 'all') : 'all';
            this.populateAndFilterTradeItems(traderType, currentFilterCategory, npcId);
        }
    }

    /**
     * Renders the items currently in the player's and NPC's private trade offers.
     * Now delegates item HTML generation to PrivateTradeUIHelper.
     * @param {string} npcId - The ID of the NPC involved in the trade.
     */
    renderPrivateTradeItems(npcId) {
        const playerItemsDiv = document.getElementById('private-trade-player-items');
        if (playerItemsDiv) {
            playerItemsDiv.innerHTML = this.privateTradeUIHelper.generateTradeItemsListHtml('player', npcId);
        }

        const npcItemsDiv = document.getElementById('private-trade-npc-items');
        if (npcItemsDiv) {
            npcItemsDiv.innerHTML = this.privateTradeUIHelper.generateTradeItemsListHtml('npc', npcId);
        }

        this.updatePrivateTradeTotals();
    }
    
    /**
     * Updates the displayed total values for player and NPC offers, and the fairness indicator.
     * Moved from PrivateTradeManager.js.
     */
    updatePrivateTradeTotals() {
        const playerValue = this.privateTradeOfferState.playerOffers.reduce((total, offer) => 
            total + this.game.tradeSystem.tradeStateManager.calculateTotalValue(offer.category, offer.item, offer.amount)
        , 0);
        const npcValue = this.privateTradeOfferState.npcOffers.reduce((total, offer) => 
            total + this.game.tradeSystem.tradeStateManager.calculateTotalValue(offer.category, offer.item, offer.amount)
        , 0);
        
        const privatePlayerTotalValue = document.getElementById('private-player-total-value');
        if (privatePlayerTotalValue) {
            privatePlayerTotalValue.textContent = playerValue.toFixed(1);
        }

        const privateNpcTotalValue = document.getElementById('private-npc-total-value');
        if (privateNpcTotalValue) {
            privateNpcTotalValue.textContent = npcValue.toFixed(1);
        }
        
        const summaryDiv = document.getElementById('private-trade-summary');
        if (summaryDiv) {
            const fairnessClass = this.game.tradeSystem.publicTradeManager.getTradeFairnessClass(playerValue, npcValue);
            const fairnessText = this.game.tradeSystem.publicTradeManager.getTradeFairnessText(playerValue, npcValue).replace("Estás Ofreciendo Más", "Ofreces Más").replace("Estás Solicitando Más", "Solicitas Más");
            summaryDiv.innerHTML = `<div class="trade-fairness-indicator ${fairnessClass}">${fairnessText}</div>`;
        }

        const balanceMarker = document.getElementById('private-balance-marker');
        if (balanceMarker) {
            const totalValue = playerValue + npcValue;
            let markerPosition = 50;
            if (totalValue > 0) {
                markerPosition = (npcValue / totalValue) * 100; 
            }
            balanceMarker.style.left = `${markerPosition}%`;
        }
    }

    /**
     * Controls the visibility of trade UI elements in the private trade modal based on whether items are in the offer.
     * Moved from PrivateTradeManager.js.
     */
    updatePrivateTradeUIElementsVisibility() {
        const hasItems = this.privateTradeOfferState.playerOffers.length > 0 || this.privateTradeOfferState.npcOffers.length > 0;
        
        const summaryDiv = document.getElementById('private-trade-summary');
        const balanceContainer = document.querySelector('.trade-balance-container');
        const balanceScaleImage = document.getElementById('balance-scale-image');
        const proposeButton = document.querySelector('.propose-trade-btn');
        const suggestButton = document.querySelector('.suggest-counter-btn');
        const tradeArrow = document.querySelector('.trade-negotiation-center > .trade-arrow-large');

        const displayStyle = hasItems ? 'block' : 'none'; 
        
        if (tradeArrow) tradeArrow.style.display = displayStyle;
        if (summaryDiv) summaryDiv.style.display = displayStyle;
        if (balanceContainer) balanceContainer.style.display = displayStyle;
        if (balanceScaleImage) balanceScaleImage.style.display = displayStyle;
        if (proposeButton) proposeButton.style.display = displayStyle;
        if (suggestButton) suggestButton.style.display = displayStyle;
    }

    /**
     * Updates the amount of a specific item in the trade offer state and refreshes its UI display.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item.
     * @param {number} newAmount - The new amount.
     * @param {string} npcId - The ID of the NPC.
     */
    updatePrivateListedItemAmount(traderType, index, newAmount, npcId) {
        this.privateTradeOfferState.updateItemAmount(traderType, index, newAmount);
        this.refreshSinglePrivateItemDisplay(traderType, index, this.privateTradeOfferState[`${traderType}Offers`][index].amount);
        this.updatePrivateTradeTotals();
    }

    /**
     * Sets the amount of a specific item in the trade offer state to its maximum and refreshes its UI display.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item.
     * @param {string} npcId - The ID of the NPC.
     */
    setPrivateListedItemMax(traderType, index, npcId) {
        const newMax = this.privateTradeOfferState.setItemMax(traderType, index, npcId);
        this.refreshSinglePrivateItemDisplay(traderType, index, newMax, newMax);
        this.updatePrivateTradeTotals();
    }

    /**
     * Sets the amount of a specific item in the trade offer state by a percentage of its maximum.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item.
     * @param {number} percentage - The percentage (0.0 to 1.0).
     * @param {string} npcId - The ID of the NPC.
     */
    setPrivateListedItemPercentage(traderType, index, percentage, npcId) {
        const newAmount = this.privateTradeOfferState.setItemPercentage(traderType, index, percentage, npcId);
        this.refreshSinglePrivateItemDisplay(traderType, index, newAmount);
        this.updatePrivateTradeTotals();
    }

    /**
     * Refreshes the display of a single item's amount and slider in the private trade modal.
     * This avoids re-rendering the entire list for small updates like slider changes.
     * @param {string} traderType - 'player' or 'npc'.
     * @param {number} index - The index of the item in the trader's privateTradeState array.
     * @param {number} newAmount - The new amount to display.
     * @param {number|null} newMaxAmount - Optional: The new max value for the slider, if it has changed.
     */
    refreshSinglePrivateItemDisplay(traderType, index, newAmount, newMaxAmount = null) {
        const slider = document.getElementById(`${traderType}-item-${index}-amount`);
        const amountValueSpan = document.getElementById(`${traderType}-item-${index}-value`);

        if (slider) {
            slider.value = newAmount;
            if (newMaxAmount !== null) {
                slider.max = newMaxAmount;
            }
        }
        if (amountValueSpan) {
            amountValueSpan.textContent = newAmount;
        }
    }

    /**
     * This method is now obsolete due to the new selection modal system.
     */
    updatePrivateItemOptions(traderType, npcId) {
        console.warn("PrivateTradeUIManager.updatePrivateItemOptions is obsolete and should not be called.");
    }
}