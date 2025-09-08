const StateManager = require('./StateManager');
const ChatManager = require('./ChatManager');
const SpectatorManager = require('./SpectatorManager');

class DevGameServer {
    constructor(io, stateManager, chatManager, spectatorManager) {
        this.io = io;
        this.stateManager = stateManager;
        this.chatManager = chatManager;
        this.spectatorManager = spectatorManager;
        
        // Single global room ID for development
        this.globalRoomId = 'dev_global';
        this.lastGlobalStateUpdate = 0;
        this.lastUnknownActionLog = 0;
        
        console.log('🎮 DevGameServer inicializado - Modo Desarrollo sin salas');
    }
    
    handleConnection(socket) {
        console.log(`🔗 Nueva conexión: ${socket.id}`);
        
        // Manejar unirse al servidor global
        socket.on('join', async (data, callback) => {
            try {
                const result = await this.handleJoin(socket, data);
                if (callback) {
                    callback(result);
                } else {
                    socket.emit('joinResponse', result);
                }
            } catch (error) {
                if (callback) {
                    callback({ success: false, error: error.message });
                } else {
                    socket.emit('error', { code: 'JOIN_FAILED', message: error.message });
                }
            }
        });
        
        // Manejar unirse como espectador
        socket.on('joinSpectator', async (data, callback) => {
            try {
                const result = await this.handleJoinSpectator(socket, data);
                if (callback) {
                    callback(result);
                } else {
                    socket.emit('joinResponse', result);
                }
            } catch (error) {
                if (callback) {
                    callback({ success: false, error: error.message });
                } else {
                    socket.emit('error', { code: 'JOIN_FAILED', message: error.message });
                }
            }
        });
        
        // Manejar acciones de jugadores
        socket.on('action', (data) => {
            this.handleAction(socket, data);
        });
        
        // Manejar guardado de posiciones
        socket.on('savePosition', (data) => {
            this.handleSavePosition(socket, data.playerId, data.position);
        });
        // Manejar solicitud de posición guardada
        socket.on('getSavedPosition', (data) => {
            this.handleGetSavedPosition(socket, data.playerId);
        });
        
        // Manejar solicitud de datos del mapa
        socket.on('getMapData', (data) => {
            this.handleGetMapData(socket, data.playerId);
        });
        
        
        // Manejar mensajes de chat
        socket.on('chatMessage', (data) => {
            this.handleChatMessage(socket, data);
        });
        
        // Manejar ping/heartbeat
        socket.on('ping', (data) => {
            socket.emit('pong', { ts: Date.now() });
        });
        
        // Manejar comandos de admin
        socket.on('adminCommand', (data) => {
            this.handleAdminCommand(socket, data);
        });
        
        // Manejar notificaciones de admin
        socket.on('adminNotification', (data) => {
            this.handleAdminNotification(socket, data);
        });
        
        // Manejar comandos del panel de admin
        socket.on('adminPanelCommand', (data) => {
            this.handleAdminPanelCommand(socket, data);
        });
        
        // Enviar estado inicial
        this.sendWelcome(socket);

        // Manejar solicitud de salas
        socket.on('getRooms', () => {
            this.handleGetRooms(socket);
        });

        // Manejar solicitud de estado global
        socket.on('getGlobalState', () => {
            this.handleGetGlobalState(socket);
        });
    }
    
    async handleJoin(socket, data) {
        const { playerId, name, preferredPosition } = data;
        
        // console.log(`👤 Jugador ${name} (${playerId}) intentando unirse al servidor global`);
        // console.log(`📍 Posición preferida:`, preferredPosition);
        
        // Verificar si hay espacio disponible (límite global)
        const globalState = this.stateManager.getRoomState(this.globalRoomId);
        if (globalState.players.size >= 50) {
            throw new Error('Servidor lleno (máximo 50 jugadores)');
        }
        
        // Limpiar imperios huérfanos antes de procesar el nuevo join
        this.stateManager.cleanOrphanedEmpires();
        
        // Agregar jugador usando la lógica del StateManager (manejará imperio existente o nuevo)
        this.stateManager.addPlayer(this.globalRoomId, {
            id: playerId,
            name: name,
            isAdmin: this.isAdminPlayer(name, playerId),
            type: 'player',
            isNPC: false,
            position: preferredPosition  // Pasar posición preferida; StateManager validará y manejará creación de imperio
        });
        
        // Si no hay datos de mapa, generarlos ahora
        if (!this.stateManager.getMapData()) {
            this.stateManager.generateAndSaveMapData();
        }
        
        // Obtener el jugador agregado para detalles
        const addedPlayer = globalState.players.get(playerId);
        const spawnPosition = addedPlayer ? addedPlayer.position : preferredPosition || { x: 0, y: 0 };
        const hasEmpire = true;  // Siempre tiene imperio después de addPlayer
        
        // console.log(`👤 Jugador ${name} (${playerId}) agregado en (${spawnPosition.x}, ${spawnPosition.y}) con imperio`);
        
        // DEBUG: Log player count after adding
        const stateAfterAdd = this.stateManager.getRoomState(this.globalRoomId);
        // console.log(`[DEBUG] Players after adding ${name}: ${stateAfterAdd.players.size}`);
        
        // Update global state for admin panel
        this.io.emit('globalState', {
            players: stateAfterAdd.players.size,
            entities: stateAfterAdd.entities.size,
            npcs: Array.from(stateAfterAdd.players.values()).filter(p => p.isNPC).length,
            sequence: this.stateManager.getCurrentSequence(),
            timestamp: Date.now()
        });
        
        // Enviar snapshot inicial del servidor global
        const snapshot = this.stateManager.getRoomSnapshot(this.globalRoomId);
        
        // Notificar a todos los clientes (incluyendo admin panel)
        this.io.emit('playerJoined', {
            playerId,
            name,
            isAdmin: this.isAdminPlayer(name, playerId),
            position: spawnPosition,
            hasEmpire: hasEmpire,
            roomId: this.globalRoomId
        });
        
        return {
            success: true,
            roomId: this.globalRoomId,
            playerId,
            isAdmin: this.isAdminPlayer(name, playerId),
            hasEmpire: hasEmpire,
            snapshot
        };
    }
    
