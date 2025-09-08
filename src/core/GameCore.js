import { MapRenderer } from '../map/MapRenderer.js';
import { ResourceManager } from '../managers/ResourceManager.js';
import { UIManager } from '../managers/UIManager.js';
import { GameActions } from '../actions/GameActions.js';
import { ChatSystem } from '../chat/ChatSystem.js';
import { TradeSystem } from '../trade/TradeSystem.js';
import { DragonManager } from '../managers/DragonManager.js';
import { ProfileManager } from '../managers/ProfileManager.js';
import { LoadingManager } from './LoadingManager.js';
import { ExplorationManager } from '../managers/ExplorationManager.js';
import { TroopManager } from '../managers/TroopManager.js';
import { DiplomacyManager } from '../managers/DiplomacyManager.js';
import { NewsManager } from '../managers/NewsManager.js';
import { BattleManager } from '../managers/BattleManager.js';
import { WelcomeManager } from '../managers/WelcomeManager.js';
import { SidePanelManager } from '../managers/SidePanelManager.js';
import { ScienceManager } from '../managers/ScienceManager.js';

export class ImperionGame {
    constructor() {
        console.log("GameCore.js: ImperionGame constructor called.");
        this.canvas = document.getElementById('mapCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.tooltip = document.getElementById('tooltip');
        
        // View containers
        this.mapViewDiv = document.getElementById('mapView');
        this.cityViewDiv = document.getElementById('cityView');
        this.diplomacyViewDiv = document.getElementById('diplomacyView');
        this.tradeViewDiv = document.getElementById('tradeView');
        this.dragonsViewDiv = document.getElementById('dragonsView');
        this.newsPanelViewDiv = document.getElementById('newsPanelView');
        this.profileViewDiv = document.getElementById('profileView');
        this.scienceViewDiv = document.getElementById('scienceView');
        this.armyViewDiv = document.getElementById('armyView');

        this.currentView = 'map'; // Initial view
        
        /* MPHOOK: Initialize multiplayer adapter */
        this.multiplayer = null;

        // Game state - inicializar con posición aleatoria por defecto
        this.playerCity = {
            x: Math.floor(Math.random() * 50),
            y: Math.floor(Math.random() * 50)
        }; // Se sobrescribirá cuando el multiplayer se una, pero tiene valor por defecto
        this.playerSpecialItems = new Map(); // NEW: Inventory for special items
        this.activeCaravans = []; // NEW: Array for temporary caravan traders

        // Define NPC Empires
        // NPCs serán creados exclusivamente desde el admin panel
        this.npcEmpires = [];

        // NEW: Player Generals with stats and buffs
        this.playerGenerals = [
            { 
                id: 'gen1', 
                name: 'Valerius', 
                level: 5, 
                avatar: 'assets/images/units/cavalry-sprite.png',
                specialty: 'Caballería',
                stats: { leadership: 8, attack_tactic: 7, defense_tactic: 5 },
                buffs: { army_attack_physical_perc: 0.1, cavalry_speed_perc: 0.2 } // +10% physical attack for all, +20% speed for cavalry
            },
            { 
                id: 'gen2', 
                name: 'Lyra', 
                level: 3, 
                avatar: 'assets/images/units/archer-sprite.png',
                specialty: 'Arqueros',
                stats: { leadership: 6, attack_tactic: 8, defense_tactic: 4 },
                buffs: { archer_attack_physical_perc: 0.25, army_range_flat: 0 } // +25% physical attack for archers
            }
        ];

        // NEW: Global combat strategies
        this.combatStrategies = [
            { id: 'defensive_stance', name: 'Posición Defensiva', icon: '🛡️', description: 'Prioriza la supervivencia de las tropas sobre el asalto.', effectText: '+15% de Defensa a todas las tropas', buffs: { army_defense_perc: 0.15 } },
            { id: 'aggressive_charge', name: 'Carga Agresiva', icon: '⚔️', description: 'Un asalto total que busca abrumar al enemigo rápidamente.', effectText: '+10% de Ataque a todas las tropas', buffs: { army_attack_physical_perc: 0.10 } },
            { id: 'guerilla_tactics', name: 'Tácticas de Guerrilla', icon: '🌲', description: 'Aumenta la velocidad y la resistencia de las unidades de infantería.', effectText: '+20% HP a la Infantería (Milicia)', buffs: { infantry_hp_perc: 0.20 } }
        ];
        this.activeStrategy = 'defensive_stance'; // Default strategy

        // NEW: Saved Army Compositions
        this.savedArmyCompositions = []; // Array of { id: string, name: string, composition: { milicia: N, archer: M, cavalry: K } }

        this.selectedTile = null;
        this.troops = new Map();
        
        // Game Loop timing
        this.lastUpdateTime = 0;
        this.timeAccumulator = 0;

        // Player's dragons
        this.playerDragons = [];
        
        // Initialize managers - Ensure correct order due to dependencies
        // LoadingManager needs to be initialized first to capture loading elements and handle logs
        const loadingScreenElements = {
            loadingScreen: document.getElementById('loadingScreen'),
            loadingPercentage: document.getElementById('loadingPercentage'),
            progressBar: document.getElementById('progressBar'),
            loadingStatus: document.getElementById('loadingStatus'),
            loadingLogs: document.getElementById('loadingLogs') 
        };
        this.loadingManager = new LoadingManager(this, loadingScreenElements);

        this.mapRenderer = new MapRenderer(this);
        this.resourceManager = new ResourceManager(this);
        
        // Initialize core game systems that other managers might depend on
        this.tradeSystem = new TradeSystem(this); // Initialize TradeSystem and its sub-managers (TradeStateManager, etc.)
        this.chatSystem = new ChatSystem(this);
        this.dragonManager = new DragonManager(this);
        this.profileManager = new ProfileManager(this);
        this.explorationManager = new ExplorationManager(this);
        this.troopManager = new TroopManager(this);
        this.diplomacyManager = new DiplomacyManager(this);
        this.newsManager = new NewsManager(this);
        this.battleManager = new BattleManager(this);
        this.welcomeManager = new WelcomeManager(this);
        this.scienceManager = new ScienceManager(this); // Pass 'this' (the game instance) to ScienceManager
        this.gameActions = new GameActions(this); // GameActions depends on various managers
        
        // UIManager relies on almost all other managers, so it should be initialized last
        this.uiManager = new UIManager(this);

        this.movingArmies = new Map();
        this.movingCaravans = new Map(); // NEW: For visual trade caravans
        this.exploringTiles = new Map();
        
        this.battleLog = []; // Initialize battle log
    }
    
    async init() {
        console.log("GameCore.js: ImperionGame init() called.");
        this.logLoadingStatus('Iniciando juego...', 'info');
        try {
            await this.loadingManager.loadAllAssets();
            this.logLoadingStatus('Todos los recursos cargados. Obteniendo información de usuario...', 'success');
            
            // Get current user info from Websim Comments API
            await this.profileManager.loadProfile();
            this.currentPlayerName = this.profileManager.playerProfile.username; // NEW: Set for ownership checks
            this.logLoadingStatus(`Bienvenido, ${this.profileManager.playerProfile.username}!`, 'info');
            this.newsManager.addNews(`¡Bienvenido, ${this.profileManager.playerProfile.username}! Tu reinado comienza.`, 'system');
            
            /* MPHOOK: Initialize multiplayer system */
            const { MultiplayerAdapter } = await import('../client/multiplayer/MultiplayerAdapter.js');
            this.multiplayer = new MultiplayerAdapter(this);
            this.logLoadingStatus('Sistema multiplayer inicializado.', 'success');
            
            // Wait for multiplayer adapter to join the room before generating the map
            await new Promise((resolve) => {
                if (this.multiplayer.currentRoom) {
                    resolve();
                } else {
                    this.multiplayer.on('roomJoined', () => {
                        resolve();
                    });
                }
            });
            
            // Request map data from server after joining the room
            if (this.multiplayer && this.multiplayer.isConnected) {
                this.multiplayer.requestMapData();
                // Wait a bit for the map data to be received
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Generate map after multiplayer adapter has joined the room
            this.mapRenderer.generateMap();
            
            // Setup multiplayer status indicator
            this.setupMultiplayerStatusIndicator();

            // Hide loading screen and show the game
            this.loadingManager.loadingScreen.style.display = 'none';
            const gameContainer = document.getElementById('gameContainer');
            if (gameContainer) {
                gameContainer.style.visibility = 'visible';
                gameContainer.style.opacity = '1';
                this.logLoadingStatus('Pantalla de carga oculta, juego visible.', 'success');
            }

            this.logLoadingStatus('Configurando el lienzo del mapa.', 'info');
            // Delegate to MapInteractionManager
            this.mapRenderer.mapInteractionManager.centerOnPlayerCity();
            this.logLoadingStatus('Centrando mapa en la ciudad del jugador.', 'info');
            // Call the modularized event listener setups
            this.logLoadingStatus('Configurando escuchadores de eventos de la UI...', 'info');
            this.setupEventListeners(); 
            this.logLoadingStatus('Configurando el slider de noticias...', 'info');
            this.newsManager.setupNewsSlider();
            this.logLoadingStatus('Inicializando vista de juego principal...', 'info');
            this.switchGameView(this.currentView);
            this.mapRenderer.render();
            this.newsManager.addNews("Imperio inicializado - ¡Comienza tu conquista!");
            this.logLoadingStatus('Inicializando sistema de comercio...', 'info');
            this.tradeSystem.init();
            this.logLoadingStatus('Configurando sistema de chat...', 'info');
            this.chatSystem.setupChatSystem(); // Ensure ChatSystem's setup is called to make it interactive.
            this.logLoadingStatus('Sistema de juego inicializado. Mostrando modal de bienvenida.', 'success');
            
            // Show welcome modal after all initialization
            this.welcomeManager.showWelcomeModal();
            this.logLoadingStatus('Iniciando bucle principal del juego.', 'info');
            
            // Start game loop
            requestAnimationFrame(this.gameLoop.bind(this));
        } catch (error) {
            console.error("GameCore.js: Error during game initialization:", error);
            this.logLoadingStatus(`Error crítico al iniciar el juego: ${error.message}`, 'error');
            // Keep loading screen visible if a critical error occurs
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'flex'; // Ensure it's visible
                loadingScreen.style.backgroundColor = 'rgba(100, 0, 0, 0.9)'; // Red background for error
            }
            // Potentially show an alert or a persistent error message on the loading screen
            if (this.loadingManager.loadingStatus) {
                this.loadingManager.loadingStatus.textContent = `¡ERROR CRÍTICO! ${error.message}. Consulta los logs de carga.`;
                this.loadingManager.loadingStatus.style.color = '#f44336';
            }
        }
    }
    
    // Helper function to append logs to the loading screen, now delegates to LoadingManager
    logLoadingStatus(message, type = 'info') {
        this.loadingManager.logLoadingStatus(message, type);
    }

    gameLoop(timestamp) {
        if (!this.lastUpdateTime) {
            this.lastUpdateTime = timestamp;
        }
        
        const rawDeltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;

        // Corrected calculation for delta time
        const deltaTime = rawDeltaTime;

        /* MPHOOK: Update multiplayer game state */
        if (this.multiplayer && this.multiplayer.isConnected) {
            this.multiplayer.startGameLoop();
        }

        // Update resources based on delta time
        this.resourceManager.updateResources(deltaTime);

        // Caravan expiration check
        const expiredCaravans = this.activeCaravans.filter(c => timestamp >= c.expires);
        if (expiredCaravans.length > 0) {
            this.activeCaravans = this.activeCaravans.filter(c => timestamp < c.expires);
            expiredCaravans.forEach(c => {
                this.newsManager.addNews(`La caravana '${c.name}' ha partido.`, 'comercio');
            });
            // If diplomacy view is open, update it
            if (this.currentView === 'diplomacy') {
                this.diplomacyManager.updateDiplomacyView();
            }
        }

        // Process exploration completion
        const completedExplorationsCoords = [];
        const currentTime = timestamp;

        // Collect all completed explorations in one pass
        for (const [key, exploreData] of [...this.exploringTiles.entries()]) { 
            if (currentTime - exploreData.startTime >= exploreData.duration) {
                completedExplorationsCoords.push({ x: exploreData.x, y: exploreData.y });
            }
        }
        
        // Now, process each completed exploration and remove it from the map
        let needsMapRender = false;
        for (const { x, y } of completedExplorationsCoords) {
            const tileKey = `${x},${y}`;
            if (this.exploringTiles.has(tileKey)) { 
                // Delegate to ExplorationManager
                this.explorationManager.resolveExploration(x, y); 
                this.exploringTiles.delete(tileKey);
                needsMapRender = true;
                
                // Update side panel if relevant tile was selected
                if (this.selectedTile && this.selectedTile.x === x && this.selectedTile.y === y) {
                    this.selectTile(this.selectedTile.x, this.selectedTile.y);
                }
            }
        }

        // Update moving armies and caravans
        for (const army of this.movingArmies.values()) {
            army.updatePosition();
            needsMapRender = true;
        }
        for (const caravan of this.movingCaravans.values()) {
            caravan.updatePosition();
            needsMapRender = true;
        }

        // Render map only if explorations were resolved OR if other conditions require rendering
        if (needsMapRender) {
            this.mapRenderer.render();
        }

        // Update UI displays periodically
        this.timeAccumulator += rawDeltaTime;
        if (this.timeAccumulator >= 1000) {
            this.resourceManager.updateResourceDisplay();
            // The news panel display is updated automatically when its view is active.
            this.timeAccumulator = 0; // Reset accumulator for next second
        }
        
        // Keep the loop going
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    setupEventListeners() {
        // Delegate map-related event listeners to MapInteractionManager
        this.mapRenderer.mapInteractionManager.setupEventListeners();
        // Delegate UI-related event listeners to UIManager
        this.uiManager.setupUIEventListeners();
    }

    // New method to switch between main game views
    switchGameView(newView) {
        // Deactivate all views
        this.mapViewDiv.classList.remove('active');
        this.cityViewDiv.classList.remove('active');
        this.diplomacyViewDiv.classList.remove('active');
        this.tradeViewDiv.classList.remove('active');
        this.dragonsViewDiv.classList.remove('active');
        this.newsPanelViewDiv.classList.remove('active');
        this.profileViewDiv.classList.remove('active');
        this.scienceViewDiv.classList.remove('active');
        this.armyViewDiv.classList.remove('active');

        // Set the new active view
        switch (newView) {
            case 'map':
                this.mapViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🏰 Ciudad';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Ver tu ciudad y edificios');
                this.mapRenderer.render();
                break;
            case 'city':
                this.cityViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                break;
            case 'diplomacy':
                this.diplomacyViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                this.diplomacyManager.updateDiplomacyView();
                break;
            case 'trade':
                this.tradeViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                this.uiManager.updateTradeView();
                break;
            case 'dragons':
                this.dragonsViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                this.uiManager.updateDragonsView();
                break;
            case 'newsPanel':
                this.newsPanelViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                this.newsManager.updateNewsPanelDisplay();
                break;
            case 'profile':
                this.profileViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                this.profileManager.updateProfileView();
                break;
            case 'science':
                this.scienceViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                this.uiManager.updateScienceView();
                break;
            case 'army':
                this.armyViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🗺️ Mundo';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Volver al mapa mundial');
                this.uiManager.updateArmyView();
                break;
            default:
                this.mapViewDiv.classList.add('active');
                document.getElementById('cityBtn').textContent = '🏰 Ciudad';
                document.getElementById('cityBtn').setAttribute('data-tooltip', 'Ver tu ciudad y edificios');
                this.mapRenderer.render();
                break;
        }
        this.currentView = newView;
        this.uiManager.setupTooltips();
    }

