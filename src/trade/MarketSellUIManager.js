console.log("MarketSellUIManager.js loaded.");

export class MarketSellUIManager {
    constructor(game) {
        this.game = game;
    }

    openSellToMarketModal() {
        // Use tradeStateManager for item types
        const categories = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes || {}); // Added || {} for robustness
        const categoryOptions = categories.map(cat => {
            const itemsInCurrentCategory = this.game.tradeSystem.tradeStateManager.tradeItemTypes[cat];
            let categoryDisplayName;

            // Try to get category display name from the first item if the category has items
            if (itemsInCurrentCategory && Object.keys(itemsInCurrentCategory).length > 0) {
                const firstItemKey = Object.keys(itemsInCurrentCategory)[0];
                categoryDisplayName = itemsInCurrentCategory[firstItemKey]?.category;
            }

            // Fallback for categories that are empty (like 'dragons' initially)
            // or if the 'category' property is missing from the first item
            if (!categoryDisplayName) {
                switch (cat) {
                    case 'resources': categoryDisplayName = 'Recursos'; break;
                    case 'troops': categoryDisplayName = 'Tropas'; break;
                    case 'territories': categoryDisplayName = 'Territorios'; break;
                    case 'technology': categoryDisplayName = 'Tecnología'; break;
                    case 'special': categoryDisplayName = 'Especiales'; break;
                    case 'dragons': categoryDisplayName = 'Dragones'; break; // Explicitly handle the 'dragons' category
                    default: categoryDisplayName = cat; // Fallback to the raw category key
                }
            }
            return { value: cat, text: categoryDisplayName };
        });

