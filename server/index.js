const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Importar módulos del servidor
const GameServer = require('./game/GameServer');
const DevGameServer = require('./game/DevGameServer');
const StateManager = require('./game/StateManager');
const ChatManager = require('./game/ChatManager');
const SpectatorManager = require('./game/SpectatorManager');
const persistence = require('./game/devPersistence');
const gameLoop = require('./game/devGameLoop');

class MultiplayerServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                allowedHeaders: ["*"],
                credentials: true,
                transports: ['websocket', 'polling']
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        // Inicializar gestores
        this.stateManager = new StateManager();
        this.chatManager = new ChatManager();
        this.spectatorManager = new SpectatorManager();
        this.devGameServer = new DevGameServer(this.io, this.stateManager, this.chatManager, this.spectatorManager);
        this.gameServer = new GameServer(this.io, this.devGameServer, this.stateManager, this.chatManager, this.spectatorManager);
        
        // Configurar CORS para peticiones HTTP
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // Middleware para manejar JSON y formularios
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Configurar rutas
        this.setupRoutes();
        
        // Iniciar bucle del juego
        this.startGameLoop();
        
        console.log('🚀 Servidor multiplayer iniciado');
    }
    
    setupRoutes() {
        // Ruta principal - servir index.html (debe ir ANTES de static middleware)
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../ui/html/index.html'));
        });
        
        // Servir archivos estáticos desde el directorio raíz del proyecto
        this.app.use(express.static(path.join(__dirname, '..')));
        
        // Ruta específica para servir CSS desde ui/css
        this.app.use('/ui/css', express.static(path.join(__dirname, '../ui/css')));
        
        // Ruta específica para servir assets
        this.app.use('/assets', express.static(path.join(__dirname, '../assets')));
        
        // Ruta del panel de admin
        this.app.get('/admin-panel.html', (req, res) => {
            res.sendFile(path.join(__dirname, '../ui/html/admin-panel.html'));
        });
        
        
        // API para obtener estado del servidor
        this.app.get('/api/server-status', (req, res) => {
            const globalState = this.stateManager.getGlobalState();
            res.json({
                status: 'running',
                room: 'dev_global',
                players: globalState.players.size,
                uptime: process.uptime()
            });
        });
        
        // API para health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: Date.now() });
        });
        
        // API para obtener información del servidor
        this.app.get('/info', (req, res) => {
            const globalState = this.stateManager.getGlobalState();
            const stats = {
                room: 'dev_global',
                players: globalState.players.size,
                entities: globalState.entities.size,
                state: this.stateManager.getStats(),
                chat: this.chatManager.getGlobalChatStats(),
                spectators: this.spectatorManager.getTotalSpectatorCount(),
                uptime: process.uptime()
            };
            res.json({ stats });
        });
        
        // API para obtener estado del servidor global
        this.app.get('/global-status', (req, res) => {
            const globalState = this.stateManager.getGlobalState();
            res.json({
                room: 'dev_global',
                players: globalState.players.size,
                entities: globalState.entities.size,
                lastUpdate: globalState.lastUpdate,
                sequence: globalState.sequence,
                version: globalState.version
            });
        });
        
        // API para reiniciar estado (hot reload)
        this.app.post('/reset-state', (req, res) => {
            try {
                this.stateManager.resetGlobalState();
                
                // Notificar a todos los clientes sobre el reinicio
                this.io.emit('serverMessage', {
                    from: 'Sistema',
                    text: 'Servidor reiniciado para desarrollo - estado limpiado',
                    type: 'system_notification'
                });
                
                res.json({
                    success: true,
                    message: 'Estado global reiniciado para hot reload',
                    timestamp: Date.now()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Error al reiniciar estado: ${error.message}`
                });
            }
        });
        
        // API para guardar estado global completo
        this.app.post('/save-state', (req, res) => {
            try {
                this.stateManager.savePersistentState();
                
                res.json({
                    success: true,
                    message: 'Estado global guardado exitosamente',
                    timestamp: Date.now()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Error al guardar estado: ${error.message}`
                });
            }
        });
        
        // API para cargar estado global completo
        this.app.post('/load-state', (req, res) => {
            try {
                this.stateManager.loadPersistentState();
                
                // Notificar a todos los clientes sobre la carga del estado
                this.io.emit('serverMessage', {
                    from: 'Sistema',
                    text: 'Estado global cargado desde persistencia',
                    type: 'system_notification'
                });
                
                res.json({
                    success: true,
                    message: 'Estado global cargado exitosamente',
                    timestamp: Date.now()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Error al cargar estado: ${error.message}`
                });
            }
        });
        
        // API para obtener estado persistente
        this.app.get('/persistent-state', (req, res) => {
            try {
                const persistentState = global.persistentGameState || null;
                res.json({
                    success: true,
                    data: persistentState,
                    timestamp: Date.now()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Error al obtener estado persistente: ${error.message}`
                });
            }
        });
        
        // API para crear NPC
        this.app.post('/create-npc', (req, res) => {
            const npcId = req.body.npcId;
            // Aquí se debería crear la sesión del NPC
            console.log(`NPC ${npcId} creado`);
            res.send('NPC creado');
        });
        
        // API para persistencia
        this.app.post('/persistence/cleanup', (req, res) => {
            const cleanedStates = this.stateManager.cleanupOldStates();
            const cleanedMessages = this.chatManager.cleanupOldMessages();
            const cleanedSpectators = this.spectatorManager.cleanupInactiveSpectators();
            
            res.json({
                success: true,
                cleaned: {
                    states: cleanedStates,
                    messages: cleanedMessages,
                    spectators: cleanedSpectators
                }
            });
        });
        
        // API para borrar ciudades neutrales y huérfanas
        this.app.post('/clear-neutral-cities', (req, res) => {
            try {
                const globalState = this.stateManager.getGlobalState();
                let clearedCount = 0;
                let orphanedCount = 0;
                let invalidOwnerCount = 0;
                
                // Filtrar entidades para eliminar diferentes tipos de ciudades problemáticas
                const entitiesToDelete = [];
                const playersToRemove = [];
                
                for (const [entityId, entity] of globalState.entities.entries()) {
                    if (entity.type === 'ciudad') {
                        // Caso 1: Ciudades con propietario inválido (neutral, null, undefined, string vacío)
                        if (!entity.owner || entity.owner === 'neutral' || entity.owner === '' || entity.owner === null) {
                            entitiesToDelete.push(entityId);
                            invalidOwnerCount++;
                            console.log(`🗑️ Eliminando ciudad con propietario inválido: ${entityId} (dueño: ${entity.owner})`);
                        }
                        // Caso 2: Ciudades huérfanas (dueño no existe en lista de jugadores)
                        else if (entity.owner && entity.owner !== 'neutral') {
                            let ownerExists = false;
                            for (const [playerId, player] of globalState.players.entries()) {
                                if (player.id === entity.owner || player.name === entity.owner) {
                                    ownerExists = true;
                                    break;
                                }
                            }
                            if (!ownerExists) {
                                entitiesToDelete.push(entityId);
                                orphanedCount++;
                                console.log(`🗑️ Eliminando ciudad huérfana: ${entityId} (dueño: ${entity.owner})`);
                            }
                        }
                    }
                }
                
                // Buscar jugadores sin imperio asociado
                for (const [playerId, player] of globalState.players.entries()) {
                    let hasEmpire = false;
                    for (const [entityId, entity] of globalState.entities.entries()) {
                        if (entity.type === 'ciudad' && (entity.owner === player.id || entity.owner === player.name)) {
                            hasEmpire = true;
                            break;
                        }
                    }
                    if (!hasEmpire && !player.isNPC) {
                        playersToRemove.push(playerId);
                        console.log(`🗑️ Jugador sin imperio: ${player.name} (${playerId})`);
                    }
                }
                
                // Eliminar ciudades problemáticas
                for (const entityId of entitiesToDelete) {
                    globalState.entities.delete(entityId);
                    clearedCount++;
                }
                
                // Eliminar jugadores sin imperio (solo jugadores, no NPCs)
                for (const playerId of playersToRemove) {
                    const player = globalState.players.get(playerId);
                    if (player) {
                        globalState.players.delete(playerId);
                        // También eliminar su posición guardada
                        this.stateManager.removeSavedPlayerPosition(playerId);
                        console.log(`🗑️ Eliminando jugador sin imperio: ${player.name} (${playerId})`);
                    }
                }
                
                // Sincronizar y guardar
                this.stateManager.syncEntitiesToMap();
                this.stateManager.savePersistentState();
                
                // Notificar a todos los clientes
                this.io.emit('serverMessage', {
                    from: 'Sistema',
                    text: `Limpieza completada: ${clearedCount} ciudades eliminadas (${invalidOwnerCount} con propietario inválido, ${orphanedCount} huérfanas), ${playersToRemove.length} jugadores sin imperio eliminados`,
                    type: 'system_notification'
                });
                
                res.json({
                    success: true,
                    message: `Limpieza completada: ${clearedCount} ciudades eliminadas, ${playersToRemove.length} jugadores sin imperio eliminados`,
                    clearedCount: clearedCount,
                    invalidOwnerCount: invalidOwnerCount,
                    orphanedCount: orphanedCount,
                    playersRemoved: playersToRemove.length
                });
            } catch (error) {
                console.error('❌ Error en limpieza de ciudades neutrales:', error);
                res.status(500).json({
                    success: false,
                    message: `Error al borrar ciudades neutrales: ${error.message}`
                });
            }
        });
        
        // API para agregar NPC
        this.app.post('/add-npc', (req, res) => {
            try {
                const { npcName, position } = req.body;
                
                if (!npcName) {
                    return res.status(400).json({
                        success: false,
                        message: 'El nombre del NPC es requerido'
                    });
                }
                
                const globalState = this.stateManager.getGlobalState();
                
                // Generar posición aleatoria si no se proporciona
                let npcPosition = position;
                if (!npcPosition) {
                    npcPosition = this.stateManager.generateValidSpawnPosition(`npc_${npcName}`);
                }
                
                // Crear entidad de ciudad para el NPC
                const npcEntity = {
                    id: `npc_${npcName}_${Date.now()}`,
                    type: 'ciudad',
                    position: npcPosition,
                    owner: `npc_${npcName}`,
                    level: 1,
                    createdAt: Date.now()
                };
                
                // Agregar jugador NPC
                const npcPlayer = {
                    id: `npc_${npcName}`,
                    name: npcName,
                    type: 'npc',
                    position: npcPosition,
                    color: '#ff6b6b', // Color rojo para NPCs
                    joinedAt: Date.now(),
                    lastActivity: Date.now(),
                    isAdmin: false,
                    isNPC: true
                };
                
                globalState.entities.set(npcEntity.id, npcEntity);
                globalState.players.set(npcPlayer.id, npcPlayer);
                
                // Sincronizar y guardar
                this.stateManager.syncEntitiesToMap();
                this.stateManager.savePersistentState();
                
                // Notificar a todos los clientes
                this.io.emit('npcAdded', {
                    npc: npcPlayer,
                    entity: npcEntity
                });
                
                res.json({
                    success: true,
                    message: `NPC ${npcName} creado exitosamente`,
                    npc: npcPlayer,
                    entity: npcEntity
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Error al crear NPC: ${error.message}`
                });
            }
        });
        
        // API para obtener lista de jugadores
        this.app.get('/api/players', (req, res) => {
            try {
                const globalState = this.stateManager.getGlobalState();
                const players = Array.from(globalState.players.values()).map(player => ({
                    id: player.id,
                    name: player.name,
                    type: player.type,
                    isAdmin: player.isAdmin,
                    isNPC: player.isNPC,
                    position: player.position,
                    joinedAt: player.joinedAt,
                    lastActivity: player.lastActivity
                }));
                
                res.json({
                    success: true,
                    players: players
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Error al obtener lista de jugadores: ${error.message}`
                });
            }
        });
        
        // API para expulsar jugador
        this.app.post('/kick-player', (req, res) => {
            try {
                const { playerId } = req.body;
                
                if (!playerId) {
                    return res.status(400).json({
                        success: false,
                        message: 'El ID del jugador es requerido'
                    });
                }
                
                const globalState = this.stateManager.getGlobalState();
                const player = globalState.players.get(playerId);
                
                if (!player) {
                    return res.status(404).json({
                        success: false,
                        message: 'Jugador no encontrado'
                    });
                }
                
                // Eliminar jugador y su imperio
                globalState.players.delete(playerId);
                
                // Eliminar entidades del jugador
                const entitiesToDelete = [];
                for (const [entityId, entity] of globalState.entities.entries()) {
                    if (entity.owner === playerId) {
                        entitiesToDelete.push(entityId);
                    }
                }
                
                for (const entityId of entitiesToDelete) {
                    globalState.entities.delete(entityId);
                }
                
                // Sincronizar y guardar
                this.stateManager.syncEntitiesToMap();
                this.stateManager.savePersistentState();
                
                // Notificar a todos los clientes
                this.io.emit('playerKicked', {
                    playerId: playerId,
                    playerName: player.name
                });
                
                res.json({
                    success: true,
                    message: `Jugador ${player.name} expulsado exitosamente`
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Error al expulsar jugador: ${error.message}`
                });
            }
        });
        
        // API para estadísticas de persistencia
        this.app.get('/persistence/stats', (req, res) => {
            const stats = {
                state: this.stateManager.getStats(),
                chat: this.chatManager.getGlobalChatStats(),
                spectators: this.spectatorManager.getAllSpectatorStats()
            };
            res.json(stats);
        });
        
        // Manejar conexiones Socket.IO
        this.io.on('connection', (socket) => {
            console.log(`🔗 Nuevo cliente conectado: ${socket.id}`);
            
            // Manejar desconexión
            socket.on('disconnect', () => {
                console.log(`🔌 Cliente desconectado: ${socket.id}`);
                this.gameServer.handleDisconnect(socket);
            });
            
            // Manejar eventos del juego
            this.gameServer.handleConnection(socket);
            
            // Manejar eventos del admin panel
            socket.on('adminPanelCommand', (data) => {
                this.gameServer.handleAdminPanelCommand(socket, data);
            });
            
            // Manejar solicitud de lista de salas (vacía en modo desarrollo)
            socket.on('getRooms', () => {
                socket.emit('roomList', { rooms: [] });
            });
            
            // Manejar solicitud de estadísticas del servidor
            socket.on('getServerStats', () => {
                const globalState = this.stateManager.getGlobalState();
                const stats = {
                    room: 'dev_global',
                    players: globalState.players.size,
                    entities: globalState.entities.size,
                    state: this.stateManager.getStats(),
                    chat: this.chatManager.getGlobalChatStats(),
                    spectators: this.spectatorManager.getTotalSpectatorCount()
                };
                socket.emit('serverStats', stats);
            });
            
            // Manejar solicitud de estado global
            socket.on('getGlobalState', () => {
                const globalState = this.stateManager.getGlobalState();
                socket.emit('globalState', globalState);
            });
        });
    }
    
    startGameLoop() {
        // Iniciar bucle del juego (versión de desarrollo)
        gameLoop.start(this.io, this.stateManager);
        
        // Iniciar persistencia
        persistence.start(this.stateManager);
    }
    
    start(port = 3001) {
        this.server.listen(port, () => {
            console.log(`🎮 Servidor Multiplayer (Desarrollo) corriendo en http://localhost:${port}`);
            console.log(`📱 Cliente Principal (Juego): http://localhost:${port}`);
            console.log(`👑 Panel de Administración: http://localhost:${port}/admin-panel.html`);
            console.log('');
            console.log(`📋 Modo Desarrollo - Características:`);
            console.log(`   • Estado global compartido por todos los jugadores`);
            console.log(`   • Soporte para hot reload con reinicio de estado`);
            console.log(`   • NPCs gestionados desde el panel de admin`);
            console.log(`   • Sin sistema de salas - todos juegan juntos`);
            console.log(`   • Soporte para acceso desde dispositivos móviles`);
            console.log(`   • Sistema de spawn aleatorio para todos los jugadores`);
            console.log('');
            console.log(`🔗 URLs de acceso:`);
            console.log(`   • Jugar: http://localhost:${port}`);
            console.log(`   • Administrar: http://localhost:${port}/admin-panel.html`);
            console.log(`   • Estado del servidor: http://localhost:${port}/api/server-status`);
            console.log(`   • Estado global: http://localhost:${port}/global-status`);
            console.log('');
            console.log(`💡 Para hot reload: POST a http://localhost:${port}/reset-state`);
            console.log('');
            console.log(`🌐 Acceso Online:`);
            console.log(`   • Para acceso online, usa la IP local de tu red`);
            console.log(`   • En Windows: ipconfig | findstr /i IPv4`);
            console.log(`   • En Linux/Mac: ifconfig | grep inet`);
            console.log(`   • URL de acceso en red: http://[TU_IP_LOCAL]:${port}`);
            console.log('');
            console.log(`📱 Acceso Móvil:`);
            console.log(`   • Asegúrate de que ambos dispositivos estén en la misma red`);
            console.log(`   • En móviles, usa la IP local del servidor`);
            console.log(`   • Ejemplo: http://192.168.1.100:${port}`);
            console.log('');
            console.log(`🔧 Configuración de red:`);
            console.log(`   • Firewall: Permitir puerto ${port}`);
            console.log(`   • Router: Reenviar puerto ${port} al servidor local`);
            console.log(`   • Dispositivos móviles: Usar WiFi local`);
        });
    }
}

// Iniciar servidor
const server = new MultiplayerServer();
server.start();

module.exports = MultiplayerServer;