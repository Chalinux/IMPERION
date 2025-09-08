export class TradeDisplayHelper {
    constructor(game) {
        this.game = game; // So it can access game.tradeSystem.tradeStateManager.tradeItemTypes and game.playerDragons
    }

    /**
     * Gets the user-friendly display name for a given item key.
     * @param {string} item - The internal item key (e.g., 'food', 'milicia', 'metalurgia').
     * @returns {string} The display name of the item.
     */
    getItemDisplayName(item) {
        // NEW: Check for technology name directly in the centralized tradeItemTypes
        const techData = this.game.tradeSystem.tradeStateManager.tradeItemTypes.technology?.[item];
        if (techData && techData.name) {
            return techData.name;
        }

        const displayNames = {
            food: 'Comida', wood: 'Madera', stone: 'Piedra', metal: 'Metal', imperion: 'Imperion',
            milicia: 'Milicia', archer: 'Arqueros', cavalry: 'Caballería',
            llanura: 'Llanura', montana: 'Montaña', nieve: 'Tierra Helada', ciudad: 'Ciudad',
            metalurgia: 'Metalurgia', agricultura: 'Agricultura', arquitectura: 'Arquitectura',
            navegacion: 'Navegación', guerra: 'Arte de la Guerra',
            dragon_egg: 'Huevo de Dragón', artifact: 'Artefacto Antiguo', map_intel: 'Inteligencia de Mapa'
        };
        // Check if it's a specific player dragon and has a custom name
        const playerDragon = this.game.playerDragons.find(d => d.id === item);
        if (playerDragon) {
            return playerDragon.name;
        }
        return displayNames[item] || item;
    }

    /**
     * Gets the image path or icon for a given trade item.
     * @param {string} category - The category of the item (e.g., 'resources', 'troops').
     * @param {string} item - The specific item ID (e.g., 'food', 'milicia').
     * @returns {string} The image path or a default empty string.
     */
    getIconForItem(category, item) {
        // Access tradeItemTypes through game.tradeSystem.tradeStateManager
        const itemData = this.game.tradeSystem.tradeStateManager.tradeItemTypes[category]?.[item];
        if (itemData && itemData.image_path) {
            return itemData.image_path;
        }
        if (category === 'dragons') {
            const dragon = this.game.playerDragons.find(d => d.id === item);
            return dragon?.image || 'assets/images/dragons/commonbabydragon1.png';
        }
        return '';
    }

    /**
     * Generates a descriptive string for a trade item (e.g., "100 🌾 Comida").
     * @param {string} category - The category of the item.
     * @param {string} item - The specific item ID.
     * @param {number} amount - The amount of the item.
     * @returns {string} The formatted trade description.
     */
    getTradeDescription(category, item, amount) {
        // Access tradeItemTypes through game.tradeSystem.tradeStateManager
        const itemData = this.game.tradeSystem.tradeStateManager.tradeItemTypes[category]?.[item];
        if (!itemData) {
            if (category === 'dragons') {
                const dragon = this.game.playerDragons.find(d => d.id === item);
                return `${amount} 🐉 ${dragon ? dragon.name : 'Dragón Desconocido'}`;
            }
            return `Desconocido (${amount})`;
        }
        const displayName = this.getItemDisplayName(item);
        return `${amount} ${itemData.icon || ''} ${displayName}`;
    }
}