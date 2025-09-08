import { PublicTradeManager } from "../trade/PublicTradeManager.js";
import { NewsManager } from "./NewsManager.js";
import { WelcomeManager } from "./WelcomeManager.js";
import { SidePanelManager } from "./SidePanelManager.js";
import { NotificationManager } from "../utils/NotificationManager.js";

export class UIManager {
    constructor(game) {
        this.game = game;
        this.notificationManager = new NotificationManager(this.game);
        this.sidePanelManager = new SidePanelManager(this.game);

        // Modals
        this.modalContainer = document.getElementById('modalContainer');
        this.modal = null; // Will be set after loading HTML
        this.modalBody = null; // Will be set after loading HTML
        this.isModalHtmlLoaded = false; // Track if modal HTML content has been loaded

        // Game state
        this.newsPanelViewDiv = document.getElementById('newsPanelView');
        this.profileViewDiv = document.getElementById('profileView');
        this.scienceViewDiv = document.getElementById('scienceView');
        this.armyViewDiv = document.getElementById('armyView');

        this.currentView = 'map'; // Initial view

        // Bind tooltip handlers to ensure `this` context is correct
        this._boundShowTooltip = this._showTooltip.bind(this);
        this._boundHideTooltip = this._hideTooltip.bind(this);
    }

    setupUIEventListeners() {
        // UI buttons for view switching
        document.getElementById('cityBtn').addEventListener('click', () => {
            // If current view is map, switch to city; otherwise, switch to map
            if (this.game.currentView === 'map') {
                this.game.switchGameView('city');
            } else {
                this.game.switchGameView('map');
            }
        });
        document.getElementById('diplomacyBtn').addEventListener('click', () => this.game.switchGameView('diplomacy'));
        document.getElementById('tradeBtn').addEventListener('click', () => this.game.switchGameView('trade'));
        document.getElementById('dragonsBtn').addEventListener('click', () => this.game.switchGameView('dragons'));
        document.getElementById('armyBtn').addEventListener('click', () => this.game.switchGameView('army'));
        document.getElementById('newsPanelBtn').addEventListener('click', () => this.game.switchGameView('newsPanel'));
        document.getElementById('profileBtn').addEventListener('click', () => this.game.switchGameView('profile'));
        document.getElementById('scienceBtn').addEventListener('click', () => this.game.switchGameView('science'));
        
        // Map control buttons (these now delegate to MapInteractionManager)
        document.getElementById('zoomIn').addEventListener('click', () => this.game.mapRenderer.mapInteractionManager.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.game.mapRenderer.mapInteractionManager.zoom(0.8));
        document.getElementById('centerMap').addEventListener('click', () => {
            this.game.mapRenderer.mapInteractionManager.centerOnPlayerCity();
            this.game.mapRenderer.render(); // Still need to render after centering
        });

        // Battle log button
        document.getElementById('battleLogBtn').addEventListener('click', () => this.game.battleManager.openBattleLog());
        
        // News panel specific button
        const clearNewsBtn = document.getElementById('clearNewsBtn');
        if (clearNewsBtn) {
            clearNewsBtn.addEventListener('click', () => this.game.newsManager.clearNews());
        }

        // NEW: Trade view tab switching
        document.getElementById('tradeTabBuy')?.addEventListener('click', () => this.switchTradeTab('buy'));
        document.getElementById('tradeTabSell')?.addEventListener('click', () => this.switchTradeTab('sell'));

        // Attach to the game object for global access from inline HTML
        this.game.marketSellUIManager = this.game.tradeSystem.publicTradeManager.marketSellManager.marketSellUIManager;
        this.game.publicOfferUIManager = this.game.tradeSystem.publicTradeManager.publicOfferUIManager;
        
        // Trade view specific button - opens simplified sell modal
        const instantSellBtn = document.getElementById('instantSellBtn'); // Renamed ID
        if (instantSellBtn) {
            instantSellBtn.addEventListener('click', () => this.game.tradeSystem.publicTradeManager.openSellToMarketModal());
        }

        // NEW: Button to create a new public offer
        const createPublicOfferBtn = document.getElementById('createPublicOfferBtn');
        if (createPublicOfferBtn) {
            createPublicOfferBtn.addEventListener('click', () => this.game.tradeSystem.publicTradeManager.openCreatePublicOfferModal());
        }

        // Profile image upload listener
        const profileImageUpload = document.getElementById('profileImageUpload');
        if (profileImageUpload) {
            profileImageUpload.addEventListener('change', (event) => this.game.profileManager.handleProfileImageUpload(event));
        }

        // NEW: City view buttons moved from inline onclick to event listeners
        document.getElementById('recruitTroopsBtn').addEventListener('click', () => {
            this.game.troopManager.openRecruitment();
        });
        document.getElementById('cityToTradeBtn').addEventListener('click', () => {
            this.game.switchGameView('trade');
        });

        // NEW: Dragons view button moved from inline onclick to event listener
        document.getElementById('incubateDragonBtn').addEventListener('click', () => {
            this.game.dragonManager.openDragonIncubation();
        });

        this.setupTooltips(); // This one already existed here, keep it.
    }
    
