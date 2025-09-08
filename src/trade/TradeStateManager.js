// ...existing imports...

export class TradeStateManager {
    constructor(game) {
        this.game = game;
        
        // Define trade items and technologies here (moved from TradeSystem.js)
        this.tradeItemTypes = {
            resources: {
                food: { value: 0.1, icon: '🌾', category: 'Recursos', image_path: 'assets/images/ui/food-icon.png' },
                wood: { value: 0.15, icon: '🪵', category: 'Recursos', image_path: 'assets/images/ui/wood-icon.png' },
                stone: { value: 0.2, icon: '🪨', category: 'Recursos', image_path: 'assets/images/ui/stone-icon.png' },
                metal: { value: 0.3, icon: '⚔️', category: 'Recursos', image_path: 'assets/images/ui/metal-icon.png' },
                imperion: { value: 1, icon: '👑', category: 'Recursos', image_path: 'assets/images/ui/imperion-icon.png' }
            },
            troops: {
                milicia: { value: 8, icon: '🗡️', category: 'Tropas', image_path: 'assets/images/units/milicia1.png' },
                archer: { value: 12, icon: '🏹', category: 'Tropas', image_path: 'assets/images/units/archer-sprite.png' },
                cavalry: { value: 25, icon: '🐎', category: 'Tropas', image_path: 'assets/images/units/cavalry-sprite.png' }
            },
            territories: {
                llanura: { value: 50, icon: '🌾', category: 'Territorios', image_path: 'assets/images/terrain/llanura1.png' },
                montana: { value: 75, icon: '⛰️', category: 'Territorios', image_path: 'assets/images/terrain/montana1.png' },
                nieve: { value: 40, icon: '❄️', category: 'Territorios', image_path: 'assets/images/terrain/nieve1.png' },
                ciudad: { value: 200, icon: '🏰', category: 'Territorios', image_path: 'assets/images/terrain/tiledeciudad.png' },
                desierto: { value: 30, icon: '🏜️', category: 'Territorios', image_path: 'assets/images/terrain/desierto1.png' },
                bosque: { value: 60, icon: '🌳', category: 'Territorios', image_path: 'assets/images/terrain/bosque1.png' },
                pantano: { value: 45, icon: '🌿', category: 'Territorios', image_path: 'assets/images/terrain/pantano1.png' },
                ruinas: { value: 80, icon: '🏛️', category: 'Territorios', image_path: 'assets/images/terrain/ruinas1.png' },
                cristales: { value: 150, icon: '💎', category: 'Territorios', image_path: 'assets/images/terrain/cristalesazules1.png' },
                agua: { value: 0, icon: '💧', category: 'Territorios', image_path: 'assets/images/terrain/agua1.png' }
            },
            technology: {
                // NEW: Unifying technology definitions here as the single source of truth.
                // Military Quadrant
                'improved_militia': { value: 100, icon: "⚔️", category: "Tecnología", name: "Milicia Mejorada", requires: [], pos: { x: '20%', y: '25%' }, quadrant: 'military' },
                'basic_archery':    { value: 150, icon: "🏹", category: "Tecnología", name: "Arquería Básica", requires: ['improved_militia'], pos: { x: '50%', y: '50%' }, quadrant: 'military' },
                'cavalry_tactics':  { value: 250, icon: "🐎", category: "Tecnología", name: "Tácticas de Caballería", requires: ['basic_archery'], pos: { x: '80%', y: '75%' }, quadrant: 'military' },
                // Economy Quadrant
                'basic_farming':    { value: 50,  icon: "🌾", category: "Tecnología", name: "Agricultura Básica", requires: [], pos: { x: '20%', y: '50%' }, quadrant: 'economy' },
                'wood_milling':     { value: 120, icon: "🪵", category: "Tecnología", name: "Aserradero", requires: ['basic_farming'], pos: { x: '50%', y: '30%' }, quadrant: 'economy' },
                'stone_quarrying':  { value: 120, icon: "🪨", category: "Tecnología", name: "Cantería", requires: ['basic_farming'], pos: { x: '50%', y: '70%' }, quadrant: 'economy' },
                'currency':         { value: 300, icon: "💰", category: "Tecnología", name: "Moneda", requires: ['wood_milling', 'stone_quarrying'], pos: { x: '80%', y: '50%' }, quadrant: 'economy' },
                // Science Quadrant
                'writing':            { value: 80,  icon: "📜", category: "Tecnología", name: "Escritura", requires: [], pos: { x: '20%', y: '50%' }, quadrant: 'science' },
                'exploration_tools':  { value: 180, icon: "🧭", category: "Tecnología", name: "Herramientas de Exploración", requires: ['writing'], pos: { x: '60%', y: '50%' }, quadrant: 'science' },
                // Empire Quadrant
                'city_planning':      { value: 100, icon: "🏛️", category: "Tecnología", name: "Planificación Urbana", requires: [], pos: { x: '20%', y: '50%' }, quadrant: 'empire' },
                'diplomacy':          { value: 200, icon: "🤝", category: "Tecnología", name: "Diplomacia", requires: ['city_planning'], pos: { x: '60%', y: '50%' }, quadrant: 'empire' }
            },
            special: {
                dragon_egg: { value: 500, icon: '🥚', category: 'Especiales', image_path: 'assets/images/dragons/huevodedragoncomun.png' },
                artifact: { value: 300, icon: '✨', category: 'Especiales' },
                map_intel: { value: 75, icon: '🗺️', category: 'Especiales' },
                mercenary_contract: { value: 250, icon: '📜', category: 'Especiales' },
                ancient_blueprint: { value: 400, icon: '📐', category: 'Especiales' },
                resource_deed: { value: 1000, icon: '📄', category: 'Especiales' }
            },
            dragons: { // Added explicit category for existing player dragons
                // Specific dragon IDs will be dynamically added here.
            }
        };
        
        this.playerTechnologies = new Set(); // Player's available technologies (moved from TradeSystem.js)
        this.npcTechnologies = new Map(); // Map of npcId -> Set of technologies (moved from TradeSystem.js)
        
        this.initializeNpcTechnologies(); // Initialize NPC techs
    }
    
