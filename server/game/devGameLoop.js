const StateManager = require('./StateManager');
const ChatManager = require('./ChatManager');
const SpectatorManager = require('./SpectatorManager');

class DevGameLoop {
    constructor() {
        this.tickRate = 15; // 15 Hz (cada ~67ms)
        this.isRunning = false;
        this.lastTick = 0;
        this.tickCount = 0;
        this.globalRoomId = 'dev_global';
        this.lastSystemMessageLog = 0;
        
        console.log('🔄 DevGameLoop inicializado - Modo Desarrollo');
    }
    
    start(io, stateManager) {
        if (this.isRunning) return;
        
        this.io = io;
        this.stateManager = stateManager;
        this.chatManager = new ChatManager();
        this.spectatorManager = new SpectatorManager();
        
        this.isRunning = true;
        this.lastTick = Date.now();
        
        // Iniciar el bucle principal
        this.gameLoop();
        
        console.log('🔄 DevGameLoop iniciado a', this.tickRate, 'Hz - Sala Global');
    }
    
    stop() {
        this.isRunning = false;
        console.log('🔄 DevGameLoop detenido');
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        const now = Date.now();
        const deltaTime = now - this.lastTick;
        
        // Ejecutar tick si ha pasado el tiempo necesario
        if (deltaTime >= 1000 / this.tickRate) {
            this.tick(now);
            this.lastTick = now;
            this.tickCount++;
        }
        
        // Continuar el bucle
        setTimeout(() => this.gameLoop(), 16); // ~60fps para el bucle
    }
    
    tick(timestamp) {
        try {
            // 1. Procesar lógica del juego global
            this.processGameLogic(timestamp);
            
            // 2. Sincronizar estado global
            this.syncGlobalState(timestamp);
            
            // 3. Enviar deltas a los clientes
            this.sendStateDeltas(timestamp);
            
            // 4. Limpiar datos antiguos
            this.cleanupOldData(timestamp);
            
            // 5. Actualizar estadísticas
            this.updateStats(timestamp);
            
        } catch (error) {
            console.error('❌ Error en dev game loop:', error);
        }
    }
    
    processGameLogic(timestamp) {
        // Obtener estado global
        const globalState = this.stateManager.getGlobalState();
        
        if (!globalState || !globalState.players || globalState.players.size === 0) {
            return; // No hay jugadores, no procesar nada
        }
        
        // Procesar movimientos de jugadores
        this.processPlayerMovements(globalState, timestamp);
        
        // Procesar construcciones
        this.processBuildings(globalState, timestamp);
        
        // Procesar combate
        this.processCombat(globalState, timestamp);
        
        // Procesar exploración
        this.processExploration(globalState, timestamp);
        
        // Procesar recursos
        this.processResources(globalState, timestamp);
    }
    
    processPlayerMovements(globalState, timestamp) {
        // En un juego 4x, los imperios son estáticos, no se procesan movimientos
        // Solo asegurarse de que todos los jugadores tengan posición imperial establecida
        // Los jugadores ya tienen su posición establecida, no es necesario hacer nada adicional
    }
    
    processBuildings(globalState, timestamp) {
        // Solo generar buildings para NPCs, no para jugadores reales
        for (const [playerId, player] of globalState.players) {
            // Solo NPCs pueden construir buildings aleatorios
            if (!player.isNPC) continue;
            
            // Simular construcción aleatoria con menor frecuencia
            if (Math.random() < 0.01) { // Reducido a 1% de probabilidad de construcción por tick
                const buildingTypes = ['casa', 'granja', 'mina', 'cuartel'];
                const type = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
                
                // Encontrar la ciudad del NPC
                let npcCity = null;
                for (const [entityId, entity] of globalState.entities.entries()) {
                    if (entity.type === 'ciudad' && entity.owner === playerId) {
                        npcCity = entity;
                        break;
                    }
                }
                
                if (npcCity && npcCity.buildings) {
                    // Verificar si ya existe un building de este tipo en la ciudad
                    const existingBuilding = npcCity.buildings.find(b => b.type === type);
                    if (existingBuilding) {
                        console.log(`🏗️ NPC ${player.name} ya tiene un ${type} en su ciudad`);
                        continue; // No crear duplicados
                    }
                    
                    // Usar el método centralizado para crear buildings
                    this.stateManager.createOrUpdateBuilding(globalState, player, type, 1);
                    
                    console.log(`🏗️ NPC ${player.name} construyó un ${type}`);
                }
            }
        }
    }
    
    processCombat(globalState, timestamp) {
        const playerIds = Array.from(globalState.players.keys());
        
        for (const attackerId of playerIds) {
            // Simular ataque aleatorio
            if (Math.random() < 0.03) { // 3% de probabilidad de ataque por tick
                const targets = playerIds.filter(id => id !== attackerId);
                if (targets.length > 0) {
                    const targetId = targets[Math.floor(Math.random() * targets.length)];
                    const damage = Math.floor(Math.random() * 50) + 10;
                    
                    this.stateManager.processAction(this.globalRoomId, {
                        playerId: attackerId,
                        type: 'attack',
                        payload: {
                            target: targetId,
                            type: 'fisico',
                            damage: damage
                        },
                        timestamp: timestamp
                    });
                }
            }
        }
    }
    
    processExploration(globalState, timestamp) {
        for (const [playerId, player] of globalState.players) {
            // Simular exploración aleatoria
            if (Math.random() < 0.08) { // 8% de probabilidad de exploración por tick
                this.stateManager.processAction(this.globalRoomId, {
                    playerId: playerId,
                    type: 'explore',
                    payload: {
                        x: Math.floor(Math.random() * 50),
                        y: Math.floor(Math.random() * 50),
                        discovered: Math.random() < 0.3 // 30% de descubrir algo
                    },
                    timestamp: timestamp
                });
            }
        }
    }
    
