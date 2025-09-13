import { NetworkManager } from './network.js';

export class MultiplayerAdapter {
    constructor(game) {
        this.game = game;
        this.networkManager = null;
        this.isConnected = false;
        this.currentRoom = null;
        this.isSpectator = false;
        this.playerId = null;
        this.sessionToken = null;
        this.isAdmin = false; // Admin flag
        this.eventHandlers = new Map();
        
        // Game state synchronization
        this.lastServerState = null;
        this.pendingActions = [];
        this.actionSequence = 0;
        
        // Reconnection settings
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        
        // Initialize if multiplayer is enabled
        this.init();
    }
    
    init() {
        // Always enable multiplayer - forced connection
        this.connect();
    }
    
    connect() {
        if (this.isConnected) {
            console.warn('Multiplayer already connected');
            return;
        }
        
        try {
            this.networkManager = new NetworkManager(this);
            this.networkManager.connect();
        } catch (error) {
            console.error('Failed to connect to multiplayer server:', error);
            this.handleConnectionError(error);
        }
    }
    
    disconnect() {
        if (!this.isConnected) return;
        
        this.isConnected = false;
        this.currentRoom = null;
        
        if (this.networkManager) {
            this.networkManager.disconnect();
        }
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        this.emit('disconnected');
    }
    
    // Core integration methods
    startGameLoop() {
        if (!this.isConnected) return;
        
        // Start sending game state updates
        this.startHeartbeat();
        this.emit('gameLoopStarted');
    }
    
    sendChatMessage(message, channel = 'mundo') {
        if (!this.isConnected || !this.currentRoom) return;
        
        const chatMessage = {
            playerId: this.playerId,
            roomId: this.currentRoom,
            text: message,
            ts: Date.now(),
            channel: channel
        };
        
        this.networkManager.send('chatMessage', chatMessage);
        this.emit('chatSent', { message, channel });
    }
    
    async loadProfileData() {
        if (!this.isConnected) {
            // Use local profile data
            return this.game.profileManager.playerProfile;
        }
        
        try {
            // Profile data is handled by the server during join
            // This method can be extended to fetch additional profile data
            return this.game.profileManager.playerProfile;
        } catch (error) {
            console.error('Failed to load profile data:', error);
            return this.game.profileManager.playerProfile;
        }
    }
    
    // Game action methods
    sendPlayerAction(actionType, payload) {
        if (!this.isConnected || !this.currentRoom) return;
        
        const action = {
            playerId: this.playerId,
            roomId: this.currentRoom,
            type: actionType,
            payload: payload,
            ts: Date.now(),
            seq: this.actionSequence++
        };
        
        // Add to pending actions for potential resend
        this.pendingActions.push(action);
        
        // Send to server
        this.networkManager.send('action', action);
        
        // Emit local event for immediate feedback
        this.emit('localAction', { actionType, payload });
    }
    
    sendPlayerMove(x, y) {
        this.sendPlayerAction('playerMove', { x, y });
    }
    
    sendUnitRecruit(unitType, count) {
        this.sendPlayerAction('unitRecruit', { unitType, count });
    }
    
    sendBuildingConstruct(buildingType, x, y) {
        this.sendPlayerAction('buildingConstruct', { buildingType, x, y });
    }
    
    // Room management
    async joinRoom(roomId, playerName, isSpectator = false) {
        if (!this.isConnected) {
            await this.connect();
        }
        
        try {
            const joinData = {
                playerId: this.playerId || `player_${Date.now()}`,
                name: playerName || this.game.profileManager.playerProfile.username,
                roomId: roomId,
                isSpectator: isSpectator
            };
            
            const result = await this.networkManager.sendPromise('join', joinData);
            
            if (result.success) {
                this.currentRoom = roomId;
                this.isSpectator = isSpectator;
                this.playerId = joinData.playerId;
                
                // Initialize game state with server data
                if (result.snapshot) {
                    this.initializeGameState(result.snapshot);
                }
                
                this.emit('roomJoined', { roomId, isSpectator });
                return true;
            } else {
                throw new Error(result.error || 'Failed to join room');
            }
        } catch (error) {
            console.error('Failed to join room:', error);
            this.emit('roomJoinFailed', { error: error.message });
            return false;
        }
    }
    
