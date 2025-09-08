import io from 'socket.io-client';

export class NetworkManager {
    constructor(adapter) {
        this.adapter = adapter;
        this.socket = null;
        this.serverUrl = this.getServerUrl();
        this.isConnected = false;
        this.pendingMessages = new Map();
        this.messageId = 0;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
    }
    
    getServerUrl() {
        // Usar siempre la URL actual del servidor para conexión dinámica
        return window.location.origin;
    }
    
    connect() {
        if (this.isConnected) {
            console.warn('Already connected to server');
            return;
        }
        
        console.log(`🔌 Connecting to multiplayer server: ${this.serverUrl}`);
        
        try {
            // Create socket connection
            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: false, // We'll handle reconnection manually
                forceNew: true
            });
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    this.handleConnectionError(new Error('Connection timeout'));
                }
            }, 10000);
            
        } catch (error) {
            this.handleConnectionError(error);
        }
    }
    
    disconnect() {
        if (!this.socket) return;
        
        console.log('🔌 Disconnecting from server');
        
        // Clear intervals and timeouts
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Disconnect socket
        this.socket.disconnect();
        this.socket = null;
        this.isConnected = false;
        
        // Clear pending messages
        this.pendingMessages.clear();
    }
    
    reconnect(sessionToken) {
        if (this.isConnected) {
            this.disconnect();
        }
        
        console.log('🔄 Attempting to reconnect with session token');
        
        // Setup socket with session token for reconnection
        this.socket = io(this.serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: false,
            forceNew: true,
            auth: {
                sessionToken: sessionToken
            }
        });
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        if (!this.socket) return;
        
        // Connection events
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.clearConnectionTimeout();
            this.adapter.handleConnected();
        });
        
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            console.log('Disconnected from server:', reason);
            this.adapter.handleDisconnected();
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.handleConnectionError(error);
        });
        
        // Game events
        this.socket.on('welcome', (data) => {
            this.adapter.sessionToken = data.sessionToken;
            this.adapter.playerId = data.you.playerId;
            this.adapter.emit('welcome', data);
        });
        
        this.socket.on('roomJoined', (data) => {
            this.adapter.handleRoomJoined(data);
        });
        
        this.socket.on('joinResponse', (data) => {
            // Handle joinResponse event for backward compatibility
            const pendingMessage = Array.from(this.pendingMessages.values()).find(
                msg => msg.event === 'join'
            );
            if (pendingMessage) {
                clearTimeout(pendingMessage.timeout);
                this.pendingMessages.delete(pendingMessage.id);
                pendingMessage.resolve(data);
            }
        });
        
        this.socket.on('playerJoined', (data) => {
            this.adapter.handlePlayerJoined(data);
        });
        
        this.socket.on('playerReconnected', (data) => {
            this.adapter.handlePlayerReconnected(data);
        });
        
        this.socket.on('stateDelta', (data) => {
            this.adapter.handleStateDelta(data);
        });
        
        this.socket.on('chatMessage', (data) => {
            this.adapter.handleChatMessage(data);
        });
        
        this.socket.on('privateMessage', (data) => {
            this.adapter.handlePrivateMessage(data);
        });
        
        this.socket.on('systemMessage', (data) => {
            this.adapter.handleSystemMessage(data);
        });
        
        this.socket.on('spectatorUpdate', (data) => {
            this.adapter.handleSpectatorUpdate(data);
        });
        
        this.socket.on('spectatorCount', (data) => {
            this.adapter.handleSpectatorCount(data);
        });
        
        this.socket.on('error', (data) => {
            this.adapter.handleError(data);
        });
        
        this.socket.on('pong', (data) => {
            this.adapter.handlePong(data);
        });
        
        this.socket.on('mapData', (data) => {
            this.adapter.handleMapData(data);
        });
    }
    
    // Message sending methods
    send(event, data) {
        if (!this.isConnected || !this.socket) {
            console.warn('Not connected to server, cannot send message:', event);
            return;
        }
        
        try {
            this.socket.emit(event, data);
        } catch (error) {
            console.error('Error sending message:', error);
            this.handleConnectionError(error);
        }
    }
    
    sendPromise(event, data) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected || !this.socket) {
                reject(new Error('Not connected to server'));
                return;
            }
            
            const messageId = this.messageId++;
            const timeout = setTimeout(() => {
                this.pendingMessages.delete(messageId);
                reject(new Error('Message timeout'));
            }, 10000);  // Increased timeout to 10 seconds
            
            this.pendingMessages.set(messageId, { id: messageId, event, resolve, reject, timeout });
            
            this.socket.emit(event, data, (response) => {
                clearTimeout(timeout);
                this.pendingMessages.delete(messageId);
                resolve(response);
            });
        });
    }
    
    // Event handling methods
    handleWelcome(data) {
        this.adapter.sessionToken = data.sessionToken;
        this.adapter.playerId = data.you.playerId;
        this.adapter.emit('welcome', data);
    }
    
    handleRoomJoined(data) {
        this.adapter.handleRoomJoined(data);
    }
    
    handlePlayerJoined(data) {
        this.adapter.handlePlayerJoined(data);
    }
    
    handlePlayerReconnected(data) {
        this.adapter.handlePlayerReconnected(data);
    }
    
    handleStateDelta(data) {
        this.adapter.handleStateDelta(data);
    }
    
    handleChatMessage(data) {
        this.adapter.handleChatMessage(data);
    }
    
    handlePrivateMessage(data) {
        this.adapter.handlePrivateMessage(data);
    }
    
    handleSystemMessage(data) {
        this.adapter.handleSystemMessage(data);
    }
    
    handleSpectatorUpdate(data) {
        this.adapter.handleSpectatorUpdate(data);
    }
    
    handleSpectatorCount(data) {
        this.adapter.handleSpectatorCount(data);
    }
    
    handleError(data) {
        this.adapter.handleError(data);
    }
    
    handlePong(data) {
        // Handle pong response (for latency measurement)
        const latency = Date.now() - data.ts;
        this.adapter.emit('pong', { latency, serverTime: data.serverTime });
    }
    
    // Connection error handling
    handleConnectionError(error) {
        console.error('Network connection error:', error);
        this.isConnected = false;
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Attempt reconnection
        this.attemptReconnection();
        
        // Notify adapter
        this.adapter.handleConnectionError(error);
    }
    
    attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.adapter.emit('reconnectionFailed');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (this.adapter.sessionToken) {
                this.reconnect(this.adapter.sessionToken);
            } else {
                this.connect();
            }
        }, delay);
    }
    
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }
    
    // Utility methods
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            serverUrl: this.serverUrl,
            reconnectAttempts: this.reconnectAttempts,
            pendingMessages: this.pendingMessages.size
        };
    }
    
    getLatency() {
        // Calculate latency based on last ping/pong
        // This would need to be implemented with timestamp tracking
        return 0; // Placeholder
    }
    
    // Message reliability methods
    resendPendingMessages() {
        // Resend any pending messages that haven't been acknowledged
        // This would need to track message acknowledgments
        console.log('Respending pending messages...');
    }
    
    // Heartbeat methods
    startHeartbeat() {
        if (this.heartbeatInterval) return;
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping', { ts: Date.now() });
            }
        }, 30000); // Send ping every 30 seconds
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
}