    processResources(globalState, timestamp) {
        for (const [playerId, player] of globalState.players) {
            // Simular generación de recursos
            const resources = {
                comida: Math.floor(Math.random() * 10) + 5,
                madera: Math.floor(Math.random() * 8) + 3,
                piedra: Math.floor(Math.random() * 6) + 2,
                metal: Math.floor(Math.random() * 4) + 1
            };
            
            this.stateManager.processAction(this.globalRoomId, {
                playerId: playerId,
                type: 'resources',
                payload: resources,
                timestamp: timestamp
            });
        }
    }
    
    syncGlobalState(timestamp) {
        // Obtener estado global
        const globalState = this.stateManager.getGlobalState();
        
        if (!globalState || !globalState.players) {
            return;
        }
        
        // Sincronizar chat
        if (globalState.players.size > 0) {
            // Generar mensajes de sistema aleatorios (reducir frecuencia a 0.1% por tick)
            if (Math.random() < 0.001) { // 0.1% de probabilidad de mensaje de sistema
                const messages = [
                    'Un nuevo día comienza en el reino',
                    'Los recursos se regeneran en la tierra',
                    'Los exploradores regresan con noticias',
                    'El comercio florece entre las naciones',
                    'Los dragones se mueven en las montañas'
                ];
                
                const message = messages[Math.floor(Math.random() * messages.length)];
                
                this.chatManager.sendSystemMessage(this.globalRoomId, message);
                
                // Log system message occasionally for debugging
                if (!this.lastSystemMessageLog || Date.now() - this.lastSystemMessageLog > 300000) { // 5 minutos
                    console.log(`🤖 Sistema: ${message}`);
                    this.lastSystemMessageLog = Date.now();
                }
            }
        }
    }
    
    sendStateDeltas(timestamp) {
        // Obtener estado global
        const globalState = this.stateManager.getGlobalState();
        
        if (!globalState || !globalState.players || !globalState.spectators) {
            return; // Estado no disponible
        }
        
        if (globalState.players.size === 0 && globalState.spectators.size === 0) {
            return; // No hay jugadores ni espectadores
        }
        
        // Enviar deltas a jugadores
        for (const [playerId, player] of globalState.players) {
            const lastSequence = player.lastSequence || 0;
            const delta = this.stateManager.getStateDelta(this.globalRoomId, lastSequence);
            
            if (delta) {
                // Enviar al socket específico del jugador
                if (player.socket && player.socket.connected) {
                    player.socket.emit('stateDelta', delta);
                    player.lastSequence = delta.sequence;
                    
                    // Enviar mensajes de chat nuevos
                    const recentMessages = this.chatManager.getRecentMessages(this.globalRoomId, player.lastChatUpdate || 0);
                    if (recentMessages.length > 0) {
                        player.socket.emit('chatMessages', recentMessages);
                        player.lastChatUpdate = timestamp;
                    }
                }
            }
        }
        
        // Enviar deltas a espectadores
        for (const [spectatorId, spectator] of globalState.spectators) {
            const lastSequence = spectator.lastSequence || 0;
            const delta = this.stateManager.getStateDelta(this.globalRoomId, lastSequence);
            
            if (delta && spectator.socket && spectator.socket.connected) {
                spectator.socket.emit('stateDelta', delta);
                spectator.lastSequence = delta.sequence;
            }
        }
    }
    
    cleanupOldData(timestamp) {
        // Limpiar estados antiguos
        this.stateManager.cleanupOldStates(3600000); // 1 hora
        
        // Limpiar mensajes antiguos
        this.chatManager.cleanupOldMessages(86400000); // 24 horas
        
        // Limpiar espectadores inactivos
        // Limpiar espectadores inactivos (ignorar logs en modo desarrollo)
        this.spectatorManager.cleanupInactiveSpectators(300000); // 5 minutos
    }
    
    updateStats(timestamp) {
        // Obtener estado global
        const globalState = this.stateManager.getGlobalState();
        
        // Contar NPCs
        let npcCount = 0;
        globalState.players.forEach(player => {
            if (player.isNPC) npcCount++;
        });
        
        // Actualizar estadísticas del servidor
        const stats = {
            timestamp: timestamp,
            tick: this.tickCount,
            room: this.globalRoomId,
            players: globalState.players.size,
            npcs: npcCount,
            entities: globalState.entities.size,
            sequence: globalState.sequence,
            version: globalState.version,
            state: this.stateManager.getStats(),
            chat: this.chatManager.getGlobalChatStats(),
            spectators: this.spectatorManager.getTotalSpectatorCount()
        };
        
        // Enviar estadísticas a panel de admin
        if (this.io) {
            this.io.emit('serverStats', stats);
            this.io.emit('globalState', globalState);
        }
        
        // Loggear estadísticas cada 3000 ticks (~3 minutos) para reducir spam
        if (this.tickCount % 3000 === 0) {
            console.log('📊 Estadísticas del servidor (Modo Desarrollo):', {
                room: this.globalRoomId,
                players: stats.players,
                npcs: stats.npcs,
                entities: stats.entities,
                uptime: Math.floor(timestamp / 1000) + 's'
            });
        }
    }
    
    getStats() {
        return {
            isRunning: this.isRunning,
            tickRate: this.tickRate,
            tickCount: this.tickCount,
            lastTick: this.lastTick,
            uptime: this.isRunning ? Date.now() - this.lastTick : 0,
            room: this.globalRoomId
        };
    }
}

// Función para iniciar el dev game loop
function start(io, stateManager) {
    const devGameLoop = new DevGameLoop();
    devGameLoop.start(io, stateManager);
    return devGameLoop;
}

module.exports = {
    DevGameLoop,
    start
};