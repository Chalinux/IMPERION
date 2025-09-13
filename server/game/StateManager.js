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
        
        // Cargar datos desde archivos JSON separados
        this.loadSeparatedData();
        
        // Limpiar datos y sincronizar después de cargar
        this.cleanupDataAfterLoad();
        
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
        // En un juego 4x, los imperios son estáticos, no se mueven
        // Ignorar cualquier intento de movimiento sin generar logs
    }
    
    processBuildAction(state, action) {
        const { playerId, payload } = action;
        const player = state.players.get(playerId);
        
        if (!player) {
            console.warn(`⚠️ Jugador ${playerId} no encontrado en el estado`);
            return;
        }
        
        // Si es una ciudad, manejar como entidad separada
        if (payload.type === 'ciudad') {
            this.handleCityConstruction(state, player, payload);
        } else {
            // Para buildings normales, verificar si son internos o del mapa global
            this.handleBuildingConstruction(state, player, payload);
        }
    }
    
    // Método para manejar construcción de ciudades
    handleCityConstruction(state, player, payload) {
        // Verificar si el jugador ya tiene una ciudad
        let existingCity = null;
        for (const [entityId, entity] of state.entities.entries()) {
            if (entity.type === 'ciudad' && entity.owner === player.id) {
                existingCity = entity;
                break;
            }
        }
        
        if (existingCity) {
            console.warn(`⚠️ Jugador ${player.name} ya tiene una ciudad (${existingCity.id}). Actualizando nivel.`);
            existingCity.level = Math.max(existingCity.level, payload.level || 1);
            this.syncEntitiesToMap();
            return;
        }
        
        // Crear nueva ciudad
        const city = {
            id: `ciudad_${Date.now()}_${player.name.replace(/[^a-zA-Z0-9]/g, '')}`,
            type: 'ciudad',
            position: {
                x: payload.x,
                y: payload.y
            },
            owner: player.id,
            level: payload.level || 1,
            createdAt: Date.now(),
            buildings: [] // Buildings se almacenarán aquí, no como entidades separadas
        };
        
        state.entities.set(city.id, city);
        this.syncEntitiesToMap();
        
        // Guardar en cities.json
        this.saveCityToJSON(city);
        
        console.log(`🏰 Nueva ciudad creada para ${player.name} en (${payload.x}, ${payload.y})`);
    }
    
    // Método para manejar construcción de buildings (dentro de ciudades)
    handleBuildingConstruction(state, player, payload) {
        // Definir tipos de construcciones internas (no ocupan tiles en el mapa global)
        const internalBuildingTypes = ['cuartel', 'mercado', 'castillo', 'casa', 'granja', 'mina'];
        
        // Si el tipo de building no es interno, bloquear su creación en el mapa global
        if (!internalBuildingTypes.includes(payload.type)) {
            console.warn(`⚠️ Tipo de construcción no permitido en mapa global: ${payload.type}`);
            return;
        }
        
        // Encontrar la ciudad del jugador
        let playerCity = null;
        for (const [entityId, entity] of state.entities.entries()) {
            if (entity.type === 'ciudad' && entity.owner === player.id) {
                playerCity = entity;
                break;
            }
        }
        
        if (!playerCity) {
            console.warn(`⚠️ No se encontró ciudad para el jugador ${player.name}. No se puede construir building.`);
            return;
        }
        
        // Verificar si ya existe un building de este tipo en la ciudad (evitar duplicados)
        if (playerCity.buildings) {
            const existingBuilding = playerCity.buildings.find(b => b.type === payload.type);
            if (existingBuilding) {
                console.log(`🏗️ ${player.name} ya tiene un ${payload.type} en su ciudad. Actualizando nivel.`);
                existingBuilding.level = Math.max(existingBuilding.level, payload.level || 1);
                existingBuilding.hp = this.getBuildingHP(payload.type, existingBuilding.level);
                this.saveCityToJSON(playerCity);
                return;
            }
        }
        
        // Crear building interno (sin posición en el mapa global)
        const building = {
            id: `building_${Date.now()}`,
            type: payload.type,
            // Los buildings internos NO tienen posición en el mapa global, solo en la ciudad
            owner: player.id,
            level: payload.level || 1,
            hp: this.getBuildingHP(payload.type, payload.level || 1), // Añadir HP
            createdAt: Date.now()
        };
        
        // Usar el método centralizado para crear o actualizar buildings
        this.createOrUpdateBuilding(state, player, payload.type, payload.level || 1);
    }
    
    // Método para obtener HP base de un building según su tipo
    getBuildingHP(buildingType, level = 1) {
        const hpValues = {
            'cuartel': 1000,
            'mercado': 800,
            'castillo': 1500,
            'casa': 500,
            'granja': 600,
            'mina': 700
        };
        return (hpValues[buildingType] || 500) * level;
    }
    
    // Método centralizado para crear o actualizar buildings
    createOrUpdateBuilding(state, player, buildingType, level = 1) {
        // Validar tipo de building
        const validBuildingTypes = ['cuartel', 'mercado', 'castillo', 'casa', 'granja', 'mina'];
        if (!validBuildingTypes.includes(buildingType)) {
            console.warn(`⚠️ Tipo de building inválido: ${buildingType}`);
            return null;
        }
        
        // Encontrar la ciudad del jugador
        let playerCity = null;
        for (const [entityId, entity] of state.entities.entries()) {
            if (entity.type === 'ciudad' && entity.owner === player.id) {
                playerCity = entity;
                break;
            }
        }
        
        if (!playerCity) {
            console.warn(`⚠️ No se encontró ciudad para el jugador ${player.name}. No se puede construir building.`);
            return null;
        }
        
        // Verificar si ya existe un building de este tipo
        if (playerCity.buildings) {
            const existingBuilding = playerCity.buildings.find(b => b.type === buildingType);
            if (existingBuilding) {
                console.log(`🏗️ ${player.name} ya tiene un ${buildingType}. Actualizando a nivel ${level}.`);
                existingBuilding.level = Math.max(existingBuilding.level, level);
                existingBuilding.hp = this.getBuildingHP(buildingType, existingBuilding.level);
                this.saveCityToJSON(playerCity);
                return existingBuilding;
            }
        }
        
        // Crear nuevo building
        const building = {
            id: `building_${Date.now()}`,
            type: buildingType,
            owner: player.id,
            level: level,
            hp: this.getBuildingHP(buildingType, level),
            createdAt: Date.now()
        };
        
        // Agregar building a la ciudad
        if (!playerCity.buildings) {
            playerCity.buildings = [];
        }
        playerCity.buildings.push(building);
        
        // Guardar en cities.json
        this.saveCityToJSON(playerCity);
        
        console.log(`🏗️ ${player.name} construyó un ${buildingType} (nivel ${level})`);
        return building;
    }
    
    // Método para obtener buildings de un jugador
    getPlayerBuildings(playerId) {
        const citiesData = this.loadJSONFile('cities.json');
        const playerBuildings = [];
        
        if (citiesData.cities) {
            for (const [cityId, city] of citiesData.cities) {
                if (city.owner === playerId && city.buildings) {
                    playerBuildings.push(...city.buildings);
                }
            }
        }
        
        return playerBuildings;
    }
    
    // Método para verificar si un jugador tiene un tipo específico de building
    hasBuildingType(playerId, buildingType) {
        const buildings = this.getPlayerBuildings(playerId);
        return buildings.some(building => building.type === buildingType);
    }
    
    // Método para obtener nivel de un tipo específico de building
    getBuildingLevel(playerId, buildingType) {
        const buildings = this.getPlayerBuildings(playerId);
        const building = buildings.find(b => b.type === buildingType);
        return building ? building.level : 0;
    }
    
    // Método para guardar ciudad en JSON
    saveCityToJSON(city) {
        try {
            const citiesData = this.loadJSONFile('cities.json');
            
            // Si no existe la estructura, crearla
            if (!citiesData.cities) {
                citiesData.cities = [];
            }
            
            // Buscar si la ciudad ya existe
            let cityExists = false;
            for (let i = 0; i < citiesData.cities.length; i++) {
                if (citiesData.cities[i][0] === city.id) {
                    citiesData.cities[i] = [city.id, city];
                    cityExists = true;
                    break;
                }
            }
            
            // Si no existe, agregarla
            if (!cityExists) {
                citiesData.cities.push([city.id, city]);
            }
            
            // Guardar actualizado
            this.saveJSONFile('cities.json', citiesData);
            
        } catch (error) {
            console.error('❌ Error al guardar ciudad en JSON:', error);
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
                    // Mantener el tipo de terreno pero resetear owner
                    const currentType = map[y][x].type;
                    map[y][x] = {
                        type: currentType,
                        owner: null,
                        troops: { milicia: 0, archer: 0, cavalry: 0 },
                        resources: map[y][x].resources || {}
                    };
                }
            }
        }
        
        // Set type and owner from ciudad entities (sincronizar solo ciudades)
        for (const [entityId, entity] of this.globalState.entities.entries()) {
            if (entity.type === 'ciudad' && entity.position && map[entity.position.y] && map[entity.position.y][entity.position.x]) {
                const tile = map[entity.position.y][entity.position.x];
                tile.type = 'ciudad';
                tile.owner = entity.owner;
                // console.log(`🔄 Sincronizado ciudad ${entityId} en (${entity.position.x}, ${entity.position.y}) owner: ${entity.owner}`);
            }
        }
        
        console.log('🔄 Entidades sincronizadas con el mapa (solo ciudades)');
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
        
        // 1. Primero buscar si el jugador ya tiene un imperio existente
        let existingEmpirePosition = null;
        
        // Buscar imperio existente en entidades (priorizando por player.id)
        for (const [entityId, entity] of state.entities.entries()) {
            if (entity.type === 'ciudad' && entity.owner === player.id) {
                existingEmpirePosition = entity.position;
                hasExistingEmpire = true;
                break;
            }
        }
        
        // Si no encontrado por ID, buscar por nombre (fallback)
        if (!hasExistingEmpire) {
            for (const [entityId, entity] of state.entities.entries()) {
                if (entity.type === 'ciudad' && entity.owner === player.name) {
                    existingEmpirePosition = entity.position;
                    hasExistingEmpire = true;
                    break;
                }
            }
        }
        
        // Si tiene imperio existente, usar esa posición
        if (hasExistingEmpire && existingEmpirePosition) {
            position = existingEmpirePosition;
            console.log(`🏰 Jugador ${player.name} tiene imperio existente en (${position.x}, ${position.y})`);
        } else {
            console.log(`🆕 Jugador ${player.name} no tiene imperio existente, generando nueva posición...`);
            
            // Si no tiene imperio, generar nueva posición (ignorando posición guardada en players.json)
            position = this.generateValidSpawnPosition(player.id);
            
            // Crear nuevo imperio en la posición determinada
            const ciudadEntity = {
                id: `ciudad_${Date.now()}_${player.name.replace(/[^a-zA-Z0-9]/g, '')}`,
                type: 'ciudad',
                position: { ...position },
                owner: player.id,
                level: 1,
                createdAt: Date.now()
            };
            state.entities.set(ciudadEntity.id, ciudadEntity);
            this.syncEntitiesToMap();
            
            console.log(`🏰 Nuevo imperio creado para ${player.name} en (${position.x}, ${position.y})`);
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
            joinedAtReadable: new Date().toLocaleString('es-AR'),
            lastActivity: Date.now(),
            lastActivityReadable: new Date().toLocaleString('es-AR'),
            isAdmin: player.isAdmin || false,
            isNPC: player.isNPC || false
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
    
    // Métodos para persistencia de estado (solo archivos JSON separados)
    savePersistentState() {
        const now = Date.now();
        // Debounce: guardar solo si han pasado 5 segundos desde último save
        if (now - this.lastSaveTime < 5000) {
            // console.log('⏳ Save debounceado');
            return;
        }
        
        // Sincronizar antes de guardar
        this.syncEntitiesToMap();
        
        try {
            // Guardar datos en archivos separados (este es el método principal)
            this.saveSeparatedData();
            
            this.lastSaveTime = now;
            console.log('💾 Estado guardado en archivos JSON separados');
        } catch (error) {
            console.error('❌ Error al guardar estado:', error);
        }
    }
    
    loadSeparatedData() {
        try {
            console.log('📖 Cargando datos desde archivos JSON separados...');
            
            // Cargar datos del mapa
            const mapData = this.loadJSONFile('map.json');
            if (mapData.mapData) {
                this.globalState.mapData = mapData.mapData;
                console.log('🗺️ Datos del mapa cargados desde map.json');
            }
            
            // Cargar ciudades y buildings
            const citiesData = this.loadJSONFile('cities.json');
            if (citiesData.cities && citiesData.cities.length > 0) {
                // Limpiar entidades existentes y agregar ciudades
                this.globalState.entities.clear();
                citiesData.cities.forEach(([cityId, city]) => {
                    this.globalState.entities.set(cityId, city);
                });
                console.log('🏰 Ciudades cargadas desde cities.json');
            }
            
            // Cargar jugadores
            const playersData = this.loadJSONFile('players.json');
            if (playersData.players && playersData.players.length > 0) {
                // Limpiar jugadores existentes y agregar nuevos
                this.globalState.players.clear();
                playersData.players.forEach(player => {
                    this.globalState.players.set(player.id, player);
                });
                console.log('👥 Jugadores cargados desde players.json');
            }
            
            // Cargar NPCs
            const npcsData = this.loadJSONFile('npcs.json');
            if (npcsData.npcs && npcsData.npcs.length > 0) {
                // Agregar NPCs a entidades
                npcsData.npcs.forEach(([npcId, npc]) => {
                    this.globalState.entities.set(npcId, npc);
                });
                console.log('👾 NPCs cargados desde npcs.json');
            }
            
            console.log('✅ Datos cargados correctamente desde archivos JSON separados');
        } catch (error) {
            console.error('❌ Error al cargar datos separados:', error);
        }
    }
    
    // Método para limpiar y organizar datos después de cargar
    cleanupDataAfterLoad() {
        console.log('🧹 Limpiando y organizando datos después de carga...');
        
        // Limpiar buildings del mapa global
        this.removeBuildingsFromMap();
        
        // Eliminar ciudades fantasma
        this.removeGhostCities();
        
        // Separar entidades por tipo
        this.separateEntitiesByType();
        
        // Sincronizar entidades con mapa (solo ciudades)
        this.syncEntitiesToMap();
        
        // Guardar datos organizados
        this.saveSeparatedData();
        
        console.log('✅ Datos limpiados y organizados');
    }
    
    // Método para eliminar buildings del mapa global
    removeBuildingsFromMap() {
        console.log('🗑️ Eliminando buildings del mapa global...');
        
        if (!this.globalState.mapData) return;
        
        let removedCount = 0;
        
        for (let y = 0; y < this.globalState.mapData.length; y++) {
            for (let x = 0; x < this.globalState.mapData[y].length; x++) {
                const tile = this.globalState.mapData[y][x];
                if (tile && tile.type && tile.type.startsWith('building_')) {
                    // Eliminar tile de building del mapa
                    this.globalState.mapData[y][x] = {
                        type: 'llanura', // Reemplazar con tipo por defecto
                        owner: null,
                        troops: { milicia: 0, archer: 0, cavalry: 0 },
                        resources: { food: 50, wood: 20 }
                    };
                    removedCount++;
                }
            }
        }
        
        if (removedCount > 0) {
            console.log(`🗑️ Se eliminaron ${removedCount} buildings del mapa global`);
        }
    }
    
    // Método para eliminar ciudades fantasma (owner: null)
    removeGhostCities() {
        console.log('👻 Eliminando ciudades fantasma...');
        
        let removedCount = 0;
        const citiesToRemove = [];
        
        // Buscar ciudades fantasma en entidades
        for (const [entityId, entity] of this.globalState.entities.entries()) {
            if (entity.type === 'ciudad' && (!entity.owner || entity.owner === null || entity.owner === '')) {
                citiesToRemove.push(entityId);
                removedCount++;
            }
        }
        
        // Eliminar ciudades fantasma
        for (const entityId of citiesToRemove) {
            this.globalState.entities.delete(entityId);
        }
        
        // Eliminar ciudades fantasma del mapa
        if (this.globalState.mapData) {
            for (let y = 0; y < this.globalState.mapData.length; y++) {
                for (let x = 0; x < this.globalState.mapData[y].length; x++) {
                    const tile = this.globalState.mapData[y][x];
                    if (tile && tile.type === 'ciudad' && (!tile.owner || tile.owner === null || tile.owner === '')) {
                        this.globalState.mapData[y][x] = {
                            type: 'llanura', // Reemplazar con tipo por defecto
                            owner: null,
                            troops: { milicia: 0, archer: 0, cavalry: 0 },
                            resources: { food: 50, wood: 20 }
                        };
                        removedCount++;
                    }
                }
            }
        }
        
        if (removedCount > 0) {
            console.log(`👻 Se eliminaron ${removedCount} ciudades fantasma`);
        }
    }
    
    // Método para separar entidades por tipo
    separateEntitiesByType() {
        console.log('📦 Separando entidades por tipo...');
        
        const cities = [];
        const buildings = [];
        const npcs = [];
        
        for (const [entityId, entity] of this.globalState.entities.entries()) {
            if (entity.type === 'ciudad') {
                cities.push([entityId, entity]);
            } else if (entity.type && (entity.type.startsWith('building_') || ['casa', 'cuartel', 'granja', 'mina'].includes(entity.type))) {
                buildings.push([entityId, entity]);
            } else if (entity.type === 'npc') {
                npcs.push([entityId, entity]);
            }
        }
        
        // Limpiar entidades existentes y agregar las separadas
        this.globalState.entities.clear();
        
        // Agregar ciudades (solo como entidades en el estado global)
        cities.forEach(([id, city]) => {
            this.globalState.entities.set(id, city);
        });
        
        // Guardar buildings en cities.json (dentro de la ciudad correspondiente)
        this.saveBuildingsToCities(buildings);
        
        // Guardar NPCs en npcs.json
        this.saveNPCs(npcs);
        
        console.log(`📦 Separadas: ${cities.length} ciudades, ${buildings.length} buildings, ${npcs.length} NPCs`);
    }
    
    // Método para guardar buildings en las ciudades correspondientes
    saveBuildingsToCities(buildings) {
        try {
            const citiesData = this.loadJSONFile('cities.json');
            
            buildings.forEach(([buildingId, building]) => {
                // Encontrar la ciudad correspondiente
                let found = false;
                for (const [cityId, city] of citiesData.cities) {
                    if (city.owner === building.owner) {
                        // Verificar si ya existe un building de este tipo para evitar duplicados
                        if (city.buildings) {
                            const existingBuilding = city.buildings.find(b => b.type === building.type);
                            if (existingBuilding) {
                                console.log(`🏗️ Ciudad ${cityId} ya tiene un ${building.type}. Actualizando existente.`);
                                existingBuilding.level = Math.max(existingBuilding.level, building.level || 1);
                                existingBuilding.hp = this.getBuildingHP(building.type, existingBuilding.level);
                                found = true;
                                break;
                            }
                        }
                        
                        // Agregar building a la ciudad
                        if (!city.buildings) {
                            city.buildings = [];
                        }
                        city.buildings.push(building);
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    console.warn(`⚠️ No se encontró ciudad para el building ${buildingId} (owner: ${building.owner})`);
                }
            });
            
            // Guardar actualizado
            this.saveJSONFile('cities.json', citiesData);
            
        } catch (error) {
            console.error('❌ Error al guardar buildings en ciudades:', error);
        }
    }
    
    // Método para guardar NPCs
    saveNPCs(npcs) {
        try {
            const npcsData = this.loadJSONFile('npcs.json');
            
            npcs.forEach(([id, npc]) => {
                npcsData.npcs.push([id, npc]);
            });
            
            // Guardar actualizado
            this.saveJSONFile('npcs.json', npcsData);
            
        } catch (error) {
            console.error('❌ Error al guardar NPCs:', error);
        }
    }
    
    // Método para guardar datos separados
    saveSeparatedData() {
        try {
            // Guardar mapData (solo tiles de terreno y ciudades como entidades)
            const mapData = {
                mapData: this.globalState.mapData,
                lastUpdate: Date.now()
            };
            this.saveJSONFile('map.json', mapData);
            
            // Guardar cities con buildings
            const citiesData = {
                cities: [],
                lastUpdate: Date.now()
            };
            
            // Extraer ciudades y sus buildings desde las entidades
            for (const [entityId, entity] of this.globalState.entities.entries()) {
                if (entity.type === 'ciudad') {
                    citiesData.cities.push([entityId, entity]);
                }
            }
            
            this.saveJSONFile('cities.json', citiesData);
            
            // Guardar players
            const playersData = {
                players: Array.from(this.globalState.players.values()),
                lastUpdate: Date.now()
            };
            this.saveJSONFile('players.json', playersData);
            
            // Guardar NPCs (vacío por ahora)
            const npcsData = {
                npcs: [],
                lastUpdate: Date.now()
            };
            this.saveJSONFile('npcs.json', npcsData);
            
            console.log('💾 Datos separados guardados: map.json, cities.json, players.json, npcs.json');
            
        } catch (error) {
            console.error('❌ Error al guardar datos separados:', error);
        }
    }
    
    // Método auxiliar para cargar JSON
    loadJSONFile(filename) {
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, filename);
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
            return { [filename.replace('.json', '')]: [], lastUpdate: 0 };
        } catch (error) {
            console.error(`❌ Error al cargar ${filename}:`, error);
            return { [filename.replace('.json', '')]: [], lastUpdate: 0 };
        }
    }
    
    // Método auxiliar para guardar JSON
    saveJSONFile(filename, data) {
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, filename);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`❌ Error al guardar ${filename}:`, error);
        }
    }
    
    // Método para guardar datos del mapa
    saveMapData(mapData) {
        this.globalState.mapData = mapData;
        this.syncEntitiesToMap();
        this.saveSeparatedData();
        console.log('🗺️ Datos del mapa guardados');
    }
    
    // Método para obtener datos del mapa
    getMapData() {
        return this.globalState.mapData;
    }
    
    // Método para guardar posición de un jugador (usando playerId como clave)
    savePlayerPosition(playerId, position) {
        // Guardar en el archivo players.json para persistencia real
        try {
            const playersData = this.loadJSONFile('players.json');
            
            // Si no existe la estructura, crearla
            if (!playersData.players) {
                playersData.players = [];
            }
            
            // Buscar al jugador en el archivo
            let playerFound = false;
            for (let i = 0; i < playersData.players.length; i++) {
                const player = playersData.players[i];
                if (player.id === playerId) {
                    // Actualizar solo la posición principal
                    player.position = { x: position.x, y: position.y };
                    player.lastActivity = Date.now();
                    playerFound = true;
                    break;
                }
            }
            
            // Si no se encontró, agregar el jugador
            if (!playerFound) {
                playersData.players.push({
                    id: playerId,
                    name: playerId,
                    type: 'player',
                    position: { x: position.x, y: position.y },
                    lastActivity: Date.now(),
                    isAdmin: false,
                    isNPC: false
                });
            }
            
            // Guardar actualizado
            this.saveJSONFile('players.json', playersData);
            console.log(`💾 Posición de jugador ${playerId} guardada en players.json: (${position.x}, ${position.y})`);
            
        } catch (error) {
            console.error('❌ Error al guardar posición de jugador en players.json:', error);
        }
        
        // También guardar en memoria para acceso rápido
        this.globalState.playerPositions.set(playerId, {
            x: position.x,
            y: position.y,
            timestamp: Date.now()
        });
        this.saveSeparatedData();
    }
    
    // Método para obtener posición guardada de un jugador (usando playerId)
    getSavedPlayerPosition(playerId) {
        // Primero intentar obtener del archivo players.json (fuente de verdad)
        try {
            const playersData = this.loadJSONFile('players.json');
            if (playersData.players) {
                for (const player of playersData.players) {
                    if (player.id === playerId) {
                        if (player.position) {
                            console.log(`📍 Posición obtenida de players.json para ${playerId}: (${player.position.x}, ${player.position.y})`);
                            return { x: player.position.x, y: player.position.y };
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error al obtener posición de players.json:', error);
        }
        
        // Fallback a memoria
        const positionData = this.globalState.playerPositions.get(playerId);
        if (positionData) {
            // Verificar si la posición es reciente (menos de 24 horas)
            if (Date.now() - positionData.timestamp < 24 * 60 * 60 * 1000) {
                return { x: positionData.x, y: positionData.y };
            } else {
                // Eliminar posición antigua
                this.globalState.playerPositions.delete(playerId);
                this.saveSeparatedData();
            }
        }
        return null;
    }
    
    // Método para eliminar posición guardada de un jugador (usando playerName)
    removeSavedPlayerPosition(playerId) {
        // Eliminar del archivo players.json
        try {
            const playersData = this.loadJSONFile('players.json');
            if (playersData.players) {
                playersData.players = playersData.players.filter(player =>
                    player.id !== playerId && player.name !== playerId
                );
                this.saveJSONFile('players.json', playersData);
                console.log(`🗑️ Jugador eliminado de players.json: ${playerId}`);
            }
        } catch (error) {
            console.error('❌ Error al eliminar jugador de players.json:', error);
        }
        
        // Eliminar de memoria
        if (this.globalState.playerPositions.has(playerId)) {
            this.globalState.playerPositions.delete(playerId);
            this.saveSeparatedData();
            console.log(`🗑️ Posición guardada eliminada para jugador ${playerId}`);
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
                map[y][x] = {
                    x: x,
                    y: y,
                    type: nearestBiome,
                    owner: null,
                    troops: { milicia: 0, archer: 0, cavalry: 0 }
                };
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
                // Asegurarse de que el tile tenga coordenadas y recursos
                if (!map[y][x].x) map[y][x].x = x;
                if (!map[y][x].y) map[y][x].y = y;
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
            this.saveSeparatedData();
        } else {
            console.log('✅ No se encontraron elementos huérfanos');
        }
        
        return uniqueEntitiesToRemove.length + playersToRemove.length;
    }
}

module.exports = StateManager;