    initializeNpcTechnologies() {
        const allTechs = Object.keys(this.tradeItemTypes.technology);
        // Verificar si hay NPCs disponibles
        if (!this.game.npcEmpires || this.game.npcEmpires.length === 0) {
            console.log('⚠️ No hay NPCs disponibles para inicializar tecnologías');
            return;
        }
        for (const npc of this.game.npcEmpires) {
            const npcTechs = new Set();
            const numTechs = Math.floor(Math.random() * 3) + 1; // 1-3 technologies
            for (let i = 0; i < numTechs; i++) {
                const randomTech = allTechs[Math.floor(Math.random() * allTechs.length)];
                npcTechs.add(randomTech);
            }
            this.npcTechnologies.set(npc.id, npcTechs);
        }
    }

    // Moved from TradeSystem.js
    calculateTotalValue(category, item, amount) {
        const itemData = this.tradeItemTypes[category]?.[item];
        if (itemData) {
            return itemData.value * amount;
        }
        // Special case for player's unique dragons
        if (category === 'dragons') {
            const dragon = this.game.playerDragons.find(d => d.id === item);
            if (dragon) {
                return (dragon.attack * 5 + dragon.defense * 3 + dragon.hp * 0.5 + dragon.level * 10) * amount;
            }
        }
        return 0;
    }