    async joinSpectatorRoom(roomId) {
        return this.joinRoom(roomId, `Spectator_${Date.now()}`, true);
    }
    
    leaveRoom() {
        if (!this.currentRoom) return;
        
        this.networkManager.send('leave', {
            playerId: this.playerId,
            roomId: this.currentRoom
        });
        
        this.currentRoom = null;
        this.isSpectator = false;
        this.emit('roomLeft');
    }
    
    // State management
    initializeGameState(snapshot) {
        if (!snapshot || !snapshot.changes) return;
        
        // Apply initial state changes
        for (const change of snapshot.changes) {
            this.applyGameStateChange(change);
        }
        
        this.lastServerState = snapshot;
        this.emit('gameStateInitialized', snapshot);
    }
    
    applyGameStateChange(change) {
        switch (change.type) {
            case 'playerUpdate':
                this.updatePlayer(change.playerId, change.data);
                break;
            case 'entityUpdate':
                this.updateEntity(change.entityId, change.data);
                break;
            case 'resourceUpdate':
                this.updateResources(change.data);
                break;
            default:
                console.warn('Unknown state change type:', change.type);
        }
    }
    
    updatePlayer(playerId, playerData) {
        // Update player data in game state
        if (playerId === this.playerId) {
            // This is the local player
            Object.assign(this.game.playerData || {}, playerData);
        }
        
        this.emit('playerUpdated', { playerId, playerData });
    }
    
    updateEntity(entityId, entityData) {
        // Update entity in game state
        this.emit('entityUpdated', { entityId, entityData });
    }
    
    updateResources(resourceData) {
        // Update resources in game state
        if (this.game.resourceManager) {
            Object.assign(this.game.resourceManager.resources, resourceData);
            this.game.resourceManager.updateResourceDisplay();
        }
        
        this.emit('resourcesUpdated', resourceData);
    }
    
    // Multiplayer players management
    updateMultiplayerPlayers(players) {
        // Initialize multiplayer players collection if it doesn't exist
        if (!this.game.multiplayerPlayers) {
            this.game.multiplayerPlayers = new Map();
        }
        
        // Update players from server data
        for (const player of players) {
            this.game.multiplayerPlayers.set(player.id, {
                id: player.id,
                name: player.name,
                x: player.x,
                y: player.y,
                isAdmin: player.isAdmin || false,
                joinedAt: player.joinedAt || Date.now()
            });
        }
        
        // Remove players that are no longer in the list
        const currentPlayerIds = new Set(players.map(p => p.id));
        for (const [playerId, player] of this.game.multiplayerPlayers) {
            if (!currentPlayerIds.has(playerId)) {
                this.game.multiplayerPlayers.delete(playerId);
            }
        }
        
        this.emit('multiplayerPlayersUpdated', Array.from(this.game.multiplayerPlayers.values()));
    }
    
