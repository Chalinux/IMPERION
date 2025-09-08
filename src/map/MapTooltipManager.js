console.log("MapTooltipManager.js loaded.");

export class MapTooltipManager {
    constructor(game) {
        this.game = game;
    }

    /**
     * Updates the map tooltip content and position based on mouse movement.
     * @param {MouseEvent} e - The mouse event.
     */
    updateTooltip(e) {
        // Only show tooltip if map view is active
        if (this.game.currentView !== 'map') {
            this.hideTooltip();
            return;
        }

        const rect = this.game.mapRenderer.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const hit = this.game.mapRenderer.getTileAtScreenXY(mouseX, mouseY);

        if (hit) {
            const typeNames = {
                llanura: 'Llanura',
                montana: 'Montaña',
                nieve: 'Tierra Helada',
                ciudad: 'Ciudad',
                desierto: 'Desierto',
                bosque: 'Bosque',
                pantano: 'Pantano',
                ruinas: 'Ruinas Antiguas',
                cristales: 'Campo de Cristales',
                agua: 'Agua'
            };

            const ownerText = hit.tile.owner === this.game.currentPlayerName ? 'Tu imperio' : (hit.tile.owner ? `Imperio de ${hit.tile.owner}` : 'Neutral');
            this.game.tooltip.textContent = `${typeNames[hit.tile.type]} (${hit.x}, ${hit.y}) - Propietario: ${ownerText}`;
            this.game.tooltip.style.left = (e.clientX + 10) + 'px';
            this.game.tooltip.style.top = (e.clientY - 30) + 'px';
            this.game.tooltip.classList.add('visible');
        } else {
            this.hideTooltip();
        }
    }
    
    /**
     * Hides the map tooltip.
     */
    hideTooltip() {
        this.game.tooltip.classList.remove('visible');
    }
}