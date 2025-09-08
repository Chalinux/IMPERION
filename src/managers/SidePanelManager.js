console.log("SidePanelManager.js loaded.");

export class SidePanelManager {
    constructor(game) {
        this.game = game;
        this.panelContent = document.getElementById('panelContent');
    }

    /**
     * Updates the content of the main side panel based on the selected tile.
     * Moved from UIManager.js.
     * @param {object} tile - The selected tile object from the map.
     * @param {number} x - The x-coordinate of the selected tile.
     * @param {number} y - The y-coordinate of the selected tile.
     */
    updateSidePanel(tile, x, y) {
        if (!this.panelContent) return;

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
        
        let ownerName = 'Sin dueño';
        if (tile.owner === 'player') {
            ownerName = 'Tu Imperio';
        } else if (tile.owner) {
            const npc = this.game.getNpcById(tile.owner);
            ownerName = npc ? npc.name : 'Imperio Desconocido';
        }

        const playerTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
        const totalPlayerTroops = Object.values(playerTile.troops || {}).reduce((sum, count) => sum + count, 0);
        const tileTotalTroops = tile.troops ? Object.values(tile.troops).reduce((sum, count) => sum + count, 0) : 0;
        
        // Check if the tile is currently being explored
        const exploringInfo = this.game.exploringTiles.get(`${x},${y}`);
        let explorationStatusHTML = '';
        if (exploringInfo) {
            const progress = Math.min(1, (performance.now() - exploringInfo.startTime) / exploringInfo.duration);
            explorationStatusHTML = `
                <p style="color: #00ff88;"><strong>🔍 Explorando:</strong> ${Math.floor(progress * 100)}% completado</p>
            `;
        }

        this.panelContent.innerHTML = `
            <div class="panel-section">
                <h4>📍 Tile (${x}, ${y})</h4>
                <p><strong>Terreno:</strong> ${typeNames[tile.type]}</p>
                <p><strong>Propietario:</strong> ${ownerName === this.game.currentPlayerName ? 'Tu imperio' : (ownerName ? `Imperio de ${ownerName}` : 'Neutral')}</p>
                <p><strong>Tropas:</strong> ${tileTotalTroops.toLocaleString()}</p>
                ${explorationStatusHTML} <!-- Display exploration status here -->
                <div class="tile-resources">
                    <h5>Recursos por hora:</h5>
                    ${Object.entries(tile.resources).map(([res, amount]) => 
                        // Call UIManager's getItemDisplayName which now delegates to TradeDisplayHelper
                        `<p>${this.game.uiManager.getItemDisplayName(res)}: +${amount}</p>`
                    ).join('')}
                </div>
            </div>

            <div class="panel-section">
                <h4>⚔️ Tu Ejército</h4>
                <div class="army-summary">
                    <p>🗡️ Milicia: ${(playerTile.troops.milicia || 0).toLocaleString()}</p>
                    <p>🏹 Arqueros: ${(playerTile.troops.archer || 0).toLocaleString()}</p>
                    <p>🐎 Caballería: ${(playerTile.troops.cavalry || 0).toLocaleString()}</p>
                    <p><strong>Total en Ciudad: ${totalPlayerTroops.toLocaleString()}</strong></p>
                    <button class="medieval-btn" onclick="game.troopManager.openRecruitment()" style="width: 100%; margin-top: 10px;">📋 Reclutar Tropas</button>
                </div>
            </div>

            <div class="panel-section">
                <h4>ℹ️ Información del Tile</h4>
                <div class="tile-info">
                    <p><strong>Bonos de Terreno:</strong></p>
                    <p>${this.getTerrainBonus(tile.type)}</p>
                    ${tile.owner !== 'player' ? `
                        <p><strong>Guarnición:</strong> ${tileTotalTroops ? tileTotalTroops.toLocaleString() : 'Desconocida'}</p>
                        <p><strong>Dificultad:</strong> ${this.getDifficulty(tile.type)}</p>
                    ` : ''}
                </div>
            </div>

            ${this.getTileActions(tile, x, y)}
        `;
    }

    /**
     * Provides a descriptive text for terrain bonuses.
     * Moved from UIManager.js.
     * @param {string} terrain - The type of terrain.
     * @returns {string} - Description of the terrain bonus.
     */
    getTerrainBonus(terrain) {
        // NEW: Reference BattleManager for terrain bonuses
        return this.game.battleManager.getTerrainName(terrain) || 'Sin bonos';
    }

    /**
     * Provides a descriptive text for terrain difficulty.
     * Moved from UIManager.js.
     * @param {string} terrain - The type of terrain.
     * @returns {string} - Description of the terrain difficulty.
     */
    getDifficulty(terrain) {
        const difficulties = {
            montana: 'Difícil',
            ciudad: 'Muy Difícil',
            llanura: 'Fácil',
            nieve: 'Medio',
            desierto: 'Medio', // NEW: Difficulty for desert
            bosque: 'Medio',
            pantano: 'Medio',
            ruinas: 'Difícil',
            cristales: 'Muy Difícil'
        };
        return difficulties[terrain] || 'Normal';
    }

    /**
     * Generates HTML for actions available on a selected tile.
     * Moved from UIManager.js.
     * @param {object} tile - The selected tile object.
     * @param {number} x - The x-coordinate of the tile.
     * @param {number} y - The y-coordinate of the tile.
     * @returns {string} - HTML string of actions.
     */
    getTileActions(tile, x, y) {
        const isExploring = this.game.exploringTiles.has(`${x},${y}`);
        
        // No actions for water tiles
        if (tile.type === 'agua') {
            return '<div class="tile-actions"><p style="color: #c9b037; text-align: center;">No se pueden realizar acciones en el agua.</p></div>';
        }

        if (tile.owner === 'player') {
            return `
                <div class="tile-actions">
                    <button class="medieval-btn" onclick="game.gameActions.sendTroops(${x}, ${y})" style="width: 100%; margin-bottom: 5px;">🚶 Enviar Tropas</button>
                    <button class="medieval-btn" onclick="game.gameActions.buildStructure(${x}, ${y})" style="width: 100%;">🏗️ Construir</button>
                </div>
            `;
        } else {
            return `
                <div class="tile-actions">
                    <button class="medieval-btn" onclick="game.gameActions.attackTile(${x}, ${y})" style="width: 100%; margin-bottom: 5px;">⚔️ Atacar</button>
                    <button class="medieval-btn" ${isExploring ? 'disabled' : ''} onclick="game.gameActions.exploreTile(${x}, ${y})" style="width: 100%;">🔍 ${isExploring ? 'Explorando...' : 'Explorar'}</button>
                </div>
            `;
        }
    }
}