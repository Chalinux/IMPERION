export class ResourceManager {
    constructor(game) {
        this.game = game;
        this.resources = {
            food: 1000,
            wood: 800,
            stone: 600,
            metal: 400,
            imperion: 200,
            "food_rate": 50,
            "wood_rate": 30,
            "stone_rate": 25,
            "metal_rate": 15,
            "imperion_rate": 5
        };
    }
    
    setupResourceUpdates() {
        // This is now handled by the main game loop
    }
    
    updateResources(deltaTime) { // deltaTime is in milliseconds
        let production = { food: 0, wood: 0, stone: 0, metal: 0, imperion: 0 };
        
        for (let y = 0; y < this.game.mapRenderer.mapSize; y++) {
            for (let x = 0; x < this.game.mapRenderer.mapSize; x++) {
                const tile = this.game.mapRenderer.map[y][x];
                if (tile.owner === 'player') {
                    for (const [resource, amount] of Object.entries(tile.resources)) {
                        production[resource] = (production[resource] || 0) + amount;
                    }
                }
            }
        }

        // Add empire buffs from dragons
        if (this.game.playerDragons && this.game.playerDragons.length > 0) {
            this.game.playerDragons.forEach(dragon => {
                if (dragon.empireBuffs) {
                    for (const [buffResource, buffAmount] of Object.entries(dragon.empireBuffs)) {
                        production[buffResource] = (production[buffResource] || 0) + buffAmount;
                    }
                }
            });
        }
        
        const deltaSeconds = deltaTime / 1000;

        for (const [resource, amount] of Object.entries(this.resources)) {
            if (!resource.endsWith('_rate')) {
                 this.resources[resource] += (production[resource] / 3600) * deltaSeconds;
            }
        }

        this.resources.food_rate = production.food;
        this.resources.wood_rate = production.wood;
        this.resources.stone_rate = production.stone;
        this.resources.metal_rate = production.metal;
        this.resources.imperion_rate = production.imperion;
    }
    
    updateResourceDisplay() {
        for (const [resource, amount] of Object.entries(this.resources)) {
            if (!resource.endsWith('_rate')) {
                const element = document.getElementById(resource);
                const detailElement = document.getElementById('detail' + resource.charAt(0).toUpperCase() + resource.slice(1));
                
                if (element) {
                    element.textContent = Math.floor(amount).toLocaleString();
                    const rateElement = element.nextElementSibling;
                    if (rateElement && rateElement.classList.contains('resource-rate')) {
                        // Calculate total production including dragon buffs for display
                        let currentProduction = 0;
                        for (let y = 0; y < this.game.mapRenderer.mapSize; y++) {
                            for (let x = 0; x < this.game.mapRenderer.mapSize; x++) {
                                const tile = this.game.mapRenderer.map[y][x];
                                if (tile.owner === 'player' && tile.resources[resource]) {
                                    currentProduction += tile.resources[resource];
                                }
                            }
                        }
                        // Add dragon buffs to the displayed rate
                        if (this.game.playerDragons && this.game.playerDragons.length > 0) {
                            this.game.playerDragons.forEach(dragon => {
                                if (dragon.empireBuffs && dragon.empireBuffs[`${resource}_rate`]) { // Check for rate buff directly
                                    currentProduction += dragon.empireBuffs[`${resource}_rate`];
                                }
                            });
                        }
                        rateElement.textContent = `+${currentProduction || 0}/h`;
                    }
                }
                
                if (detailElement) {
                    detailElement.textContent = Math.floor(amount).toLocaleString();
                }
            }
        }
    }
    
    canAfford(costs) {
        for (const [resource, amount] of Object.entries(costs)) {
            if (this.resources[resource] < amount) {
                return false;
            }
        }
        return true;
    }
    
    spendResources(costs) {
        if (this.canAfford(costs)) {
            for (const [resource, amount] of Object.entries(costs)) {
                this.resources[resource] -= amount;
            }
            this.updateResourceDisplay();
            return true;
        }
        return false;
    }

    // NEW: Helper function to get resource display name, moved from UIManager
    getResourceDisplayName(resourceKey) {
        const names = {
            food: 'Comida',
            wood: 'Madera',
            stone: 'Piedra',
            metal: 'Metal',
            imperion: 'Imperion'
        };
        return names[resourceKey] || resourceKey;
    }
}