    startCaravanJourney(fromTile, toTile, items, onArrivalCallback, eventMessage = null) {
        // This method is now obsolete and its logic is handled directly in PrivateTradeLogic.
        // It's kept here to prevent errors if any old code calls it, but it does nothing.
        console.warn("GameCore.startCaravanJourney is deprecated. Logic has moved to PrivateTradeLogic.");
    }

    handleClick(e) {
        // If mapInteractionManager is dragging, then this click is part of a drag, so ignore.
        if (this.mapRenderer.mapInteractionManager.isDragging) return;

        // Only process map clicks if mapView is active
        if (this.currentView !== 'map') return;

        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const hit = this.mapRenderer.getTileAtScreenXY(clickX, clickY);

        if (hit) {
            console.log(`Clic detectado en el tile (${hit.x}, ${hit.y})`);
            this.selectTile(hit.x, hit.y);
        } else {
            console.log("El clic no alcanzó ningún tile.");
            this.selectedTile = null;
            this.mapRenderer.render();
        }
    }
    
    selectTile(x, y) {
        this.selectedTile = { x, y };
        const tile = this.mapRenderer.map[y][x];
        
        this.uiManager.updateSidePanel(tile, x, y);
        this.mapRenderer.render();
    }
    
    // NEW: Method to center the map view on a moving caravan
    centerOnCaravan(caravanId) {
        const caravan = this.movingCaravans.get(caravanId);
        if (!caravan) {
            this.newsManager.addNews("No se pudo encontrar la caravana.", "system");
            return;
        }

        // Switch to map view if not already there
        if (this.currentView !== 'map') {
            this.switchGameView('map');
        }

        const progress = caravan.getAnimationProgress();
        const currentX = caravan.from.x + (caravan.to.x - caravan.from.x) * progress;
        const currentY = caravan.from.y + (caravan.to.y - caravan.from.y) * progress;
        
        // Use a temporary city-like object for the centering logic
        const tempTarget = { x: Math.round(currentX), y: Math.round(currentY) };
        const originalPlayerCity = { ...this.playerCity }; // Backup original city
        this.playerCity = tempTarget; // Temporarily set player city to caravan location for centering
        this.mapRenderer.mapInteractionManager.centerOnPlayerCity();
        this.playerCity = originalPlayerCity; // Restore original city
        
        this.mapRenderer.render(); // Re-render to show the centered map
    }
    
