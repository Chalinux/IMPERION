const fs = require('fs');
const path = require('path');

class StateManager {
    constructor() {
        // Single global state for development
        this.globalRoomId = 'dev_global';
        this.globalState = {
            roomId: this.globalRoomId,
            players: new Map(),
            entities: new Map(),
            lastUpdate: Date.now(),
            sequence: 0,
            version: 1,
            mapData: null, // Para almacenar el mapa persistente
            playerPositions: new Map() // Para almacenar posiciones persistentes de jugadores (key: player.name)
        };
        this.actionSequence = 0;
        this.lastUpdate = Date.now();
        this.lastUnknownActionLog = 0;
        this.lastSaveTime = Date.now(); // Para debounce de saves
        
        // Cargar estado persistente si existe
        this.loadPersistentState();
        
        // Sincronizar entidades con mapa después de cargar
        if (this.globalState.mapData) {
            this.syncEntitiesToMap();
        }
        
        // Clean orphaned empires on startup
        this.cleanOrphanedEmpires();
        
        console.log('📊 StateManager inicializado - Modo Desarrollo con estado global y persistencia');
    }
    
    getRoomState(roomId) {
        // En modo desarrollo, siempre devolver el estado global
        if (roomId !== this.globalRoomId) {
            console.warn(`⚠️ Petición de estado para sala no existente: ${roomId}. Usando estado global.`);
        }
        return this.globalState;
    }
    
    createRoomState(roomId) {
        // En modo desarrollo, ignorar la creación de salas individuales
        if (roomId !== this.globalRoomId) {
            console.warn(`⚠️ Intento de crear sala no permitida en modo desarrollo: ${roomId}`);
            return this.globalState;
        }
        
        // Si ya existe el estado global, devolverlo
        if (this.globalState) {
            return this.globalState;
        }
        
        // Crear estado global si no existe
        this.globalState = {
            roomId: this.globalRoomId,
            players: new Map(),
            entities: new Map(),
            lastUpdate: Date.now(),
            sequence: 0,
            version: 1,
            mapData: null,
            playerPositions: new Map()
        };
        
        console.log(`📊 Estado global creado: ${this.globalRoomId}`);
        return this.globalState;
    }
    
    getRoomSnapshot(roomId) {
        const state = this.getRoomState(roomId);
        if (!state) return null;
        
        return {
            roomId: state.roomId,
            players: Array.from(state.players.values()),
            entities: Array.from(state.entities.values()),
            timestamp: state.lastUpdate,
            version: state.version
        };
    }
    
    processAction(roomId, action) {
        const state = this.getRoomState(roomId);
        if (!state) return;
        
        // Usar secuencia global en modo desarrollo
        const sequence = this.actionSequence + 1;
        this.actionSequence = sequence;
        
        action.sequence = sequence;
        action.timestamp = Date.now();
        
        // Procesar la acción según su tipo
        switch (action.type) {
            case 'move':
                this.processMoveAction(state, action);
                break;
            case 'build':
                this.processBuildAction(state, action);
                break;
            case 'chat':
                this.processChatAction(state, action);
                break;
            case 'attack':
                this.processAttackAction(state, action);
                break;
            case 'explore':
                this.processExploreAction(state, action);
                break;
            case 'resources':
                // Silently handle resource actions (likely from game systems)
                // These are probably legitimate game actions that don't need server processing
                break;
            default:
                // Log unknown actions occasionally for debugging
                if (!this.lastUnknownActionLog || Date.now() - this.lastUnknownActionLog > 30000) {
                    console.log(`📝 Unknown action received: ${action.type} from ${action.playerId}`);
                    this.lastUnknownActionLog = Date.now();
                }
                break;
        }
        
        state.lastUpdate = Date.now();
        state.version++;
        
        // Guardar acción para sincronización
        if (!state.actionHistory) {
            state.actionHistory = [];
        }
        
        state.actionHistory.push(action);
        
        // Limitar historial de acciones
        if (state.actionHistory.length > 100) {
            state.actionHistory.shift();
        }
        
        // Comentado para reducir spam de logs
        // console.log(`🔄 Acción procesada: ${action.type} por ${action.playerId} (secuencia: ${sequence})`);
    }
    