    // Moved from TradeSystem.js
    validatePlayerCanOffer(category, item, amount, checkOnlyExistence = false) {
        if (!item) return false; // No item selected

        const checkAmount = checkOnlyExistence ? 1 : amount;
        switch (category) {
            case 'resources':
                return this.game.resourceManager.resources[item] >= checkAmount;
            case 'troops':
                const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
                // Check specific troop type if it exists in the troops object, otherwise this check is invalid for the old number-based system
                if (typeof cityTile.troops === 'object' && cityTile.troops[item] !== undefined) {
                    return cityTile.troops[item] >= checkAmount;
                }
                return false; // Cannot offer troops if structure is not {milicia: X, ...}
            case 'territories':
                return this.getPlayerTerritoryCount(item) >= checkAmount;
            case 'technology':
                return this.playerTechnologies.has(item);
            case 'special':
                // NEW: Check against player's special item inventory
                return (this.game.playerSpecialItems.get(item) || 0) >= checkAmount;
            case 'dragons':
                return this.game.playerDragons.some(dragon => dragon.id === item && checkAmount === 1); 
            default:
                return true; 
        }
    }

    // Moved from PrivateTradeManager.js
    getMaxAmountForListedItem(traderType, category, item, npcId = null) {
        let maxAmount = 0;
        if (traderType === 'player') {
            switch (category) {
                case 'resources':
                    maxAmount = Math.floor(this.game.resourceManager.resources[item]);
                    break;
                case 'troops':
                    const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
                    if (typeof cityTile.troops === 'object') {
                        maxAmount = cityTile.troops[item] || 0;
                    } else {
                        maxAmount = 0; // Invalid troop structure
                    }
                    break;
                case 'territories':
                    maxAmount = this.getPlayerTerritoryCount(item);
                    break;
                case 'technology':
                    maxAmount = this.playerTechnologies.has(item) ? 1 : 0;
                    break;
                case 'special':
                    // NEW: Check against player's special item inventory
                    maxAmount = this.game.playerSpecialItems.get(item) || 0;
                    break;
                case 'dragons':
                    maxAmount = this.game.playerDragons.some(d => d.id === item) ? 1 : 0;
                    break;
            }
        } else {
            const npc = this.game.getNpcById(npcId);
            if (!npc) return 0;
            switch (category) {
                case 'resources':
                    maxAmount = Math.floor(npc.inventory[item] || 0);
                    break;
                case 'troops':
                    // Assume NPCs have troops of a certain type to trade. A more complex check could go here.
                    maxAmount = npc.inventory?.[item] || 500; // Placeholder for NPC troop inventory
                    break;
                case 'territories':
                    maxAmount = this.getNpcTerritoryCount(npc.id, item);
                    break;
                case 'technology':
                case 'special':
                    maxAmount = this.npcTechnologies.get(npc.id)?.has(item) ? 1 : 0;
                    if (item === 'dragon_egg' || item === 'mercenary_contract' || item === 'ancient_blueprint') { // Caravans can have special items
                         maxAmount = npc.inventory?.[item] || 0;
                    }
                    break;
                case 'dragons':
                    maxAmount = 0; // NPCs do not offer specific player dragons
                    break;
            }
        }
        return maxAmount;
    }

    // Moved from TradeSystem.js
    getPlayerTerritoryCount(terrainType) {
        let count = 0;
        for (let y = 0; y < this.game.mapRenderer.mapSize; y++) {
            for (let x = 0; x < this.game.mapRenderer.mapSize; x++) {
                const tile = this.game.mapRenderer.map[y][x];
                if (tile.owner === 'player' && tile.type === terrainType) {
                    count++;
                }
            }
        }
        return count;
    }