    getNpcById(entityId) {
        if (entityId && entityId.startsWith('caravan_')) {
            return this.activeCaravans.find(c => c.id === entityId);
        }
        return this.npcEmpires.find(npc => npc.id === entityId);
    }


    // NEW: Method to set active strategy
    setActiveStrategy(strategyId) {
        const strategyExists = this.combatStrategies.some(s => s.id === strategyId);
        if (strategyExists) {
            this.activeStrategy = strategyId;
            this.newsManager.addNews(`Estrategia global cambiada a: ${this.combatStrategies.find(s => s.id === strategyId).name}`, 'system');
            this.uiManager.notificationManager.showNotification('info', 'Estrategia de combate actualizada.');
            if (this.currentView === 'army') {
                this.uiManager.updateArmyView(); // Re-render to show active state
            }
        }
    }

    // NEW: Methods for managing saved army compositions
    saveArmyCompositionFromModal() {
        const nameInput = document.getElementById('formation-name');
        const miliciaCount = parseInt(document.getElementById('save-milicia-count').value) || 0;
        const archerCount = parseInt(document.getElementById('save-archer-count').value) || 0;
        const cavalryCount = parseInt(document.getElementById('save-cavalry-count').value) || 0;

        const name = nameInput.value.trim();
        if (!name) {
            this.uiManager.notificationManager.showNotification('error', 'Por favor, introduce un nombre para la formación.');
            return;
        }
        if (miliciaCount + archerCount + cavalryCount <= 0) {
            this.uiManager.notificationManager.showNotification('error', 'La formación debe contener al menos una tropa.');
            return;
        }

        const newComposition = {
            id: `formation_${Date.now()}`,
            name: name,
            composition: {
                milicia: miliciaCount,
                archer: archerCount,
                cavalry: cavalryCount
            }
        };

        this.savedArmyCompositions.push(newComposition);
        this.uiManager.notificationManager.showNotification('success', `Formación '${name}' guardada.`);
        this.uiManager.closeModal();
        this.uiManager.updateArmyView(); // Re-render army view to show new formation
    }

