import { PublicTradeManager } from './PublicTradeManager.js';
import { TradeStateManager } from './TradeStateManager.js';
import { TradeDisplayHelper } from './TradeDisplayHelper.js';

console.log("PublicOfferUIManager.js loaded.");

export class PublicOfferUIManager {
    constructor(game, publicTradeManager) {
        this.game = game;
        this.publicTradeManager = publicTradeManager;
    }

    openCreatePublicOfferModal() {
        const categories = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes || {});
        const categoryOptions = categories.map(cat => {
            const itemsInCurrentCategory = this.game.tradeSystem.tradeStateManager.tradeItemTypes[cat];
            let categoryDisplayName;

            if (itemsInCurrentCategory && Object.keys(itemsInCurrentCategory).length > 0) {
                const firstItemKey = Object.keys(itemsInCurrentCategory)[0];
                categoryDisplayName = itemsInCurrentCategory[firstItemKey]?.category;
            }

            if (!categoryDisplayName) {
                switch (cat) {
                    case 'resources': categoryDisplayName = 'Recursos'; break;
                    case 'troops': categoryDisplayName = 'Tropas'; break;
                    case 'territories': categoryDisplayName = 'Territorios'; break;
                    case 'technology': categoryDisplayName = 'Tecnología'; break;
                    case 'special': categoryDisplayName = 'Especiales'; break;
                    case 'dragons': categoryDisplayName = 'Dragones'; break;
                    default: categoryDisplayName = cat;
                }
            }
            return { value: cat, text: categoryDisplayName };
        });

        this.game.uiManager.showModal('📝 Publicar Nueva Oferta Pública', `
            <div class="minimalist-sell-panel">
                <h3>Vende tus artículos a otros jugadores por Imperion</h3>
                <p style="text-align: center; color: #c9b037; font-size: 0.9em; margin-bottom: 15px;">Al venderse, se aplicará un impuesto del ${PublicTradeManager.SERVER_TAX_RATE * 100}% sobre el Imperion recibido.</p>
                
                <div class="sell-section-main">
                    <h4>📤 Ofreces:</h4>
                    <div class="input-row">
                        <label for="public-offer-category">Categoría:</label>
                        <div class="custom-select-wrapper">
                             <input type="hidden" id="public-offer-category" value="${categories[0] || ''}">
                             <button class="medieval-btn custom-select-btn" id="public-offer-category-btn">
                                 ${categoryOptions.length > 0 ? categoryOptions[0].text : 'No disponible'}
                             </button>
                             <div class="custom-select-options" id="public-offer-category-options">
                                 ${categoryOptions.map(opt => `<div class="custom-select-option" data-value="${opt.value}">${opt.text}</div>`).join('')}
                             </div>
                        </div>
                    </div>
                    <div class="input-row">
                        <label for="public-offer-item">Artículo:</label>
                        <div class="custom-select-wrapper">
                            <input type="hidden" id="public-offer-item">
                            <button class="medieval-btn custom-select-btn" id="public-offer-item-btn">Selecciona un artículo</button>
                            <div class="custom-select-options" id="public-offer-item-options">
                                <!-- Item options will be populated here -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="amount-slider-container">
                        <label for="public-offer-amount">Cantidad:</label>
                        <div class="slider-and-value">
                            <input type="range" 
                                   id="public-offer-amount" 
                                   class="trade-slider" 
                                   value="1" 
                                   min="0" 
                                   oninput="game.tradeSystem.publicTradeManager.publicOfferUIManager.updatePublicOfferPriceDisplay()">
                            <span id="public-offer-amount-value" class="slider-value">1</span>
                            <button class="medieval-btn" onclick="game.tradeSystem.publicTradeManager.publicOfferUIManager.setPublicOfferAmountMax()">MAX</button>
                        </div>
                    </div>
                    
                    <div class="item-summary-display"> 
                        <div class="display-item-offered">
                            <img id="public-offer-item-icon" src="" alt="Item Icon" class="trade-item-icon">
                            <span id="public-offer-item-name-amount"></span>
                            <small id="public-offer-item-base-value-text"></small>
                        </div>
                        <div class="trade-arrow-large">⇄</div>
                        <div class="display-imperion-received">
                            <img src="assets/images/ui/imperion-icon.png" alt="Imperion Icon" class="imperion-trade-icon">
                            <span id="public-offer-imperion-price">0.0 👑</span>
                        </div>
                    </div>
                    
                    <span id="public-offer-recommended-price-display">Precio Recomendado: <span id="public-offer-recommended-price-value">0</span> 👑</span>
                </div>
                
                <div class="sell-section-price">
                    <h4>👑 Precio de Venta (Imperion)</h4>
                    <div class="input-row">
                        <label for="public-offer-price-imperion">Solicitar:</label>
                        <div class="custom-number-input-wrapper">
                            <button class="medieval-btn custom-number-btn" onclick="game.publicOfferUIManager.adjustPublicOfferPrice(-10)">-</button>
                            <input type="number" id="public-offer-price-imperion" class="custom-number-input" value="1" min="0.1" step="0.1" oninput="game.tradeSystem.publicTradeManager.publicOfferUIManager.updatePublicOfferPriceDisplay()">
                             <button class="medieval-btn custom-number-btn" onclick="game.publicOfferUIManager.adjustPublicOfferPrice(10)">+</button>
                        </div>
                    </div>
                    
                    <div class="trade-summary">
                        <h4>📊 Análisis de la Oferta</h4>
                        <div class="value-comparison">
                            <div class="fairness-bar-container">
                                <div class="fairness-bar" id="public-offer-fairness-bar"></div>
                                <div class="fairness-bar-marker" id="public-offer-fairness-marker"></div>
                            </div>
                            <div class="fairness-indicator" id="public-offer-fairness-indicator">
                                Precio Justo
                            </div>
                            <div class="availability-check" id="public-offer-availability-check">
                                <span class="availability-ok">✅ Tienes el artículo para vender.</span>
                            </div>
                        </div>
                    </div>
                    <button class="medieval-btn" id="execute-public-offer-btn" onclick="game.tradeSystem.publicTradeManager.createPublicOffer(
                        document.getElementById('public-offer-category').value,
                        document.getElementById('public-offer-item').value,
                        parseInt(document.getElementById('public-offer-amount').value),
                        parseFloat(document.getElementById('public-offer-price-imperion').value)
                    ">📝 Publicar Oferta</button>
                </div>
                
            </div>
        `);
        
