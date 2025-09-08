import { MapInteractionManager } from './MapInteractionManager.js';
import { CanvasResizer } from './CanvasResizer.js'; // NEW: Import CanvasResizer

export class MapRenderer {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.ctx = game.ctx;
        
        // Map configuration
        this.mapSize = 50; // INCREASED MAP SIZE
        this.baseTileWidth = 128;
        this.baseTileHeight = 64;
        this.scale = 1; // Now managed by MapRenderer, but updated by MapInteractionManager
        this.offsetX = 0; // Now managed by MapRenderer, but updated by MapInteractionManager
        this.offsetY = 0; // Now managed by MapRenderer, but updated by MapInteractionManager
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        
        // Images
        this.images = {};
        
        // NEW: Instantiate CanvasResizer to handle canvas resizing logic
        this.canvasResizer = new CanvasResizer(this.canvas, () => this.render());
        
        // Instantiate MapInteractionManager
        this.mapInteractionManager = new MapInteractionManager(game);
        
        // Don't generate map immediately, wait for multiplayer adapter to restore player position
        // Request map data from server if multiplayer is available (moved post-join)
    }
    
    getImageListForPreloading() {
        return [
            { type: 'image', key: 'llanura', src: '/assets/images/terrain/llanura1.png' },
            { type: 'image', key: 'montana', src: '/assets/images/terrain/montana1.png' },
            { type: 'image', key: 'nieve', src: '/assets/images/terrain/nieve1.png' },
            { type: 'image', key: 'ciudad', src: '/assets/images/terrain/tiledeciudad.png' },
            { type: 'image', key: 'milicia', src: '/assets/images/units/milicia1.png' },
            { type: 'image', key: 'cityBackground', src: '/assets/images/terrain/ciudadinicial.png' },
            { type: 'image', key: 'archer', src: '/assets/images/units/archer-sprite.png' },
            { type: 'image', key: 'cavalry', src: '/assets/images/units/cavalry-sprite.png' },
            { type: 'image', key: 'diplomacyBackground', src: '/assets/images/backgrounds/diplomacy_background.png' },
            { type: 'image', key: 'tradeBackground', src: '/assets/images/backgrounds/trade_background.png' },
            { type: 'image', key: 'dragonsBackground', src: '/assets/images/backgrounds/dragons_background.png' },
            { type: 'image', key: 'newsPanelBackground', src: '/assets/images/backgrounds/news_panel_background.png' },
            { type: 'image', key: 'exploreIcon', src: '/assets/images/ui/explore_icon.png' },
            { type: 'image', key: 'balanceScale', src: '/assets/images/ui/balance_scale.png' }, // For trade notifications
            { type: 'image', key: 'battleReportDragon', src: '/assets/images/backgrounds/battle_report_dragon.png' }, // Battle Report Dragon
            { type: 'image', key: 'commonbabydragon', src: '/assets/images/dragons/commonbabydragon1.png' }, // Baby Dragon Image
            { type: 'image', key: 'dragonEggAltar', src: '/assets/images/dragons/huevodedragoncomun.png' }, // Dragon Egg Altar Image
            { type: 'image', key: 'desierto', src: '/assets/images/terrain/desierto1.png' }, // Desert tile image
            { type: 'image', key: 'bosque', src: '/assets/images/terrain/bosque1.png' },
            { type: 'image', key: 'pantano', src: '/assets/images/terrain/pantano1.png' },
            { type: 'image', key: 'ruinas', src: '/assets/images/terrain/ruinas1.png' },
            { type: 'image', key: 'cristales', src: '/assets/images/terrain/cristalesazules1.png' },
            { type: 'image', key: 'agua', src: '/assets/images/terrain/agua1.png' } // Water tile image
        ];
    }
    
    generateMap() {
        // Verificar si hay datos de mapa persistentes disponibles desde el adaptador multiplayer
        if (this.game.multiplayer && this.game.multiplayer.mapData) {
            console.log('🗺️ Cargando mapa desde datos persistentes del servidor');
            this.map = this.game.multiplayer.mapData;
            return;
        }
        
        // Si no hay datos persistentes, generar nuevo mapa
        console.log('🎲 Generando nuevo mapa aleatorio');
        this.map = Array.from({ length: this.mapSize }, () => Array(this.mapSize).fill(null));

        const biomes = ['llanura', 'montana', 'desierto', 'nieve', 'bosque', 'pantano', 'agua'];
        const numSeeds = 15;
        const seeds = [];

        // 1. Generate biome seed points
        for (let i = 0; i < numSeeds; i++) {
            seeds.push({
                x: Math.random() * this.mapSize,
                y: Math.random() * this.mapSize,
                biome: biomes[Math.floor(Math.random() * biomes.length)]
            });
        }
        
        // Add a guaranteed large water body
        const waterSeedX = Math.random() * this.mapSize;
        const waterSeedY = Math.random() * this.mapSize;
        for (let i = 0; i < 3; i++) {
             seeds.push({
                x: waterSeedX + (Math.random() - 0.5) * 8,
                y: waterSeedY + (Math.random() - 0.5) * 8,
                biome: 'agua'
            });
        }

        // 2. Assign biomes based on nearest seed (Voronoi)
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                let nearestDist = Infinity;
                let nearestBiome = 'llanura';
                for (const seed of seeds) {
                    const dist = Math.sqrt((x - seed.x) ** 2 + (y - seed.y) ** 2);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestBiome = seed.biome;
                    }
                }
                this.map[y][x] = { type: nearestBiome, owner: null, troops: { milicia: 0, archer: 0, cavalry: 0 } };
            }
        }

        // 3. Place cities on valid land tiles
        const placeCity = (preferredX, preferredY, owner) => {
            let placeX = preferredX;
            let placeY = preferredY;
            let attempts = 0;
            while (this.map[placeY][placeX].type === 'agua' || this.map[placeY][placeX].owner) {
                placeX = Math.floor(Math.random() * this.mapSize);
                placeY = Math.floor(Math.random() * this.mapSize);
                attempts++;
                if (attempts > 100) {
                    console.error(`Could not place city for ${owner}`);
                    return; // Failsafe
                }
            }
            this.map[placeY][placeX] = {
                type: 'ciudad',
                owner: owner,
                troops: (owner === 'player')
                    ? { milicia: 30, archer: 15, cavalry: 5 }
                    : { milicia: 25, archer: 10, cavalry: 5 }
            };
        };

        // Place player city if available, otherwise use default position
        if (this.game.playerCity && this.game.playerCity.x !== undefined && this.game.playerCity.y !== undefined) {
            placeCity(this.game.playerCity.x, this.game.playerCity.y, 'player');
        } else {
            // Use default position if playerCity is not available
            const defaultX = Math.floor(this.mapSize / 2);
            const defaultY = Math.floor(this.mapSize / 2);
            placeCity(defaultX, defaultY, 'player');
            console.log('Using default player city position:', defaultX, defaultY);
        }

        // Place NPC cities if available
        if (this.game.npcEmpires && this.game.npcEmpires.length > 0) {
            this.game.npcEmpires.forEach(npc => {
                if (npc.cityX !== undefined && npc.cityY !== undefined) {
                    placeCity(npc.cityX, npc.cityY, npc.id);
                }
            });
        }

        // 4. Sprinkle special tiles randomly
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                const tile = this.map[y][x];
                if (tile.type !== 'ciudad' && tile.type !== 'agua') {
                    const rand = Math.random();
                    if (rand < 0.02) { // 2% chance for crystals
                        tile.type = 'cristales';
                    } else if (rand < 0.04) { // 2% chance for ruins
                        tile.type = 'ruinas';
                    }
                }
            }
        }
        
        // 5. Assign resources to all tiles
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                this.map[y][x].resources = this.getTileResources(this.map[y][x].type);
            }
        }
        
        // No save map data from client - handled server-side
    }
    
    getTileResources(type) {
        const resources = {
            llanura: { food: 50, wood: 20 },
            montana: { stone: 40, metal: 20 },
            nieve: { metal: 10 },
            ciudad: { food: 30, wood: 30, stone: 30, metal: 30, imperion: 10 },
            desierto: { food: 10, metal: 20 },
            bosque: { wood: 60, food: 10 },
            pantano: { food: 20, wood: 10 },
            ruinas: { metal: 15, imperion: 5 },
            cristales: { imperion: 20, stone: 10 },
            agua: {} // Water produces no resources
        };
        return resources[type] || {};
    }
    
    // NEW: Public methods for MapInteractionManager to update map state
    setOffset(x, y) {
        this.offsetX = x;
        this.offsetY = y;
    }

    setScale(s) {
        this.scale = s;
    }

    getScale() {
        return this.scale;
    }

    getOffsetX() {
        return this.offsetX;
    }

    getOffsetY() {
        return this.offsetY;
    }
    // END NEW Public methods
    
    render() {
        // Only draw if map view is currently active
        if (this.game.currentView !== 'map') {
            return;
        }
        
        // Don't render if map is not yet defined
        if (!this.map) {
            return;
        }

        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
        this.ctx.imageSmoothingQuality = 'high';
        
        this.ctx.fillStyle = '#1a0f08';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        
        // Adjust tile drawing order for better visuals (draw from back to front)
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                this.renderTile(x, y);
            }
        }
        
        this.ctx.restore();
        
        if (this.game.selectedTile) {
            this.renderSelection();
        }

        this.renderTroops();
        this.renderCaravans(); // NEW
        this.renderMultiplayerPlayers(this.ctx);
        this.renderExploringTiles(this.ctx);
    }
    
    renderTile(x, y) {
        const tile = this.map[y][x];
        
        const tileWorldWidth = this.baseTileWidth * this.scale;
        const tileWorldHeight = this.baseTileHeight * this.scale;
        
        const screenX = (x - y) * tileWorldWidth / 2 + this.offsetX;
        const screenY = (x + y) * tileWorldHeight / 2 + this.offsetY;
        
        const imageDrawWidth = Math.floor(tileWorldWidth); 
        const imageDrawHeight = Math.floor(tileWorldWidth);
        
        const imageDrawY = screenY - (imageDrawHeight / 2);

        let finalImageDrawY = imageDrawY;
        if (tile.type === 'montana') {
            finalImageDrawY -= imageDrawHeight * 0.08;
        }

        if (screenX + imageDrawWidth < 0 || screenX > this.canvas.width || 
            finalImageDrawY + imageDrawHeight < 0 || finalImageDrawY > this.canvas.height) {
            return;
        }
        
        const image = this.images[tile.type];
        if (image && image.complete) {
            // No debug crop data
            this.ctx.drawImage(image, 
                Math.floor(screenX), 
                Math.floor(finalImageDrawY), 
                imageDrawWidth, 
                imageDrawHeight);
        } else {
            this.ctx.fillStyle = this.getTileColor(tile.type);
            this.ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.floor(this.baseTileWidth * this.scale), Math.floor(this.baseTileWidth * this.scale));
        }
        
        // Draw owner border and label
        if (tile.owner) {
            let borderColor = '#ff0000'; // Default red
            let ownerName = tile.owner;
            let isOwnEmpire = false;
            
            // Check if this is the player's empire
            if (this.game.multiplayer && this.game.multiplayer.playerId === tile.owner) {
                borderColor = '#00ff00'; // Green for own empire
                ownerName = 'Tu imperio';
                isOwnEmpire = true;
            } else if (this.game.multiplayerPlayers) {
                const player = this.game.multiplayerPlayers.get(tile.owner);
                if (player && player.color) {
                    borderColor = player.color;
                    ownerName = player.name;
                }
            } else if (tile.owner === 'player') {
                borderColor = '#00ff00'; // Local player fallback
                ownerName = 'Tu imperio';
                isOwnEmpire = true;
            }

            // Draw border
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = isOwnEmpire ? 4 : 3; // Thicker border for own empire
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenX + tileWorldWidth / 2, finalImageDrawY + imageDrawHeight / 4);
            this.ctx.lineTo(screenX + tileWorldWidth, finalImageDrawY + imageDrawHeight / 2);
            this.ctx.lineTo(screenX + tileWorldWidth / 2, finalImageDrawY + imageDrawHeight * 3 / 4);
            this.ctx.lineTo(screenX, finalImageDrawY + imageDrawHeight / 2);
            this.ctx.closePath();
            this.ctx.stroke();
            
            // Draw owner label
            this.ctx.save();
            this.ctx.fillStyle = isOwnEmpire ? '#00ff00' : '#ffffff';
            this.ctx.font = `${Math.max(10, 12 * this.scale)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            
            // Add background for better readability
            const textMetrics = this.ctx.measureText(ownerName);
            const textWidth = textMetrics.width;
            const textHeight = 16;
            const textX = screenX + tileWorldWidth / 2;
            const textY = finalImageDrawY - 10;
            
            // Draw background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(textX - textWidth / 2 - 4, textY - textHeight, textWidth + 8, textHeight);
            
            // Draw text
            this.ctx.fillStyle = isOwnEmpire ? '#00ff00' : '#ffffff';
            this.ctx.fillText(ownerName, textX, textY - 2);
            
            this.ctx.restore();
        }
    }
    
    getTileColor(type) {
        const colors = {
            llanura: '#4a5d23',
            montana: '#6b5b73',
            nieve: '#e8e8e8',
            ciudad: '#8b4513',
            desierto: '#d2b48c', // NEW: Color for desert
            bosque: '#224029',
            pantano: '#424225',
            ruinas: '#555555',
            cristales: '#30426b',
            agua: '#3d5a80' // NEW: Color for water
        };
        return colors[type] || '#333333';
    }
    
    getTileScreenPosition(x, y) {
        const tileWorldWidth = this.baseTileWidth * this.scale;
        const tileWorldHeight = this.baseTileHeight * this.scale;
        
        const screenX = (x - y) * tileWorldWidth / 2 + this.offsetX;
        const screenY = (x + y) * tileWorldHeight / 2 + this.offsetY;
        
        // Return the center of the tile for accurate army positioning relative to the tile's visual center
        const centerX = screenX + tileWorldWidth / 2;
        let centerY = screenY + tileWorldHeight / 2;
        
        // Adjust for mountain tiles that have their visual origin shifted up
        if (this.map[y] && this.map[y][x] && this.map[y][x].type === 'montana') {
            centerY -= tileWorldWidth * 0.08; // This is the vertical shift used in renderTile
        }

        return { x: centerX, y: centerY };
    }
    
    renderTroops() {
        if (!this.game.movingArmies || !(this.game.movingArmies instanceof Map)) {
            return;
        }
        
        for (const [id, army] of this.game.movingArmies) {
            if (army.updatePosition) {
                army.updatePosition();
            }
        }
    }

    renderCaravans() {
        for (const [id, caravan] of this.game.movingCaravans) {
            if (caravan.updatePosition) {
                caravan.updatePosition();
            }
        }
    }
    
    renderMultiplayerPlayers() {
        if (!this.game.multiplayerPlayers) return;
        
        for (const [playerId, player] of this.game.multiplayerPlayers) {
            // Compatibilidad con ambos formatos: position.x/y o x/y directo
            const x = player.position ? player.position.x : player.x;
            const y = player.position ? player.position.y : player.y;
            
            if (x !== undefined && y !== undefined) {
                const tilePos = this.getTileScreenPosition(x, y);
                const playerSize = 20 * this.scale;
                
                // Dibujar jugador como círculo colorido
                this.ctx.save();
                this.ctx.fillStyle = player.isAdmin ? '#ffd700' : '#00ff00';
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                
                this.ctx.beginPath();
                this.ctx.arc(tilePos.x, tilePos.y, playerSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                
                // Dibujar nombre del jugador
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = `${Math.max(10, 12 * this.scale)}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'bottom';
                this.ctx.fillText(player.name || playerId, tilePos.x, tilePos.y - playerSize / 2 - 5);
                
                // Si es admin, dibujar corona
                if (player.isAdmin) {
                    this.ctx.fillStyle = '#ffd700';
                    this.ctx.font = `${Math.max(8, 10 * this.scale)}px Arial`;
                    this.ctx.fillText('👑', tilePos.x, tilePos.y - playerSize / 2 - 20);
                }
                
                // Si es NPC, dibujar indicador
                if (player.type === 'npc' || player.isNPC) {
                    this.ctx.fillStyle = '#ff6b6b';
                    this.ctx.font = `${Math.max(8, 10 * this.scale)}px Arial`;
                    this.ctx.fillText('👺', tilePos.x + playerSize / 2 + 5, tilePos.y - playerSize / 2);
                }
                
                this.ctx.restore();
            }
        }
    }
    
    getTileAtScreenXY(screenX, screenY) {
        const tileWorldWidth = this.baseTileWidth * this.scale;
        const tileWorldHeight = this.baseTileHeight * this.scale;

        // Iterate in reverse draw order (front tiles first)
        for (let y = this.mapSize - 1; y >= 0; y--) {
            for (let x = this.mapSize - 1; x >= 0; x--) {
                const tile = this.map[y][x];

                // Calculate the position and drawing area of the tile on the screen
                const tileScreenX = (x - y) * tileWorldWidth / 2 + this.offsetX;
                let tileScreenY = (x + y) * tileWorldHeight / 2 + this.offsetY;

                const imageDrawWidth = Math.floor(tileWorldWidth);
                const imageDrawHeight = Math.floor(tileWorldWidth); 
                let finalImageDrawY = tileScreenY - (imageDrawHeight / 2);

                if (tile.type === 'montana') {
                    finalImageDrawY -= imageDrawHeight * 0.08;
                }

                const effectiveScreenX = tileScreenX;
                const effectiveScreenY = finalImageDrawY;
                const effectiveDrawWidth = imageDrawWidth;
                const effectiveDrawHeight = imageDrawHeight;

                const handleSize = 10; 
                if (screenX >= effectiveScreenX - handleSize && screenX <= effectiveScreenX + effectiveDrawWidth + handleSize &&
                    screenY >= effectiveScreenY - handleSize && screenY <= effectiveScreenY + effectiveDrawHeight + handleSize) {

                    const image = this.images[tile.type];
                    if (!image || !image.complete || image.width === 0) {
                        continue;
                    }

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = image.width; 
                    tempCanvas.height = image.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.imageSmoothingEnabled = false; 

                    tempCtx.save();
                    
                    tempCtx.drawImage(image, 
                        0, 0, image.width, image.height,
                        0, 0, tempCanvas.width, tempCanvas.height
                    );
                    tempCtx.restore();

                    let relativeX = (screenX - effectiveScreenX) / effectiveDrawWidth;
                    let relativeY = (screenY - effectiveScreenY) / effectiveDrawHeight;
                    
                    const pixelX = Math.floor(relativeX * tempCanvas.width);
                    const pixelY = Math.floor(relativeY * tempCanvas.height);
                    
                    if (pixelX >= 0 && pixelX < tempCanvas.width && pixelY >= 0 && pixelY < tempCanvas.height) {
                        const alpha = tempCtx.getImageData(pixelX, pixelY, 1, 1).data[3];

                        if (alpha > 20) { 
                            return { x, y, tile }; 
                        }
                    }
                }
            }
        }
        
        return null; // No tile found at click coordinates
    }
    
    renderSelection() {
        const x = this.game.selectedTile.x;
        const y = this.game.selectedTile.y;
        
        const tileWorldWidth = this.baseTileWidth * this.scale;
        const tileWorldHeight = this.baseTileHeight * this.scale;
        
        const screenX = (x - y) * tileWorldWidth / 2 + this.offsetX;
        const screenY = (x + y) * tileWorldHeight / 2 + this.offsetY;
        const imageDrawHeight = tileWorldWidth;
        let imageDrawY = screenY - (imageDrawHeight / 2);

        if (this.map[y][x].type === 'montana') {
            imageDrawY -= imageDrawHeight * 0.08;
        }

        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 8]);

        this.ctx.beginPath();
        this.ctx.moveTo(screenX + tileWorldWidth / 2, imageDrawY + imageDrawHeight / 4);
        this.ctx.lineTo(screenX + tileWorldWidth, imageDrawY + imageDrawHeight / 2);
        this.ctx.lineTo(screenX + tileWorldWidth / 2, imageDrawY + imageDrawHeight * 3 / 4);
        this.ctx.lineTo(screenX, imageDrawY + imageDrawHeight / 2);
        this.ctx.closePath();
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    }

    renderExploringTiles(ctx) {
        if (!this.images.exploreIcon || !this.images.exploreIcon.complete) return;

        ctx.save();
        ctx.globalAlpha = 0.9;

        const currentTime = performance.now();

        for (const [key, { x, y, startTime, duration }] of this.game.exploringTiles.entries()) {
            const tilePos = this.getTileScreenPosition(x, y);
            const iconSize = 48 * this.scale; // Size of the icon
            
            // Adjust position to be above the tile center
            const drawX = tilePos.x - iconSize / 2;
            const drawY = tilePos.y - iconSize - 10 * this.scale; // 10 pixels above the tile

            ctx.drawImage(this.images.exploreIcon, drawX, drawY, iconSize, iconSize);

            // Draw progress bar
            const progress = Math.min(1, (currentTime - startTime) / duration); // Clamp to 1
            const progressBarWidth = iconSize;
            const progressBarHeight = 5 * this.scale;
            const progressBarY = drawY + iconSize + 2 * this.scale; // Below the icon

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Background for progress bar
            ctx.fillRect(drawX, progressBarY, progressBarWidth, progressBarHeight);

            ctx.fillStyle = '#00ff88'; // Progress color
            ctx.fillRect(drawX, progressBarY, progressBarWidth * progress, progressBarHeight);

            ctx.strokeStyle = '#00ff88';
            this.ctx.lineWidth = 1;
            ctx.strokeRect(drawX, progressBarY, progressBarWidth, progressBarHeight);

            // Draw percentage text
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.max(8, 10 * this.scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.floor(progress * 100)}%`, drawX + progressBarWidth / 2, progressBarY + progressBarHeight / 2);
        }

        ctx.restore();
    }
    
    renderMultiplayerPlayers(ctx) {
        if (!this.ctx || !this.game.multiplayerPlayers || this.game.multiplayerPlayers.size === 0) return;
        
        ctx.save();
        
        for (const [playerId, player] of this.game.multiplayerPlayers) {
            // Skip if player is the local player
            if (playerId === this.game.playerData?.id) continue;
            
            // Compatibilidad con ambos formatos: position.x/y o x/y directo
            const x = player.position ? player.position.x : player.x;
            const y = player.position ? player.position.y : player.y;
            
            if (x !== undefined && y !== undefined) {
                const tilePos = this.getTileScreenPosition(x, y);
                
                // Draw player marker
                ctx.fillStyle = player.isAdmin ? '#ff6b6b' : '#4dabf7';
                ctx.beginPath();
                ctx.arc(tilePos.x, tilePos.y, 8 * this.scale, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw player border
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Draw player name
                ctx.fillStyle = '#ffffff';
                ctx.font = `${Math.max(10, 12 * this.scale)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(player.name, tilePos.x, tilePos.y - 12 * this.scale);
                
                // Draw admin crown if admin
                if (player.isAdmin) {
                    ctx.fillStyle = '#ffd700';
                    ctx.font = `${Math.max(12, 16 * this.scale)}px Arial`;
                    ctx.fillText('👑', tilePos.x, tilePos.y - 24 * this.scale);
                }
                
                // Draw NPC indicator if NPC
                if (player.type === 'npc' || player.isNPC) {
                    ctx.fillStyle = '#ff6b6b';
                    ctx.font = `${Math.max(12, 16 * this.scale)}px Arial`;
                    ctx.fillText('👺', tilePos.x + 12 * this.scale, tilePos.y - 24 * this.scale);
                }
            }
        }
        
        ctx.restore();
    }
}