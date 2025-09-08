const StateManager = require('./StateManager');
const ChatManager = require('./ChatManager');
const SpectatorManager = require('./SpectatorManager');

class DevPersistenceManager {
    constructor(stateManager, chatManager, spectatorManager) {
        this.stateManager = stateManager;
        this.chatManager = chatManager;
        this.spectatorManager = spectatorManager;
        
        this.isRunning = false;
        this.interval = 5000; // 5 segundos
        this.redisClient = null;
        this.isRedisConnected = false;
        
        console.log('💾 DevPersistenceManager inicializado - Modo Desarrollo');
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        // Intentar conectar a Redis si está disponible
        this.connectToRedis();
        
        // Iniciar el intervalo de persistencia
        this.persistenceInterval = setInterval(() => {
            this.saveGameState();
        }, this.interval);
        
        console.log('💾 Sistema de persistencia (desarrollo) iniciado');
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.persistenceInterval) {
            clearInterval(this.persistenceInterval);
        }
        
        // Guardar estado final
        this.saveGameState();
        
        console.log('💾 Sistema de persistencia (desarrollo) detenido');
    }
    
    async connectToRedis() {
        try {
            // Intentar importar redis (opcional)
            const redis = await import('redis');
            
            this.redisClient = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });
            
            this.redisClient.on('error', (err) => {
                console.warn('⚠️ Error de Redis:', err);
                this.isRedisConnected = false;
            });
            
            this.redisClient.on('connect', () => {
                console.log('🔗 Conectado a Redis');
                this.isRedisConnected = true;
            });
            
            await this.redisClient.connect();
            
        } catch (error) {
            console.warn('⚠️ Redis no disponible, usando persistencia en memoria');
            this.isRedisConnected = false;
        }
    }
    
    async saveGameState() {
        try {
            // Obtener estado global
            const globalState = this.stateManager.getGlobalState();
            
            const gameState = {
                timestamp: Date.now(),
                room: 'dev_global',
                players: Array.from(globalState.players.values()),
                entities: Array.from(globalState.entities.values()),
                sequence: globalState.sequence,
                version: globalState.version,
                stats: {
                    state: this.stateManager.getStats(),
                    chat: this.chatManager && this.chatManager.getGlobalChatStats ? this.chatManager.getGlobalChatStats() : { totalMessages: 0, recentMessages: 0, messagesByType: {} },
                    spectators: this.spectatorManager && this.spectatorManager.getTotalSpectatorCount ? this.spectatorManager.getTotalSpectatorCount() : 0
                }
            };
            
            if (this.isRedisConnected && this.redisClient) {
                // Guardar en Redis
                await this.redisClient.set('imperion:devGameState', JSON.stringify(gameState));
                await this.redisClient.expire('imperion:devGameState', 3600); // 1 hora
                
                // Guardar historial de chat
                const globalChat = this.chatManager && this.chatManager.getGlobalChat ? this.chatManager.getGlobalChat(100) : [];
                await this.redisClient.set('imperion:devGlobalChat', JSON.stringify(globalChat));
                await this.redisClient.expire('imperion:devGlobalChat', 3600);
                
                console.log('💾 Estado global guardado en Redis');
            } else {
                // Guardar en memoria (fallback)
                this.memoryStorage = gameState;
                this.memoryChatStorage = this.chatManager && this.chatManager.getGlobalChat ? this.chatManager.getGlobalChat(100) : [];
                
                console.log('💾 Estado global guardado en memoria');
            }
            
        } catch (error) {
            console.error('❌ Error al guardar estado:', error);
        }
    }
    
    async loadGameState() {
        try {
            if (this.isRedisConnected && this.redisClient) {
                // Cargar desde Redis
                const gameState = await this.redisClient.get('imperion:devGameState');
                const globalChat = await this.redisClient.get('imperion:devGlobalChat');
                
                if (gameState) {
                    const parsed = JSON.parse(gameState);
                    console.log('📖 Estado global cargado desde Redis:', {
                        players: parsed.players.length,
                        entities: parsed.entities.length,
                        sequence: parsed.sequence
                    });
                }
                
                if (globalChat) {
                    const parsedChat = JSON.parse(globalChat);
                    console.log('📖 Chat cargado desde Redis:', parsedChat.length, 'mensajes');
                }
                
            } else {
                // Cargar desde memoria
                if (this.memoryStorage) {
                    console.log('📖 Estado global cargado desde memoria:', {
                        players: this.memoryStorage.players.length,
                        entities: this.memoryStorage.entities.length
                    });
                }
                
                if (this.memoryChatStorage) {
                    console.log('📖 Chat cargado desde memoria:', this.memoryChatStorage.length, 'mensajes');
                }
            }
            
        } catch (error) {
            console.error('❌ Error al cargar estado:', error);
        }
    }
    
    async cleanupOldData() {
        try {
            const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 horas atrás
            
            if (this.isRedisConnected && this.redisClient) {
                // Limpiar datos antiguos en Redis
                const keys = await this.redisClient.keys('imperion:dev:*');
                
                for (const key of keys) {
                    const data = await this.redisClient.get(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (parsed.timestamp < cutoffTime) {
                            await this.redisClient.del(key);
                            console.log(`🗑️ Datos antiguos eliminados: ${key}`);
                        }
                    }
                }
                
            } else {
                // Limpiar datos antiguos en memoria
                if (this.memoryStorage && this.memoryStorage.timestamp < cutoffTime) {
                    this.memoryStorage = null;
                    console.log('🗑️ Datos antiguos eliminados del estado global');
                }
                
                if (this.memoryChatStorage && this.memoryChatStorage.length > 1000) {
                    this.memoryChatStorage = this.memoryChatStorage.slice(-500);
                    console.log('🗑️ Chat recortado a 500 mensajes');
                }
            }
            
        } catch (error) {
            console.error('❌ Error al limpiar datos antiguos:', error);
        }
    }
    
    async getBackup() {
        try {
            const globalState = this.stateManager.getGlobalState();
            
            const backup = {
                timestamp: Date.now(),
                version: '1.0-dev',
                room: 'dev_global',
                gameState: {
                    players: Array.from(globalState.players.values()),
                    entities: Array.from(globalState.entities.values()),
                    sequence: globalState.sequence,
                    version: globalState.version
                },
                globalChat: this.memoryChatStorage || [],
                stats: {
                    state: this.stateManager.getStats(),
                    chat: this.chatManager && this.chatManager.getGlobalChatStats ? this.chatManager.getGlobalChatStats() : { totalMessages: 0, recentMessages: 0, messagesByType: {} },
                    spectators: this.spectatorManager && this.spectatorManager.getTotalSpectatorCount ? this.spectatorManager.getTotalSpectatorCount() : 0
                }
            };
            
            console.log('📦 Backup generado (desarrollo):', {
                players: backup.gameState.players.length,
                entities: backup.gameState.entities.length
            });
            return backup;
            
        } catch (error) {
            console.error('❌ Error al generar backup:', error);
            return null;
        }
    }
    
    async restoreFromBackup(backup) {
        try {
            if (!backup) {
                throw new Error('Backup inválido');
            }
            
            console.log('🔄 Restaurando desde backup (desarrollo)...');
            
            // Restaurar estado del juego
            if (backup.gameState) {
                const globalState = this.stateManager.getGlobalState();
                
                // Limpiar estado actual
                globalState.players.clear();
                globalState.entities.clear();
                
                // Restaurar jugadores
                if (backup.gameState.players) {
                    backup.gameState.players.forEach(player => {
                        globalState.players.set(player.id, player);
                    });
                }
                
                // Restaurar entidades
                if (backup.gameState.entities) {
                    backup.gameState.entities.forEach(entity => {
                        globalState.entities.set(entity.id, entity);
                    });
                }
                
                // Restaurar secuencia y versión
                globalState.sequence = backup.gameState.sequence || 0;
                globalState.version = backup.gameState.version || 1;
                
                console.log(`✅ Backup restaurado: ${backup.gameState.players.length} jugadores, ${backup.gameState.entities.length} entidades`);
            }
            
            // Restaurar chat global
            if (backup.globalChat) {
                this.memoryChatStorage = backup.globalChat;
            }
            
        } catch (error) {
            console.error('❌ Error al restaurar backup:', error);
        }
    }
    
    getStats() {
        return {
            isRunning: this.isRunning,
            isRedisConnected: this.isRedisConnected,
            lastSave: this.memoryStorage?.timestamp || null,
            memoryUsage: {
                gameState: this.memoryStorage ? JSON.stringify(this.memoryStorage).length : 0,
                chat: this.memoryChatStorage ? JSON.stringify(this.memoryChatStorage).length : 0
            },
            interval: this.interval
        };
    }
}

// Función para iniciar el sistema de persistencia (desarrollo)
function start(stateManager, chatManager, spectatorManager) {
    const persistence = new DevPersistenceManager(stateManager, chatManager, spectatorManager);
    persistence.start();
    return persistence;
}

module.exports = {
    DevPersistenceManager,
    start
};