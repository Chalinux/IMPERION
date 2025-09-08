export class GameActions {
    constructor(game) {
        this.game = game;
        this.troopCosts = {
            milicia: { food: 50, wood: 25 },
            archer: { food: 40, wood: 30 },
            cavalry: { food: 80, metal: 50 }
        };
    }
    
    sendTroops(x, y) {
        this.game.newsManager.addNews(`Enviando tropas a (${x}, ${y})`);
    }
    
    attackTile(x, y) {
        const playerTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
        const availableTroops = playerTile.troops;
        const totalAvailableTroops = Object.values(availableTroops).reduce((sum, count) => sum + count, 0);

        if (totalAvailableTroops <= 0) {
            this.game.newsManager.addNews("No tienes tropas disponibles para atacar");
            this.game.uiManager.notificationManager.showNotification('error', '¡No tienes tropas para atacar!');
            return;
        }
        
        const targetTile = this.game.mapRenderer.map[y][x];
        const targetTileImage = this.game.mapRenderer.images[targetTile.type]?.src || '';

        // Determine defender name for display
        let defenderName = 'Fuerzas Neutrales';
        if (targetTile.owner) {
            const npc = this.game.getNpcById(targetTile.owner);
            defenderName = npc ? `Imperio de ${npc.name}` : 'Imperio Desconocido';
        }

        const playerAvatar = this.game.profileManager.playerProfile.avatarUrl;
        
        // NEW: Generate Generals HTML
        let generalsHtml = '<p>No hay generales disponibles para liderar.</p>';
        if (this.game.playerGenerals.length > 0) {
            generalsHtml = this.game.playerGenerals.map((general, index) => `
                <div class="general-selection-item">
                    <input type="radio" id="general-${index}" name="selectedGeneral" value="${general.id}" ${index === 0 ? 'checked' : ''}>
                    <label for="general-${index}">
                        <img src="${general.avatar}" alt="${general.name}" class="general-selection-icon">
                        <div class="general-selection-info">
                            <strong>${general.name}</strong>
                            <span>Lvl ${general.level} - ${general.specialty}</span>
                        </div>
                    </label>
                </div>
            `).join('');
        }
        
        let dragonsHtml = '<p>No hay dragones disponibles para liderar.</p>';
        if (this.game.playerDragons.length > 0) {
            dragonsHtml = this.game.playerDragons.map((dragon, index) => `
                <div class="dragon-selection-item">
                    <input type="radio" id="dragon-${index}" name="selectedDragon" value="${dragon.id}" ${index === 0 ? 'checked' : ''}>
                    <label for="dragon-${index}">
                        <img src="${dragon.image}" alt="${dragon.name}" class="dragon-selection-icon">
                        <div class="dragon-selection-info">
                            <strong>${dragon.name}</strong>
                            <span>Lvl ${dragon.level} ${dragon.element}</span>
                        </div>
                    </label>
                </div>
            `).join('');
        }

        this.game.uiManager.showModal('Planificar Ataque', `
            <div class="attack-planning-v2">
                <div class="attack-panel attacker-panel">
                    <h4>⚔️ Tus Fuerzas</h4>
                    
                    <h5>🎖️ General al Mando</h5>
                    <div class="general-selection-list">
                        ${generalsHtml}
                    </div>
                    
                    <h5>🐉 Dragón Líder</h5>
                    <div class="dragon-selection-list">
                        ${dragonsHtml}
                    </div>

                    <h5>🎯 Composición del Ejército</h5>
                    <div class="troop-selection-list">
                        <!-- Milicia -->
                        <div class="troop-selection-item">
                            <img src="assets/images/units/milicia1.png" alt="Milicia" class="troop-icon-medium">
                            <div class="troop-details">
                                <strong>Milicia (${availableTroops.milicia.toLocaleString()})</strong>
                                <input type="range" id="milicia-slider" class="troop-slider" min="0" max="${availableTroops.milicia}" value="0" oninput="game.gameActions.updateTroopSliders('milicia')">
                            </div>
                            <input type="number" id="milicia-input" class="troop-input" min="0" max="${availableTroops.milicia}" value="0" oninput="game.gameActions.updateTroopSliders('milicia', true)">
                        </div>
                        <!-- Arqueros -->
                        <div class="troop-selection-item">
                            <img src="assets/images/units/archer-sprite.png" alt="Arqueros" class="troop-icon-medium">
                            <div class="troop-details">
                                <strong>Arqueros (${availableTroops.archer.toLocaleString()})</strong>
                                <input type="range" id="archer-slider" class="troop-slider" min="0" max="${availableTroops.archer}" value="0" oninput="game.gameActions.updateTroopSliders('archer')">
                            </div>
                            <input type="number" id="archer-input" class="troop-input" min="0" max="${availableTroops.archer}" value="0" oninput="game.gameActions.updateTroopSliders('archer', true)">
                        </div>
                        <!-- Caballería -->
                        <div class="troop-selection-item">
                            <img src="assets/images/units/cavalry-sprite.png" alt="Caballería" class="troop-icon-medium">
                            <div class="troop-details">
                                <strong>Caballería (${availableTroops.cavalry.toLocaleString()})</strong>
                                <input type="range" id="cavalry-slider" class="troop-slider" min="0" max="${availableTroops.cavalry}" value="0" oninput="game.gameActions.updateTroopSliders('cavalry')">
                            </div>
                            <input type="number" id="cavalry-input" class="troop-input" min="0" max="${availableTroops.cavalry}" value="0" oninput="game.gameActions.updateTroopSliders('cavalry', true)">
                        </div>
                    </div>
                    <div class="army-summary">
                        <p>Tropas Asignadas: <span id="assigned-troops-count">0</span> / ${totalAvailableTroops.toLocaleString()}</p>
                        <div class="troops-assigned-bar"><div id="troops-assigned-bar-inner"></div></div>
                    </div>
                </div>

                <div class="attack-panel defender-panel">
                    <h4>🛡️ Defensas Enemigas</h4>
                    <div class="target-tile-visual">
                        <img src="${targetTileImage}" alt="Tile de Terreno" class="target-tile-image">
                        <div class="target-tile-overlay">
                             <h5>Tile (${x}, ${y})</h5>
                             <p>${this.game.battleManager.getTerrainName(targetTile.type)}</p>
                        </div>
                    </div>
                    <div class="intel-report">
                        <h5>📋 Informe de Inteligencia</h5>
                        <p><strong>Propietario:</strong> ${defenderName}</p>
                        <p><strong>Fuerza Estimada:</strong> ~${(targetTile.troops.milicia || 0) + (targetTile.troops.archer || 0) + (targetTile.troops.cavalry || 0)} Tropas</p>
                        <p><strong>Bono de Terreno:</strong> +${this.game.battleManager.getTerrainBonus(targetTile.type) * 100}% Defensa</p>
                    </div>
                     <div class="attack-warning">
                        <h4>⚠️ Advertencia</h4>
                        <p>El combate es arriesgado y resultará en bajas. ¡Procede con cautela!</p>
                    </div>
                    <button class="medieval-btn launch-attack-btn" id="launchAttackBtn" onclick="game.gameActions.executeAttack(${x}, ${y})">🚀 ¡Lanzar Ataque!</button>
                </div>
            </div>
        `);
    }

    updateTroopSliders(changedType, isInput = false) {
        const slider = document.getElementById(`${changedType}-slider`);
        const input = document.getElementById(`${changedType}-input`);
        const max = parseInt(slider.max);

        let value;
        if (isInput) {
            value = parseInt(input.value) || 0;
        } else {
            value = parseInt(slider.value) || 0;
        }

        // Clamp value
        value = Math.max(0, Math.min(value, max));
        
        slider.value = value;
        input.value = value;
        
        const types = ['milicia', 'archer', 'cavalry'];
        let finalTotal = 0;
        types.forEach(type => {
             finalTotal += parseInt(document.getElementById(`${type}-input`).value) || 0;
        });

        const totalAvailable = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x].troops;
        const totalAvailableCount = Object.values(totalAvailable).reduce((sum, count) => sum + count, 0);

        document.getElementById('assigned-troops-count').textContent = finalTotal.toLocaleString();
        const percentage = totalAvailableCount > 0 ? (finalTotal / totalAvailableCount) * 100 : 0;
        document.getElementById('troops-assigned-bar-inner').style.width = `${percentage}%`;
    }

    executeAttack(x, y) {
        const attackingArmy = {
            milicia: parseInt(document.getElementById('milicia-input').value) || 0,
            archer: parseInt(document.getElementById('archer-input').value) || 0,
            cavalry: parseInt(document.getElementById('cavalry-input').value) || 0,
        };
        
        // NEW: Get selected General and Dragon
        const selectedGeneralId = document.querySelector('input[name="selectedGeneral"]:checked')?.value;
        const selectedDragonId = document.querySelector('input[name="selectedDragon"]:checked')?.value;

        const totalAttackingTroops = Object.values(attackingArmy).reduce((sum, count) => sum + count, 0);

        if (totalAttackingTroops <= 0) {
            this.game.uiManager.notificationManager.showNotification('error', 'Debes asignar al menos una tropa.');
            return;
        }

        const playerTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
        
        // Validate each troop type
        for(const type in attackingArmy) {
            if (attackingArmy[type] > (playerTile.troops[type] || 0)) {
                this.game.newsManager.addNews(`No tienes suficientes tropas de tipo ${type} para este ataque.`);
                this.game.uiManager.notificationManager.showNotification('error', `¡Tropas de ${type} insuficientes!`);
                return;
            }
        }
        
        this.game.uiManager.closeModal();
        
        // Deduct troops from player city immediately as they are now marching
        for(const type in attackingArmy) {
            playerTile.troops[type] -= attackingArmy[type];
        }

        // Start army movement animation, which will trigger the battle on completion
        this.animateArmyMovement(this.game.playerCity, {x, y}, totalAttackingTroops, () => {
            this.game.battleManager.resolveBattle(x, y, attackingArmy, selectedGeneralId, selectedDragonId);
        });
        
        this.game.mapRenderer.render();
        
        // Update side panel if city is selected
        if (this.game.selectedTile && this.game.selectedTile.x === this.game.playerCity.x && this.game.selectedTile.y === this.game.playerCity.y) {
            this.game.selectTile(this.game.playerCity.x, this.game.playerCity.y);
        }
    }

    animateCaravanMovement(from, to, items, onComplete) {
        // NEW: Simple Manhattan path movement with minimum delay
        const path = [];
        let cx = from.x, cy = from.y;
        while (cx !== to.x) {
            cx += cx < to.x ? 1 : -1;
            path.push({ x: cx, y: cy });
        }
        while (cy !== to.y) {
            cy += cy < to.y ? 1 : -1;
            path.push({ x: cx, y: cy });
        }
        const pathPoints = [{ x: from.x, y: from.y }, ...path];
        const steps = pathPoints.length - 1;
        const baseSize = 40;
        const minDuration = 10000; // 10s minimum
        const timePerTile = 1500;  // 1.5s per tile
        const duration = Math.max(minDuration, steps * timePerTile);
        const startTime = performance.now();

        const caravanId = `caravan_${Date.now()}`;
        const caravanMarker = document.createElement('div');
        caravanMarker.className = 'caravan-marker';
        caravanMarker.style.pointerEvents = 'auto';
        caravanMarker.style.cursor = 'pointer';
        caravanMarker.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game.centerOnCaravan(caravanId);
        });

        const scaledSize = baseSize * this.game.mapRenderer.scale;
        caravanMarker.style.width = scaledSize + 'px';
        caravanMarker.style.height = scaledSize + 'px';
        const startPos = this.game.mapRenderer.getTileScreenPosition(from.x, from.y);
        caravanMarker.style.left = (startPos.x - scaledSize/2) + 'px';
        caravanMarker.style.top  = (startPos.y - scaledSize/2) + 'px';

        document.getElementById('mapContainer').appendChild(caravanMarker);

        this.game.movingCaravans.set(caravanId, {
            game: this.game,
            id: caravanId,
            element: caravanMarker,
            path: pathPoints,
            baseSize,
            startTime,
            duration,
            from: from,       // Track start coordinates
            to: to,           // Track destination coordinates
            updatePosition() {
                const progress = Math.min(1, (performance.now() - this.startTime) / this.duration);
                const idxProg = progress * steps;
                const idx = Math.floor(idxProg);
                const frac = idxProg - idx;
                const p0 = this.path[idx];
                const p1 = this.path[Math.min(idx + 1, this.path.length - 1)];
                const pos0 = this.game.mapRenderer.getTileScreenPosition(p0.x, p0.y);
                const pos1 = this.game.mapRenderer.getTileScreenPosition(p1.x, p1.y);
                const currentScale = this.game.mapRenderer.scale;
                const size = this.baseSize * currentScale;
                caravanMarker.style.width = size + 'px';
                caravanMarker.style.height = size + 'px';
                const x = pos0.x + (pos1.x - pos0.x) * frac;
                const y = pos0.y + (pos1.y - pos0.y) * frac;
                caravanMarker.style.left = (x - size/2) + 'px';
                caravanMarker.style.top  = (y - size/2) + 'px';
            },
            getAnimationProgress() {  // NEW: Expose progress [0..1]
                return Math.min(1, (performance.now() - this.startTime) / this.duration);
            }
        });

        setTimeout(() => {
            if (onComplete) onComplete();
            caravanMarker.remove();
            this.game.movingCaravans.delete(caravanId);
            this.game.mapRenderer.render();
        }, duration);

        this.game.newsManager.addNews(`Una caravana ha partido hacia tu imperio.`, 'comercio');
        return caravanId;
    }

    animateArmyMovement(from, to, troopCount, onComplete) {
        // NEW: Simple Manhattan path army movement
        const path = [];
        let cx = from.x, cy = from.y;
        while (cx !== to.x) {
            cx += cx < to.x ? 1 : -1;
            path.push({ x: cx, y: cy });
        }
        while (cy !== to.y) {
            cy += cy < to.y ? 1 : -1;
            path.push({ x: cx, y: cy });
        }
        const pathPoints = [{ x: from.x, y: from.y }, ...path];
        const steps = pathPoints.length - 1;
        const baseSize = 32;
        const minDuration = 5000; // 5s minimum
        const timePerTile = 500;  // 0.5s per tile
        const duration = Math.max(minDuration, steps * timePerTile);
        const startTime = performance.now();

        const armyId = `army_${Date.now()}`;
        const armyMarker = document.createElement('div');
        armyMarker.className = 'army-marker';
        armyMarker.style.pointerEvents = 'auto';
        armyMarker.style.cursor = 'pointer';
        armyMarker.innerHTML = `<span style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);color:white;font-size:12px;font-weight:bold;text-shadow:1px 1px 2px:black;">${troopCount}</span>`;
        document.getElementById('mapContainer').appendChild(armyMarker);

        this.game.movingArmies.set(armyId, {
            game: this.game,
            id: armyId,
            element: armyMarker,
            troopCount,
            onComplete,
            path: pathPoints,
            baseSize,
            startTime,
            duration,
            updatePosition() {
                const progress = Math.min(1, (performance.now() - this.startTime) / this.duration);
                const idxProg = progress * steps;
                const idx = Math.floor(idxProg);
                const frac = idxProg - idx;
                const p0 = this.path[idx];
                const p1 = this.path[Math.min(idx + 1, this.path.length - 1)];
                const pos0 = this.game.mapRenderer.getTileScreenPosition(p0.x, p0.y);
                const pos1 = this.game.mapRenderer.getTileScreenPosition(p1.x, p1.y);
                const currentScale = this.game.mapRenderer.scale;
                const size = this.baseSize * currentScale;
                armyMarker.style.width = size + 'px';
                armyMarker.style.height = size + 'px';
                const x = pos0.x + (pos1.x - pos0.x) * frac;
                const y = pos0.y + (pos1.y - pos0.y) * frac;
                armyMarker.style.left = (x - size/2) + 'px';
                armyMarker.style.top  = (y - size/2) + 'px';
            }
        });

        setTimeout(() => {
            if (onComplete) onComplete();
            armyMarker.remove();
            this.game.movingArmies.delete(armyId);
            this.game.mapRenderer.render();
        }, duration);

        this.game.newsManager.addNews(`Ejército de ${troopCount} tropas marchando hacia (${to.x}, ${to.y})`);
    }

    getAnimationProgress(element) {
        // Simple progress calculation based on transition
        const style = window.getComputedStyle(element);
        const transform = style.transform;
        // This is a simplified version - in reality you'd need more complex calculation
        return 0.5; // Placeholder
    }

    exploreTile(x, y) {
        this.game.explorationManager.openExplorationModal(x, y);
    }

    buildStructure(x, y) {
        this.game.newsManager.addNews(`Construyendo en (${x}, ${y})`);
    }
    
    trainTroop(type) {
        // This method is deprecated, use recruitTroops instead
        this.game.newsManager.addNews("Usa el nuevo sistema de reclutamiento en el panel lateral");
    }
}