    // Validar si una posición es válida para spawn (usar StateManager's validation)
    isValidPosition(position) {
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return false;
        }
        
        return this.stateManager.isValidSpawnPosition(position);
    }
    
    // Método para encontrar una posición alternativa de spawn cercana a la posición deseada (deprecated, use StateManager)
    findAlternativeSpawnPosition(mapData, preferredPosition, maxRadius = 5) {
        // StateManager maneja validación, pero mantener para compatibilidad si needed
        return this.stateManager.generateValidSpawnPosition();
    }
    
    // Método para generar posición determinística basada en name (estable)
    generateDeterministicPosition(name) {
        // Generate a consistent position based on player name to ensure
        // the same player always spawns in the same place
        try {
            let seed = 0;
            for (let i = 0; i < name.length; i++) {
                seed += name.charCodeAt(i);
            }
            
            // Use seed to generate consistent coordinates
            const rng = (seed) => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
            
            const x = Math.floor(rng(seed) * 50);
            const y = Math.floor(rng(seed + 1) * 50);
            
            const position = { x, y };
            console.log(`🎲 Generated deterministic position for ${name}:`, position);
            
            return position;
        } catch (error) {
            console.error('Error generating deterministic position:', error);
            return null;
        }
    }
    
    
    // Método para limpiar imperios huérfanos (ciudades sin jugador asociado)
    cleanOrphanedEmpires() {
        try {
            const state = this.stateManager.getGlobalState();
            const mapData = state.mapData;
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            
            if (!mapData) {
                console.log('🗺️ No hay datos de mapa disponibles para limpiar imperios huérfanos');
                return;
            }
            
            let cleanedCount = 0;
            const activePlayerNames = new Set(Array.from(globalState.players.values()).map(p => p.name));
            
            // Buscar en todo el mapa ciudades que no tengan jugador activo asociado
            for (let y = 0; y < mapData.length; y++) {
                for (let x = 0; x < mapData[y].length; x++) {
                    const tile = mapData[y][x];
                    if (tile.type === 'ciudad' && tile.owner) {
                        // Si el propietario no está en la lista de jugadores activos, limpiar la ciudad
                        if (!activePlayerNames.has(tile.owner)) {
                            console.log(`🧹 Limpiando imperio huérfano en (${x}, ${y}) perteneciente a ${tile.owner}`);
                            
                            // Convertir de vuelta a terreno neutral (llanura)
                            mapData[y][x] = {
                                type: 'llanura',
                                owner: null,
                                troops: { milicia: 0, archer: 0, cavalry: 0 },
                                resources: { food: 10, wood: 10, stone: 10, metal: 10 }
                            };
                            
                            // Limpiar posición guardada del jugador huérfano
                            this.stateManager.removeSavedPlayerPosition(tile.owner);
                            
                            cleanedCount++;
                        }
                    }
                }
            }
            
            // Limpiar entidades de ciudades huérfanas
            let entityCleanedCount = 0;
            for (const [entityId, entity] of state.entities.entries()) {
                if (entity.type === 'ciudad' && !activePlayerNames.has(entity.owner)) {
                    console.log(`🗑️ Eliminando entidad de imperio huérfano: ${entityId} de ${entity.owner}`);
                    state.entities.delete(entityId);
                    entityCleanedCount++;
                }
            }
            
            if (cleanedCount > 0 || entityCleanedCount > 0) {
                this.stateManager.syncEntitiesToMap();
                this.stateManager.savePersistentState();
                console.log(`🧹 ${cleanedCount} tiles y ${entityCleanedCount} entidades huérfanas limpiadas`);
            } else {
                console.log(`✅ No se encontraron imperios huérfanos`);
            }
        } catch (error) {
            console.error('❌ Error limpiando imperios huérfanos:', error);
        }
    }
    
    async handleJoinSpectator(socket, data) {
        const { playerId } = data;
        
        // console.log(`👁️ Espectador ${playerId} intentando unirse al servidor global`);
        
        // Agregar espectador
        const spectator = {
            id: playerId,
            socket: socket,
            joinedAt: Date.now()
        };
        
        socket.join(this.globalRoomId);
        socket.currentRoom = this.globalRoomId;
        socket.playerId = playerId;
        socket.isSpectator = true;
        
        // console.log(`✅ Espectador ${playerId} unido al servidor global`);
        
        // Enviar snapshot inicial
        const snapshot = this.stateManager.getRoomSnapshot(this.globalRoomId);
        
        return {
            success: true,
            roomId: this.globalRoomId,
            playerId,
            isSpectator: true,
            snapshot
        };
    }
    
    handleAction(socket, data) {
        if (!socket.currentRoom) return;
        
        const { playerId, type, payload, ts } = data;
        
        // Validar que el jugador está en el servidor
        if (socket.playerId !== playerId) {
            console.warn(`⚠️ Intento de acción no autorizada: ${playerId}`);
            return;
        }
        
        // Handle known action types
        switch (type) {
            case 'playerMove':
                this.handlePlayerMove(socket, playerId, payload);
                break;
                
            case 'resources':
                // Silently handle resource actions (likely from game systems)
                // These are probably legitimate game actions that don't need server processing
                break;
                
            case 'chatMessage':
                this.handleChatMessage(socket, data);
                break;
                
            case 'ping':
                socket.emit('pong', { ts: Date.now() });
                break;
                
            case 'savePosition':
                this.handleSavePosition(socket, playerId, payload);
                break;
                
            default:
                // Log unknown actions occasionally for debugging
                if (!this.lastUnknownActionLog || Date.now() - this.lastUnknownActionLog > 30000) {
                    console.log(`📝 Unknown action received: ${type} from ${playerId}`);
                    this.lastUnknownActionLog = Date.now();
                }
                break;
        }
        
        // Update global state for admin panel (limit frequency to avoid spam)
        if (!this.lastGlobalStateUpdate || Date.now() - this.lastGlobalStateUpdate > 1000) {
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            this.io.emit('globalState', {
                players: globalState.players.size,
                entities: globalState.entities.size,
                npcs: Array.from(globalState.players.values()).filter(p => p.isNPC).length,
                sequence: this.stateManager.getCurrentSequence(),
                timestamp: Date.now()
            });
            this.lastGlobalStateUpdate = Date.now();
        }
    }
    
    // Handle player movement and position updates
    handlePlayerMove(socket, playerId, payload) {
        try {
            const { x, y } = payload;
            
            // Validar la posición
            if (typeof x !== 'number' || typeof y !== 'number') {
                console.warn(`⚠️ Posición inválida recibida de ${playerId}:`, payload);
                return;
            }
            
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);
            
            if (!player) {
                console.warn(`⚠️ Jugador no encontrado: ${playerId}`);
                return;
            }
            
            // Actualizar la posición del jugador
            const oldPosition = { ...player.position };
            player.position = { x, y };
            player.lastPosition = { x, y }; // Guardar última posición para persistencia
            player.lastActivity = Date.now();
            
            // console.log(`🏃 Jugador ${player.name} se movió: (${oldPosition.x}, ${oldPosition.y}) → (${x}, ${y})`);
            
            // Guardar posición para persistencia en el servidor (última posición conocida)
            this.stateManager.savePlayerPosition(player.name, { x, y });
            
            // Notificar a todos los jugadores sobre el movimiento
            this.io.to(this.globalRoomId).emit('playerMoved', {
                playerId: playerId,
                playerName: player.name,
                from: oldPosition,
                to: { x, y },
                timestamp: Date.now()
            });
            
            // Notificar al jugador que su posición fue guardada
            socket.emit('positionSaved', {
                success: true,
                position: { x, y },
                persistent: true,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error(`❌ Error al manejar movimiento del jugador ${playerId}:`, error);
        }
    }
    
    // Handle position save requests
    handleSavePosition(socket, playerId, payload) {
        try {
            const { x, y, persistent = false } = payload;
            
            // Validar la posición
            if (typeof x !== 'number' || typeof y !== 'number') {
                console.warn(`⚠️ Posición inválida recibida para guardar de ${playerId}:`, payload);
                return;
            }
            
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);
            
            if (!player) {
                console.warn(`⚠️ Jugador no encontrado para guardar posición: ${playerId}`);
                return;
            }
            
            // Actualizar la posición del jugador
            player.position = { x, y };
            player.lastPosition = { x, y };
            player.lastActivity = Date.now();
            
            // Si es una posición persistente, guardarla en el estado persistente
            if (persistent) {
                this.stateManager.savePlayerPosition(player.name, { x, y });
                // console.log(`💾 Posición persistente guardada para ${player.name}: (${x}, ${y})`);
            } else {
                // console.log(`💾 Posición temporal guardada para ${player.name}: (${x}, ${y})`);
            }
            
            // Notificar al jugador que su posición fue guardada
            socket.emit('positionSaved', {
                success: true,
                position: { x, y },
                persistent: persistent,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error(`❌ Error al guardar posición para ${playerId}:`, error);
            socket.emit('positionSaved', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
    
    // Handle map data requests
    handleGetMapData(socket, playerId) {
        try {
            // Get map data from state manager
            const mapData = this.stateManager.getMapData();
            
            // Send map data to client
            socket.emit('mapData', {
                success: true,
                mapData: mapData,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error(`❌ Error handling map data request for ${playerId}:`, error);
            socket.emit('mapData', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
    
    // Handle get saved position requests
    handleGetSavedPosition(socket, playerId) {
        try {
            // Get the player to get the name
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);
            if (!player) {
                throw new Error('Player not found');
            }
            const playerName = player.name;
            
            // Get saved position from state manager using name
            const savedPosition = this.stateManager.getSavedPlayerPosition(playerName);
            
            // Send saved position to client
            socket.emit('savedPosition', {
                success: true,
                position: savedPosition,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error(`❌ Error handling get saved position request for ${playerId}:`, error);
            socket.emit('savedPosition', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
    
    // Add a method to handle unknown actions silently
    handleUnknownAction(socket, data) {
        // Silently ignore unknown actions to reduce log spam
        // Only log unknown actions occasionally for debugging
        if (!this.lastUnknownActionLog || Date.now() - this.lastUnknownActionLog > 30000) {
            console.log(`📝 Unknown action received: ${data.type} from ${data.playerId}`);
            this.lastUnknownActionLog = Date.now();
        }
    }
    
    handleChatMessage(socket, data) {
        if (!socket.currentRoom) return;
        
        const { playerId, text, ts, channel = 'mundo' } = data;
        
        // Validar que el jugador está en el servidor
        if (socket.playerId !== playerId) {
            return;
        }
        
        // Procesar mensaje de chat
        const message = {
            from: socket.room?.players?.get(playerId)?.name || playerId,
            text,
            ts,
            channel,
            type: 'player'
        };
        
        // Enviar mensaje a todos en el servidor global
        this.io.to(this.globalRoomId).emit('chatMessage', message);
        
        // Guardar mensaje en el historial
        this.chatManager.addMessage(this.globalRoomId, message);
    }
    
    handleAdminCommand(socket, data) {
        if (!socket.currentRoom || !socket.isAdmin) return;
        
        const { action, target, message, adminId, ts } = data;
        
        // console.log(`👑 Comando de admin: ${action} por ${adminId}`);
        
        switch (action) {
            case 'kick':
                this.kickPlayer(target);
                break;
            case 'broadcast':
                this.broadcastMessage(message);
                break;
            case 'list_players':
                this.listPlayers(socket);
                break;
            default:
                console.warn(`⚠️ Comando de admin desconocido: ${action}`);
        }
    }
    
    // Método para manejar comandos de admin desde el panel de admin
    handleAdminPanelCommand(socket, data) {
        const { action, playerName, playerType, position, target, message, adminId, ts, roomId } = data;

        // console.log(`👑 Comando de admin panel: ${action} por ${adminId}`);

        // Enviar respuesta inicial de procesamiento
        socket.emit('adminPanelResponse', {
            success: true,
            message: `Comando ${action} recibido`,
            adminId: adminId,
            ts: ts
        });

        switch (action) {
            case 'kick_all':
                this.kickAllPlayers();
                break;
            case 'global_broadcast':
                this.globalBroadcast(message);
                break;
            case 'get_server_stats':
                this.sendServerStats(socket);
                break;
            case 'add_player':
                this.handleAddPlayer({ playerName, playerType, position }, adminId);
                break;
            case 'add_npc':
                // Parse the NPC data from message field or use direct parameters
                try {
                    let npcData;
                    if (typeof message === 'string') {
                        try {
                            npcData = JSON.parse(message);
                        } catch (e) {
                            // If parsing fails, use direct parameters
                            npcData = {
                                npcName: playerName,
                                npcType: playerType || 'npc',
                                position: position
                            };
                        }
                    } else {
                        npcData = message || {
                            npcName: playerName,
                            npcType: playerType || 'npc',
                            position: position
                        };
                    }
                    
                    // Ensure we have the NPC name
                    if (!npcData.npcName || npcData.npcName.trim() === '') {
                        throw new Error('El nombre del NPC no puede estar vacío');
                    }
                    
                    this.handleAddNPC(npcData, adminId);
                } catch (error) {
                    console.error('❌ Error al procesar datos de NPC:', error);
                    socket.emit('adminPanelResponse', {
                        success: false,
                        message: `Error al procesar datos de NPC: ${error.message}`,
                        adminId: adminId,
                        ts: Date.now()
                    });
                }
                break;
            case 'remove_player':
                this.handleRemovePlayer(playerName, adminId);
                break;
            case 'get_room_players':
                this.handleGetPlayers(socket, adminId);
                break;
            case 'remove_npc':
                this.handleRemoveNPC(target, adminId);
                break;
            case 'get_npcs':
                this.handleGetNPCs(socket, adminId);
                break;
            case 'get_player_data':
                this.handleGetPlayerData(socket, data.playerId, adminId);
                break;
            case 'edit_player':
                this.handleEditPlayer(socket, data.playerId, data.updatedData, adminId);
                break;
            default:
                console.warn(`⚠️ Comando de admin panel desconocido: ${action}`);
                socket.emit('adminPanelResponse', {
                    success: false,
                    message: `Comando desconocido: ${action}`,
                    adminId: adminId,
                    ts: ts
                });
        }
    }
    
    kickAllPlayers() {
        let kickedCount = 0;
        
        // Obtener estado global
        const globalState = this.stateManager.getRoomState(this.globalRoomId);
        
        for (const [playerId, player] of globalState.players) {
            // console.log(`👑 Expulsando a ${player.name} del servidor global`);
            player.socket.emit('kicked', { reason: 'Expulsado por admin' });
            player.socket.leave(this.globalRoomId);
            globalState.players.delete(player.id);
            kickedCount++;
        }
        
        // console.log(`👑 ${kickedCount} jugadores expulsados`);
        
        // Notificar a todos los clientes que los jugadores fueron expulsados
        this.io.emit('serverMessage', {
            from: 'Sistema',
            text: `El administrador ha expulsado a ${kickedCount} jugadores`,
            type: 'admin_notification'
        });
    }
    
    globalBroadcast(message) {
        if (!message || message.trim() === '') {
            console.warn('⚠️ Intento de broadcast con mensaje vacío');
            return;
        }
        
        // console.log(`📢 Broadcast global: ${message}`);
        
        const broadcastMessage = {
            from: '👑 Admin',
            text: message,
            ts: Date.now(),
            type: 'admin_notification'
        };
        
        // Enviar mensaje a todos los clientes conectados
        this.io.emit('chatMessage', broadcastMessage);
        
        // También guardar en el chat global
        this.chatManager.addToGlobalChat(broadcastMessage);
        
        // console.log(`📢 Broadcast enviado a ${this.io.sockets.sockets.size} clientes`);
    }
    
    sendServerStats(socket) {
        const globalState = this.stateManager.getRoomState(this.globalRoomId);
        const stats = {
            players: globalState.players.size,
            entities: globalState.entities.size,
            state: this.stateManager.getStats(),
            chat: this.chatManager.getGlobalChatStats(),
            spectators: this.spectatorManager.getTotalSpectatorCount()
        };
        
        socket.emit('serverStats', stats);
    }
    
    handleAdminNotification(socket, data) {
        if (!socket.currentRoom || !socket.isAdmin) return;
        
        const { adminAction, ts } = data;
        
        // Enviar notificación a todos en el servidor global
        this.io.to(this.globalRoomId).emit('adminNotification', {
            text: `👑 Admin: ${adminAction}`,
            type: 'admin_notification'
        });
    }
    
    kickPlayer(targetName) {
        const globalState = this.stateManager.getRoomState(this.globalRoomId);
        
        let targetPlayer = null;
        for (const [playerId, player] of globalState.players) {
            if (player.name === targetName) {
                targetPlayer = player;
                break;
            }
        }
        
        if (targetPlayer) {
            // console.log(`👑 Expulsando a ${targetName} del servidor global`);
            targetPlayer.socket.emit('kicked', { reason: 'Expulsado por admin' });
            targetPlayer.socket.leave(this.globalRoomId);
            globalState.players.delete(targetPlayer.id);
            
            // Notificar a otros jugadores
            targetPlayer.socket.to(this.globalRoomId).emit('playerKicked', {
                playerName: targetName,
                kickedBy: 'Admin'
            });
        }
    }
    
    broadcastMessage(message) {
        // console.log(`📢 Broadcast en servidor global: ${message}`);
        
        this.io.to(this.globalRoomId).emit('chatMessage', {
            from: '👑 Admin',
            text: message,
            ts: Date.now(),
            type: 'admin_notification'
        });
    }
    
    listPlayers(socket) {
        const globalState = this.stateManager.getRoomState(this.globalRoomId);
        const players = Array.from(globalState.players.values()).map(p => ({
            name: p.name,
            id: p.id,
            isAdmin: p.isAdmin,
            joinedAt: p.joinedAt
        }));
        
        socket.emit('playerList', { players });
    }
    
    sendWelcome(socket) {
        socket.emit('welcome', {
            serverTime: Date.now(),
            you: {
                id: socket.id,
                connected: true
            },
            roomSnapshotMin: {},
            sessionToken: `session_${socket.id}_${Date.now()}`
        });
    }
    
    isAdminPlayer(name, playerId) {
        // Solo Rey Theron o player_123 pueden ser admin
        return name === 'Rey Theron' || playerId === 'player_123';
    }
    
    handleDisconnect(socket) {
        // console.log(`🔌 Cliente desconectado: ${socket.id}`);
        
        if (socket.currentRoom) {
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            if (globalState) {
                // Remover jugador o espectador
                if (socket.isSpectator) {
                    // Los espectadores no se almacenan en el estado del juego
                    socket.leave(this.globalRoomId);
                } else {
                    // Eliminar jugador del estado global
                    this.stateManager.removePlayer(this.globalRoomId, socket.playerId);
                    
                    // Notificar a todos los clientes (incluyendo admin panel)
                    this.io.emit('playerLeft', {
                        playerId: socket.playerId,
                        name: socket.room?.players?.get(socket.playerId)?.name || socket.playerId,
                        roomId: this.globalRoomId
                    });
                    
                    // DEBUG: Log player count after removal
                    // console.log(`[DEBUG] Players after disconnect: ${globalState.players.size}`);
                    
                    // Update global state for admin panel
                    this.io.emit('globalState', {
                        players: globalState.players.size,
                        entities: globalState.entities.size,
                        npcs: Array.from(globalState.players.values()).filter(p => p.isNPC).length,
                        sequence: this.stateManager.getCurrentSequence(),
                        timestamp: Date.now()
                    });
                }
            }
        }
    }
    
    // Métodos para manejar jugadores desde el panel de admin
    handleAddPlayer(playerData, adminId) {
        try {
            const { playerName, playerType = 'player', position } = playerData;
            
            // Generar ID único para el jugador
            const playerId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Agregar jugador al estado del juego con spawn aleatorio
            const spawnPosition = this.stateManager.generateValidSpawnPosition();
            
            this.stateManager.addPlayer(this.globalRoomId, {
                id: playerId,
                name: playerName,
                type: playerType,
                position: spawnPosition,
                isAdmin: false,
                isNPC: false
            });
            
            // console.log(`👤 Jugador ${playerName} (${playerType}) spawn en (${spawnPosition.x}, ${spawnPosition.y})`);
            
            // Notificar a todos los clientes (incluyendo admin panel)
            this.io.emit('playerJoined', {
                playerId,
                name: playerName,
                type: playerType,
                position: position || { x: 25, y: 25 },
                isAdmin: false,
                isNPC: false,
                roomId: this.globalRoomId
            });
            
            // Enviar respuesta exitosa
            this.io.emit('adminPanelResponse', {
                success: true,
                message: `Jugador ${playerName} agregado exitosamente`,
                adminId: adminId,
                ts: Date.now()
            });
            
            // console.log(`✅ Jugador ${playerName} (${playerType}) agregado al servidor global`);
            
        } catch (error) {
            console.error(`❌ Error al agregar jugador: ${error.message}`);
            this.io.emit('adminPanelResponse', {
                success: false,
                message: `Error al agregar jugador: ${error.message}`,
                adminId: adminId,
                ts: Date.now()
            });
        }
    }
    
    handleRemovePlayer(playerName, adminId) {
        try {
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            
            // Buscar y eliminar el jugador
            const playerIndex = Array.from(globalState.players.values()).findIndex(p => p.name === playerName);
            if (playerIndex === -1) {
                this.io.emit('adminPanelResponse', {
                    success: false,
                    message: 'Jugador no encontrado',
                    adminId: adminId,
                    ts: Date.now()
                });
                return;
            }
            
            const player = Array.from(globalState.players.values())[playerIndex];
            globalState.players.delete(player.id);
            
            // Notificar a todos los clientes (incluyendo admin panel)
            this.io.emit('playerLeft', {
                playerId: player.id,
                name: player.name,
                type: player.type,
                roomId: this.globalRoomId
            });
            
            // Enviar respuesta exitosa
            this.io.emit('adminPanelResponse', {
                success: true,
                message: `Jugador ${playerName} eliminado exitosamente`,
                adminId: adminId,
                ts: Date.now()
            });
            
            // console.log(`🗑️ Jugador ${playerName} eliminado del servidor global`);
            
        } catch (error) {
            console.error(`❌ Error al eliminar jugador: ${error.message}`);
            this.io.emit('adminPanelResponse', {
                success: false,
                message: `Error al eliminar jugador: ${error.message}`,
                adminId: adminId,
                ts: Date.now()
            });
        }
    }
    
    handleGetPlayers(socket, adminId) {
        try {
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            
            // Enviar lista de jugadores
            socket.emit('adminPanelResponse', {
                success: true,
                action: 'get_room_players',
                roomId: this.globalRoomId,
                players: Array.from(globalState.players.values()),
                adminId: adminId,
                ts: Date.now()
            });
            
        } catch (error) {
            console.error(`❌ Error al obtener jugadores: ${error.message}`);
            socket.emit('adminPanelResponse', {
                success: false,
                action: 'get_room_players',
                message: `Error al obtener jugadores: ${error.message}`,
                adminId: adminId,
                ts: Date.now()
            });
        }
    }
    
    // Métodos para manejar NPCs
    handleAddNPC(npcData, adminId) {
        try {
            const { npcName, npcType = 'npc', position } = npcData;
            
            // Validar datos del NPC
            if (!npcName || npcName.trim() === '') {
                throw new Error('El nombre del NPC no puede estar vacío');
            }
            
            // Validar que el nombre no exista ya
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const existingPlayer = Array.from(globalState.players.values()).find(p => p.name === npcName);
            if (existingPlayer) {
                throw new Error(`Ya existe un jugador o NPC con el nombre "${npcName}"`);
            }
            
            console.log(`🎮 Iniciando creación de NPC: ${npcName} (tipo: ${npcType})`);
            
            // Generar ID único para el NPC
            const npcId = `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Siempre generar spawn aleatorio para NPCs
            console.log(`🎲 Buscando posición de spawn para NPC ${npcName}...`);
            const spawnPosition = this.stateManager.generateValidSpawnPosition(npcId);
            
            if (!spawnPosition) {
                throw new Error('No se pudo encontrar una posición válida de spawn para el NPC');
            }
            
            console.log(`✅ Posición de encontrada para NPC ${npcName}: (${spawnPosition.x}, ${spawnPosition.y})`);
            
            // Agregar NPC al estado del juego
            console.log(`📝 Agregando NPC ${npcName} al estado del juego...`);
            this.stateManager.addPlayer(this.globalRoomId, {
                id: npcId,
                name: npcName,
                type: npcType,
                position: spawnPosition,
                isAdmin: false,
                isNPC: true,
                joinedAt: Date.now(),
                lastActivity: Date.now()
            });
            
            // Verificar que el NPC fue agregado correctamente
            const addedNPC = globalState.players.get(npcId);
            if (!addedNPC) {
                throw new Error('Error al agregar NPC al estado del juego - NPC no encontrado después de la agregación');
            }
            
            console.log(`👺 NPC ${npcName} (${npcType}) agregado exitosamente en (${spawnPosition.x}, ${spawnPosition.y})`);
            
            // Notificar a todos los clientes (incluyendo admin panel)
            console.log(`📡 Notificando a todos los clientes sobre el nuevo NPC...`);
            this.io.emit('playerJoined', {
                playerId: npcId,
                name: npcName,
                type: npcType,
                position: spawnPosition,
                isAdmin: false,
                isNPC: true,
                roomId: this.globalRoomId
            });
            
            // Enviar respuesta exitosa con la posición real asignada
            console.log(`📤 Enviando respuesta exitosa al panel de admin...`);
            this.io.emit('adminPanelResponse', {
                success: true,
                message: `NPC ${npcName} agregado exitosamente en posición (${spawnPosition.x}, ${spawnPosition.y})`,
                adminId: adminId,
                ts: Date.now(),
                action: 'add_npc',
                npcData: {
                    id: npcId,
                    name: npcName,
                    type: npcType,
                    position: spawnPosition
                }
            });
            
            console.log(`✅ NPC ${npcName} (${npcType}) agregado completamente al servidor global`);
            
        } catch (error) {
            console.error(`❌ Error al agregar NPC: ${error.message}`);
            console.error(`🔍 Detalles del error:`, error.stack);
            
            this.io.emit('adminPanelResponse', {
                success: false,
                message: `Error al agregar NPC: ${error.message}`,
                adminId: adminId,
                ts: Date.now(),
                action: 'add_npc',
                error: error.message
            });
        }
    }
    
    handleRemoveNPC(npcName, adminId) {
        try {
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            
            // Buscar y eliminar el NPC
            const npc = Array.from(globalState.players.values()).find(p => p.name === npcName && p.isNPC);
            if (!npc) {
                this.io.emit('adminPanelResponse', {
                    success: false,
                    message: 'NPC no encontrado',
                    adminId: adminId,
                    ts: Date.now()
                });
                return;
            }
            
            globalState.players.delete(npc.id);
            
            // Notificar a todos los clientes (incluyendo admin panel)
            this.io.emit('playerLeft', {
                playerId: npc.id,
                name: npc.name,
                type: npc.type,
                roomId: this.globalRoomId
            });
            
            // Enviar respuesta exitosa
            this.io.emit('adminPanelResponse', {
                success: true,
                message: `NPC ${npcName} eliminado exitosamente`,
                adminId: adminId,
                ts: Date.now()
            });
            
            // console.log(`🗑️ NPC ${npcName} eliminado del servidor global`);
            
        } catch (error) {
            console.error(`❌ Error al eliminar NPC: ${error.message}`);
            this.io.emit('adminPanelResponse', {
                success: false,
                message: `Error al eliminar NPC: ${error.message}`,
                adminId: adminId,
                ts: Date.now()
            });
        }
    
    }
    
    handleGetNPCs(socket, adminId) {
        try {
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            
            // Filtrar solo NPCs
            const npcs = Array.from(globalState.players.values()).filter(p => p.isNPC);
            
            // Enviar lista de NPCs
            socket.emit('adminPanelResponse', {
                success: true,
                action: 'get_npcs',
                npcs: npcs,
                adminId: adminId,
                ts: Date.now()
            });
            
        } catch (error) {
            console.error(`❌ Error al obtener NPCs: ${error.message}`);
            socket.emit('adminPanelResponse', {
                success: false,
                action: 'get_npcs',
                message: `Error al obtener NPCs: ${error.message}`,
                adminId: adminId,
                ts: Date.now()
            });
        }
    }

    handleGetRooms(socket) {
        try {
            // En modo desarrollo, solo hay una sala global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const rooms = [{
                id: this.globalRoomId,
                playerCount: globalState.players.size,
                maxPlayers: 50,
                isGlobal: true,
                name: 'Sala Global (Modo Desarrollo)'
            }];

            socket.emit('roomList', { rooms });
        } catch (error) {
            console.error(`❌ Error al obtener salas: ${error.message}`);
            socket.emit('error', { message: `Error al obtener salas: ${error.message}` });
        }
    }

    handleGetGlobalState(socket) {
        try {
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            socket.emit('globalState', {
                players: globalState.players.size,
                entities: globalState.entities.size,
                npcs: Array.from(globalState.players.values()).filter(p => p.isNPC).length,
                sequence: this.stateManager.getCurrentSequence()
            });
        } catch (error) {
            console.error(`❌ Error al obtener estado global: ${error.message}`);
            socket.emit('error', { message: `Error al obtener estado global: ${error.message}` });
        }
    }
    
    // Métodos para manejar edición de jugadores
    handleGetPlayerData(socket, playerId, adminId) {
        try {
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);
            
            if (player) {
                socket.emit('playerData', {
                    success: true,
                    player: player,
                    adminId: adminId,
                    ts: Date.now()
                });
                // console.log(`📄 Datos del jugador ${player.name} enviados para edición`);
            } else {
                socket.emit('playerData', {
                    success: false,
                    message: 'Jugador no encontrado',
                    adminId: adminId,
                    ts: Date.now()
                });
                // console.warn(`⚠️ Jugador no encontrado para edición: ${playerId}`);
            }
        } catch (error) {
            console.error(`❌ Error al obtener datos del jugador: ${error.message}`);
            socket.emit('playerData', {
                success: false,
                message: `Error al obtener datos del jugador: ${error.message}`,
                adminId: adminId,
                ts: Date.now()
            });
        }
    }
    
    handleEditPlayer(socket, playerId, updatedData, adminId) {
        try {
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);
            
            if (!player) {
                socket.emit('adminPanelResponse', {
                    success: false,
                    message: 'Jugador no encontrado',
                    adminId: adminId,
                    ts: Date.now()
                });
                return;
            }
            
            // Guardar datos anteriores para logging
            const oldData = {
                name: player.name,
                position: { ...player.position },
                type: player.type
            };
            
            // Actualizar datos del jugador
            if (updatedData.name) {
                player.name = updatedData.name;
            }
            
            if (updatedData.position) {
                player.position = {
                    x: updatedData.position.x || player.position.x,
                    y: updatedData.position.y || player.position.y
                };
            }
            
            if (updatedData.type) {
                player.type = updatedData.type;
                player.isNPC = updatedData.type === 'npc';
            }
            
            // Actualizar última actividad
            player.lastActivity = Date.now();
            
            // console.log(`✅ Jugador editado: ${oldData.name} → ${player.name}`);
            // console.log(`📍 Posición: (${oldData.position.x}, ${oldData.position.y}) → (${player.position.x}, ${player.position.y})`);
            // console.log(`🏷️ Tipo: ${oldData.type} → ${player.type}`);
            
            // Notificar a todos los clientes del panel que el jugador fue actualizado
            this.io.emit('playerUpdated', {
                playerId: player.id,
                name: player.name,
                position: player.position,
                type: player.type,
                isNPC: player.isNPC,
                roomId: this.globalRoomId
            });
            
            // Enviar respuesta exitosa al administrador que realizó la edición
            socket.emit('adminPanelResponse', {
                success: true,
                message: `Jugador ${player.name} actualizado exitosamente`,
                action: 'edit_player',
                adminId: adminId,
                ts: Date.now()
            });
            
            // console.log(`👑 Admin ${adminId} actualizó al jugador ${player.name}`);
            
        } catch (error) {
            console.error(`❌ Error al editar jugador: ${error.message}`);
            socket.emit('adminPanelResponse', {
                success: false,
                message: `Error al editar jugador: ${error.message}`,
                action: 'edit_player',
                adminId: adminId,
                ts: Date.now()
            });
        }
    }
}

module.exports = DevGameServer;