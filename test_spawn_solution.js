const DevGameServer = require('./server/game/DevGameServer');
const StateManager = require('./server/game/StateManager');

// Simular el servidor para pruebas
console.log('🧪 Iniciando pruebas de solución de spawn persistente...\n');

// Crear instancias simuladas
const stateManager = new StateManager();
// Simular objeto io básico
const io = {
    emit: (event, data) => {
        console.log(`📡 Broadcast: ${event}`, data);
    }
};
const chatManager = { addMessage: () => {}, addToGlobalChat: () => {} };
const spectatorManager = { getTotalSpectatorCount: () => 0 };

const server = new DevGameServer(io, stateManager, chatManager, spectatorManager);

// Simular socket para pruebas
class MockSocket {
    constructor(id) {
        this.id = id;
        this.playerId = id;
        this.currentRoom = null;
        this.isSpectator = false;
        this.room = { players: new Map() };
        this.emit = (event, data) => {
            console.log(`📡 Socket ${this.id} recibió evento: ${event}`, data);
        };
        this.join = (room) => {
            this.currentRoom = room;
            console.log(`🔗 Socket ${this.id} se unió a sala: ${room}`);
        };
        this.leave = (room) => {
            this.currentRoom = null;
            console.log(`🚪 Socket ${this.id} dejó sala: ${room}`);
        };
    }
}

// Prueba 1: Verificar que un jugador nuevo spawnee correctamente
console.log('=== PRUEBA 1: Spawn de jugador nuevo ===');
const socket1 = new MockSocket('socket_1');
const playerId1 = 'player_test_1';
const playerName1 = 'Jugador de Prueba 1';

server.handleJoin(socket1, {
    playerId: playerId1,
    name: playerName1,
    preferredPosition: { x: 10, y: 10 }
});

// Prueba 2: Verificar que el mismo jugador vuelva a spawnear en el mismo lugar
console.log('\n=== PRUEBA 2: Re-conexión del mismo jugador ===');
const socket2 = new MockSocket('socket_2');
server.handleJoin(socket2, {
    playerId: playerId1,
    name: playerName1,
    preferredPosition: { x: 20, y: 20 } // Esto debería ser ignorado
});

// Prueba 3: Verificar que un segundo jugador nuevo spawnee en lugar diferente
console.log('\n=== PRUEBA 3: Spawn de segundo jugador ===');
const socket3 = new MockSocket('socket_3');
const playerId2 = 'player_test_2';
const playerName2 = 'Jugador de Prueba 2';

server.handleJoin(socket3, {
    playerId: playerId2,
    name: playerName2,
    preferredPosition: { x: 30, y: 30 }
});

// Prueba 4: Verificar limpieza de imperios huérfanos
console.log('\n=== PRUEBA 4: Limpieza de imperios huérfanos ===');
// Simular un imperio huérfano (creado en el mapa pero sin jugador activo)
const state = stateManager.getGlobalState();
if (state.mapData) {
    // Encontrar una posición libre y crear una ciudad "huérfana"
    for (let y = 0; y < state.mapData.length; y++) {
        for (let x = 0; x < state.mapData[y].length; x++) {
            if (!state.mapData[y][x].owner && state.mapData[y][x].type !== 'agua') {
                state.mapData[y][x] = {
                    type: 'ciudad',
                    owner: 'orphan_player_' + Date.now(),
                    troops: { milicia: 30, archer: 15, cavalry: 5 },
                    resources: { food: 30, wood: 30, stone: 30, metal: 30, imperion: 10 }
                };
                console.log(`🏰 Creado imperio huérfano en (${x}, ${y})`);
                break;
            }
        }
        if (state.mapData[y] && state.mapData[y].some(tile => tile.owner && tile.owner.startsWith('orphan_'))) {
            break;
        }
    }
}

// Intentar unir un nuevo jugador para activar la limpieza
const socket4 = new MockSocket('socket_4');
const playerId3 = 'player_test_3';
const playerName3 = 'Jugador de Prueba 3';

server.handleJoin(socket4, {
    playerId: playerId3,
    name: playerName3,
    preferredPosition: { x: 40, y: 40 }
});

// Verificar estado final
console.log('\n=== ESTADO FINAL ===');
const finalState = stateManager.getGlobalState();
console.log(`📊 Total de jugadores en el servidor: ${finalState.players.size}`);
console.log(`🗺️ Total de ciudades en el mapa: ${finalState.mapData ? finalState.mapData.flat().filter(tile => tile.type === 'ciudad').length : 0}`);
console.log(`👥 Total de posiciones guardadas: ${finalState.playerPositions.size}`);

// Verificar posiciones guardadas
console.log('\n=== POSICIONES GUARDADAS ===');
for (const [playerId, positionData] of finalState.playerPositions) {
    console.log(`📍 Jugador ${playerId}: (${positionData.x}, ${positionData.y})`);
}

console.log('\n✅ Pruebas completadas. Verifica los logs para confirmar que la solución funciona correctamente.');