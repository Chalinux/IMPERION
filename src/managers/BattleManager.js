export class BattleManager {
    constructor(game) {
        this.game = game;
        this.battleIdCounter = 0; // Unique ID for each battle report
    }

    /**
     * Resolves a battle between an attacking army and a defending garrison.
     * This method simulates the battle round by round using detailed troop stats.
     * @param {number} x - The x-coordinate of the battle tile.
     * @param {number} y - The y-coordinate of the battle tile.
     * @param {object} attackingArmyComposition - The composition of the attacking army (e.g., { milicia: 50, archer: 20 }).
     * @param {string|null} attackerGeneralId - The ID of the general leading the attack.
     * @param {string|null} attackerDragonId - The ID of the dragon accompanying the attack.
     */
    resolveBattle(x, y, attackingArmyComposition, attackerGeneralId = null, attackerDragonId = null) {
        const battleId = `battle_${this.battleIdCounter++}`;
        const targetTile = this.game.mapRenderer.map[y][x];

        // 1. Prepare armies with full stats and buffs
        const terrainBonus = this.getTerrainBonus(targetTile.type);
        const attacker = this._prepareArmy('attacker', attackingArmyComposition, attackerGeneralId, attackerDragonId, 0);
        // Ensure defender composition is an object
        const defenderComposition = typeof targetTile.troops === 'object' ? targetTile.troops : { milicia: targetTile.troops || 0, archer: 0, cavalry: 0 };
        const defender = this._prepareArmy('defender', defenderComposition, null, null, terrainBonus);

        // Store initial detailed state for reporting
        const initialAttackerDetailed = JSON.parse(JSON.stringify(attacker));
        const initialDefenderDetailed = JSON.parse(JSON.stringify(defender));

        // 2. Simulate Battle Rounds
        const battleRounds = [];
        const maxRounds = 10;
        for (let i = 0; i < maxRounds; i++) {
            const attackerTotalTroops = Object.values(attacker).reduce((sum, unit) => sum + unit.count, 0);
            const defenderTotalTroops = Object.values(defender).reduce((sum, unit) => sum + unit.count, 0);
            if (attackerTotalTroops === 0 || defenderTotalTroops === 0) break;

            const roundResult = this._simulateRound(attacker, defender);
            battleRounds.push(roundResult);
        }

        // 3. Process Results
        const finalAttackerComposition = this._getSurvivingTroopsComposition(attacker);
        const finalDefenderComposition = this._getSurvivingTroopsComposition(defender);
        
        const finalAttackerTroopsTotal = Object.values(finalAttackerComposition).reduce((sum, count) => sum + count, 0);
        const finalDefenderTroopsTotal = Object.values(finalDefenderComposition).reduce((sum, count) => sum + count, 0);

        const victory = finalAttackerTroopsTotal > 0 && finalDefenderTroopsTotal === 0;
        
        // 4. Update Map State
        if (victory) {
            targetTile.owner = 'player';
            targetTile.troops = finalAttackerComposition; // Survivors occupy the tile
            this.game.newsManager.addNews(`¡Victoria! Tile (${x}, ${y}) conquistado`);
        } else {
            // Defeat: Return survivors to the city
            const playerCityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
            for (const type in finalAttackerComposition) {
                playerCityTile.troops[type] = (playerCityTile.troops[type] || 0) + finalAttackerComposition[type];
            }
            targetTile.troops = finalDefenderComposition; // Update defender's remaining troops
            this.game.newsManager.addNews(`Derrota en (${x}, ${y}). ${finalAttackerTroopsTotal} tropas regresan`);
        }
        
        // 5. Create and Store Battle Report
        this._createAndStoreReport(battleId, {x,y}, initialAttackerDetailed, initialDefenderDetailed, finalAttackerComposition, finalDefenderComposition, battleRounds, victory);

        this.game.mapRenderer.render();
        if (this.game.selectedTile && this.game.selectedTile.x === x && this.game.selectedTile.y === y) {
            this.game.selectTile(x, y);
        }
    }
    
    /**
     * Prepares an army object with full stats, applying any relevant buffs.
     * @private
     */
    _prepareArmy(side, composition, generalId, dragonId, terrainBonus) {
        const army = {};
        const general = this.game.playerGenerals.find(g => g.id === generalId);
        
        for (const type in composition) {
            if (composition[type] > 0) {
                const baseStats = this.game.troopManager.troopStats[type];
                const count = composition[type];
                
                army[type] = {
                    count: count,
                    stats: { ...baseStats }, // Important: copy base stats
                    totalHp: count * baseStats.hp
                };
                
                // Apply general buffs (only for attacker for now)
                if (side === 'attacker' && general && general.buffs) {
                    if (general.buffs.army_attack_physical_perc) {
                        army[type].stats.attack *= (1 + general.buffs.army_attack_physical_perc);
                    }
                    if (general.buffs[`${type}_attack_physical_perc`]) {
                         army[type].stats.attack *= (1 + general.buffs[`${type}_attack_physical_perc`]);
                    }
                }
                
                // Apply terrain bonus for defender
                if (side === 'defender') {
                     army[type].stats.armor *= (1 + terrainBonus);
                }
            }
        }
        return army;
    }

    /**
     * Simulates a single round of combat.
     * @private
     */
    _simulateRound(attacker, defender) {
        const roundSummary = {
            attackerCasualties: {},
            defenderCasualties: {}
        };

        // Ranged units attack first, then melee
        this._executeAttacks(attacker, defender, roundSummary, 'defenderCasualties', (unit) => unit.stats.range > 1);
        this._executeAttacks(defender, attacker, roundSummary, 'attackerCasualties', (unit) => unit.stats.range > 1);
        
        this._executeAttacks(attacker, defender, roundSummary, 'defenderCasualties', (unit) => unit.stats.range === 1);
        this._executeAttacks(defender, attacker, roundSummary, 'attackerCasualties', (unit) => unit.stats.range === 1);
        
        return roundSummary;
    }

    /**
     * Executes the attack phase for one side in a round.
     * @private
     */
    _executeAttacks(attackingArmy, defendingArmy, roundSummary, casualtyTracker, unitFilter) {
        const totalDefenderTroops = Object.values(defendingArmy).reduce((sum, unit) => sum + unit.count, 0);
        if (totalDefenderTroops === 0) return;

        // Calculate total damage from qualifying units
        let totalDamage = 0;
        Object.values(attackingArmy).filter(unitFilter).forEach(unit => {
            totalDamage += unit.count * unit.stats.attack * (0.8 + Math.random() * 0.4); // Add 20% variance
        });

        // Distribute damage among defending units
        for (const type in defendingArmy) {
            const unit = defendingArmy[type];
            if (unit.count > 0) {
                const proportion = unit.count / totalDefenderTroops;
                const damageToUnitType = totalDamage * proportion;
                
                // Damage reduction: Dmg * (100 / (100 + Armor))
                const effectiveDamage = damageToUnitType * (100 / (100 + unit.stats.armor));
                
                const casualties = Math.min(unit.count, Math.floor(effectiveDamage / unit.stats.hp));
                
                if (casualties > 0) {
                    unit.count -= casualties;
                    unit.totalHp -= casualties * unit.stats.hp;
                    roundSummary[casualtyTracker][type] = (roundSummary[casualtyTracker][type] || 0) + casualties;
                }
            }
        }
    }

    /**
     * Converts the final army state back into a simple composition object.
     * @private
     */
    _getSurvivingTroopsComposition(army) {
        const composition = { milicia: 0, archer: 0, cavalry: 0 };
        for (const type in army) {
            composition[type] = army[type].count;
        }
        return composition;
    }
    
    /**
     * Creates the battle report object and stores it.
     * @private
     */
    _createAndStoreReport(battleId, location, initialAttackerDetailed, initialDefenderDetailed, finalAttackerComposition, finalDefenderComposition, rounds, victory) {
        const initialAttackerTroopsTotal = Object.values(initialAttackerDetailed).reduce((sum, unit) => sum + unit.count, 0);
        const initialDefenderTroopsTotal = Object.values(initialDefenderDetailed).reduce((sum, unit) => sum + unit.count, 0);
        const finalAttackerTroopsTotal = Object.values(finalAttackerComposition).reduce((sum, count) => sum + count, 0);
        const finalDefenderTroopsTotal = Object.values(finalDefenderComposition).reduce((sum, count) => sum + count, 0);
        
        const battleResult = {
            id: battleId,
            timestamp: new Date().toLocaleString('es-ES'),
            location: location,
            attacker: 'Tu Imperio',
            defender: 'Fuerzas Enemigas', // Simplified
            initialAttackerDetailed, // Store the detailed initial composition
            initialDefenderDetailed, // Store the detailed initial composition
            finalAttackerComposition, // Store the final simple composition
            finalDefenderComposition, // Store the final simple composition
            attackerCasualties: initialAttackerTroopsTotal - finalAttackerTroopsTotal,
            defenderCasualties: initialDefenderTroopsTotal - finalDefenderTroopsTotal,
            terrain: this.getTerrainName(this.game.mapRenderer.map[location.y][location.x].type),
            result: victory ? 'Victoria' : 'Derrota',
            description: victory ? `Tile conquistado. ${finalAttackerTroopsTotal} tropas sobrevivieron.` : `Ataque fallido. ${finalAttackerTroopsTotal} tropas regresaron.`,
            rounds: rounds
        };
        
        this.addBattleLog(battleResult);
        
        this.game.uiManager.notificationManager.showNotification(
            victory ? 'battle_victory' : 'battle_defeat', 
            `Batalla en (${location.x},${location.y}): ¡${battleResult.result}!`, 
            7000, 
            { type: 'open_battle_report', battleId: battleResult.id },
            true
        );
    }

    // NEW: Moved from GameActions.js
    getTerrainBonus(terrain) {
        const bonuses = {
            montana: 0.2,  // 20% defense bonus
            ciudad: 0.3,   // 30% defense bonus
            llanura: 0.0,  // No bonus
            nieve: 0.1,    // 10% defense bonus
            desierto: 0.05, // NEW: 5% defense bonus for desert
            bosque: 0.1,   // 10% defense bonus
            pantano: 0.05, // 5% defense bonus
            ruinas: 0.15,  // 15% defense bonus
            cristales: 0.0 // 0% defense bonus
        };
        return bonuses[terrain] || 0;
    }

    // NEW: Moved from GameActions.js
    getTerrainName(terrain) {
        const names = {
            llanura: 'Llanura',
            montana: 'Montaña',
            nieve: 'Tierra Helada',
            ciudad: 'Ciudad',
            desierto: 'Desierto',
            bosque: 'Bosque',
            pantano: 'Pantano',
            ruinas: 'Ruinas',
            cristales: 'Cristales',
            agua: 'Agua' // NEW: Name for water
        };
        return names[terrain] || 'Desconocido';
    }

    openBattleLog() {
        const battleLogHTML = this.game.battleLog.map(battle => `
            <div class="battle-log-item">
                <div class="battle-timestamp">${battle.timestamp}</div>
                <div class="battle-details">
                    <strong>Ubicación:</strong> (${battle.location.x}, ${battle.location.y})<br>
                    <strong>Atacante:</strong> ${battle.attacker} (${Object.values(battle.initialAttackerDetailed).reduce((sum, unit) => sum + unit.count, 0)} tropas iniciales)<br>
                    <strong>Defensor:</strong> ${battle.defender} (${Object.values(battle.initialDefenderDetailed).reduce((sum, unit) => sum + unit.count, 0)} tropas iniciales)<br>
                    <strong>Resultado:</strong> <span class="battle-result ${battle.result.toLowerCase()}">${battle.result === 'Victoria' ? '⚔️ Victoria' : '💀 Derrota'}</span>
                </div>
                <div class="item-actions" style="justify-content: center;">
                    <button class="medieval-btn" onclick="game.battleManager.openBattleReport('${battle.id}')">
                        📜 Ver Informe Completo
                    </button>
                </div>
            </div>
        `).reverse().join(''); // Reverse to show latest battles first

        this.game.uiManager.showModal('📜 Registro de Batallas', `
            <div class="battle-log-panel">
                <h3 style="color: #ffd700; margin-bottom: 15px;">Historial de Combates</h3>
                <div class="battle-controls" style="margin-bottom: 15px;">
                    <button class="medieval-btn" onclick="game.battleManager.clearBattleLog()" style="margin-right: 10px;">Limpiar Historial</button>
                    <span style="color: #c9b037;">Total: ${this.game.battleLog.length} batallas</span>
                </div>
                <div class="battle-list">
                    ${battleLogHTML || '<p style="text-align: center; color: #c9b037;">No hay batallas registradas</p>'}
                </div>
            </div>
        `);
    }

    openBattleReport(battleId) {
        const battle = this.game.battleLog.find(b => b.id === battleId);
        if (!battle) {
            this.game.uiManager.notificationManager.showNotification('error', 'Informe de batalla no encontrado.');
            return;
        }

        const troopTypes = ['milicia', 'archer', 'cavalry'];

        // Updated generateCasualtyBreakdown to use initial detailed and final simple compositions
        const generateCasualtyBreakdown = (initialDetailedComposition, finalSimpleComposition) => {
            return troopTypes.map(type => {
                const initialCount = initialDetailedComposition[type]?.count || 0;
                if (initialCount === 0) return '';
                const finalCount = finalSimpleComposition[type] || 0;
                const casualties = initialCount - finalCount;

                return `<p><img src="${this.game.troopManager.troopStats[type].name === 'Milicia' ? 'assets/images/units/milicia1.png' : this.game.troopManager.troopStats[type].name === 'Arquero' ? 'assets/images/units/archer-sprite.png' : 'assets/images/units/cavalry-sprite.png'}" class="troop-icon-small"> ${this.game.troopManager.troopStats[type].name}: ${initialCount} ➡️ ${finalCount} (<span class="casualties">-${casualties}</span>)</p>`;
            }).join('');
        };
        
        const attackerCasualtyBreakdown = generateCasualtyBreakdown(battle.initialAttackerDetailed, battle.finalAttackerComposition);
        const defenderCasualtyBreakdown = generateCasualtyBreakdown(battle.initialDefenderDetailed, battle.finalDefenderComposition);
        
        let roundsHtml = battle.rounds.map((round, index) => {
            const attackerCasualtiesText = troopTypes.map(t => round.attackerCasualties[t] > 0 ? `${round.attackerCasualties[t]} ${this.game.troopManager.troopStats[t].name}` : '').filter(Boolean).join(', ');
            const defenderCasualtiesText = troopTypes.map(t => round.defenderCasualties[t] > 0 ? `${round.defenderCasualties[t]} ${this.game.troopManager.troopStats[t].name}` : '').filter(Boolean).join(', ');

            return `
                 <div class="round-summary">
                    <h5 class="round-title">Ronda ${index + 1}</h5>
                    <p class="attacker-round">Atacante pierde: <span class="casualties">${attackerCasualtiesText || 'Ninguna'}</span></p>
                    <p class="defender-round">Defensor pierde: <span class="casualties">
                        ${defenderCasualtiesText || 'Ninguna'}
                    </span></p>
                </div>
            `;
        }).join('');
        
        const reportContent = `
            <div class="battle-report-modal">
                <h3 class="report-title">📜 Informe de Batalla</h3>
                <div class="letter-parchment">
                    <div class="report-header">
                        <h4>¡El Rugido de la Guerra!</h4>
                        <p class="report-date">${battle.timestamp}</p>
                        <p class="report-location">Enfrentamiento en: Tile (${battle.location.x}, ${battle.location.y}) - ${battle.terrain}</p>
                    </div>

                    <div class="report-summary-info">
                        <div class="casualty-breakdown">
                            <h5>⚔️ Fuerzas Atacantes</h5>
                            ${attackerCasualtyBreakdown || '<p>Sin tropas atacantes.</p>'}
                        </div>
                        <div class="casualty-breakdown">
                            <h5>🛡️ Fuerzas Defensoras</h5>
                            ${defenderCasualtyBreakdown || '<p>Sin tropas defensoras.</p>'}
                        </div>
                    </div>

                    <div class="report-section battle-outcome ${battle.result.toLowerCase()}">
                        <h4>Resultado de la Batalla</h4>
                        <p class="result-text">${battle.result === 'Victoria' ? '🎉 ¡VICTORIA GLORIOSA! 🎉' : '☠️ ¡DERROTA CATASTRÓFICA! ☠️'}</p>
                        <div class="casualty-stats">
                           <p>Bajas Totales Atacante: <strong class="casualties">${battle.attackerCasualties}</strong></p>
                           <p>Bajas Totales Defensor: <strong class="casualties">${battle.defenderCasualties}</strong></p>
                        </div>
                    </div>

                    <div class="report-section round-details">
                        <h4>Desarrollo de las Rondas</h4>
                        ${roundsHtml || '<p>La batalla se resolvió instantáneamente.</p>'}
                    </div>

                    <p class="report-footer">Que los dioses de la guerra te sean favorables. Fin del informe.</p>
                </div>
            </div>
        `;

        this.game.uiManager.showModal(`Informe de Batalla - ${battle.result}`, reportContent);
    }

    clearBattleLog() {
        this.game.battleLog = [];
        this.game.uiManager.closeModal();
        this.game.newsManager.addNews("Historial de batallas limpiado", 'system');
    }

    addBattleLog(battle) {
        this.game.battleLog.push(battle);

        // Keep only last 100 battles
        if (this.game.battleLog.length > 100) {
            this.game.battleLog.shift();
        }
    }
}