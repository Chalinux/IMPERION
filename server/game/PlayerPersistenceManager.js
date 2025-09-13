const fs = require('fs').promises;
const path = require('path');

class PlayerPersistenceManager {
    constructor() {
        this.playersFilePath = path.join(__dirname, 'players.json');
        this.players = new Map(); // id -> player object
        this.isLoaded = false;
        console.log('💾 PlayerPersistenceManager inicializado');
    }

    /**
     * Cargar players.json en memoria al iniciar el servidor
     */
    async loadPlayers() {
        try {
            console.log('📖 Cargando players.json...');

            // Verificar si el archivo existe
            try {
                await fs.access(this.playersFilePath);
            } catch (error) {
                console.log('⚠️ players.json no existe, creando archivo vacío');
                await this.savePlayers(); // Crear archivo vacío
                this.isLoaded = true;
                return;
            }

            // Leer y parsear el archivo
            const data = await fs.readFile(this.playersFilePath, 'utf8');
            const parsed = JSON.parse(data);

            // Cargar players en el Map
            if (parsed.players && Array.isArray(parsed.players)) {
                this.players.clear();
                parsed.players.forEach(player => {
                    if (player.id) {
                        this.players.set(player.id, player);
                    }
                });
                console.log(`✅ ${this.players.size} jugadores cargados desde players.json`);
            } else {
                console.warn('⚠️ Formato inválido en players.json, inicializando vacío');
                this.players.clear();
            }

            this.isLoaded = true;

        } catch (error) {
            console.error('❌ Error al cargar players.json:', error);
            this.players.clear();
            this.isLoaded = true; // Marcar como cargado para evitar bloqueos
        }
    }

    /**
     * Verificar si un playerId existe
     */
    hasPlayer(playerId) {
        return this.players.has(playerId);
    }

    /**
     * Obtener un jugador por ID
     */
    getPlayer(playerId) {
        return this.players.get(playerId) || null;
    }

    /**
     * Agregar o actualizar un jugador
     */
    addOrUpdatePlayer(player) {
        if (!player.id) {
            throw new Error('Player must have an id');
        }

        this.players.set(player.id, {
            ...player,
            lastActivity: Date.now()
        });
    }

    /**
     * Generar un nuevo playerId único
     */
    generatePlayerId() {
        let id;
        do {
            id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        } while (this.players.has(id));

        return id;
    }

    /**
     * Guardar players.json de forma atómica
     */
    async savePlayers() {
        try {
            const data = {
                players: Array.from(this.players.values()),
                lastUpdate: Date.now()
            };

            // Escribir a un archivo temporal primero
            const tempFilePath = `${this.playersFilePath}.tmp`;
            await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');

            // Mover el archivo temporal al archivo final (operación atómica)
            await fs.rename(tempFilePath, this.playersFilePath);

            console.log(`💾 ${this.players.size} jugadores guardados en players.json`);

        } catch (error) {
            console.error('❌ Error al guardar players.json:', error);
            throw error;
        }
    }

    /**
     * Obtener todos los jugadores
     */
    getAllPlayers() {
        return Array.from(this.players.values());
    }

    /**
     * Obtener estadísticas
     */
    getStats() {
        return {
            totalPlayers: this.players.size,
            isLoaded: this.isLoaded,
            filePath: this.playersFilePath
        };
    }
}

module.exports = PlayerPersistenceManager;