    // Moved from TradeSystem.js
    deductPlayerItems(category, item, amount) {
        switch (category) {
            case 'resources':
                this.game.resourceManager.resources[item] -= amount;
                this.game.resourceManager.updateResourceDisplay();
                break;
            case 'troops':
                const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
                if(typeof cityTile.troops === 'object' && cityTile.troops[item] !== undefined) {
                    cityTile.troops[item] -= amount;
                }
                break;
            case 'territories':
                let removed = 0;
                for (let y = 0; y < this.game.mapRenderer.mapSize && removed < amount; y++) {
                    for (let x = 0; x < this.game.mapRenderer.mapSize && removed < amount; x++) {
                        const tile = this.game.mapRenderer.map[y][x];
                        if (tile.owner === 'player' && tile.type === item) {
                            tile.owner = null; 
                            tile.troops = { milicia: 0, archer: 0, cavalry: 0 }; // Set troops to empty object
                            removed++;
                            this.game.mapRenderer.render(); 
                        }
                    }
                }
                break;
            case 'technology':
                this.playerTechnologies.delete(item);
                break;
            case 'special':
                 // NEW: Deduct from player's special item inventory
                 const currentSpecialAmount = this.game.playerSpecialItems.get(item) || 0;
                 if (currentSpecialAmount >= amount) {
                     this.game.playerSpecialItems.set(item, currentSpecialAmount - amount);
                 }
                break;
            case 'dragons':
                this.game.playerDragons = this.game.playerDragons.filter(dragon => dragon.id !== item);
                this.game.uiManager.updateDragonsView();
                this.game.resourceManager.updateResourceDisplay();
                break;
        }
    }

    // Moved from TradeSystem.js
    givePlayerItems(category, item, amount) {
        switch (category) {
            case 'resources':
                this.game.resourceManager.resources[item] += amount;
                this.game.resourceManager.updateResourceDisplay();
                break;
            case 'troops':
                const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
                if(typeof cityTile.troops === 'object' && cityTile.troops[item] !== undefined) {
                    cityTile.troops[item] += amount;
                }
                break;
            case 'territories':
                let granted = 0;
                for (let y = 0; y < this.game.mapRenderer.mapSize && granted < amount; y++) {
                    for (let x = 0; x < this.game.mapRenderer.mapSize && granted < amount; x++) {
                        const tile = this.game.mapRenderer.map[y][x];
                        if (!tile.owner && tile.type === item) {
                            tile.owner = 'player';
                            granted++;
                            this.game.mapRenderer.render(); 
                        }
                    }
                }
                break;
            case 'technology':
                this.playerTechnologies.add(item);
                break;
            case 'special':
                // NEW: Add to player's special item inventory
                const currentAmount = this.game.playerSpecialItems.get(item) || 0;
                this.game.playerSpecialItems.set(item, currentAmount + amount);
                break;
            case 'dragons':
                const newDragon = { 
                    id: `dragon_${Date.now()}`,
                    name: this.game.tradeSystem.tradeDisplayHelper.getItemDisplayName(item) || 'Nuevo Dragón', // Use TradeDisplayHelper
                    rarity: 'Común',
                    element: 'Fuego', 
                    level: 1,
                    xp: 0,
                    max_xp: 100,
                    hp: 100,
                    max_hp: 100,
                    attack: 10,
                    defense: 5,
                    ability: { name: 'Aliento Básico', description: 'Un ataque de aliento débil.' },
                    empireBuffs: { food_rate: 2, wood_rate: 2 },
                    image: 'assets/images/dragons/commonbabydragon1.png'
                };
                this.game.playerDragons.push(newDragon);
                this.game.uiManager.updateDragonsView(); 
                this.game.resourceManager.updateResourceDisplay();
                break;
        }
    }

    // ... Existing methods in TradeStateManager ...
    