    processMoveAction(state, action) {
        const { playerId, payload } = action;
        const player = state.players.get(playerId);
        
        if (player) {
            const newPosition = {
                x: payload.x || player.position.x,
                y: payload.y || player.position.y
            };
            
            // Calcular distancia desde última posición guardada
            const lastSaved = player.lastSavedPosition || player.position;
            const dx = Math.abs(newPosition.x - lastSaved.x);
            const dy = Math.abs(newPosition.y - lastSaved.y);
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Solo actualizar y guardar si movimiento significativo (>1 tile)
            if (distance > 1) {
                player.position = newPosition;
                player.lastMove = Date.now();
                player.lastSavedPosition = { ...newPosition };
                
                // Guardar posición para persistencia usando player.name como clave
                this.savePlayerPosition(player.name, player.position);
                
                // console.log(`🏃 Jugador ${player.name} se movió significativamente a (${newPosition.x}, ${newPosition.y})`);
            } else {
                // console.log(`📷 Movimiento menor (cámara?) ignorado para ${player.name}: (${newPosition.x}, ${newPosition.y})`);
            }
            
            // Comentado para reducir spam de logs
            // console.log(`🏃 Jugador ${playerId} se movió a (${player.position.x}, ${player.position.y})`);
        }
    }
    
    processBuildAction(state, action) {
        const { playerId, payload } = action;
        const player = state.players.get(playerId);
        
        if (player) {
            const building = {
                id: `building_${Date.now()}`,
                type: payload.type,
                position: {
                    x: payload.x,
                    y: payload.y
                },
                owner: player.id,  // Use id for unique owner per device
                level: payload.level || 1,
                createdAt: Date.now()
            };
            
            // Si es una ciudad, verificar si ya existe una para este jugador
            if (payload.type === 'ciudad') {
                let hasExistingEmpire = false;
                let existingEmpireId = null;
                for (const [entityId, entity] of state.entities.entries()) {
                    if (entity.type === 'ciudad' && entity.owner === player.id) {
                        hasExistingEmpire = true;
                        existingEmpireId = entityId;
                        break;
                    }
                }
                
                if (hasExistingEmpire) {
                    console.warn(`⚠️ Jugador ${player.name} ya tiene un imperio (${existingEmpireId}). Actualizando nivel.`);
                    const existingEmpire = state.entities.get(existingEmpireId);
                    if (existingEmpire) {
                        existingEmpire.level = Math.max(existingEmpire.level, building.level);
                    }
                    // No agregar nueva entidad, solo actualizar existente
                    this.syncEntitiesToMap();
                    return; // Salir sin agregar
                } else {
                    // console.log(`🏰 Nuevo imperio creado para ${player.name} en (${payload.x}, ${payload.y})`);
                }
            }
            
            state.entities.set(building.id, building);
            
            // Sincronizar entidades con mapa para ciudades
            if (payload.type === 'ciudad') {
                this.syncEntitiesToMap();
            }
            
            // Comentado para reducir spam de logs
            // console.log(`🏗️ Jugador ${playerId} construyó ${payload.type} en (${payload.x}, ${payload.y})`);
        }
    }
    
    processChatAction(state, action) {
        const { playerId, payload } = action;
        const player = state.players.get(playerId);
        
        if (player) {
            const chatMessage = {
                id: `msg_${Date.now()}`,
                playerId: playerId,
                playerName: player.name,
                text: payload.text,
                timestamp: Date.now(),
                channel: payload.channel || 'mundo'
            };
            
            if (!state.chatHistory) {
                state.chatHistory = [];
            }
            
            state.chatHistory.push(chatMessage);
            
            // Limitar historial de chat
            if (state.chatHistory.length > 50) {
                state.chatHistory.shift();
            }
            
            // Comentado para reducir spam de logs
            // console.log(`💬 ${player.name}: ${payload.text}`);
        }
    }
    
