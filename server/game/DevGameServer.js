const StateManager = require('./StateManager');
const ChatManager = require('./ChatManager');
const SpectatorManager = require('./SpectatorManager');
const PlayerPersistenceManager = require('./PlayerPersistenceManager');

class DevGameServer {
    constructor(io, stateManager, chatManager, spectatorManager, playerPersistenceManager) {
        this.io = io;
        this.stateManager = stateManager;
        this.chatManager = chatManager;
        this.spectatorManager = spectatorManager;
        this.playerPersistenceManager = playerPersistenceManager;
        
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

        // Manejar verificación de unicidad de nombre
        socket.on('checkNameUniqueness', (data) => {
            this.handleCheckNameUniqueness(socket, data);
        });

        // Manejar establecimiento de nombre de jugador
        socket.on('setPlayerName', (data) => {
            this.handleSetPlayerName(socket, data);
        });
    }
    
    async handleJoin(socket, data) {
        const { playerId, name, preferredPosition, spectator } = data;

        // Verificar si es modo espectador
        if (spectator || data.join_game === false) {
            console.log(`👁️ Cliente ${socket.id} conectándose como espectador`);
            return this.handleJoinSpectator(socket, data);
        }

        // Verificar si hay espacio disponible (límite global)
        const globalState = this.stateManager.getRoomState(this.globalRoomId);
        if (globalState.players.size >= 50) {
            throw new Error('Servidor lleno (máximo 50 jugadores)');
        }

        let finalPlayerId = playerId;
        let existingPlayer = null;
        let isNewPlayer = false;

        // Si no se envía playerId, generar uno nuevo
        if (!playerId || playerId === 'undefined' || playerId === '') {
            finalPlayerId = this.playerPersistenceManager.generatePlayerId();
            isNewPlayer = true;
            console.log(`🆕 Nuevo jugador sin ID: ${name} -> ID generado: ${finalPlayerId}`);
        } else {
            // Verificar si el playerId existe en players.json
            if (this.playerPersistenceManager.hasPlayer(playerId)) {
                // Jugador existente - cargar su estado
                existingPlayer = this.playerPersistenceManager.getPlayer(playerId);
                finalPlayerId = playerId;
                console.log(`🔄 Jugador existente reconectado: ${existingPlayer.name} (${playerId})`);
            } else {
                // Jugador nuevo con ID proporcionado
                finalPlayerId = playerId;
                isNewPlayer = true;
                console.log(`🆕 Nuevo jugador con ID: ${name} (${playerId})`);
            }
        }

        // Limpiar imperios huérfanos antes de procesar el nuevo join
        this.stateManager.cleanOrphanedEmpires();

        // Preparar datos del jugador
        const playerData = existingPlayer ? {
            ...existingPlayer,
            lastActivity: Date.now()
        } : {
            id: finalPlayerId,
            name: name,
            type: 'player',
            isAdmin: this.isAdminPlayer(name, finalPlayerId),
            isNPC: false,
            position: preferredPosition || this.stateManager.generateValidSpawnPosition(),
            color: this.generateRandomColor(),
            joinedAt: Date.now(),
            joinedAtReadable: new Date().toLocaleString('es-AR'),
            lastActivity: Date.now(),
            lastActivityReadable: new Date().toLocaleString('es-AR')
        };

        // Agregar o actualizar en persistencia
        this.playerPersistenceManager.addOrUpdatePlayer(playerData);
        await this.playerPersistenceManager.savePlayers();

        // Agregar jugador al estado del juego
        this.stateManager.addPlayer(this.globalRoomId, playerData);

        // Actualizar el playerId en el socket para futuras comunicaciones
        socket.playerId = finalPlayerId;

        // Si no hay datos de mapa, generarlos ahora
        if (!this.stateManager.getMapData()) {
            this.stateManager.generateAndSaveMapData();
        }

        // Obtener el jugador agregado para detalles
        const addedPlayer = globalState.players.get(finalPlayerId);
        const spawnPosition = addedPlayer ? addedPlayer.position : playerData.position;
        const hasEmpire = true;  // Siempre tiene imperio después de addPlayer

        // Update global state for admin panel
        const stateAfterAdd = this.stateManager.getRoomState(this.globalRoomId);
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
            playerId: finalPlayerId,
            name: playerData.name,
            isAdmin: playerData.isAdmin,
            position: spawnPosition,
            hasEmpire: hasEmpire,
            roomId: this.globalRoomId,
            joinedAtReadable: playerData.joinedAtReadable,
            lastActivityReadable: playerData.lastActivityReadable,
            isNewPlayer: isNewPlayer
        });

        // Si es un nuevo jugador, enviar el playerId al cliente para que lo guarde
        if (isNewPlayer) {
            socket.emit('assignPlayerId', {
                playerId: finalPlayerId,
                message: 'Guarda este ID para futuras conexiones'
            });
        }

        return {
            success: true,
            roomId: this.globalRoomId,
            playerId: finalPlayerId,
            isAdmin: playerData.isAdmin,
            hasEmpire: hasEmpire,
            snapshot,
            isNewPlayer: isNewPlayer
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
    
    // Método para generar color aleatorio para nuevos jugadores
    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
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
                    state.entities.delete(entityId);
                    entityCleanedCount++;
                }
            }
            
            if (cleanedCount > 0 || entityCleanedCount > 0) {
                this.stateManager.syncEntitiesToMap();
                this.stateManager.savePersistentState();
            }
        } catch (error) {
            console.error('❌ Error limpiando imperios huérfanos:', error);
        }
    }
    
    async handleJoinSpectator(socket, data) {
        const { playerId } = data;

        // Generar ID único para espectador si no se proporciona
        let finalPlayerId = playerId;
        if (!playerId || playerId === 'undefined' || playerId === '') {
            finalPlayerId = `spectator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        console.log(`👁️ Espectador conectado: ${finalPlayerId}`);

        // Agregar espectador al SpectatorManager
        this.spectatorManager.addSpectator(finalPlayerId, socket);

        socket.join(this.globalRoomId);
        socket.currentRoom = this.globalRoomId;
        socket.playerId = finalPlayerId;
        socket.isSpectator = true;

        // Enviar snapshot inicial
        const snapshot = this.stateManager.getRoomSnapshot(this.globalRoomId);

        // No crear ni modificar players.json para espectadores
        console.log(`👁️ Espectador ${finalPlayerId} - no se modifica players.json`);

        return {
            success: true,
            roomId: this.globalRoomId,
            playerId: finalPlayerId,
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
            
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);
            
            if (!player) {
                return;
            }
            
            // En un juego 4x, los imperios son estáticos, no se mueven
            // Notificar al jugador que el movimiento no está permitido
            socket.emit('moveResponse', {
                success: false,
                message: 'Los imperios son estáticos en este juego 4x, no se pueden mover',
                position: player.position, // Mantener posición actual
                timestamp: Date.now()
            });
            
            // Usar la posición actual del jugador
            socket.emit('imperialPosition', {
                success: true,
                position: player.position,
                message: 'Usando posición actual',
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
            
            // Obtener el estado global
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);
            
            if (!player) {
                return;
            }
            
            // En un juego 4x, los imperios son estáticos, no se pueden guardar nuevas posiciones
            
            // Notificar al jugador que no se pueden guardar nuevas posiciones
            socket.emit('positionSaved', {
                success: false,
                message: 'Los imperios son estáticos en este juego 4x, no se pueden cambiar de posición',
                position: player.position,
                persistent: false,
                timestamp: Date.now()
            });
            
        } catch (error) {
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
        }
    }
    
    // Método para manejar comandos de admin desde el panel de admin
    handleAdminPanelCommand(socket, data) {
        const { action, playerName, playerType, position, target, message, adminId, ts, roomId } = data;


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
            player.socket.emit('kicked', { reason: 'Expulsado por admin' });
            player.socket.leave(this.globalRoomId);
            globalState.players.delete(player.id);
            kickedCount++;
        }
        
        
        // Notificar a todos los clientes que los jugadores fueron expulsados
        this.io.emit('serverMessage', {
            from: 'Sistema',
            text: `El administrador ha expulsado a ${kickedCount} jugadores`,
            type: 'admin_notification'
        });
    }
    
    globalBroadcast(message) {
        if (!message || message.trim() === '') {
            return;
        }
        
        
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

        if (socket.currentRoom) {
            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            if (globalState) {
                // Remover jugador o espectador
                if (socket.isSpectator) {
                    // Remover espectador del SpectatorManager
                    this.spectatorManager.removeSpectator(socket.playerId);
                    socket.leave(this.globalRoomId);
                } else {
                    // Obtener datos del jugador antes de eliminarlo
                    const player = globalState.players.get(socket.playerId);
                    if (player) {
                        // Actualizar datos persistentes antes de desconectar
                        this.playerPersistenceManager.addOrUpdatePlayer({
                            ...player,
                            lastActivity: Date.now(),
                            lastActivityReadable: new Date().toLocaleString('es-AR')
                        });
                        // Guardar cambios de forma asíncrona
                        this.playerPersistenceManager.savePlayers().catch(error => {
                            console.error('❌ Error al guardar datos del jugador al desconectar:', error);
                        });
                    }

                    // Eliminar jugador del estado global
                    this.stateManager.removePlayer(this.globalRoomId, socket.playerId);

                    // Notificar a todos los clientes (incluyendo admin panel)
                    this.io.emit('playerLeft', {
                        playerId: socket.playerId,
                        name: player?.name || socket.playerId,
                        roomId: this.globalRoomId
                    });

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
            
            
            // Generar ID único para el NPC
            const npcId = `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Siempre generar spawn aleatorio para NPCs
            const spawnPosition = this.stateManager.generateValidSpawnPosition(npcId);
            
            if (!spawnPosition) {
                throw new Error('No se pudo encontrar una posición válida de spawn para el NPC');
            }
            
            
            // Agregar NPC al estado del juego
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
            
            
            // Notificar a todos los clientes (incluyendo admin panel)
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

    // Handle name uniqueness check
    handleCheckNameUniqueness(socket, data) {
        try {
            const { name, playerId } = data;

            if (!name || name.trim() === '') {
                socket.emit('nameUniquenessResult', { unique: false, error: 'Nombre vacío' });
                return;
            }

            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            let isUnique = true;

            // Check against all existing players
            for (const [id, player] of globalState.players.entries()) {
                if (player.name && player.name.toLowerCase() === name.toLowerCase() && id !== playerId) {
                    isUnique = false;
                    break;
                }
            }

            socket.emit('nameUniquenessResult', { unique: isUnique });
            console.log(`🔍 Verificación de unicidad para "${name}": ${isUnique ? 'único' : 'duplicado'}`);

        } catch (error) {
            console.error(`❌ Error al verificar unicidad de nombre: ${error.message}`);
            socket.emit('nameUniquenessResult', { unique: false, error: error.message });
        }
    }

    // Handle player name setting
    handleSetPlayerName(socket, data) {
        try {
            const { name, playerId } = data;

            if (!name || name.trim() === '') {
                socket.emit('setPlayerNameResult', { success: false, error: 'Nombre vacío' });
                return;
            }

            if (!playerId || socket.playerId !== playerId) {
                socket.emit('setPlayerNameResult', { success: false, error: 'ID de jugador inválido' });
                return;
            }

            const globalState = this.stateManager.getRoomState(this.globalRoomId);
            const player = globalState.players.get(playerId);

            if (!player) {
                socket.emit('setPlayerNameResult', { success: false, error: 'Jugador no encontrado' });
                return;
            }

            // Check uniqueness again (in case of race condition)
            let isUnique = true;
            for (const [id, p] of globalState.players.entries()) {
                if (p.name && p.name.toLowerCase() === name.toLowerCase() && id !== playerId) {
                    isUnique = false;
                    break;
                }
            }

            if (!isUnique) {
                socket.emit('setPlayerNameResult', { success: false, error: 'Nombre ya en uso' });
                return;
            }

            // Update player name
            const oldName = player.name;
            player.name = name.trim();
            player.lastActivity = Date.now();

            // Save to persistent storage
            this.stateManager.savePersistentState();

            // Notify all clients about the name change
            this.io.emit('playerNameChanged', {
                playerId: playerId,
                oldName: oldName,
                newName: player.name,
                timestamp: Date.now()
            });

            socket.emit('setPlayerNameResult', { success: true, name: player.name });
            console.log(`✅ Nombre de jugador ${playerId} cambiado de "${oldName}" a "${player.name}"`);

        } catch (error) {
            console.error(`❌ Error al establecer nombre de jugador: ${error.message}`);
            socket.emit('setPlayerNameResult', { success: false, error: error.message });
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
            } else {
                socket.emit('playerData', {
                    success: false,
                    message: 'Jugador no encontrado',
                    adminId: adminId,
                    ts: Date.now()
                });
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