    recruitSavedComposition(compositionId) {
        const formation = this.savedArmyCompositions.find(f => f.id === compositionId);
        if (!formation) {
            this.uiManager.notificationManager.showNotification('error', 'Formación no encontrada.');
            return;
        }

        // Calculate total cost for the formation
        let totalCost = { food: 0, wood: 0, stone: 0, metal: 0 };
        let canAffordAll = true;
        let missingResources = {};

        for (const type in formation.composition) {
            const count = formation.composition[type];
            if (count > 0) {
                const costs = this.troopManager.troopCosts[type];
                if (costs) {
                    for (const res in costs) {
                        totalCost[res] = (totalCost[res] || 0) + costs[res] * count;
                    }
                }
            }
        }

        // Check affordability before recruiting any troops
        for (const res in totalCost) {
            if (this.resourceManager.resources[res] < totalCost[res]) {
                canAffordAll = false;
                missingResources[res] = totalCost[res] - this.resourceManager.resources[res];
            }
        }

        if (!canAffordAll) {
            let missingMsg = 'Recursos insuficientes: ';
            missingMsg += Object.entries(missingResources)
                .filter(([, amount]) => amount > 0)
                .map(([res, amount]) => `${amount} ${this.resourceManager.getResourceDisplayName(res)}`)
                .join(', ');
            this.uiManager.notificationManager.showNotification('error', missingMsg);
            this.newsManager.addNews(`No se pudo reclutar '${formation.name}': ${missingMsg}`, 'ejército');
            return;
        }

        // Deduct resources
        this.resourceManager.spendResources(totalCost);

        // Add troops to player city
        const cityTile = this.mapRenderer.map[this.playerCity.y][this.playerCity.x];
        for (const type in formation.composition) {
            const count = formation.composition[type];
            if (count > 0) {
                cityTile.troops[type] = (cityTile.troops[type] || 0) + count;
            }
        }

        this.uiManager.notificationManager.showNotification('success', `Formación '${formation.name}' reclutada.`);
        this.newsManager.addNews(`Formación '${formation.name}' reclutada: ${Object.entries(formation.composition).filter(([,c])=>c>0).map(([t,c])=>`${c} ${this.troopManager.troopStats[t].name}`).join(', ')}.`, 'ejército');
        this.uiManager.updateArmyView(); // Re-render army view to show updated troop counts
        this.mapRenderer.render(); // Re-render map if troops are visualized
    }

