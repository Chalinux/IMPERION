import { MapTooltipManager } from './MapTooltipManager.js';

console.log("MapInteractionManager.js loaded.");

export class MapInteractionManager {
    constructor(game) {
        this.game = game; // Reference to the main game object

        this.isDragging = false;
        this.dragStart = { x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 };

        this.mapTooltipManager = new MapTooltipManager(game);
    }

    setupEventListeners() {
        const canvas = this.game.mapRenderer.canvas;

        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('click', (e) => this.game.handleClick(e)); // Delegate back to game for tile selection
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(zoomFactor, e.clientX, e.clientY); // Pass mouse coordinates for zoom
        });
        
        // Tooltips
        canvas.addEventListener('mousemove', (e) => this.mapTooltipManager.updateTooltip(e));
        canvas.addEventListener('mouseleave', () => this.mapTooltipManager.hideTooltip());
    }
    
    centerOnPlayerCity() {
        // Verificar si playerCity está disponible
        if (!this.game.playerCity || this.game.playerCity.x === undefined || this.game.playerCity.y === undefined) {
            console.warn('Player city not available, using default center position');
            // Usar posición por defecto en el centro del mapa
            this.game.playerCity = { x: 25, y: 25 };
        }
        
        const canvas = this.game.mapRenderer.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const currentScale = this.game.mapRenderer.getScale();
        const baseTileWidth = this.game.mapRenderer.baseTileWidth;
        const baseTileHeight = this.game.mapRenderer.baseTileHeight;

        const tileWorldWidth = baseTileWidth * currentScale;
        const tileWorldHeight = baseTileHeight * currentScale;
        
        const tileX = (this.game.playerCity.x - this.game.playerCity.y) * tileWorldWidth / 2;
        const tileY = (this.game.playerCity.x + this.game.playerCity.y) * tileWorldHeight / 2;
        
        const newOffsetX = centerX - tileX;
        const newOffsetY = centerY - tileY;

        this.game.mapRenderer.setOffset(newOffsetX, newOffsetY);
    }
    
    zoom(factor, mouseX = null, mouseY = null) {
        const canvas = this.game.mapRenderer.canvas;
        const rect = canvas.getBoundingClientRect();
        
        // If mouse coordinates not provided, use center of canvas
        const zoomCenterX = mouseX !== null ? mouseX - rect.left : rect.width / 2;
        const zoomCenterY = mouseY !== null ? mouseY - rect.top : rect.height / 2;
        
        const currentScale = this.game.mapRenderer.getScale();
        const currentOffsetX = this.game.mapRenderer.getOffsetX();
        const currentOffsetY = this.game.mapRenderer.getOffsetY();

        const worldX = (zoomCenterX - currentOffsetX);
        const worldY = (zoomCenterY - currentOffsetY);
        
        let newScale = currentScale * factor;
        newScale = Math.max(0.4, Math.min(2.5, newScale)); // Clamp scale
        
        const scaleRatio = newScale / currentScale;

        const newOffsetX = zoomCenterX - (worldX * scaleRatio);
        const newOffsetY = zoomCenterY - (worldY * scaleRatio);
        
        this.game.mapRenderer.setScale(newScale);
        this.game.mapRenderer.setOffset(newOffsetX, newOffsetY);

        // Update all moving armies (their positions depend on map scale and offset)
        for (const [id, army] of this.game.movingArmies) {
            if (army.updatePosition) {
                army.updatePosition();
            }
        }
        
        this.game.mapRenderer.render();
    }
    
    handleMouseDown(e) {
        // Only allow dragging if the map view is active AND admin mode is NOT active AND player has selected name
        if (this.game.currentView !== 'map' || this.game.isAdminMode) return;

        // Prevent interaction if player hasn't selected a name yet
        if (!this.game.welcomeManager?.playerNameSelected) {
            console.log('Player must select a name before interacting with the map');
            return;
        }

        this.isDragging = true;
        this.dragStart = {
            x: e.clientX,
            y: e.clientY,
            initialOffsetX: this.game.mapRenderer.getOffsetX(),
            initialOffsetY: this.game.mapRenderer.getOffsetY()
        };
        this.game.mapRenderer.canvas.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            const newOffsetX = this.dragStart.initialOffsetX + dx;
            const newOffsetY = this.dragStart.initialOffsetY + dy;
            this.game.mapRenderer.setOffset(newOffsetX, newOffsetY);
            this.game.mapRenderer.render();
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.game.mapRenderer.canvas.style.cursor = 'grab';
        }
    }
}