        this.game.uiManager.showModal('💰 ¿Qué quieres vender?', `
            <div class="minimalist-sell-panel">
                <h3>💰 Vender al Mercado Global</h3>
                
                <div class="sell-section-main">
                    <h4>📤 Tu Oferta</h4>
                    <div class="input-row">
                        <label for="sell-category-offered">Categoría:</label>
                        <div class="custom-select-wrapper">
                            <input type="hidden" id="sell-category-offered" value="${categories[0] || ''}">
                            <button class="medieval-btn custom-select-btn" id="sell-category-offered-btn">
                                ${categoryOptions.length > 0 ? categoryOptions[0].text : 'No disponible'}
                            </button>
                            <div class="custom-select-options" id="sell-category-offered-options">
                                ${categoryOptions.map(opt => `<div class="custom-select-option" data-value="${opt.value}">${opt.text}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="input-row">
                        <label for="sell-item-offered">Artículo:</label>
                        <div class="custom-select-wrapper">
                            <input type="hidden" id="sell-item-offered">
                            <button class="medieval-btn custom-select-btn" id="sell-item-offered-btn">Selecciona un artículo</button>
                            <div class="custom-select-options" id="sell-item-offered-options">
                                <!-- Item options will be populated here -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="amount-slider-container">
                        <label for="sell-amount-offered">Cantidad:</label>
                        <div class="slider-and-value">
                            <input type="range" 
                                   id="sell-amount-offered" 
                                   class="trade-slider" 
                                   value="1" 
                                   min="0" 
                                   oninput="game.tradeSystem.publicTradeManager.marketSellUIManager.updateSellPriceDisplay()">
                            <span id="sell-amount-value" class="slider-value">1</span>
                            <button class="medieval-btn" onclick="game.tradeSystem.publicTradeManager.marketSellUIManager.setSellAmountMax()">MAX</button>
                        </div>
                    </div>
                    
                    <div class="item-summary-display"> 
                        <div class="display-item-offered">
                            <img id="sell-item-icon" src="" alt="Item Icon" class="trade-item-icon">
                            <span id="sell-item-name-amount"></span>
                            <small id="sell-item-base-value-text"></small>
                        </div>
                        <div class="trade-arrow-large">⇄</div>
                        <div class="display-imperion-received">
                            <img src="assets/images/ui/imperion-icon.png" alt="Imperion Icon" class="imperion-trade-icon">
                            <span id="sell-imperion-price">0.0 👑</span>
                        </div>
                    </div>
                    
                    <span id="recommended-price-display">Precio Recomendado: <span id="recommended-price-value">0</span> 👑</span>
                </div>
                
                <div class="sell-section-price">
                    <h4>👑 Tu Precio de Imperion</h4>
                    <div class="input-row">
                        <label for="sell-price-imperion">Ofrecer por:</label>
                        <div class="custom-number-input-wrapper">
                            <button class="medieval-btn custom-number-btn" onclick="game.marketSellUIManager.adjustSellPrice(-10)">-</button>
                            <input type="number" id="sell-price-imperion" class="custom-number-input" value="1" min="0.1" step="0.1" oninput="game.tradeSystem.publicTradeManager.marketSellUIManager.updateSellPriceDisplay()">
                            <button class="medieval-btn custom-number-btn" onclick="game.marketSellUIManager.adjustSellPrice(10)">+</button>
                        </div>
                    </div>
                    
                    <div class="trade-summary">
                        <h4>📊 Análisis de la Oferta</h4>
                        <div class="value-comparison">
                            <div class="fairness-bar-container">
                                <div class="fairness-bar" id="sell-fairness-bar"></div>
                                <div class="fairness-bar-marker" id="sell-fairness-marker"></div>
                            </div>
                            <div class="fairness-indicator" id="sell-fairness-indicator">
                                Precio Justo
                            </div>
                            <div class="availability-check" id="sell-availability-check">
                                <span class="availability-ok">✅ Tienes el artículo para vender.</span>
                            </div>
                        </div>
                    </div>
                    <button class="medieval-btn" id="execute-sell-offer-btn" onclick="game.tradeSystem.publicTradeManager.marketSellManager.executeInstantSell()" style="width: 100%;">
                        💰 Vender al Mercado
                    </button>
                </div>
                
            </div>
        `);
        
        // Use a slight timeout to ensure DOM elements are rendered before attempting to update them
        setTimeout(() => {
            this.setupCustomSelect('sell-category-offered', () => this.updateSellItemOptions());
            this.setupCustomSelect('sell-item-offered', () => this.updateSellPriceDisplay());
            this.updateSellItemOptions();
            this.setSellAmountMax();
            this.updateSellPriceDisplay(); // Call again after setting max amount to ensure initial display is correct
        }, 50); 
    }

    // NEW: Helper function to set up custom select functionality
    setupCustomSelect(idPrefix, onChangeCallback) {
        const wrapper = document.getElementById(`${idPrefix}-btn`)?.closest('.custom-select-wrapper');
        const hiddenInput = document.getElementById(idPrefix);
        const button = document.getElementById(`${idPrefix}-btn`);
        const optionsContainer = document.getElementById(`${idPrefix}-options`);

        if (!wrapper || !hiddenInput || !button || !optionsContainer) return;

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other open selects
            document.querySelectorAll('.custom-select-wrapper.open').forEach(openWrapper => {
                if (openWrapper !== wrapper) {
                    openWrapper.classList.remove('open');
                    openWrapper.querySelector('.custom-select-options').classList.remove('visible');
                }
            });
            wrapper.classList.toggle('open');
            optionsContainer.classList.toggle('visible');
        });

        optionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('custom-select-option')) {
                const selectedValue = e.target.dataset.value;
                const selectedText = e.target.textContent;
                
                hiddenInput.value = selectedValue;
                button.textContent = selectedText;
                
                wrapper.classList.remove('open');
                optionsContainer.classList.remove('visible');
                
                if (onChangeCallback) {
                    onChangeCallback();
                }
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
                optionsContainer.classList.remove('visible');
            }
        });
    }

    // NEW: Helper function to adjust sell price with buttons
    adjustSellPrice(amount) {
        const priceInput = document.getElementById('sell-price-imperion');
        if (priceInput) {
            let currentValue = parseFloat(priceInput.value) || 0;
            let step = Math.abs(amount) > 1 ? 10 : 1;
            if(currentValue < 10) step = 1;
            if(currentValue < 1) step = 0.1;
            
            let finalAmount = amount > 0 ? step : -step;

            priceInput.value = Math.max(0.1, (currentValue + finalAmount)).toFixed(1);
            this.updateSellPriceDisplay();
        }
    }

    updateSellItemOptions() {
        const categoryInput = document.getElementById('sell-category-offered');
        const itemInput = document.getElementById('sell-item-offered');
        const itemButton = document.getElementById('sell-item-offered-btn');
        const itemOptionsContainer = document.getElementById('sell-item-offered-options');

        if (!categoryInput || !itemInput || !itemButton || !itemOptionsContainer) return;

        const category = categoryInput.value;
        
        let items = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes[category] || {});
        
        items = items.filter(item => this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(category, item, 1, true)); 
        
        itemOptionsContainer.innerHTML = items.map(item => {
            const itemData = this.game.tradeSystem.tradeStateManager.tradeItemTypes[category]?.[item];
            const displayName = this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item);
            return `<div class="custom-select-option" data-value="${item}">${itemData?.icon || ''} ${displayName}</div>`;
        }).join('');

        if (items.length > 0) {
            // Automatically select the first item
            itemInput.value = items[0];
            itemButton.textContent = itemOptionsContainer.querySelector('.custom-select-option').textContent;
        } else {
            itemInput.value = '';
            itemButton.textContent = 'No disponible';
        }

        if (items.length === 0) {
            itemButton.disabled = true;
            const amountSlider = document.getElementById('sell-amount-offered');
            const sellPriceInput = document.getElementById('sell-price-imperion');
            const executeSellBtn = document.getElementById('execute-sell-offer-btn');

            if (amountSlider) {
                amountSlider.value = 0;
                amountSlider.max = 0;
                amountSlider.disabled = true;
            }
            if (sellPriceInput) {
                sellPriceInput.value = 0;
                sellPriceInput.disabled = true;
            }
            if (executeSellBtn) {
                executeSellBtn.classList.add('disabled');
                executeSellBtn.disabled = true;
            }
        } else {
            itemButton.disabled = false;
            const amountSlider = document.getElementById('sell-amount-offered'); // Re-query after potential innerHTML change
            const sellPriceInput = document.getElementById('sell-price-imperion'); // Re-query
            const executeSellBtn = document.getElementById('execute-sell-offer-btn'); // Re-query

            if (amountSlider) {
                amountSlider.disabled = false;
            }
            if (sellPriceInput) {
                sellPriceInput.disabled = false;
            }
            if (executeSellBtn) {
                executeSellBtn.classList.remove('disabled');
                executeSellBtn.disabled = false;
            }
        }
        
        this.setSellAmountMax(); 
        this.updateSellPriceDisplay(); // Ensure price display is updated after item options change
    }

    setSellAmountMax() {
        const categoryInput = document.getElementById('sell-category-offered');
        const itemInput = document.getElementById('sell-item-offered');

        if (!categoryInput || !itemInput) return; // Robustness check

        const category = categoryInput.value;
        const item = itemInput.value;
        let maxAmount = 0;

        if (!item || !category) { // Robustness: check both
            document.getElementById('sell-amount-offered').value = 0;
            document.getElementById('sell-amount-offered').max = 0;
            // Removed direct call to updateSellPriceDisplay here. It's called after setSellAmountMax.
            return;
        }
        
        switch (category) {
            case 'resources':
                maxAmount = Math.floor(this.game.resourceManager.resources[item]);
                break;
            case 'troops':
                const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
                maxAmount = cityTile.troops[item] || 0; 
                break;
            case 'territories':
                // Use tradeStateManager for player territory count
                maxAmount = this.game.tradeSystem.tradeStateManager.getPlayerTerritoryCount(item);
                break;
            case 'technology':
            case 'special':
                // Use tradeStateManager for player technologies
                maxAmount = this.game.tradeSystem.tradeStateManager.playerTechnologies.has(item) ? 1 : 0; 
                if (item === 'dragon_egg') {
                    maxAmount = this.game.playerDragons.length === 0 ? 1 : 0;
                }
                break;
            case 'dragons':
                 maxAmount = 0; // Assuming specific player dragons cannot be sold instantly to market for Imperion yet.
                 break;
        }
        const amountSlider = document.getElementById('sell-amount-offered');
        if (amountSlider) {
            amountSlider.max = maxAmount;
            amountSlider.value = maxAmount; 
        }
        // Don't call updateSellPriceDisplay here to avoid circular calls if it's called from updateSellItemOptions.
        // It will be called explicitly after setSellAmountMax in openSellToMarketModal.
    }

    updateSellPriceDisplay() {
        const category = document.getElementById('sell-category-offered')?.value;
        const item = document.getElementById('sell-item-offered')?.value;
        const amount = parseInt(document.getElementById('sell-amount-offered')?.value) || 0;
        let proposedPrice = parseFloat(document.getElementById('sell-price-imperion')?.value) || 0; 

        const sellAmountValueSpan = document.getElementById('sell-amount-value');
        if (sellAmountValueSpan) {
            sellAmountValueSpan.textContent = amount;
        }

        if (!category || !item || amount <= 0) { // Check for category and item presence
            const sellItemIcon = document.getElementById('sell-item-icon');
            if (sellItemIcon) sellItemIcon.src = '';
            const sellItemNameAmount = document.getElementById('sell-item-name-amount');
            if (sellItemNameAmount) sellItemNameAmount.textContent = 'Selecciona un artículo';
            const sellItemBaseValueText = document.getElementById('sell-item-base-value-text');
            if (sellItemBaseValueText) sellItemBaseValueText.textContent = '';
            const sellImperionPrice = document.getElementById('sell-imperion-price');
            if (sellImperionPrice) sellImperionPrice.textContent = '0.0 👑';

            const recommendedPriceValue = document.getElementById('recommended-price-value');
            if (recommendedPriceValue) recommendedPriceValue.textContent = (0).toFixed(1);
            const fairnessIndicator = document.getElementById('sell-fairness-indicator');
            if (fairnessIndicator) {
                fairnessIndicator.textContent = 'Selecciona un artículo y cantidad';
                fairnessIndicator.className = 'fairness-indicator';
            }
            const fairnessMarker = document.getElementById('sell-fairness-marker');
            if (fairnessMarker) fairnessMarker.style.left = '50%';
            const availabilityCheck = document.getElementById('sell-availability-check');
            if (availabilityCheck) availabilityCheck.innerHTML = '<span class="availability-error">❌ No hay artículo seleccionado o cantidad inválida.</span>';
            const executeSellBtn = document.getElementById('execute-sell-offer-btn');
            if (executeSellBtn) {
                executeSellBtn.classList.add('disabled');
                executeSellBtn.disabled = true;
            }
            return;
        }

        // Use tradeStateManager for item value
        const baseValuePerUnit = this.game.tradeSystem.tradeStateManager.tradeItemTypes[category]?.[item]?.value || 0; // Robustness
        const totalBaseValue = baseValuePerUnit * amount;
        
        const sellPriceInput = document.getElementById('sell-price-imperion');
        if (sellPriceInput && document.activeElement.id !== 'sell-price-imperion') { 
            sellPriceInput.value = totalBaseValue.toFixed(1);
            proposedPrice = totalBaseValue; 
        }

        const sellItemIcon = document.getElementById('sell-item-icon');
        const sellItemNameAmount = document.getElementById('sell-item-name-amount');
        const sellItemBaseValueText = document.getElementById('sell-item-base-value-text');
        const sellImperionPrice = document.getElementById('sell-imperion-price');
        const recommendedPriceValue = document.getElementById('recommended-price-value');

        if (sellItemIcon && item) {
            sellItemIcon.src = this.game.tradeSystem.tradeDisplayHelper.getIconForItem(category, item); // Use TradeDisplayHelper
        } else if (sellItemIcon) {
            sellItemIcon.src = ''; 
        }
        
        if (sellItemNameAmount) {
            sellItemNameAmount.textContent = `${amount} ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}`; // Use TradeDisplayHelper
        }
        
        if (sellItemBaseValueText) {
            sellItemBaseValueText.textContent = `(${totalBaseValue.toFixed(1)} 👑)`;
        }

        if (sellImperionPrice) {
            sellImperionPrice.textContent = `${proposedPrice.toFixed(1)} 👑`;
        }

        if (recommendedPriceValue) {
            recommendedPriceValue.textContent = totalBaseValue.toFixed(1);
        }

        const fairnessRatio = proposedPrice / (totalBaseValue || 1); 
        const fairnessIndicator = document.getElementById('sell-fairness-indicator');
        const fairnessMarker = document.getElementById('sell-fairness-marker');

        let markerPosition = (fairnessRatio - 0.5) * 100;
        markerPosition = Math.max(0, Math.min(100, markerPosition)); 
        if (fairnessMarker) fairnessMarker.style.left = `${markerPosition}%`;
        
        if (fairnessIndicator) {
            fairnessIndicator.className = 'fairness-indicator';
            fairnessIndicator.classList.add(this.game.tradeSystem.publicTradeManager.getTradeFairnessClass(proposedPrice, totalBaseValue));
            fairnessIndicator.textContent = this.game.tradeSystem.publicTradeManager.getTradeFairnessText(proposedPrice, totalBaseValue);
        }

        const hasItem = this.game.tradeSystem.publicTradeManager.canAffordTrade(category, item, amount);
        const availabilityCheck = document.getElementById('sell-availability-check');
        const executeSellBtn = document.getElementById('execute-sell-offer-btn');
        if (availabilityCheck) {
            if (hasItem) {
                availabilityCheck.innerHTML = '<span class="availability-ok">✅ Tienes suficiente para vender.</span>';
                if (executeSellBtn) executeSellBtn.classList.remove('disabled');
                if (executeSellBtn) executeSellBtn.disabled = false;
            } else {
                const missing = this.game.tradeSystem.publicTradeManager.getMissingResources(category, item, amount); 
                availabilityCheck.innerHTML = `<span class="availability-error">❌ ${missing}</span>`;
                if (executeSellBtn) executeSellBtn.classList.add('disabled');
                if (executeSellBtn) executeSellBtn.disabled = true;
            }
        }
    }
}