    processAttackAction(state, action) {
        const { playerId, payload } = action;
        const player = state.players.get(playerId);
        
        if (player) {
            const attack = {
                id: `attack_${Date.now()}`,
                attacker: playerId,
                target: payload.target,
                type: payload.type,
                damage: payload.damage,
                timestamp: Date.now()
            };
            
            if (!state.combatHistory) {
                state.combatHistory = [];
            }
            
            state.combatHistory.push(attack);
            
            // Limitar historial de combate
            if (state.combatHistory.length > 20) {
                state.combatHistory.shift();
            }
            
            // Comentado para reducir spam de logs
            // console.log(`⚔️ ${player.name} atacó ${payload.target} con ${payload.damage} de daño`);
        }
    }
    
    processExploreAction(state, action) {
        const { playerId, payload } = action;
        const player = state.players.get(playerId);
        
        if (player) {
            const exploration = {
                id: `explore_${Date.now()}`,
                playerId: playerId,
                position: {
                    x: payload.x,
                    y: payload.y
                },
                discovered: payload.discovered,
                timestamp: Date.now()
            };
            
            if (!state.explorationHistory) {
                state.explorationHistory = [];
            }
            
            state.explorationHistory.push(exploration);
            
            // Comentado para reducir spam de logs
            // console.log(`🔍 ${player.name} exploró (${payload.x}, ${payload.y})`);
        }
    }
    
