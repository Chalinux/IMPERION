export class TroopManager {
    constructor(game) {
        this.game = game;
        this.troopCosts = {
            milicia: { food: 50, wood: 25 },
            archer: { food: 40, wood: 30 },
            cavalry: { food: 80, metal: 50 }
        };
        // NEW: Define detailed stats for each troop type
        this.troopStats = {
            milicia: { name: 'Milicia', hp: 50, attack: 8, armor: 5, range: 1, speed: 2 },
            archer: { name: 'Arquero', hp: 35, attack: 10, armor: 2, range: 3, speed: 2 },
            cavalry: { name: 'Caballería', hp: 80, attack: 15, armor: 8, range: 1, speed: 4 }
        };
    }

    openRecruitment() {
        this.game.uiManager.closeModal();
        const playerTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
        const totalTroops = Object.values(playerTile.troops).reduce((sum, count) => sum + count, 0);
        
        this.game.uiManager.showModal('Reclutamiento de Tropas', `
            <div class="recruitment-panel">
                <h3>🏰 Cuartel - Reclutamiento</h3>
                <div class="recruitment-stats" style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <h4>📊 Estado del Ejército</h4>
                    <p>🗡️ Milicia: ${playerTile.troops.milicia.toLocaleString()}</p>
                    <p>🏹 Arqueros: ${playerTile.troops.archer.toLocaleString()}</p>
                    <p>🐎 Caballería: ${playerTile.troops.cavalry.toLocaleString()}</p>
                    <p><strong>Total: ${totalTroops.toLocaleString()}</strong></p>
                </div>
                
                <div class="recruitment-options" style="display: grid; gap: 15px;">
                    <div class="recruit-option" style="display: flex; align-items: center; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid #8b6914;">
                        <img src="/assets/images/units/milicia1.png" style="width: 48px; height: 48px; margin-right: 15px; image-rendering: pixelated;">
                        <div style="flex: 1;">
                            <h4 style="color: #ffd700;">🗡️ Milicia</h4>
                            <p style="color: #e8d5b7;">Unidad básica de infantería</p>
                            <p style="color: #c9b037;">Costo: 50 Comida, 25 Madera</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="number" id="milicia-count" value="1" min="1" max="50" style="width: 60px; padding: 5px; border: 1px solid #8b6914; background: rgba(0,0,0,0.5); color: #ffd700; border-radius: 4px;">
                            <button class="medieval-btn" onclick="game.troopManager.recruitTroops('milicia', document.getElementById('milicia-count').value)">Reclutar</button>
                        </div>
                    </div>
                    
                    <div class="recruit-option" style="display: flex; align-items: center; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid #8b6914;">
                        <img src="/assets/images/units/archer-sprite.png" style="width: 48px; height: 48px; margin-right: 15px; image-rendering: pixelated;">
                        <div style="flex: 1;">
                            <h4 style="color: #ffd700;">🏹 Arquero</h4>
                            <p style="color: #e8d5b7;">Unidad de ataque a distancia</p>
                            <p style="color: #c9b037;">Costo: 40 Comida, 30 Madera</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="number" id="archer-count" value="1" min="1" max="50" style="width: 60px; padding: 5px; border: 1px solid #8b6914; background: rgba(0,0,0,0.5); color: #ffd700; border-radius: 4px;">
                            <button class="medieval-btn" onclick="game.troopManager.recruitTroops('archer', document.getElementById('archer-count').value)">Reclutar</button>
                        </div>
                    </div>
                    
                    <div class="recruit-option" style="display: flex; align-items: center; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid #8b6914;">
                        <img src="/assets/images/units/cavalry-sprite.png" style="width: 48px; height: 48px; margin-right: 15px; image-rendering: pixelated;">
                        <div style="flex: 1;">
                            <h4 style="color: #ffd700;">🐎 Caballería</h4>
                            <p style="color: #e8d5b7;">Unidad rápida y poderosa</p>
                            <p style="color: #c9b037;">Costo: 80 Comida, 50 Metal</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="number" id="cavalry-count" value="1" min="1" max="50" style="width: 60px; padding: 5px; border: 1px solid #8b6914; background: rgba(0,0,0,0.5); color: #ffd700; border-radius: 4px;">
                            <button class="medieval-btn" onclick="game.troopManager.recruitTroops('cavalry', document.getElementById('cavalry-count').value)">Reclutar</button>
                        </div>
                    </div>
                </div>
                
                <div class="recruitment-summary" style="margin-top: 20px; padding: 15px; background: rgba(139,105,20,0.3); border-radius: 8px;">
                    <h4>📋 Resumen de Recursos</h4>
                    <p>🌾 Comida: ${Math.floor(this.game.resourceManager.resources.food).toLocaleString()}</p>
                    <p>🪵 Madera: ${Math.floor(this.game.resourceManager.resources.wood).toLocaleString()}</p>
                    <p>⚔️ Metal: ${Math.floor(this.game.resourceManager.resources.metal).toLocaleString()}</p>
                </div>
            </div>
        `);
    }

    recruitTroops(type, count) {
        const amount = parseInt(count) || 1;
        const costs = this.troopCosts;
        
        const totalCost = {};
        const cost = costs[type];
        
        if (!cost) {
            this.game.newsManager.addNews(`Tipo de tropa desconocido: ${type}`);
            return;
        }
        
        // Calculate total cost
        for (const [resource, price] of Object.entries(cost)) {
            totalCost[resource] = price * amount;
        }
        
        if (this.game.resourceManager.canAfford(totalCost)) {
            this.game.resourceManager.spendResources(totalCost);
            
            // Add troops to player city
            const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
            // NEW: Add to specific troop type
            cityTile.troops[type] = (cityTile.troops[type] || 0) + amount;
            
            const troopName = type === 'milicia' ? 'Milicia' : type === 'archer' ? 'Arqueros' : 'Caballería';
            this.game.newsManager.addNews(`${amount} ${troopName} reclutados exitosamente`);
            // RE-OPEN recruitment modal to show updated values
            this.openRecruitment();
            this.game.mapRenderer.render();
            
            // Update side panel if tile is selected
            if (this.game.selectedTile) {
                this.game.selectTile(this.game.selectedTile.x, this.game.selectedTile.y);
            }
        } else {
            this.game.newsManager.addNews(`Recursos insuficientes para reclutar ${amount} ${type}`);
            // Use UIManager's getItemDisplayName (which now delegates to TradeDisplayHelper)
            this.game.uiManager.notificationManager.showNotification('error', `Recursos insuficientes para reclutar ${amount} ${this.game.uiManager.getItemDisplayName(type)}`);
        }
    }
}