    // Event handling
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in multiplayer event handler:', error);
                }
            });
        }
    }
    
    // Network event handlers
    handleConnected() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('🔗 Connected to multiplayer server');
        console.log('📡 Server URL:', this.networkManager.serverUrl);
        console.log('🆔 Socket ID:', this.networkManager.socket.id);
        this.emit('connected');
        
        // Auto-join the global room after connection
        // Add a small delay to ensure the connection is fully established
        setTimeout(() => {
            this.autoJoinGlobalRoom();
        }, 100);
    }
    
    handleConnecting() {
        this.emit('connecting');
    }
    
    handleDisconnected() {
        this.isConnected = false;
        console.log('🔌 Disconnected from multiplayer server');
        this.emit('disconnected');
        
        // Attempt reconnection
        this.attemptReconnection();
    }
    
    handleRoomJoined(data) {
        if (data.success) {
            this.currentRoom = data.room.id;
            this.isSpectator = data.room.spectatorCount > 0;
            
            if (data.snapshot) {
                this.initializeGameState(data.snapshot);
            }
            
            this.emit('roomJoined', data);
        } else {
            this.emit('roomJoinFailed', data);
        }
    }
    
    handleStateDelta(data) {
        // Apply server state changes
        if (data.changes) {
            for (const change of data.changes) {
                this.applyGameStateChange(change);
            }
        }
        
        // Update multiplayer players for map rendering
        if (data.players) {
            this.updateMultiplayerPlayers(data.players);
        }
        
        this.lastServerState = data;
        this.emit('stateDelta', data);
    }
    
    // Handle player movement events
    handlePlayerMoved(data) {
        try {
            const { playerId, playerName, from, to, timestamp } = data;
            
            console.log(`🏃 Jugador ${playerName} se movió: (${from.x}, ${from.y}) → (${to.x}, ${to.y})`);
            
            // Update the player's position in the game state
            if (this.game.multiplayerPlayers) {
                const player = this.game.multiplayerPlayers.get(playerId);
                if (player) {
                    const oldPosition = { x: player.x, y: player.y };
                    player.x = to.x;
                    player.y = to.y;
                    
                    console.log(`🔄 Actualizada posición de ${playerName} en el estado local: (${to.x}, ${to.y})`);
                    
                    // If this is the local player, save the position
                    if (playerId === this.playerId) {
                        this.savePlayerPosition(to);
                        console.log(`💾 Posición guardada localmente para ${playerName}`);
                    }
                    
                    // Emit event for other systems
                    this.emit('playerMoved', {
                        playerId,
                        playerName,
                        from: oldPosition,
                        to,
                        timestamp
                    });
                }
            }
            
            // Update map rendering if needed
            if (this.game.mapRenderer && this.game.mapRenderer.mapInteractionManager) {
                this.game.mapRenderer.render();
            }
            
        } catch (error) {
            console.error('❌ Error al manejar movimiento de jugador:', error);
        }
    }
    
    // Handle position save events
    handlePositionSaved(data) {
        try {
            const { playerId, position, success, error, timestamp } = data;
            
            if (success) {
                console.log(`✅ Posición guardada exitosamente para ${playerId}: (${position.x}, ${position.y})`);
                
                // If this is the local player, update the game state
                if (playerId === this.playerId && this.game.playerCity) {
                    this.game.playerCity = position;
                    this.savePlayerPosition(position);
                    
                    // Update map rendering
                    if (this.game.mapRenderer && this.game.mapRenderer.mapInteractionManager) {
                        this.game.mapRenderer.mapInteractionManager.centerOnPlayerCity();
                        this.game.mapRenderer.render();
                    }
                    
                    // Emit event for other systems
                    this.emit('positionSaved', {
                        playerId,
                        position,
                        timestamp
                    });
                }
            } else {
                console.error(`❌ Error al guardar posición para ${playerId}:`, error);
            }
            
        } catch (error) {
            console.error('❌ Error al manejar guardado de posición:', error);
        }
    }
    
    handleChatMessage(data) {
        // Add message to game chat
        if (this.game.chatSystem) {
            // Check if this is an admin notification
            if (data.type === 'admin_notification') {
                this.game.chatSystem.addMessage('👑 Admin', data.text, 'system');
                return;
            }
            
            this.game.chatSystem.addMessage(data.from, data.text, data.type || 'player');
        }
        
        this.emit('chatMessage', data);
    }
    
    handlePlayerJoined(data) {
        // NEW: If this is self, update currentPlayerName for ownership
        if (data.playerId === this.playerId) {
            this.game.currentPlayerName = data.name;
            console.log(`✅ Self player joined, currentPlayerName set to: ${data.name}`);
        }
        console.log(`Player ${data.name} joined the game`);
        this.emit('playerJoined', data);
    }
    
    handlePlayerReconnected(data) {
        console.log(`Player ${data.name} reconnected`);
        this.emit('playerReconnected', data);
    }
    
    handleError(data) {
        console.error('Multiplayer error:', data);
        this.emit('error', data);
    }
    
    // Reconnection system
    attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('reconnectionFailed');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (this.sessionToken) {
                this.networkManager.reconnect(this.sessionToken);
            } else {
                this.connect();
            }
        }, delay);
    }
    
    // Heartbeat system
    startHeartbeat() {
        if (this.heartbeatInterval) return;
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.networkManager.send('ping', { ts: Date.now() });
            }
        }, 30000); // Send ping every 30 seconds
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    // Connection error handling
    handleConnectionError(error) {
        console.error('Connection error:', error);
        this.emit('connectionError', error);
        
        // Attempt reconnection for connection errors
        if (error.code === 'ECONNREFUSED' || error.code === 'TIMEOUT') {
            this.attemptReconnection();
        }
    }
    
    // Utility methods
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            currentRoom: this.currentRoom,
            isSpectator: this.isSpectator,
            playerId: this.playerId,
            reconnectAttempts: this.reconnectAttempts
        };
    }
    
    getGameState() {
        return {
            lastServerState: this.lastServerState,
            pendingActions: this.pendingActions.length,
            actionSequence: this.actionSequence
        };
    }
    
    // Admin methods
    sendAdminNotification(type) {
        if (!this.isConnected || !this.isAdmin) return;
        
        const notification = {
            type: 'admin_notification',
            adminAction: type,
            ts: Date.now()
        };
        
        this.networkManager.send('adminNotification', notification);
    }
    
    kickPlayer(playerName) {
        if (!this.isConnected || !this.isAdmin) return;
        
        const kickCommand = {
            action: 'kick',
            target: playerName,
            adminId: this.playerId,
            ts: Date.now()
        };
        
        this.networkManager.send('adminCommand', kickCommand);
        this.sendChatMessage(`👑 Intentando expulsar a ${playerName}`, 'mundo');
    }
    
    broadcastMessage(message) {
        if (!this.isConnected || !this.isAdmin) return;
        
        const broadcastCommand = {
            action: 'broadcast',
            message: message,
            adminId: this.playerId,
            ts: Date.now()
        };
        
        this.networkManager.send('adminCommand', broadcastCommand);
    }
    
    requestPlayerList() {
        if (!this.isConnected || !this.isAdmin) return;
        
        const playerListRequest = {
            action: 'list_players',
            adminId: this.playerId,
            ts: Date.now()
        };
        
        this.networkManager.send('adminCommand', playerListRequest);
    }
    
    requestRoomList() {
        if (!this.isConnected || !this.isAdmin) return;
        
        const roomListRequest = {
            action: 'list_rooms',
            adminId: this.playerId,
            ts: Date.now()
        };
        
        this.networkManager.send('adminCommand', roomListRequest);
    }
    
    // Handle admin status from server
    handleAdminStatus(data) {
        this.isAdmin = data.isAdmin || false;
        console.log(`👑 Admin status: ${this.isAdmin ? 'Enabled' : 'Disabled'}`);
        this.emit('adminStatusChanged', { isAdmin: this.isAdmin });
    }
    
    // Enhanced debugging methods
    logDebug(message, data = null) {
        console.log(`🔍 [DEBUG] ${message}`, data || '');
    }
    
    logConnectionEvent(event, data = null) {
        console.log(`🌐 [CONNECTION] ${event}`, data || '');
    }
    
    logGameStateEvent(event, data = null) {
        console.log(`🎮 [GAME STATE] ${event}`, data || '');
    }
    
    // Auto-join the global development room
    async autoJoinGlobalRoom() {
        this.logDebug('Starting auto-join process for global room');

        if (!this.isConnected) {
            this.logConnectionEvent('Cannot join room - not connected to server');
            return;
        }

        try {
            this.logConnectionEvent('Attempting to join global development room...');

            // Clear old localStorage keys from previous system
            localStorage.removeItem('persistent_player_id');
            localStorage.removeItem('persistent_player_name');
            localStorage.removeItem('player_count');

            // Get persistent player ID from localStorage (set by server)
            if (!this.playerId) {
                const persistentId = localStorage.getItem('imperion_playerId');
                if (persistentId) {
                    this.playerId = persistentId;
                    this.logDebug('Using existing persistent player ID from server:', this.playerId);
                } else {
                    this.logDebug('No persistent player ID found - server will generate one');
                }
            }
            
            // Get player name from profile or use default
            const playerName = this.game?.profileManager?.playerProfile?.username ||
                              `Player_${this.playerId.substr(-6)}`;
            
            // Try to get saved position from localStorage first
            let savedPosition = this.getSavedPlayerPosition();
            this.logDebug('Saved position from localStorage:', savedPosition);
            
            // If no localStorage position, try to get from server persistence
            if (!savedPosition) {
                savedPosition = this.getServerSavedPosition();
                this.logDebug('Saved position from server:', savedPosition);
            }
            
            // Create a deterministic position based on player ID for consistency (only if we have saved position)
            const deterministicPosition = savedPosition ? this.generateDeterministicPosition(this.playerId) : null;
            this.logDebug('Deterministic position based on player ID:', deterministicPosition);
            
            // Use the best available position: saved > deterministic > null
            // For new players without saved position, don't use deterministic position to ensure random spawn
            const preferredPosition = savedPosition || deterministicPosition;
            
            const joinData = {
                playerId: this.playerId,
                name: playerName,
                preferredPosition: preferredPosition // Send the best available position
            };
            
            this.logConnectionEvent('Sending join request:', joinData);
            
            const result = await this.networkManager.sendPromise('join', joinData);

            // Save the playerId returned by server to localStorage
            if (result.success && result.playerId) {
                const oldPlayerId = this.playerId;
                this.playerId = result.playerId;
                localStorage.setItem('imperion_playerId', this.playerId);
                this.logDebug('Player ID received from server and saved:', this.playerId);

                // If playerId changed, clear old position data
                if (oldPlayerId && oldPlayerId !== this.playerId) {
                    localStorage.removeItem(`player_position_${oldPlayerId}`);
                    localStorage.removeItem(`server_player_position_${oldPlayerId}`);
                    this.logDebug('Cleared old position data for previous player ID:', oldPlayerId);
                }

                this.game.currentPlayerId = this.playerId; // Set for unique owner check
                this.game.currentPlayerOwner = this.playerId; // Set for unique owner check
            }
            
            this.logConnectionEvent('Join response received:', result);
            
            if (result.success) {
                this.currentRoom = 'dev_global';
                this.logConnectionEvent('Successfully joined global room');
                this.logGameStateEvent('Room joined successfully', {
                    roomId: this.currentRoom,
                    playerId: this.playerId,
                    playerCount: result.snapshot?.players?.length || 0
                });
                
                // Initialize game state with server data
                if (result.snapshot) {
                    this.initializeGameState(result.snapshot);
                    this.logGameStateEvent('Game state initialized from server snapshot');
                    
                    // Establecer la posición del jugador y verificar si tiene imperio
                    if (result.snapshot.players && result.snapshot.players.length > 0) {
                        const playerData = result.snapshot.players.find(p => p.id === this.playerId);
                        if (playerData && playerData.position) {
                            // Save the position to both localStorage and server for persistence
                            this.savePlayerPosition(playerData.position);
                            this.saveServerPlayerPosition(playerData.position);
                            
                            this.game.playerCity = playerData.position;
                            this.game.currentPlayerName = playerData.name || playerName; // NEW: Set for ownership checks
                            this.logGameStateEvent('Player position set and saved', {
                                position: playerData.position,
                                hasSavedPosition: !!savedPosition,
                                preferredPosition: preferredPosition
                            });
                            
                            // Centrar el mapa en la nueva posición
                            if (this.game.mapRenderer && this.game.mapRenderer.mapInteractionManager) {
                                this.game.mapRenderer.mapInteractionManager.centerOnPlayerCity();
                                this.game.mapRenderer.render();
                            }
                        }

                        // Update multiplayer players from snapshot
                        this.updateMultiplayerPlayers(result.snapshot.players);
                        this.logGameStateEvent('Multiplayer players updated from snapshot', {
                            playerCount: result.snapshot.players.length
                        });

                        // Verificar si el jugador tiene un imperio existente
                        const hasEmpire = result.hasEmpire || playerData?.hasEmpire || false;
                        this.logGameStateEvent('Empire status check', {
                            hasEmpire: hasEmpire,
                            playerId: this.playerId
                        });

                        // Si el jugador tiene un imperio, mostrar mensaje "Tu imperio: [nombre]"
                        if (hasEmpire) {
                            const playerName = this.game.profileManager?.playerProfile?.username || this.playerId;
                            const empireMessage = `🏰 Tu imperio: ${playerName}`;
                            
                            // Mostrar notificación o mensaje en el news manager
                            if (this.game.newsManager) {
                                this.game.newsManager.addNews(empireMessage, 'system');
                            }
                            
                            console.log(empireMessage);
                        }

                        // Request shared map data after join
                        this.requestMapData();
                        this.logGameStateEvent('Requested shared map data from server');
                    }
                }
                
                // Emit join event for other systems
                this.emit('roomJoined', {
                    roomId: 'dev_global',
                    success: true,
                    snapshot: result.snapshot
                });
                
                // Notify game about successful connection
                if (this.game && this.game.newsManager) {
                    const positionSource = savedPosition ? 'restaurada' : (deterministicPosition ? 'determinística' : 'aleatoria');
                    
                    // Verificar si el jugador tiene un imperio existente
                    const hasEmpire = result.hasEmpire || false;
                    
                    if (hasEmpire) {
                        // Si tiene imperio, mostrar mensaje de restauración
                        const empireMessage = `🏰 Bienvenido de vuelta al servidor global (${this.game.profileManager.playerProfile.username}) - Imperio restaurado`;
                        this.game.newsManager.addNews(empireMessage, 'system');
                        console.log(empireMessage);
                    } else {
                        // Si es un nuevo imperio, mostrar mensaje de creación
                        const newEmpireMessage = `🌐 Bienvenido al servidor global (${this.game.profileManager.playerProfile.username}) - Nuevo imperio creado en posición ${positionSource}`;
                        this.game.newsManager.addNews(newEmpireMessage, 'system');
                        console.log(newEmpireMessage);
                    }
                }
                
            } else {
                this.logConnectionEvent('Failed to join room:', result);
                this.emit('roomJoinFailed', { error: result.error || 'Unknown error' });
                
                // Notify game about join failure
                if (this.game && this.game.newsManager) {
                    this.game.newsManager.addNews(
                        `❌ Error al unirse al servidor global: ${result.error || 'Error desconocido'}`,
                        'system'
                    );
                }
            }
            
        } catch (error) {
            this.logConnectionEvent('Error joining global room:', error);
            this.emit('roomJoinFailed', { error: error.message });
            
            // Notify game about join error
            if (this.game && this.game.newsManager) {
                this.game.newsManager.addNews(
                    `❌ Error de conexión al servidor: ${error.message}`,
                    'system'
                );
            }
        }
    }
    
    // Player position persistence methods
    savePlayerPosition(position) {
        try {
            // Guardar en localStorage para persistencia en el cliente
            const positionData = {
                x: position.x,
                y: position.y,
                timestamp: Date.now(),
                playerId: this.playerId
            };
            localStorage.setItem(`player_position_${this.playerId}`, JSON.stringify(positionData));
            this.logDebug('Player position saved to localStorage:', positionData);
            
            // Notificar al servidor para que guarde la posición también
            if (this.isConnected && this.currentRoom) {
                this.networkManager.send('savePosition', {
                    playerId: this.playerId,
                    position: position,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Error saving player position:', error);
        }
    }
    
    getSavedPlayerPosition() {
        try {
            const savedData = localStorage.getItem(`player_position_${this.playerId}`);
            if (savedData) {
                const positionData = JSON.parse(savedData);
                // Check if the position is recent (within 24 hours)
                if (Date.now() - positionData.timestamp < 24 * 60 * 60 * 1000) {
                    return { x: positionData.x, y: positionData.y };
                } else {
                    // Remove old position data
                    localStorage.removeItem(`player_position_${this.playerId}`);
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting saved player position:', error);
            return null;
        }
    }
    
    clearSavedPlayerPosition() {
        try {
            localStorage.removeItem(`player_position_${this.playerId}`);
            this.logDebug('Saved player position cleared');
        } catch (error) {
            console.error('Error clearing saved player position:', error);
        }
    }
    
    // Request saved position from server
    requestSavedPosition() {
        if (this.isConnected && this.currentRoom) {
            this.networkManager.send('getSavedPosition', {
                playerId: this.playerId,
                timestamp: Date.now()
            });
        }
    }
    
    // Request map data from server
    requestMapData() {
        if (this.isConnected && this.currentRoom) {
            this.networkManager.send('getMapData', {
                playerId: this.playerId,
                timestamp: Date.now()
            });
        }
    }
    
    // Handle map data from server
    handleMapData(data) {
        try {
            const { mapData, success, error, timestamp } = data;

            if (success && mapData) {
                console.log(`✅ Map data received from server`);
                // Store map data for use by MapRenderer
                this.mapData = mapData;

                // If the map renderer exists, update it with the new map data
                if (this.game.mapRenderer) {
                    this.game.mapRenderer.map = mapData;
                    // If the map hasn't been generated yet, generate it now
                    if (!this.game.mapRenderer.map) {
                        this.game.mapRenderer.generateMap();
                    }
                    this.game.mapRenderer.render();
                }

                // Emit event for other systems
                this.emit('mapDataReceived', {
                    mapData,
                    timestamp
                });
            } else {
                console.error(`❌ Error receiving map data from server:`, error);
            }

        } catch (error) {
            console.error('❌ Error handling map data:', error);
        }
    }

    // Handle name uniqueness result
    handleNameUniquenessResult(data) {
        try {
            const { unique, error } = data;

            if (error) {
                console.error('❌ Error checking name uniqueness:', error);
            } else {
                console.log(`🔍 Name uniqueness result: ${unique ? 'unique' : 'not unique'}`);
            }

            // Emit event for WelcomeManager
            this.emit('nameUniquenessResult', { unique, error });

        } catch (error) {
            console.error('❌ Error handling name uniqueness result:', error);
        }
    }

    // Handle set player name result
    handleSetPlayerNameResult(data) {
        try {
            const { success, name, error } = data;

            if (success) {
                console.log(`✅ Player name set to: ${name}`);
                // Update local player name
                this.game.currentPlayerName = name;
            } else {
                console.error('❌ Error setting player name:', error);
            }

            // Emit event for WelcomeManager
            this.emit('setPlayerNameResult', { success, name, error });

        } catch (error) {
            console.error('❌ Error handling set player name result:', error);
        }
    }

    // Handle player name changed (for other players)
    handlePlayerNameChanged(data) {
        try {
            const { playerId, oldName, newName, timestamp } = data;

            console.log(`📝 Player ${playerId} changed name from "${oldName}" to "${newName}"`);

            // Update local multiplayer players data
            if (this.game.multiplayerPlayers) {
                const player = this.game.multiplayerPlayers.get(playerId);
                if (player) {
                    player.name = newName;
                }
            }

            // Emit event for other systems
            this.emit('playerNameChanged', {
                playerId,
                oldName,
                newName,
                timestamp
            });

        } catch (error) {
            console.error('❌ Error handling player name changed:', error);
        }
    }
    
    // New methods for enhanced position persistence
    generateDeterministicPosition(playerId) {
        // Generate a consistent position based on player ID to ensure
        // the same player always spawns in the same place
        try {
            let seed = 0;
            for (let i = 0; i < playerId.length; i++) {
                seed += playerId.charCodeAt(i);
            }
            
            // Use seed to generate consistent coordinates
            const rng = (seed) => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
            
            const x = Math.floor(rng(seed) * 50);
            const y = Math.floor(rng(seed + 1) * 50);
            
            const position = { x, y };
            this.logDebug('Generated deterministic position:', { playerId, seed, position });
            
            return position;
        } catch (error) {
            console.error('Error generating deterministic position:', error);
            return null;
        }
    }
    
    saveServerPlayerPosition(position) {
        try {
            // Save position to server for persistence across sessions
            if (this.isConnected && this.currentRoom) {
                this.networkManager.send('savePosition', {
                    playerId: this.playerId,
                    position: position,
                    timestamp: Date.now(),
                    persistent: true // Mark as persistent position
                });
                this.logDebug('Player position saved to server:', position);
            }
        } catch (error) {
            console.error('Error saving player position to server:', error);
        }
    }
    
    // Generate a consistent hash from player name for persistent ID
    generateNameHash(name) {
        try {
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            
            // Convert to positive and to base36 for shorter ID
            const positiveHash = (hash & 0x7fffffff).toString(36);
            
            // Add timestamp to ensure uniqueness across different sessions with same name
            const timestamp = Date.now().toString(36).substr(-4);
            
            return `${positiveHash}_${timestamp}`;
        } catch (error) {
            console.error('Error generating name hash:', error);
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        }
    }
    
    getServerSavedPosition() {
        // Try to get position from server storage
        // This is a placeholder - actual implementation depends on server-side storage
        try {
            // For now, check if we have a recent position in localStorage that was marked as server-synced
            const savedData = localStorage.getItem(`server_player_position_${this.playerId}`);
            if (savedData) {
                const positionData = JSON.parse(savedData);
                // Check if the position is recent (within 24 hours)
                if (Date.now() - positionData.timestamp < 24 * 60 * 60 * 1000) {
                    return { x: positionData.x, y: positionData.y };
                } else {
                    // Remove old position data
                    localStorage.removeItem(`server_player_position_${this.playerId}`);
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting saved player position from server:', error);
            return null;
        }
    }
    
}