    /**
     * Updates the content of the main side panel based on the selected tile.
     * Delegates to SidePanelManager.
     * @param {object} tile - The selected tile object from the map.
     * @param {number} x - The x-coordinate of the selected tile.
     * @param {number} y - The y-coordinate of the selected tile.
     */
    updateSidePanel(tile, x, y) {
        this.sidePanelManager.updateSidePanel(tile, x, y);
    }

    /**
     * Sets up tooltips for elements with `data-tooltip` attributes.
     * Made idempotent: only attaches listeners to elements not yet initialized.
     */
    setupTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]:not([data-tooltip-initialized])');
        tooltipElements.forEach(element => {
            const tooltipText = element.getAttribute('data-tooltip');
            element.addEventListener('mouseenter', this._boundShowTooltip.bind(this, element, tooltipText));
            element.addEventListener('mouseleave', this._boundHideTooltip);
            element.setAttribute('data-tooltip-initialized', 'true'); // Mark as initialized
        });
        
        // Setup resource expand button (specific logic, kept separate)
        const resourceExpandBtn = document.getElementById('resourceExpandBtn');
        const resourcePanel = document.getElementById('resourcePanel');
        
        if (resourceExpandBtn && resourcePanel && !resourceExpandBtn.hasAttribute('data-tooltip-initialized')) {
            resourceExpandBtn.addEventListener('click', (e) => {
                resourcePanel.classList.toggle('visible');
                e.stopPropagation(); // Prevent immediate closing from document click
            });
            
            // Close panel when clicking outside
            document.addEventListener('click', (e) => {
                if (resourcePanel.classList.contains('visible') && !resourceExpandBtn.contains(e.target) && !resourcePanel.contains(e.target)) {
                    resourcePanel.classList.remove('visible');
                }
            });
            resourceExpandBtn.setAttribute('data-tooltip-initialized', 'true');
        }
    }

    /**
     * Shows the tooltip. Bound to UIManager instance to retain context.
     * @param {HTMLElement} element - The element the tooltip is for.
     * @param {string} text - The tooltip text.
     * @param {MouseEvent} e - The mouse event.
     */
    _showTooltip(element, text, e) {
        this.game.tooltip.textContent = text;
        const rect = element.getBoundingClientRect();
        
        // Position tooltip relative to the element, trying to keep it within bounds
        let tooltipX = rect.left + rect.width / 2;
        let tooltipY = rect.bottom + 10; // 10px below the element

        // Adjust for viewport boundaries if tooltip would go off screen
        const tooltipWidth = this.game.tooltip.offsetWidth;
        const tooltipHeight = this.game.tooltip.offsetHeight;

        if (tooltipX + tooltipWidth / 2 > window.innerWidth) {
            tooltipX = window.innerWidth - tooltipWidth / 2 - 5; // 5px padding from right
        }
        if (tooltipX - tooltipWidth / 2 < 0) {
            tooltipX = tooltipWidth / 2 + 5; // 5px padding from left
        }
        if (tooltipY + tooltipHeight > window.innerHeight) {
            tooltipY = rect.top - tooltipHeight - 10; // 10px above the element
        }

        this.game.tooltip.style.left = tooltipX + 'px';
        this.game.tooltip.style.top = tooltipY + 'px';
        this.game.tooltip.style.transform = 'translateX(-50%)'; // Always center horizontally relative to its own width
        this.game.tooltip.classList.add('visible');
    }

    /**
     * Hides the tooltip. Bound to UIManager instance to retain context.
     */
    _hideTooltip() {
        this.game.tooltip.classList.remove('visible');
    }
    
    /**
     * Private method to set up modal event listeners once the HTML is loaded
     * or to re-attach them if the modal content is re-injected.
     */
    _setupModalEventListeners() {
        if (!this.modal) { // Ensure modal reference is set
            this.modal = document.getElementById('actionModal');
            this.modalBody = document.getElementById('modalBody');
        }
        
        // Attach event listeners only once
        if (!this._modalListenersAttached) {
            const closeBtn = this.modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }
            window.addEventListener('click', (e) => {
                if (e.target === this.modal) { // Check if click is directly on the modal backdrop
                    this.closeModal();
                }
            });
            this._modalListenersAttached = true;
        }
    }

    async showModal(title, content) {
        if (!this.isModalHtmlLoaded) {
            try {
                this.game.logLoadingStatus('Cargando HTML del modal de acción...', 'info');
                const response = await fetch('ui/html/game-modals.html');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const htmlContent = await response.text();
                this.modalContainer.innerHTML = htmlContent;
                this.isModalHtmlLoaded = true;
                this.game.logLoadingStatus('HTML del modal de acción cargado.', 'success');
            } catch (error) {
                console.error("Failed to load modal HTML:", error);
                this.game.logLoadingStatus(`Error al cargar modal: ${error.message}`, 'error');
                return; // Prevent showing modal if load failed
            }
        }
        
        this._setupModalEventListeners(); // Ensure listeners are attached after loading HTML
        
        this.modalBody.innerHTML = `<h2>${title}</h2>${content}`;
        this.modal.style.display = 'flex'; // Use flex to center the modal
        this.setupTooltips(); // Re-scan for tooltips in the new modal content
    }
    
    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
        this._hideTooltip(); // Ensure any active tooltip is hidden when modal closes
    }
    
    // NEW: Helper function to get resource display name
    // This now delegates to TradeDisplayHelper for a broader range of item names
    getItemDisplayName(itemKey) {
        // Fallback to resource manager for specific resource names if not a trade item
        return this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(itemKey) || this.game.resourceManager.getResourceDisplayName(itemKey);
    }

    // Delegate trade view update to PublicTradeManager
    updateTradeView() {
        // Ensure the correct tab is active on view switch
        this.switchTradeTab('buy'); // Default to 'Buy' tab when entering Trade View
        this.game.tradeSystem.publicTradeManager.updatePublicTradeView();
    }
    
    // NEW: Method to switch trade tabs
    switchTradeTab(tabName) {
        const buySection = document.getElementById('marketBuySection');
        const sellSection = document.getElementById('marketSellSection');
        const buyTab = document.getElementById('tradeTabBuy');
        const sellTab = document.getElementById('tradeTabSell');

        if (!buySection || !sellSection || !buyTab || !sellTab) {
            console.error("Trade tab elements not found.");
            return;
        }

        // Deactivate all sections and tabs
        buySection.classList.remove('active');
        sellSection.classList.remove('active');
        buyTab.classList.remove('active');
        sellTab.classList.remove('active');

        // Activate the selected tab and its content
        if (tabName === 'buy') {
            buySection.classList.add('active');
            buyTab.classList.add('active');
        } else if (tabName === 'sell') {
            sellSection.classList.add('active');
            sellTab.classList.add('active');
        }
        // Always refresh public trade view data when tabs change (in case underlying data changed)
        this.game.tradeSystem.publicTradeManager.updatePublicTradeView();
        this.setupTooltips(); // Re-scan for tooltips in the newly active trade tab
    }
    
    // NEW: Method to update Dragons View
    updateDragonsView() {
        const playerDragonsList = document.getElementById('playerDragonsList');
        if (!playerDragonsList) return;

        let dragonsHtml = '';
        if (this.game.playerDragons.length === 0) {
            dragonsHtml = '<p style="text-align: center; color: #c9b037;">No tienes dragones en tu guarida. ¡Incuba un huevo!</p>';
        } else {
            dragonsHtml = this.game.playerDragons.map(dragon => {
                const hpPercentage = (dragon.hp / dragon.max_hp) * 100;
                const xpPercentage = (dragon.xp / dragon.max_xp) * 100;
                let buffsHtml = '';
                if (dragon.empireBuffs) {
                    buffsHtml = Object.entries(dragon.empireBuffs).map(([resource, amount]) => {
                        // Use the shared getItemDisplayName for resource names
                        return `<span class="dragon-buff-item">${this.getItemDisplayName(resource.replace('_rate', ''))}: +${amount}/h</span>`;
                    }).join('');
                }

                return `
                    <div class="dragon-card">
                        <div class="dragon-header">
                            <img src="${dragon.image}" alt="${dragon.name}" class="dragon-icon">
                            <div class="dragon-title-level">
                                <h5 class="item-title">🐲 ${dragon.name}</h5>
                                <p class="dragon-level">Nivel: ${dragon.level} (XP: ${dragon.xp}/${dragon.max_xp})</p>
                                <div class="dragon-xp-bar-container">
                                    <div class="dragon-xp-bar" style="width: ${xpPercentage}%;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="dragon-hp-bar-container">
                            <div class="dragon-hp-bar" style="width: ${hpPercentage}%;"></div>
                            <span class="hp-text">${dragon.hp}/${dragon.max_hp} HP</span>
                        </div>
                        <div class="dragon-stats-grid">
                            <p><strong>Ataque:</strong> ${dragon.attack}</p>
                            <p><strong>Defensa:</strong> ${dragon.defense}</p>
                            <p><strong>Elemento:</strong> ${dragon.element}</p>
                            <p><strong>Rareza:</strong> ${dragon.rarity}</p>
                        </div>
                        <div class="dragon-abilities">
                            <h5>Habilidad: ${dragon.ability.name}</h5>
                            <p>${dragon.ability.description}</p>
                        </div>
                        <div class="dragon-buffs">
                            <h5>Buffs al Imperio:</h5>
                            ${buffsHtml || '<p>Ninguno</p>'}
                        </div>
                        <div class="item-actions">
                            <button class="medieval-btn">Entrenar</button>
                            <button class="medieval-btn">Enviar a Misión</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        playerDragonsList.innerHTML = dragonsHtml;
        this.setupTooltips(); // Re-scan for tooltips in the updated dragons view
    }

    // NEW: Method to update Science View
    updateScienceView() {
        this.game.scienceManager.renderTechTree();
        // Tooltips for science view are handled by ScienceManager itself,
        // which then calls setupTooltips.
    }

    // NEW: Method to update Army View
    updateArmyView() {
        const armyViewContent = document.getElementById('armyViewContent');
        if (!armyViewContent) return;
    
        const playerCityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
        const totalTroops = Object.values(playerCityTile.troops).reduce((sum, count) => sum + count, 0);
    
        // Troop Roster HTML
        let troopRosterHtml = Object.entries(playerCityTile.troops).map(([type, count]) => {
            if (count === 0) return '';
            const stats = this.game.troopManager.troopStats[type];
            const icon = this.game.tradeSystem.tradeDisplayHelper.getIconForItem('troops', type);
            return `
                <div class="troop-entry">
                    <img src="${icon}" alt="${stats.name}" class="troop-entry-icon">
                    <div class="troop-entry-info">
                        <div class="troop-entry-name">${stats.name}</div>
                        <div class="troop-entry-stats">
                            HP: ${stats.hp} | ATK: ${stats.attack} | DEF: ${stats.armor} | RNG: ${stats.range} | SPD: ${stats.speed}
                        </div>
                    </div>
                    <div class="troop-entry-count">${count.toLocaleString()}</div>
                </div>
            `;
        }).join('');
    
        if (totalTroops === 0) {
            troopRosterHtml = '<p style="text-align: center; color: #c9b037;">No tienes tropas en tu ciudad. ¡Recluta en el cuartel!</p>';
        }

        // Generals List HTML
        const generalsHtml = this.game.playerGenerals.map(general => `
            <div class="general-card">
                <div class="general-card-header">
                    <img src="${general.avatar}" alt="${general.name}" class="general-card-avatar">
                    <div class="general-card-title">
                        <h4>${general.name}</h4>
                        <p>Nivel ${general.level} - ${general.specialty}</p>
                    </div>
                </div>
                <ul class="general-card-stats">
                    <li><strong>Liderazgo:</strong> ${general.stats.leadership}</li>
                    <li><strong>Táctica Ofensiva:</strong> ${general.stats.attack_tactic}</li>
                    <li><strong>Táctica Defensiva:</strong> ${general.stats.defense_tactic}</li>
                </ul>
                <div class="general-card-buffs">
                    <h5>Bonificaciones</h5>
                    <p>${Object.entries(general.buffs).map(([key, value]) => this.formatBuffText(key, value)).join('<br>')}</p>
                </div>
            </div>
        `).join('');

        // Strategies HTML
        const strategiesHtml = this.game.combatStrategies.map(strategy => `
            <div class="strategy-card ${this.game.activeStrategy === strategy.id ? 'active' : ''}">
                <h4>${strategy.icon} ${strategy.name}</h4>
                <p>${strategy.description}</p>
                <p><strong>Efecto:</strong> ${strategy.effectText}</p>
                <button class="medieval-btn" onclick="game.setActiveStrategy('${strategy.id}')">
                    ${this.game.activeStrategy === strategy.id ? '✅ Activa' : 'Activar'}
                </button>
            </div>
        `).join('');

        // Current Army Stats
        let combinedArmyStats = { hp: 0, attack: 0, armor: 0, range: 0, speed: 0 };
        let totalCombatTroopsCount = 0;

        for (const type in playerCityTile.troops) {
            const count = playerCityTile.troops[type];
            if (count > 0) {
                const stats = this.game.troopManager.troopStats[type];
                combinedArmyStats.hp += stats.hp * count;
                combinedArmyStats.attack += stats.attack * count;
                combinedArmyStats.armor += stats.armor * count;
                combinedArmyStats.range += stats.range * count;
                combinedArmyStats.speed += stats.speed * count;
                totalCombatTroopsCount += count;
            }
        }

        // Calculate averages for range and speed
        if (totalCombatTroopsCount > 0) {
            combinedArmyStats.range = (combinedArmyStats.range / totalCombatTroopsCount).toFixed(1);
            combinedArmyStats.speed = (combinedArmyStats.speed / totalCombatTroopsCount).toFixed(1);
        } else {
            combinedArmyStats.range = 0;
            combinedArmyStats.speed = 0;
        }

        // Army Slots HTML
        let armySlotsHtml = '';
        if (this.game.savedArmyCompositions.length === 0) {
            armySlotsHtml = '<p style="text-align: center; color: #c9b037;">No tienes formaciones de ejército guardadas. ¡Crea una!</p>';
        } else {
            armySlotsHtml = this.game.savedArmyCompositions.map(slot => {
                const compositionText = Object.entries(slot.composition)
                    .filter(([, count]) => count > 0)
                    .map(([type, count]) => `<span>${count} ${this.game.troopManager.troopStats[type].name}</span>`)
                    .join('');

                return `
                    <div class="army-slot-card">
                        <div class="slot-info">
                            <div class="slot-name">💾 ${slot.name}</div>
                            <div class="slot-composition">${compositionText || 'Vacía'}</div>
                        </div>
                        <div class="slot-actions">
                            <button class="medieval-btn compact-btn" onclick="game.recruitSavedComposition('${slot.id}')">📋 Reclutar</button>
                            <button class="medieval-btn compact-remove-btn" onclick="game.deleteSavedComposition('${slot.id}')">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        armyViewContent.innerHTML = `
            <div class="army-container">
                <div class="army-sidebar">
                    <h3 class="view-title">⚔️ Comandancia</h3>
                    <button class="army-tab-btn active" data-tab="overview">
                        📊 Resumen
                    </button>
                    <button class="army-tab-btn" data-tab="generals">
                        🎖️ Generales
                    </button>
                    <button class="army-tab-btn" data-tab="strategies">
                        📜 Estrategias
                    </button>
                </div>
                <div class="army-main-content">
                    <!-- Overview Tab -->
                    <div id="overviewTab" class="army-tab-content active">
                        <h4>Resumen del Ejército</h4>
                        <div class="army-overview-stats">
                            <div class="stat-card">
                                <div class="stat-card-title">Tropas Totales</div>
                                <div class="stat-card-value">${totalTroops.toLocaleString()}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-card-title">Poder de Ejército (Est.)</div>
                                <div class="stat-card-value">--</div>
                             </div>
                             <div class="stat-card">
                                <div class="stat-card-title">Generales Activos</div>
                                <div class="stat-card-value">${this.game.playerGenerals.length}</div>
                            </div>
                        </div>
                        <h4>Estadísticas de la Formación Actual</h4>
                        <div class="army-current-stats">
                            <p>Total HP: <strong>${combinedArmyStats.hp.toLocaleString()}</strong></p>
                            <p>Ataque Combinado: <strong>${combinedArmyStats.attack.toLocaleString()}</strong></p>
                            <p>Armadura Combinada: <strong>${combinedArmyStats.armor.toLocaleString()}</strong></p>
                            <p>Rango Promedio: <strong>${combinedArmyStats.range}</strong></p>
                            <p>Velocidad Promedio: <strong>${combinedArmyStats.speed}</strong></p>
                        </div>
                        <h4>Plantilla de Tropas</h4>
                        <div class="troop-roster">
                           ${troopRosterHtml}
                        </div>
                        <div class="army-slots-section">
                            <h4>Formaciones de Ejército Guardadas</h4>
                            <button class="medieval-btn" style="width: 100%; margin-bottom: 15px;" onclick="game.uiManager.openSaveArmyCompositionModal()">➕ Crear Nueva Formación</button>
                            <div class="army-slots-list">
                                ${armySlotsHtml}
                            </div>
                        </div>
                    </div>
                    <!-- Generals Tab -->
                    <div id="generalsTab" class="army-tab-content">
                         <h4>Tus Generales</h4>
                         <div class="generals-list">
                            ${generalsHtml}
                         </div>
                    </div>
                    <!-- Strategies Tab -->
                    <div id="strategiesTab" class="army-tab-content">
                        <h4>Estrategias de Combate Globales</h4>
                        <p style="color: #c9b037; text-align: center; margin-bottom: 20px;">Selecciona una estrategia para aplicar una bonificación pasiva a todos tus ejércitos.</p>
                        <div class="strategies-list">
                            ${strategiesHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupArmyViewTabs();
    }

    setupArmyViewTabs() {
        const tabButtons = document.querySelectorAll('.army-tab-btn');
        const tabContents = document.querySelectorAll('.army-tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;

                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabId}Tab`) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    formatBuffText(key, value) {
        const descriptions = {
            army_attack_physical_perc: `+${value * 100}% Ataque Físico (Ejército)`,
            cavalry_speed_perc: `+${value * 100}% Velocidad (Caballería)`,
            archer_attack_physical_perc: `+${value * 100}% Ataque Físico (Arqueros)`,
            army_range_flat: `+${value} Rango (Ejército)`,
            army_defense_perc: `+${value * 100}% Defensa (Ejército)`,
            infantry_hp_perc: `+${value * 100}% HP (Infantería)`,
        };
        return descriptions[key] || `${key}: ${value}`;
    }

    // This method is now delegated to WelcomeManager
    showWelcomeModal() {
        this.game.welcomeManager.showWelcomeModal();
    }

    // NEW: Method to open modal for saving a new army composition
    openSaveArmyCompositionModal() {
        this.game.uiManager.showModal('Guardar Nueva Formación', `
            <div class="save-composition-modal">
                <div class="input-row">
                    <label for="formation-name">Nombre de Formación:</label>
                    <input type="text" id="formation-name" placeholder="Ej: Avanzada Rápida" class="admin-input">
                </div>
                <h4>Composición de Tropas:</h4>
                <div class="troop-inputs-grid">
                    <label>Milicia:</label><input type="number" id="save-milicia-count" min="0" value="0" class="admin-input">
                    <label>Arqueros:</label><input type="number" id="save-archer-count" min="0" value="0" class="admin-input">
                    <label>Caballería:</label><input type="number" id="save-cavalry-count" min="0" value="0" class="admin-input">
                </div>
                <button class="medieval-btn" style="width: 100%;" onclick="game.saveArmyCompositionFromModal()">Guardar Formación</button>
            </div>
        `);
    }
}