        setTimeout(() => { 
            this.game.marketSellUIManager.setupCustomSelect('public-offer-category', () => this.updatePublicOfferItemOptions());
            this.game.marketSellUIManager.setupCustomSelect('public-offer-item', () => this.updatePublicOfferPriceDisplay());
            this.updatePublicOfferItemOptions();
            this.setPublicOfferAmountMax();
            this.updatePublicOfferPriceDisplay();
        }, 50); 
    }

    // NEW: Helper to adjust public offer price
    adjustPublicOfferPrice(amount) {
        const priceInput = document.getElementById('public-offer-price-imperion');
        if (priceInput) {
            let currentValue = parseFloat(priceInput.value) || 0;
            let step = Math.abs(amount) > 1 ? 10 : 1;
            if (currentValue < 10) step = 1;
            if (currentValue < 1) step = 0.1;

            let finalAmount = amount > 0 ? step : -step;

            priceInput.value = Math.max(0.1, (currentValue + finalAmount)).toFixed(1);
            this.updatePublicOfferPriceDisplay();
        }
    }

    updatePublicOfferItemOptions() {
        const categoryInput = document.getElementById('public-offer-category');
        const itemInput = document.getElementById('public-offer-item');
        const itemButton = document.getElementById('public-offer-item-btn');
        const itemOptionsContainer = document.getElementById('public-offer-item-options');


        if (!categoryInput || !itemInput || !itemButton || !itemOptionsContainer) return;

        const category = categoryInput.value;
        let items = Object.keys(this.game.tradeSystem.tradeStateManager.tradeItemTypes[category] || {});
        
        // Filter items to ensure player can actually offer them
        items = items.filter(item => this.game.tradeSystem.tradeStateManager.validatePlayerCanOffer(category, item, 1, true)); 
        
        itemOptionsContainer.innerHTML = items.map(item => {
            const itemData = this.game.tradeSystem.tradeStateManager.tradeItemTypes[category]?.[item];
            const displayName = this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item);
            return `<div class="custom-select-option" data-value="${item}">${itemData?.icon || ''} ${displayName}</div>`;
        }).join('');

        if (items.length > 0) {
            itemInput.value = items[0];
            itemButton.textContent = itemOptionsContainer.querySelector('.custom-select-option').textContent;
        } else {
            itemInput.value = '';
            itemButton.textContent = 'No disponible';
        }

        if (items.length === 0) {
            itemButton.disabled = true;
            const amountSlider = document.getElementById('public-offer-amount');
            const priceInput = document.getElementById('public-offer-price-imperion');
            const createBtn = document.getElementById('execute-public-offer-btn');

            if (amountSlider) {
                amountSlider.value = 0;
                amountSlider.max = 0;
                amountSlider.disabled = true;
            }
            if (priceInput) {
                priceInput.value = 0;
                priceInput.disabled = true;
            }
            if (createBtn) {
                createBtn.classList.add('disabled');
                createBtn.disabled = true;
            }
        } else {
            itemButton.disabled = false;
            const amountSlider = document.getElementById('public-offer-amount');
            const priceInput = document.getElementById('public-offer-price-imperion');
            const createBtn = document.getElementById('execute-public-offer-btn');

            if (amountSlider) {
                amountSlider.disabled = false;
            }
            if (priceInput) {
                priceInput.disabled = false;
            }
            if (createBtn) {
                createBtn.classList.remove('disabled');
                createBtn.disabled = false;
            }
        }
        
        this.setPublicOfferAmountMax();
        this.updatePublicOfferPriceDisplay();
    }

    setPublicOfferAmountMax() {
        const categoryInput = document.getElementById('public-offer-category');
        const itemInput = document.getElementById('public-offer-item');

        if (!categoryInput || !itemInput) return;

        const category = categoryInput.value;
        const item = itemInput.value;
        let maxAmount = 0;

        if (!item || !category) {
            document.getElementById('public-offer-amount').value = 0;
            document.getElementById('public-offer-amount').max = 0;
            return;
        }
        
        maxAmount = this.game.tradeSystem.tradeStateManager.getMaxAmountForListedItem('player', category, item);

        const amountSlider = document.getElementById('public-offer-amount');
        if (amountSlider) {
            amountSlider.max = maxAmount;
            amountSlider.value = maxAmount; 
        }
    }

    updatePublicOfferPriceDisplay() {
        const category = document.getElementById('public-offer-category')?.value;
        const item = document.getElementById('public-offer-item')?.value;
        const amount = parseInt(document.getElementById('public-offer-amount')?.value) || 0;
        let proposedPrice = parseFloat(document.getElementById('public-offer-price-imperion')?.value) || 0; 

        const amountValueSpan = document.getElementById('public-offer-amount-value');
        if (amountValueSpan) {
            amountValueSpan.textContent = amount;
        }

        if (!category || !item || amount <= 0) {
            const itemIcon = document.getElementById('public-offer-item-icon');
            if (itemIcon) itemIcon.src = '';
            const itemNameAmount = document.getElementById('public-offer-item-name-amount');
            if (itemNameAmount) itemNameAmount.textContent = 'Selecciona un artículo';
            const itemBaseValueText = document.getElementById('public-offer-item-base-value-text');
            if (itemBaseValueText) itemBaseValueText.textContent = '';
            const imperionPrice = document.getElementById('public-offer-imperion-price');
            if (imperionPrice) imperionPrice.textContent = '0.0 👑';

            const recommendedPriceValue = document.getElementById('public-offer-recommended-price-value');
            if (recommendedPriceValue) recommendedPriceValue.textContent = (0).toFixed(1);
            const fairnessIndicator = document.getElementById('public-offer-fairness-indicator');
            if (fairnessIndicator) {
                fairnessIndicator.textContent = 'Selecciona un artículo y cantidad';
                fairnessIndicator.className = 'fairness-indicator';
            }
            const fairnessMarker = document.getElementById('public-offer-fairness-marker');
            if (fairnessMarker) fairnessMarker.style.left = '50%';
            const availabilityCheck = document.getElementById('public-offer-availability-check');
            if (availabilityCheck) availabilityCheck.innerHTML = '<span class="availability-error">❌ No hay artículo seleccionado o cantidad inválida.</span>';
            const createBtn = document.getElementById('execute-public-offer-btn');
            if (createBtn) {
                createBtn.classList.add('disabled');
                createBtn.disabled = true;
            }
            return;
        }

        const baseValuePerUnit = this.game.tradeSystem.tradeStateManager.tradeItemTypes[category]?.[item]?.value || 0;
        const totalBaseValue = baseValuePerUnit * amount;
        
        const priceInput = document.getElementById('public-offer-price-imperion');
        if (priceInput && document.activeElement.id !== 'public-offer-price-imperion') { 
            priceInput.value = totalBaseValue.toFixed(1);
            proposedPrice = totalBaseValue; 
        }

        const itemIcon = document.getElementById('public-offer-item-icon');
        const itemNameAmount = document.getElementById('public-offer-item-name-amount');
        const itemBaseValueText = document.getElementById('public-offer-item-base-value-text');
        const imperionPrice = document.getElementById('public-offer-imperion-price');
        const recommendedPriceValue = document.getElementById('public-offer-recommended-price-value');

        if (itemIcon && item) {
            itemIcon.src = this.game.tradeSystem.tradeDisplayHelper.getIconForItem(category, item);
        } else if (itemIcon) {
            itemIcon.src = ''; 
        }
        
        if (itemNameAmount) {
            itemNameAmount.textContent = `${amount} ${this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item)}`;
        }
        
        if (itemBaseValueText) {
            itemBaseValueText.textContent = `(${totalBaseValue.toFixed(1)} 👑)`;
        }

        if (imperionPrice) {
            imperionPrice.textContent = `${proposedPrice.toFixed(1)} 👑`;
        }

        if (recommendedPriceValue) {
            recommendedPriceValue.textContent = totalBaseValue.toFixed(1);
        }

        const fairnessRatio = proposedPrice / (totalBaseValue || 1); 
        const fairnessIndicator = document.getElementById('public-offer-fairness-indicator');
        const fairnessMarker = document.getElementById('public-offer-fairness-marker');

        let markerPosition = (fairnessRatio - 0.5) * 100;
        markerPosition = Math.max(0, Math.min(100, markerPosition)); 
        if (fairnessMarker) fairnessMarker.style.left = `${markerPosition}%`;
        
        if (fairnessIndicator) {
            fairnessIndicator.className = 'fairness-indicator';
            fairnessIndicator.classList.add(this.publicTradeManager.getTradeFairnessClass(proposedPrice, totalBaseValue));
            fairnessIndicator.textContent = this.publicTradeManager.getTradeFairnessText(proposedPrice, totalBaseValue);
        }

        const hasItem = this.publicTradeManager.canAffordTrade(category, item, amount); // Use publicTradeManager's method
        const availabilityCheck = document.getElementById('public-offer-availability-check');
        const createBtn = document.getElementById('execute-public-offer-btn');
        if (availabilityCheck) {
            if (hasItem) {
                availabilityCheck.innerHTML = '<span class="availability-ok">✅ Tienes suficiente para publicar la oferta.</span>';
                if (createBtn) createBtn.classList.remove('disabled');
                if (createBtn) createBtn.disabled = false;
            } else {
                const missing = this.publicTradeManager.getMissingResources(category, item, amount); // Use publicTradeManager's method
                availabilityCheck.innerHTML = `<span class="availability-error">❌ ${missing}</span>`;
                if (createBtn) createBtn.classList.add('disabled');
                if (createBtn) createBtn.disabled = true;
            }
        }
    }

    /**
     * Updates the display of the public trade view (player offers and market offers).
     * Moved from PublicTradeManager.js.
     */
    updatePublicTradeView() {
        const playerOffersList = document.getElementById('playerOffersList');
        const marketOffersList = document.getElementById('marketOffersList');

        if (!playerOffersList || !marketOffersList) return;

        // Combine NPC offers and other players' offers for the "Buy" tab
        const allBuyOffers = [
            ...this.game.tradeSystem.npcOffers,
            // Filter player offers to only show those not created by current user
            ...this.game.tradeSystem.playerOffers.filter(offer => offer.creatorId !== this.game.profileManager.playerProfile.userId)
        ];

        // Render combined offers for "Buy" tab
        let marketOffersHTML = '';
        if (allBuyOffers.length === 0) {
            marketOffersHTML = '<p style="text-align: center; color: #c9b037;">No hay ofertas disponibles en el mercado global.</p>';
        } else {
            marketOffersHTML = allBuyOffers.map(offer => `
                <div class="advanced-trade-card ${offer.creatorId === this.game.profileManager.playerProfile.userId ? 'player-offer' : 'npc-offer'}">
                    <div class="trade-card-header">
                        <h5 class="item-title">${offer.creator}</h5>
                        <div class="trade-value-badge ${this.getValueBadgeClass(offer.offeredValue, offer.requestedValue)}">
                            ${Math.max(offer.offeredValue, offer.requestedValue).toFixed(1)} 👑
                        </div>
                    </div>
                    <div class="trade-card-content">
                        <div class="trade-item-display">
                            <div class="trade-offer-section">
                                <span class="trade-label">📤 Ofrece:</span>
                                <div class="trade-item-info">
                                    <span class="trade-item-amount-name">${this._getTradeItemDisplayContent(offer.offeredCategory, offer.offeredItem, offer.offeredAmount)}</span>
                                    <small>(${offer.offeredValue.toFixed(1)} 👑)</small>
                                </div>
                            </div>
                            <div class="trade-arrow">⇄</div>
                            <div class="trade-request-section">
                                <span class="trade-label">📥 Solicitado:</span>
                                <div class="trade-item-info">
                                    <span class="trade-item-amount-name">${this._getTradeItemDisplayContent(offer.requestedCategory, offer.requestedItem, offer.requestedAmount)}</span>
                                    <small>(${offer.requestedValue.toFixed(1)} 👑)</small>
                                </div>
                            </div>
                        </div>
                        <div class="availability-check">
                            ${this.getAvailabilityStatus(offer.requestedCategory, offer.requestedItem, offer.requestedAmount)}
                        </div>
                        <div class="trade-fairness-indicator ${this.getTradeFairnessClass(offer.offeredValue, offer.requestedValue)}">
                            ${this.getTradeFairnessText(offer.offeredValue, offer.requestedValue)}
                        </div>
                    </div>
                    <div class="trade-card-actions">
                        <button class="accept-trade-btn ${this.publicTradeManager.canAffordTrade(offer.requestedCategory, offer.requestedItem, offer.requestedAmount) ? '' : 'disabled'}"
                                ${this.publicTradeManager.canAffordTrade(offer.requestedCategory, offer.requestedItem, offer.requestedAmount) ? '' : 'disabled'}
                                onclick="game.tradeSystem.publicTradeManager.acceptPublicOffer('${offer.id}')">
                            ${this.publicTradeManager.canAffordTrade(offer.requestedCategory, offer.requestedItem, offer.requestedAmount) ? '✅ Aceptar Intercambio' : '❌ Recursos Insuficientes'}
                        </button>
                    </div>
                </div>
            `).join('');
        }
        marketOffersList.innerHTML = marketOffersHTML;

        // Render current player's active public offers for the "Sell" tab
        const currentPlayerOffers = this.game.tradeSystem.playerOffers.filter(offer => offer.creatorId === this.game.profileManager.playerProfile.userId);
        let playerOffersHTML = '';
        if (currentPlayerOffers.length === 0) {
            playerOffersHTML = '<p style="text-align: center; color: #c9b037;">No tienes ofertas de comercio público activas.</p>';
        } else {
            playerOffersHTML = currentPlayerOffers.map(offer => `
                <div class="advanced-trade-card player-offer">
                    <div class="trade-card-header">
                        <h5 class="item-title">Tu Oferta Publicada</h5>
                        <div class="trade-value-badge">
                            ${Math.max(offer.offeredValue, offer.requestedValue).toFixed(1)} 👑
                        </div>
                    </div>
                    <div class="trade-card-content">
                        <div class="trade-item-display">
                            <div class="trade-offer-section">
                                <span class="trade-label">📤 Ofreces:</span>
                                <div class="trade-item-info">
                                    <span class="trade-item-amount-name">${this._getTradeItemDisplayContent(offer.offeredCategory, offer.offeredItem, offer.offeredAmount)}</span>
                                    <small>(${offer.offeredValue.toFixed(1)} 👑)</small>
                                </div>
                            </div>
                            <div class="trade-arrow">⇄</div>
                            <div class="trade-request-section">
                                <span class="trade-label">📥 Solicitas:</span>
                                <div class="trade-item-info">
                                    <span class="trade-item-amount-name">${this._getTradeItemDisplayContent(offer.requestedCategory, offer.requestedItem, offer.requestedAmount)}</span>
                                    <small>(${offer.requestedValue.toFixed(1)} 👑)</small>
                                </div>
                            </div>
                        </div>
                        <div class="trade-fairness-indicator ${this.getTradeFairnessClass(offer.offeredValue, offer.requestedValue)}">
                            ${this.getTradeFairnessText(offer.offeredValue, offer.requestedValue)}
                        </div>
                    </div>
                    <div class="trade-card-actions">
                        <button class="cancel-trade-btn" onclick="game.tradeSystem.publicTradeManager.cancelPublicOffer('${offer.id}')">
                            ❌ Cancelar Oferta
                        </button>
                    </div>
                </div>
            `).join('');
        }
        playerOffersList.innerHTML = playerOffersHTML;
    }

    /**
     * Helper to get trade item content with image or emoji.
     * Moved from PublicTradeManager.js.
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
     * Determines the CSS class for trade fairness based on value ratio.
     * Moved from PublicTradeManager.js.
     */
    getTradeFairnessClass(offeredValue, requestedValue) {
        const ratio = offeredValue / requestedValue;
        if (ratio >= 0.9 && ratio <= 1.1) return 'fair-trade';
        if (ratio > 1.1) return 'generous-trade';
        return 'demanding-trade';
    }

    /**
     * Provides a descriptive text for trade fairness.
     * Moved from PublicTradeManager.js.
     */
    getTradeFairnessText(offeredValue, requestedValue) {
        const ratio = offeredValue / requestedValue;
        if (ratio >= 0.9 && ratio <= 1.1) return '⚖️ Intercambio Justo';
        if (ratio > 1.1) return '💎 Oferta Generosa';
        return '📈 Solicita Más Valor';
    }

    /**
     * Determines the CSS class for the value badge based on the maximum value.
     * Moved from PublicTradeManager.js.
     */
    getValueBadgeClass(offeredValue, requestedValue) {
        const maxValue = Math.max(offeredValue, requestedValue);
        if (maxValue >= 200) return 'high-value';
        if (maxValue >= 100) return 'medium-value';
        return 'low-value';
    }

    /**
     * Generates HTML status indicating if player can afford an item.
     * Moved from PublicTradeManager.js.
     */
    getAvailabilityStatus(category, item, amount) {
        // Delegate to PublicTradeManager for the actual affordability check
        const canAfford = this.publicTradeManager.canAffordTrade(category, item, amount);
        if (canAfford) {
            return '<span class="availability-ok">✅ Puedes realizar este intercambio</span>';
        } else {
            // Delegate to PublicTradeManager for missing resources message
            const missing = this.publicTradeManager.getMissingResources(category, item, amount);
            return `<span class="availability-error">❌ ${missing}</span>`;
        }
    }
}