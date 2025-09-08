export class ExplorationManager {
    constructor(game) {
        this.game = game;
        this.explorationCosts = { food: 50, imperion: 1 }; // Define exploration costs
        this.explorationDuration = 10000; // 10 seconds in milliseconds
    }

    // Moved from GameCore.js
    resolveExploration(x, y) {
        const tile = this.game.mapRenderer.map[y][x];
        const outcomes = [
            'recursos',   // 30%
            'enemigos',   // 25%
            'caravan',    // 15%
            'tesoro',     // 15%
            'dragón',     // 5%
            'nada'        // 10%
        ];
        
        const randomChance = Math.random();
        let outcome;
        if (randomChance < 0.30) { outcome = 'recursos'; }
        else if (randomChance < 0.55) { outcome = 'enemigos'; }
        else if (randomChance < 0.70) { outcome = 'caravan'; }
        else if (randomChance < 0.85) { outcome = 'tesoro'; }
        else if (randomChance < 0.90) { outcome = 'dragón'; }
        else { outcome = 'nada'; }
        
        switch(outcome) {
            case 'recursos':
                const resourceTypes = ['food', 'wood', 'stone', 'metal']; // Removed imperion from common finds
                const resource = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
                const amount = Math.floor(Math.random() * 500) + 100;
                this.game.resourceManager.resources[resource] += amount;
                this.game.resourceManager.updateResourceDisplay();
                // Use UIManager's getItemDisplayName (which now delegates to TradeDisplayHelper)
                this.game.newsManager.addNews(`¡Exploración exitosa! Descubriste ${amount} unidades de ${this.game.uiManager.getItemDisplayName(resource)} en (${x},${y})`, 'imperion');
                break;
                
            case 'enemigos':
                // Verificar si hay NPCs disponibles
                if (!this.game.npcEmpires || this.game.npcEmpires.length === 0) {
                    console.log('⚠️ No hay NPCs disponibles para asignar como enemigos');
                    return;
                }
                const randomNpc = this.game.npcEmpires[Math.floor(Math.random() * this.game.npcEmpires.length)];
                tile.owner = randomNpc.id; // Assign actual NPC as owner
                // NEW: Assign troops as an object, not a number
                tile.troops = { milicia: Math.floor(Math.random() * 20) + 10, archer: Math.floor(Math.random() * 10), cavalry: Math.floor(Math.random() * 5) }; // More varied troops
                this.game.newsManager.addNews(`¡Peligro! Has descubierto un campamento de ${randomNpc.name} en (${x},${y})`, 'combate');
                break;
                
            case 'dragón':
                this.game.dragonManager.revealBabyDragon();
                this.game.newsManager.addNews(`¡Has descubierto un dragón salvaje en (${x},${y})! Se ha unido a tu guarida.`, 'dragón');
                break;
                
            case 'tesoro':
                const specialItems = ['artifact', 'map_intel'];
                const grantedItem = specialItems[Math.floor(Math.random() * specialItems.length)];
                const currentAmount = this.game.playerSpecialItems.get(grantedItem) || 0;
                this.game.playerSpecialItems.set(grantedItem, currentAmount + 1);
                this.game.newsManager.addNews(`¡Tesoro descubierto! Has encontrado un ${this.game.uiManager.getItemDisplayName(grantedItem)}.`, 'imperion');
                break;

            case 'caravan':
                const caravanId = `caravan_${Date.now()}`;
                const caravanName = "Caravana del Desierto Dorado"; // Example name
                const caravan = {
                    id: caravanId,
                    name: caravanName,
                    isCaravan: true, // Flag to distinguish from NPCs
                    color: '#f9a825', // Gold color
                    initialRelation: 'neutral', // Caravans are neutral
                    expires: performance.now() + 5 * 60 * 1000, // Expires in 5 minutes
                    inventory: {
                        // Good deals on common resources
                        food: 5000,
                        wood: 5000,
                        // Unique items
                        mercenary_contract: 1,
                        ancient_blueprint: 1,
                    }
                };
                this.game.activeCaravans.push(caravan);
                this.game.newsManager.addNews(`¡Has descubierto la '${caravanName}' en (${x},${y})! Estará disponible para comerciar por un tiempo limitado.`, 'comercio');
                this.game.uiManager.notificationManager.showNotification(
                    'info',
                    `¡Has descubierto la '${caravanName}'!`,
                    10000,
                    { type: 'open_private_trade', npcId: caravanId },
                    true // Make it persistent until clicked or caravan expires
                );
                // if diplomacy view is open, update it
                if (this.game.currentView === 'diplomacy') {
                    this.game.diplomacyManager.updateDiplomacyView();
                }
                break;
                
            default:
                this.game.newsManager.addNews(`La exploración en (${x},${y}) no ha revelado nada interesante.`, 'exploración');
                break;
        }
        
        // Update UI if selected tile is currently displayed
        if(this.game.selectedTile && this.game.selectedTile.x === x && this.game.selectedTile.y === y) {
            this.game.selectTile(x, y);
        }
        
        this.game.mapRenderer.render();
    }

    // NEW: Moved from GameActions.js - opens the exploration modal
    openExplorationModal(x, y) {
        const tile = this.game.mapRenderer.map[y][x];
        const costs = this.explorationCosts;
        const durationSeconds = this.explorationDuration / 1000;

        // Check if already exploring
        if (this.game.exploringTiles.has(`${x},${y}`)) {
            this.game.newsManager.addNews(`El tile (${x}, ${y}) ya está siendo explorado.`);
            this.game.uiManager.notificationManager.showNotification('info', `El tile (${x}, ${y}) ya está siendo explorado.`);
            return;
        }

        this.game.uiManager.showModal('Planificar Exploración', `
            <div class="exploration-planning">
                <h3>🔍 Explorar Tile (${x}, ${y})</h3>
                <div class="info-section" style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <h4>📜 Detalles de la Expedición</h4>
                    <p><strong>Costo:</strong> ${costs.food} Comida, ${costs.imperion} Imperion</p>
                    <p><strong>Duración:</strong> ${durationSeconds} segundos</p>
                    <p><strong>Posibles Descubrimientos:</strong> Recursos, Puestos enemigos, o nada especial.</p>
                </div>
                
                <div class="cost-summary" style="margin-top: 20px; padding: 15px; background: rgba(139,105,20,0.3); border-radius: 8px;">
                    <h4>💰 Tus Recursos</h4>
                    <p>🌾 Comida: ${Math.floor(this.game.resourceManager.resources.food).toLocaleString()} / ${costs.food}</p>
                    <p>👑 Imperion: ${Math.floor(this.game.resourceManager.resources.imperion).toLocaleString()} / ${costs.imperion}</p>
                </div>

                <div class="action-buttons" style="margin-top: 20px;">
                    <button class="medieval-btn" onclick="game.explorationManager.startExploration(${x}, ${y})" style="width: 100%;">🚀 Iniciar Exploración</button>
                </div>
            </div>
        `);
    }

    // NEW: Moved from GameActions.js - handles initiating the exploration process
    startExploration(x, y) {
        if (!this.game.resourceManager.canAfford(this.explorationCosts)) {
            this.game.newsManager.addNews("Recursos insuficientes para iniciar la exploración.");
            this.game.uiManager.notificationManager.showNotification('error', '¡Recursos insuficientes para exploración!');
            this.game.uiManager.closeModal();
            return;
        }

        const tileKey = `${x},${y}`;
        if (this.game.exploringTiles.has(tileKey)) {
            this.game.newsManager.addNews(`El tile (${x}, ${y}) ya está siendo explorado.`);
            this.game.uiManager.notificationManager.showNotification('info', `El tile (${x}, ${y}) ya está siendo explorado.`);
            this.game.uiManager.closeModal();
            return;
        }

        this.game.resourceManager.spendResources(this.explorationCosts);
        this.game.exploringTiles.set(tileKey, {
            x, y,
            startTime: performance.now(),
            duration: this.explorationDuration
        });
        
        this.game.newsManager.addNews(`Exploración iniciada en (${x}, ${y}). La expedición tomará ${this.explorationDuration / 1000} segundos.`);
        this.game.uiManager.notificationManager.showNotification('info', `Exploración iniciada en (${x}, ${y}).`);
        this.game.uiManager.closeModal();
        this.game.mapRenderer.render(); // To show the exploration marker immediately
        
        // Update side panel if it's the selected tile
        if (this.game.selectedTile && this.game.selectedTile.x === x && this.game.selectedTile.y === y) {
            this.game.selectTile(x, y);
        }
    }
}