    deleteSavedComposition(compositionId) {
        const index = this.savedArmyCompositions.findIndex(f => f.id === compositionId);
        if (index > -1) {
            const deletedFormation = this.savedArmyCompositions.splice(index, 1);
            this.uiManager.notificationManager.showNotification('info', `Formación '${deletedFormation[0].name}' eliminada.`);
            this.uiManager.updateArmyView(); // Re-render army view
        }
    }
    
    // Setup multiplayer status indicator
    setupMultiplayerStatusIndicator() {
        if (!this.multiplayer) return;
        
        const statusIndicator = document.getElementById('statusIndicator');
        const playerIdDisplay = document.getElementById('playerIdDisplay');
        const roomInfo = document.getElementById('roomInfo');
        
        if (!statusIndicator) {
            console.warn('Multiplayer status indicator not found in DOM');
            return;
        }
        
        // Update status based on multiplayer events
        this.multiplayer.on('connected', () => {
            statusIndicator.className = 'status-indicator connected';
            statusIndicator.querySelector('.status-icon').textContent = '🔗';
            statusIndicator.querySelector('.status-text').textContent = 'Conectado';
            
            if (playerIdDisplay && this.multiplayer.playerId) {
                playerIdDisplay.textContent = `ID: ${this.multiplayer.playerId.substr(0, 8)}...`;
            }
            if (roomInfo && this.multiplayer.currentRoom) {
                roomInfo.textContent = `Sala: ${this.multiplayer.currentRoom}`;
            }
        });
        
        this.multiplayer.on('disconnected', () => {
            statusIndicator.className = 'status-indicator disconnected';
            statusIndicator.querySelector('.status-icon').textContent = '🔌';
            statusIndicator.querySelector('.status-text').textContent = 'Desconectado';
            
            if (playerIdDisplay) {
                playerIdDisplay.textContent = '';
            }
            if (roomInfo) {
                roomInfo.textContent = '';
            }
        });
        
        this.multiplayer.on('connecting', () => {
            statusIndicator.className = 'status-indicator connecting';
            statusIndicator.querySelector('.status-icon').textContent = '⏳';
            statusIndicator.querySelector('.status-text').textContent = 'Conectando...';
        });
        
        this.multiplayer.on('roomJoined', (data) => {
            if (data.success) {
                if (playerIdDisplay && this.multiplayer.playerId) {
                    playerIdDisplay.textContent = `ID: ${this.multiplayer.playerId.substr(0, 8)}...`;
                }
                if (roomInfo && this.multiplayer.currentRoom) {
                    roomInfo.textContent = `Sala: ${this.multiplayer.currentRoom}`;
                }
            }
        });
        
        // Set initial state
        statusIndicator.className = 'status-indicator connecting';
        statusIndicator.querySelector('.status-icon').textContent = '⏳';
        statusIndicator.querySelector('.status-text').textContent = 'Conectando...';
    }
}