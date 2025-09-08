const DevGameServer = require('./DevGameServer');
const StateManager = require('./StateManager');
const ChatManager = require('./ChatManager');
const SpectatorManager = require('./SpectatorManager');

class GameServer {
    constructor(io, devGameServer, stateManager, chatManager, spectatorManager) {
        this.io = io;
        this.devGameServer = devGameServer;
        this.stateManager = stateManager;
        this.chatManager = chatManager;
        this.spectatorManager = spectatorManager;
        
        console.log('🎮 GameServer inicializado - Modo Desarrollo');
    }
    
    handleConnection(socket) {
        console.log(`🔗 Nueva conexión: ${socket.id}`);
        
        // Delegar al DevGameServer para manejar la conexión
        this.devGameServer.handleConnection(socket);
    }
    
    async handleJoin(socket, data) {
        // Delegar al DevGameServer para manejar la unión
        return this.devGameServer.handleJoin(socket, data);
    }
    
    async handleJoinSpectator(socket, data) {
        // Delegar al DevGameServer para manejar la unión de espectadores
        return this.devGameServer.handleJoinSpectator(socket, data);
    }
    
    handleAction(socket, data) {
        // Delegar al DevGameServer para manejar acciones
        this.devGameServer.handleAction(socket, data);
    }
    
    handleChatMessage(socket, data) {
        // Delegar al DevGameServer para manejar mensajes de chat
        this.devGameServer.handleChatMessage(socket, data);
    }
    
    handleAdminCommand(socket, data) {
        // Delegar al DevGameServer para manejar comandos de admin
        this.devGameServer.handleAdminCommand(socket, data);
    }
    
    // Método para manejar comandos de admin desde el panel de admin
    handleAdminPanelCommand(socket, data) {
        // Delegar al DevGameServer para manejar comandos del panel de admin
        this.devGameServer.handleAdminPanelCommand(socket, data);
    }
    
    kickAllPlayers() {
        // Delegar al DevGameServer para expulsar todos los jugadores
        this.devGameServer.kickAllPlayers();
    }
    
    globalBroadcast(message) {
        // Delegar al DevGameServer para manejar broadcast global
        this.devGameServer.globalBroadcast(message);
    }
    
    sendRoomList(socket) {
        // En lista vacía ya que no hay salas en modo desarrollo
        socket.emit('roomList', { rooms: [] });
    }
    
    sendServerStats(socket) {
        // Delegar al DevGameServer para enviar estadísticas del servidor
        this.devGameServer.sendServerStats(socket);
    }
    
    handleAdminNotification(socket, data) {
        // Delegar al DevGameServer para manejar notificaciones de admin
        this.devGameServer.handleAdminNotification(socket, data);
    }
    
    kickPlayer(roomId, targetName) {
        // Delegar al DevGameServer para expulsar jugadores
        this.devGameServer.kickPlayer(targetName);
    }
    
    broadcastMessage(roomId, message) {
        // Delegar al DevGameServer para manejar mensajes de broadcast
        this.devGameServer.broadcastMessage(message);
    }
    
    listPlayers(roomId, socket) {
        // Delegar al DevGameServer para listar jugadores
        this.devGameServer.listPlayers(socket);
    }
    
    listRooms(socket) {
        // En lista vacía ya que no hay salas en modo desarrollo
        socket.emit('roomList', { rooms: [] });
    }
    
    sendWelcome(socket) {
        // Delegar al DevGameServer para enviar mensaje de bienvenida
        this.devGameServer.sendWelcome(socket);
    }
    
    isAdminPlayer(name, playerId) {
        // Solo Rey Theron o player_123 pueden ser admin
        return name === 'Rey Theron' || playerId === 'player_123';
    }
    
    handleDisconnect(socket) {
        // Delegar al DevGameServer para manejar desconexiones
        this.devGameServer.handleDisconnect(socket);
    }
    
    
    handleAddPlayerToRoom(socket, roomId, playerName, playerType, position, adminId) {
        // Delegar al DevGameServer para agregar jugadores
        this.devGameServer.handleAddPlayer(JSON.stringify({
            playerName: playerName,
            playerType: playerType,
            position: position
        }), adminId);
    }
    
    handleRemovePlayerFromRoom(socket, roomId, playerName, adminId) {
        // Delegar al DevGameServer para eliminar jugadores
        this.devGameServer.handleRemovePlayer(playerName, adminId);
    }
    
    handleGetRoomPlayers(socket, roomId, adminId) {
        // Delegar al DevGameServer para obtener jugadores
        this.devGameServer.handleGetPlayers(socket, adminId);
    }
    
    handleGlobalBroadcast(socket, message, adminId) {
        // Delegar al DevGameServer para manejar broadcast global
        this.devGameServer.globalBroadcast(message);
    }
    
    handleKickAll(socket, adminId) {
        // Delegar al DevGameServer para expulsar todos los jugadores
        this.devGameServer.kickAllPlayers();
    }
    
    handleCreateRoom(socket, data) {
        // En respuesta negativa ya que no se pueden crear salas en modo desarrollo
        const { adminId } = data;
        socket.emit('adminPanelResponse', {
            success: false,
            message: 'No se pueden crear salas en modo desarrollo',
            adminId: adminId,
            ts: Date.now()
        });
    }
    
}

module.exports = GameServer;