    // Método para sincronizar entidades con el mapa (actualizar type y owner para ciudades)
    syncEntitiesToMap() {
        const map = this.globalState.mapData;
        if (!map) {
            console.warn('⚠️ No hay mapData para sincronizar entidades');
            return;
        }
        
        // Reset all owners to null first (but keep type unless overridden)
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                if (map[y][x]) {
                    map[y][x].owner = null;
                }
            }
        }
        
        // Set type and owner from ciudad entities
        for (const [entityId, entity] of this.globalState.entities.entries()) {
            if (entity.type === 'ciudad' && entity.position && map[entity.position.y] && map[entity.position.y][entity.position.x]) {
                const tile = map[entity.position.y][entity.position.x];
                tile.type = 'ciudad';
                tile.owner = entity.owner;  // owner is player.name
                // console.log(`🔄 Sincronizado imperio ${entityId} en (${entity.position.x}, ${entity.position.y}) owner: ${entity.owner}`);
            }
        }
        
        // console.log('🔄 Entidades sincronizadas con el mapa (ciudades actualizadas)');
    }
    
    // Método para generar posición de spawn válida (modificado para permitir posición de propio imperio)
    isValidSpawnPosition(position, playerId = null) {
        const { x, y } = position;
        
        // Verificar límites del mapa (50x50)
        if (x < 0 || x >= 50 || y < 0 || y >= 50) {
            return false;
        }
        
        const globalState = this.getGlobalState();
        
        // Verificar si la posición está ocupada por otro jugador
        for (const [pId, player] of globalState.players) {
            if (player.position && player.position.x === x && player.position.y === y) {
                return false; // Posición ocupada por cualquier jugador (incluyendo self, but self not added yet)
            }
        }
        
        // Verificar si la posición está ocupada por una entidad que no sea el propio imperio
        for (const [entityId, entity] of globalState.entities) {
            if (entity.position && entity.position.x === x && entity.position.y === y) {
                if (entity.type !== 'ciudad' || entity.owner !== playerId) {
                    return false; // Posición ocupada por entidad no propia ciudad
                }
                // Permitir si es propio imperio
            }
        }
        
        return true; // Posición válida
    }
    
    // Método para generar posición de spawn válida (wrapper para compatibilidad)
    generateValidSpawnPosition(playerId = null) {
        // Definir safeZones con las 5 zonas dadas
        const safeZones = [
            { x1: 0, y1: 0, x2: 20, y2: 20 },
            { x1: 30, y1: 0, x2: 49, y2: 20 },
            { x1: 0, y1: 30, x2: 20, y2: 49 },
            { x1: 30, y1: 30, x2: 49, y2: 49 },
            { x1: 15, y1: 15, x2: 35, y2: 35 }
        ];
        
        // Intentar hasta 100 veces generar coordenadas aleatorias dentro de una zona segura y validar
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            // Seleccionar una zona segura aleatoria
            const safeZone = safeZones[Math.floor(Math.random() * safeZones.length)];
            
            // Generar posición aleatoria dentro de la zona segura
            const x = Math.floor(Math.random() * (safeZone.x2 - safeZone.x1 + 1)) + safeZone.x1;
            const y = Math.floor(Math.random() * (safeZone.y2 - safeZone.y1 + 1)) + safeZone.y1;
            
            const position = { x, y };
            
            // Verificar si la posición es válida (pasar playerId si proporcionado)
            if (this.isValidSpawnPosition(position, playerId)) {
                // console.log(`✅ Spawn en zona segura: (${x}, ${y}) después de ${attempts + 1} intentos`);
                return position;
            }
            
            attempts++;
        }
        
        // Si falla, hacer 50 intentos aleatorios en todo el mapa (0–49 en X e Y)
        console.log('⚠️ Búsqueda en zona segura fallida, intentando en todo el mapa');
        for (let attempt = 0; attempt < 50; attempt++) {
            const x = Math.floor(Math.random() * 50);
            const y = Math.floor(Math.random() * 50);
            const position = { x, y };
            
            if (this.isValidSpawnPosition(position, playerId)) {
                // console.log(`✅ Spawn en todo el mapa: (${x}, ${y}) en intento ${attempt + 1}`);
                return position;
            }
        }
        
        // Si falla, hacer búsqueda secuencial (doble bucle) hasta encontrar posición válida
        console.log('⚠️ Búsqueda aleatoria fallida, intentando búsqueda secuencial');
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                const position = { x, y };
                if (this.isValidSpawnPosition(position, playerId)) {
                    // console.log(`✅ Spawn secuencial: (${x}, ${y})`);
                    return position;
                }
            }
        }
        
        // Si todo falla, devolver coordenadas aleatorias en todo el mapa
        const finalX = Math.floor(Math.random() * 50);
        const finalY = Math.floor(Math.random() * 50);
        // console.log(`⚠️ Búsqueda secuencial fallida, usando spawn aleatorio final: (${finalX}, ${finalY})`);
        return { x: finalX, y: finalY };
    }
    
    addPlayer(roomId, player) {
        const state = this.getRoomState(roomId);
        if (!state) return;
        
        let position = player.position;
        let hasExistingEmpire = false;
        
        // Buscar imperio existente primero en entidades (priorizando por player.id)
        let existingEmpirePosition = null;
        let existingEntityId = null;
        
        // Primera búsqueda: por player.id (más preciso)
        for (const [entityId, entity] of state.entities.entries()) {
            if (entity.type === 'ciudad' && entity.owner === player.id) {
                existingEmpirePosition = entity.position;
                existingEntityId = entityId;
                hasExistingEmpire = true;
                console.log(`🏰 Imperio existente encontrado por ID para ${player.name} en (${existingEmpirePosition.x}, ${existingEmpirePosition.y})`);
                break;
            }
        }
        
        // Si no encontrado, buscar por player.name (fallback)
        if (!hasExistingEmpire) {
            for (const [entityId, entity] of state.entities.entries()) {
                if (entity.type === 'ciudad' && entity.owner === player.name) {
                    existingEmpirePosition = entity.position;
                    existingEntityId = entityId;
                    hasExistingEmpire = true;
                    console.log(`🏰 Imperio existente encontrado por nombre para ${player.name} en (${existingEmpirePosition.x}, ${existingEmpirePosition.y})`);
                    break;
                }
            }
        }
        
        // Si no encontrado en entidades, buscar en mapData
        if (!hasExistingEmpire) {
            const mapData = this.globalState.mapData;
            if (mapData) {
                for (let y = 0; y < mapData.length; y++) {
                    for (let x = 0; x < mapData[y].length; x++) {
                        const tile = mapData[y][x];
                        if (tile.type === 'ciudad' && (tile.owner === player.id || tile.owner === player.name)) {
                            existingEmpirePosition = { x, y };
                            hasExistingEmpire = true;
                            console.log(`🏰 Imperio existente encontrado en mapData para ${player.name} en (${x}, ${y})`);
                            // Crear entidad si no existe
                            const ciudadEntity = {
                                id: `ciudad_${Date.now()}_${player.name.replace(/[^a-zA-Z0-9]/g, '')}`,
                                type: 'ciudad',
                                position: existingEmpirePosition,
                                owner: player.id,
                                level: 1,
                                createdAt: Date.now()
                            };
                            state.entities.set(ciudadEntity.id, ciudadEntity);
                            this.syncEntitiesToMap();
                            console.log(`🔄 Entidad de imperio recreada para ${player.name}`);
                            break;
                        }
                    }
                    if (hasExistingEmpire) break;
                }
            }
        }
        
        if (hasExistingEmpire) {
            // Usar posición del imperio existente si es válida
            if (this.isValidSpawnPosition(existingEmpirePosition, player.id)) {
                position = existingEmpirePosition;
            } else {
                console.warn(`⚠️ Posición de imperio existente no válida para ${player.name}, generando nueva`);
                position = this.generateValidSpawnPosition(player.id);
            }
        } else if (position && this.isValidSpawnPosition(position, player.id)) {
            // Si no hay existente y se proporciona posición válida, usarla y crear imperio allí
            console.log(`📍 Usando posición proporcionada para nuevo imperio de ${player.name}: (${position.x}, ${position.y})`);
        } else {
            // Generar nueva posición para nuevo imperio
            position = this.generateValidSpawnPosition(player.id);
            console.log(`🎲 Generando nuevo imperio para ${player.name}: (${position.x}, ${position.y})`);
        }
        
        // Si no hay imperio existente, crear uno nuevo en la posición determinada
        if (!hasExistingEmpire) {
            const ciudadEntity = {
                id: `ciudad_${Date.now()}_${player.name.replace(/[^a-zA-Z0-9]/g, '')}`,
                type: 'ciudad',
                position: { ...position },
                owner: player.id,
                level: 1,
                createdAt: Date.now()
            };
            state.entities.set(ciudadEntity.id, ciudadEntity);
            
            // Sincronizar con mapa
            this.syncEntitiesToMap();
            
            // console.log(`🏰 Nuevo imperio creado y sincronizado para ${player.name}`);
        }
        
        // Si no hay datos de mapa, generarlos ahora
        if (!this.globalState.mapData) {
            this.generateAndSaveMapData();
        }
        
        // Generate unique color for player based on ID
        let color = '#';
        let hash = 0;
        for (let i = 0; i < player.id.length; i++) {
            hash = player.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).slice(-2);
        }

        state.players.set(player.id, {
            id: player.id,
            name: player.name,
            type: player.type || 'player',
            position: position,
            color: color,
            joinedAt: Date.now(),
            lastActivity: Date.now(),
            isAdmin: player.isAdmin || false,
            isNPC: player.isNPC || false,
            lastSavedPosition: { ...position }  // Para debounce de moves
        });
        
        // Guardar posición persistente
        this.savePlayerPosition(player.id, position);
        
        // console.log(`👤 Jugador ${player.name} (${player.type || 'player'}) agregado al estado de ${roomId} en posición (${position.x}, ${position.y}) ${hasExistingEmpire ? '(imperio existente)' : '(nuevo imperio)'}`);
        // console.log(`[DEBUG] Total players in ${roomId}: ${state.players.size}`);
    }
    
    removePlayer(roomId, playerId) {
        const state = this.getRoomState(roomId);
        if (!state) return;
        
        state.players.delete(playerId);
        // console.log(`👤 Jugador ${playerId} removido del estado de ${roomId}`);
        // console.log(`[DEBUG] Total players in ${roomId}: ${state.players.size}`);
    }
    
    getStateDelta(roomId, lastSequence = 0) {
        const state = this.getRoomState(roomId);
        if (!state) return null;
        
        // Usar secuencia global en modo desarrollo
        const currentSequence = this.actionSequence || 0;
        
        if (currentSequence <= lastSequence) {
            return null; // No hay cambios
        }
        
        const changes = [];
        
        // Obtener acciones nuevas
        if (state.actionHistory) {
            for (let i = lastSequence; i < currentSequence; i++) {
                const action = state.actionHistory[i];
                if (action && action.sequence > lastSequence) {
                    changes.push(action);
                }
            }
        }
        
        return {
            roomId: roomId,
            sequence: currentSequence,
            changes: changes,
            timestamp: state.lastUpdate,
            version: state.version
        };
    }
    
    cleanupOldStates(maxAge = 3600000) { // 1 hora
        // En modo desarrollo, no limpiar estados individuales
        // Solo mantener el estado global
        return 0;
    }
    
    getStats() {
        // En modo desarrollo, solo estadísticas del estado global
        const stats = {
            totalRooms: 1, // Solo una sala global
            totalPlayers: this.globalState.players.size,
            totalEntities: this.globalState.entities.size,
            totalActions: this.globalState.actionHistory ? this.globalState.actionHistory.length : 0,
            averageActionsPerRoom: this.globalState.actionHistory ? this.globalState.actionHistory.length : 0
        };
        
        return stats;
    }
    
    // Método para obtener el estado global directamente
    getGlobalState() {
        return this.globalState;
    }
    
    // Método para reiniciar el estado global (útil para hot reload)
    resetGlobalState() {
        this.globalState = {
            roomId: this.globalRoomId,
            players: new Map(),
            entities: new Map(),
            lastUpdate: Date.now(),
            sequence: 0,
            version: 1,
            mapData: null,
            playerPositions: new Map()
        };
        this.actionSequence = 0;
        this.lastUpdate = Date.now();
        
        console.log('🔄 Estado global reiniciado para hot reload');
    }
    
    // Método para obtener la secuencia actual (falta en el código original)
    getCurrentSequence() {
        return this.actionSequence || 0;
    }
    
    // Métodos para persistencia de estado
    savePersistentState() {
        const now = Date.now();
        // Debounce: guardar solo si han pasado 5 segundos desde último save
        if (now - this.lastSaveTime < 5000) {
            // console.log('⏳ Save persistente debounceado');
            return;
        }
        
        // Sincronizar antes de guardar
        this.syncEntitiesToMap();
        
        try {
            const persistentData = {
                mapData: this.globalState.mapData,
                entities: Array.from(this.globalState.entities.entries()),
                playerPositions: Array.from(this.globalState.playerPositions.entries()),
                lastSave: now
            };
            
            const filePath = path.join(__dirname, 'persistent-state.json');
            fs.writeFileSync(filePath, JSON.stringify(persistentData, null, 2));
            
            this.lastSaveTime = now;
            // console.log('💾 Estado persistente guardado en archivo');
        } catch (error) {
            console.error('❌ Error al guardar estado persistente:', error);
        }
    }
    
    loadPersistentState() {
        try {
            const filePath = path.join(__dirname, 'persistent-state.json');
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                const persistentData = JSON.parse(data);
                
                // Restaurar datos del mapa si existen
                if (persistentData.mapData) {
                    this.globalState.mapData = persistentData.mapData;
                    // console.log('🗺️ Datos del mapa cargados desde archivo persistente');
                }
                
                // Restaurar entidades si existen
                if (persistentData.entities && persistentData.entities.length > 0) {
                    this.globalState.entities = new Map(persistentData.entities);
                    // console.log('📦 Entidades cargadas desde archivo persistente');
                }
                
                // Restaurar posiciones de jugadores si existen
                if (persistentData.playerPositions && persistentData.playerPositions.length > 0) {
                    this.globalState.playerPositions = new Map(persistentData.playerPositions);
                    // console.log('👥 Posiciones de jugadores cargadas desde archivo persistente');
                }
                
                // console.log('✅ Estado persistente cargado correctamente desde archivo');
            } else {
                console.log('ℹ️ No se encontró archivo de persistencia, iniciando estado nuevo');
            }
        } catch (error) {
            console.error('❌ Error al cargar estado persistente:', error);
        }
    }
    
    // Método para guardar datos del mapa
    saveMapData(mapData) {
        this.globalState.mapData = mapData;
        this.syncEntitiesToMap();
        this.savePersistentState();
        console.log('🗺️ Datos del mapa guardados en estado persistente');
    }
    
    // Método para obtener datos del mapa
    getMapData() {
        return this.globalState.mapData;
    }
    
    // Método para guardar posición de un jugador (usando playerName como clave)
    savePlayerPosition(playerId, position) {
        this.globalState.playerPositions.set(playerId, {
            x: position.x,
            y: position.y,
            timestamp: Date.now()
        });
        this.savePersistentState();
        // console.log(`💾 Posición de jugador ${playerId} guardada: (${position.x}, ${position.y})`);
    }
    
    // Método para obtener posición guardada de un jugador (usando playerName)
    getSavedPlayerPosition(playerId) {
        const positionData = this.globalState.playerPositions.get(playerId);
        if (positionData) {
            // Verificar si la posición es reciente (menos de 24 horas)
            if (Date.now() - positionData.timestamp < 24 * 60 * 60 * 1000) {
                return { x: positionData.x, y: positionData.y };
            } else {
                // Eliminar posición antigua
                this.globalState.playerPositions.delete(playerId);
                this.savePersistentState();
            }
        }
        return null;
    }
    
    // Método para eliminar posición guardada de un jugador (usando playerName)
    removeSavedPlayerPosition(playerId) {
        if (this.globalState.playerPositions.has(playerId)) {
            this.globalState.playerPositions.delete(playerId);
            this.savePersistentState();
            // console.log(`🗑️ Posición guardada eliminada para jugador ${playerId}`);
        }
    }
    
    // Método para generar una semilla de mapa consistente
    generateMapSeed(playerId) {
        // Usar el ID del jugador para generar una semilla consistente
        let seed = 0;
        for (let i = 0; i < playerId.length; i++) {
            seed += playerId.charCodeAt(i);
        }
        return seed;
    }
    
    // Método para generar y guardar datos del mapa
    generateAndSaveMapData() {
        console.log('🗺️ Generando y guardando datos del mapa');
        
        // Generar mapa aleatorio
        const mapSize = 50;
        const map = Array.from({ length: mapSize }, () => Array(mapSize).fill(null));
        
        const biomes = ['llanura', 'montana', 'desierto', 'nieve', 'bosque', 'pantano', 'agua'];
        const numSeeds = 15;
        const seeds = [];
        
        // 1. Generate biome seed points
        for (let i = 0; i < numSeeds; i++) {
            seeds.push({
                x: Math.random() * mapSize,
                y: Math.random() * mapSize,
                biome: biomes[Math.floor(Math.random() * biomes.length)]
            });
        }
        
        // Add a guaranteed large water body
        const waterSeedX = Math.random() * mapSize;
        const waterSeedY = Math.random() * mapSize;
        for (let i = 0; i < 3; i++) {
            seeds.push({
                x: waterSeedX + (Math.random() - 0.5) * 8,
                y: waterSeedY + (Math.random() - 0.5) * 8,
                biome: 'agua'
            });
        }
        
        // 2. Assign biomes based on nearest seed (Voronoi)
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                let nearestDist = Infinity;
                let nearestBiome = 'llanura';
                for (const seed of seeds) {
                    const dist = Math.sqrt((x - seed.x) ** 2 + (y - seed.y) ** 2);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestBiome = seed.biome;
                    }
                }
                map[y][x] = { type: nearestBiome, owner: null, troops: { milicia: 0, archer: 0, cavalry: 0 } };
            }
        }
        
        // 3. Sprinkle special tiles randomly
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                const tile = map[y][x];
                if (tile.type !== 'ciudad' && tile.type !== 'agua') {
                    const rand = Math.random();
                    if (rand < 0.02) { // 2% chance for crystals
                        tile.type = 'cristales';
                    } else if (rand < 0.04) { // 2% chance for ruins
                        tile.type = 'ruinas';
                    }
                }
            }
        }
        
        // 4. Assign resources to all tiles
        const getTileResources = (type) => {
            const resources = {
                llanura: { food: 50, wood: 20 },
                montana: { stone: 40, metal: 20 },
                nieve: { metal: 10 },
                ciudad: { food: 30, wood: 30, stone: 30, metal: 30, imperion: 10 },
                desierto: { food: 10, metal: 20 },
                bosque: { wood: 60, food: 10 },
                pantano: { food: 20, wood: 10 },
                ruinas: { metal: 15, imperion: 5 },
                cristales: { imperion: 20, stone: 10 },
                agua: {} // Water produces no resources
            };
            return resources[type] || {};
        };
        
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                map[y][x].resources = getTileResources(map[y][x].type);
            }
        }
        
        // Guardar datos del mapa para persistencia
        this.saveMapData(map);
        
        return map;
    }
    
    // Método para limpiar imperios huérfanos (sin jugadores asociados)
    cleanOrphanedEmpires() {
        console.log('🧹 Limpiando imperios huérfanos...');
        
        const state = this.getGlobalState();
        if (!state) return;
        
        let cleanedCount = 0;
        const playersToRemove = [];
        const entitiesToRemove = [];
        
        // Limpiar ciudades con propietario "neutral" u otros valores inválidos
        for (const [entityId, entity] of state.entities.entries()) {
            if (entity.type === 'ciudad') {
                // Si el propietario es "neutral", null, undefined o string vacío, eliminar
                if (!entity.owner || entity.owner === 'neutral' || entity.owner === '' || entity.owner === null) {
                    entitiesToRemove.push(entityId);
                    console.log(`🗑️ Eliminando ciudad con propietario inválido: ${entityId} (dueño: ${entity.owner})`);
                    cleanedCount++;
                }
            }
        }
        
        // Buscar jugadores sin imperio asociado y entidades huérfanas
        for (const [playerId, player] of state.players.entries()) {
            let hasEmpire = false;
            
            // Verificar si el jugador tiene una ciudad en entidades
            for (const [entityId, entity] of state.entities.entries()) {
                if (entity.type === 'ciudad' && entity.owner === player.id) {
                    hasEmpire = true;
                    break;
                }
            }
            
            // Si no tiene imperio, marcar para eliminación
            if (!hasEmpire) {
                playersToRemove.push(playerId);
                console.log(`⚠️ Jugador ${player.name} (${playerId}) no tiene imperio asociado`);
            }
        }
        
        // Buscar entidades huérfanas (ciudades sin dueño existente)
        for (const [entityId, entity] of state.entities.entries()) {
            if (entity.type === 'ciudad' && entity.owner && entity.owner !== 'neutral') {
                let ownerExists = false;
                for (const [playerId, player] of state.players.entries()) {
                    if (player.id === entity.owner) {
                        ownerExists = true;
                        break;
                    }
                }
                
                if (!ownerExists) {
                    entitiesToRemove.push(entityId);
                    console.log(`🗑️ Eliminando entidad huérfana: ${entityId} (dueño: ${entity.owner})`);
                    cleanedCount++;
                }
            }
        }
        
        // Eliminar jugadores sin imperio
        for (const playerId of playersToRemove) {
            const player = state.players.get(playerId);
            if (player) {
                console.log(`🗑️ Eliminando jugador huérfano: ${player.name} (${playerId})`);
                state.players.delete(playerId);
                cleanedCount++;
            }
        }
        
        // Eliminar entidades huérfanas (evitar duplicados)
        const uniqueEntitiesToRemove = [...new Set(entitiesToRemove)];
        for (const entityId of uniqueEntitiesToRemove) {
            state.entities.delete(entityId);
        }
        
        // Limpiar posiciones de jugadores huérfanos
        for (const playerId of playersToRemove) {
            if (this.globalState.playerPositions.has(playerId)) {
                this.globalState.playerPositions.delete(playerId);
                console.log(`🗑️ Posición eliminada para jugador huérfano: ${playerId}`);
            }
        }
        
        if (uniqueEntitiesToRemove.length > 0 || playersToRemove.length > 0) {
            console.log(`✅ Se limpiaron ${uniqueEntitiesToRemove.length + playersToRemove.length} elementos huérfanos (${playersToRemove.length} jugadores, ${uniqueEntitiesToRemove.length} entidades)`);
            this.syncEntitiesToMap();
            this.savePersistentState();
        } else {
            console.log('✅ No se encontraron elementos huérfanos');
        }
        
        return uniqueEntitiesToRemove.length + playersToRemove.length;
    }
}

module.exports = StateManager;