    generateTradeItemForValue(targetValue, offererType, relevantNpcId) {
        const itemCategories = Object.keys(this.tradeItemTypes);
        
        for (let i = 0; i < 50; i++) {
            const randomCategory = itemCategories[Math.floor(Math.random() * itemCategories.length)];
            const itemsInCat = Object.keys(this.tradeItemTypes[randomCategory] ?? {});
            
            if (itemsInCat.length === 0) continue; 

            let randomItem = itemsInCat[Math.floor(Math.random() * itemsInCat.length)];
            const itemData = this.tradeItemTypes[randomCategory]?.[randomItem];
            if (!itemData && randomCategory !== 'dragons') continue;
            if (itemData && itemData.value <= 0) continue;

            let recommendedAmount;
            if (itemData) {
                const tolerance = 0.15;
                const minAmountForValue = Math.max(1, Math.floor(targetValue / itemData.value * (1 - tolerance)));
                const maxAmountForValue = Math.max(1, Math.ceil(targetValue / itemData.value * (1 + tolerance)));
                recommendedAmount = Math.floor(Math.random() * (maxAmountForValue - minAmountForValue + 1)) + minAmountForValue;
                recommendedAmount = Math.max(1, recommendedAmount);
            } else {
                recommendedAmount = 1;
            }

            if (randomCategory === 'territories') {
                recommendedAmount = 1;
                if (offererType === 'npc') {
                    if (this.getNpcTerritoryCount(relevantNpcId, randomItem) < 1) continue;
                } else {
                    if (this.getPlayerTerritoryCount(randomItem) < 1) continue;
                }
            } else if (randomCategory === 'technology' || randomCategory === 'special') {
                recommendedAmount = 1;
                if (offererType === 'npc') {
                    const npcTechs = this.npcTechnologies.get(relevantNpcId);
                    if (!npcTechs || !npcTechs.has(randomItem)) continue;
                } else {
                    if (!this.playerTechnologies.has(randomItem)) continue;
                }
            } else if (randomCategory === 'dragons') {
                recommendedAmount = 1;
                if (offererType === 'npc') {
                    if (randomItem !== 'dragon_egg') continue; // NPCs don't have unique dragons to trade
                } else {
                    if (this.game.playerDragons.length === 0) continue;
                    randomItem = this.game.playerDragons[Math.floor(Math.random() * this.game.playerDragons.length)].id;
                }
            }

            if (offererType === 'npc') {
                const npc = this.game.getNpcById(relevantNpcId);
                if (randomCategory === 'resources' && (!npc.inventory || (npc.inventory[randomItem] || 0) < recommendedAmount)) {
                    continue;
                }
            } else {
                if (randomCategory === 'resources' && this.game.resourceManager.resources[randomItem] < recommendedAmount) {
                    continue;
                }
                const playerCityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
                if (randomCategory === 'troops' && (playerCityTile.troops[randomItem] || 0) < recommendedAmount) {
                    continue;
                }
            }
            
            return { category: randomCategory, item: randomItem, amount: recommendedAmount };
        }

        return null;
    }

    validateNpcCanOffer(npc, category, item, amount) {
        switch (category) {
            case 'resources':
                return npc.inventory && (npc.inventory[item] || 0) >= amount;
            case 'technology':
                return this.npcTechnologies.get(npc.id)?.has(item) || false;
            case 'territories':
                return this.getNpcTerritoryCount(npc.id, item) >= amount;
            case 'troops':
                // Assume NPCs have troops of a certain type to trade. A more complex check could go here.
                return (npc.inventory?.[item] || 500) >= amount; // Placeholder for NPC troop inventory
            case 'special':
                if (item === 'dragon_egg' || item === 'artifact' || item === 'map_intel' || item === 'mercenary_contract' || item === 'ancient_blueprint' || item === 'resource_deed') {
                    // Use inventory for special items that might be held by caravans
                    return (npc.inventory?.[item] || 0) >= amount;
                }
                return false;
            case 'dragons':
                return false; // NPCs don't offer specific dragons in public market
            default:
                return true; 
        }
    }

    getNpcTerritoryCount(npcId, terrainType) {
        let count = 0;
        for (let y = 0; y < this.game.mapRenderer.mapSize; y++) {
            for (let x = 0; x < this.game.mapRenderer.mapSize; x++) {
                const tile = this.game.mapRenderer.map[y][x];
                if (tile.owner === npcId && tile.type === terrainType) {
                    count++;
                }
            }
        }
        return count;
    }
}