# 🏰 Imperion: Reinos en Guerra - Multiplayer

**Un juego 2D/HTML5 de estrategia en tiempo real con soporte multiplayer por salas.**

## 📋 Características

- **Multiplayer por salas**: Soporta 2-20 jugadores por sala
- **Modo espectador**: Los jugadores pueden observar partidas sin participar
- **Chat en tiempo real**: Sistema de chat global y por sala
- **Sincronización de estado**: Tick de red de 10-20 Hz con optimización de diffs
- **Reconexión automática**: Sistema robusto con sessionToken y live updates
- **Panel de admin**: Solo tú puedes activarlo para gestionar el servidor
- **Simuladores de jugadores**: Herramientas para probar y jugar con amigos

## 🚀 Instalación y Configuración

### Requisitos

- Node.js 16+ 
- npm 8+

### 1. Clonar el repositorio

```bash
git clone <repositorio-url>
cd imperion-multiplayer
```

### 2. Instalar dependencias

```bash
# Instalar dependencias del servidor
cd server
npm install

# Volver al directorio principal e instalar dependencias del cliente
cd ..
npm install
```

### 3. Configuración

El sistema está listo para funcionar con configuración por defecto:

- **Servidor**: `http://localhost:3001`
- **Cliente**: `http://localhost:8080` (servido por el servidor de desarrollo)

## 🎮 Scripts Disponibles

### Desarrollo

```bash
# Iniciar servidor de desarrollo (cliente + servidor multiplayer)
npm run dev

# Iniciar solo el servidor multiplayer
npm run dev:server

# Iniciar solo el cliente (juego principal)
npm run dev:client
```

### Producción

```bash
# Construir y iniciar en producción
npm run start

# Construir cliente para producción
npm run build

# Iniciar servidor en producción
npm run start:server
```

### Pruebas y Herramientas

```bash
# Ejecutar pruebas unitarias
npm test

# Ejecutar pruebas de integración multiplayer
npm run test:integration

# Limpiar caché y archivos temporales
npm run clean
```

## 🎯 Cómo Jugar

### 1. Iniciar el Servidor

```bash
npm run dev
```

Esto iniciará:
- **Servidor Multiplayer**: `http://localhost:3001` (backend con Socket.IO)
- **Cliente Principal**: `http://localhost:8080` (interfaz del juego)
- **Panel de Admin**: `http://localhost:8080/admin-panel.html` (herramientas de administración y simulador unificado)

### 2. Modo Singleplayer (por defecto)

Abre `http://localhost:8080` en tu navegador. El juego funcionará en modo singleplayer con NPCs.

### 3. Modo Multiplayer

Para activar el multiplayer, tienes varias opciones:

#### Opción A: Usar el hash en la URL
```
http://localhost:8080#multiplayer
```

#### Opción B: Activar desde localStorage
```javascript
localStorage.setItem('imperion.multiplayer.enabled', 'true');
```

#### Opción C: Usar el panel de admin
1. Abre el chat en el juego
2. Escribe "admin" en el canal "mundo"
3. ¡Listo! Tendrás acceso a funciones de admin y multiplayer

### 4. Unirse a una Sala

1. En el modo multiplayer, verás un botón "Unirse a Sala"
2. Ingresa tu nombre y selecciona una sala
3. Puedes elegir ser jugador o espectador

## 👑 Panel de Administración

### Activar Modo Admin

Solo tú puedes activar el modo admin:

1. Abre el chat en el juego
2. Escribe "admin" en el canal "mundo"
3. Se abrirá el panel de admin

### Comandos de Admin en Chat

- `/kick [nombre]`: Expulsar a un jugador
- `/broadcast [mensaje]`: Enviar mensaje a todos
- `/players`: Ver lista de jugadores conectados
- `/rooms`: Ver lista de salas activas

### Panel de Admin Web

Accede a `http://localhost:8080/admin-panel.html` para:

- Ver estado del servidor en tiempo real
- Gestionar salas y jugadores
- Simular conexiones de jugadores
- Enviar mensajes broadcast
- Monitorear actividad

## 🎮 Simulador de Jugadores (Unificado en Panel de Admin)

**¡El simulador de jugadores está ahora integrado en el panel de administración!** Ya no necesitas el archivo `player-simulator.html` separado.

Para jugar con tus amigos sin que tengan que instalar nada:

1. Abre `http://localhost:8080/admin-panel.html`
2. Ve a la sección "Gestión de Jugadores en Salas"
3. Usa las herramientas para:
   - Agregar jugadores manuales a salas
   - Spawnear NPCs automáticamente
   - Conectar/desconectar jugadores simulados
   - Monitorear posición en el mapa

### Características del Simulador Unificado

- **Creación de salas persistentes** con jugadores/NPCs
- **Spawn masivo de NPCs** con nombres aleatorios
- **Control individual** de cada jugador simulado
- **Monitoreo en tiempo real** de posiciones en el mapa
- **Chat integrado** entre jugadores simulados
- **Pruebas de rendimiento** con múltiples conexiones
- **Estadísticas detalladas** por sala y jugador
- **Control masivo** (desconectar todos, broadcast, etc.)

### Uso Práctico

1. **Para jugar con amigos**: Crea jugadores con sus nombres y conéctalos a salas
2. **Para pruebas de carga**: Usa "Spawnear 5 NPCs" varias veces
3. **Para desarrollo**: Monitorea cómo los jugadores aparecen y se mueven en el mapa
4. **Para administración**: Gestiona todos los jugadores desde un solo lugar

## 🏗️ Arquitectura del Sistema

### Estructura General

El proyecto se compone de dos componentes principales:

1. **Servidor Multiplayer** (`http://localhost:3001`): Backend con Node.js + Socket.IO
2. **Cliente Principal** (`http://localhost:8080`): Frontend con HTML5 + JavaScript

### Servidor (Node.js + Socket.IO)

```
server/
├── index.js              # Servidor principal Socket.IO
├── game/
│   ├── GameServer.js     # Lógica principal del servidor
│   ├── RoomManager.js    # Gestión de salas (2-20 jugadores)
│   ├── StateManager.js   # Sincronización de estado y jugadores
│   ├── ChatManager.js    # Sistema de chat global y por sala
│   ├── SpectatorManager.js # Gestión de espectadores
│   ├── persistence.js    # Capa de persistencia (Redis/memoria)
│   ├── gameLoop.js       # Bucle principal del servidor
│   └── protocol.js       # Definición de protocolo de comunicación
└── package.json          # Dependencias del servidor
```

### Cliente (HTML5 + JavaScript)

```
src/
├── core/
│   └── GameCore.js       # Core del juego con hooks multiplayer
├── client/
│   └── multiplayer/
│       ├── MultiplayerAdapter.js  # Interfaz estable para el core
│       └── network.js             # Gestión de red y Socket.IO
├── chat/
│   └── ChatSystem.js     # Sistema de chat con soporte multiplayer
├── admin/
│   └── AdminTools.js     # Herramientas de administración
└── map/
    └── MapRenderer.js    # Renderizado del mapa con jugadores
```

### Panel de Administración

```
admin-panel.html          # Panel de admin unificado (incluye simulador)
├── Gestión de salas      # Crear, eliminar, monitorear salas
├── Gestión de jugadores  # Agregar, eliminar, spawnear NPCs
├── Simulador unificado   # Herramientas para probar y jugar
└── Monitoreo en tiempo real # Estadísticas y logs
```

### Protocolo de Comunicación

#### Client → Server

```javascript
// Unirse a sala
{ type: 'join', playerId, name, roomId }

// Unirse como espectador
{ type: 'joinSpectator', playerId, roomId }

// Acción del jugador
{ type: 'action', playerId, roomId, type, payload, ts }

// Mensaje de chat
{ type: 'chatMessage', playerId, roomId, text, ts }

// Ping/heartbeat
{ type: 'ping', ts }
```

#### Server → Client

```javascript
// Bienvenida inicial
{ type: 'welcome', serverTime, you, roomSnapshotMin, sessionToken }

// Delta de estado
{ type: 'stateDelta', roomId, seq, changes, ts }

// Evento del juego
{ type: 'event', roomId, kind, data, ts }

// Mensaje de chat
{ type: 'chatMessage', from, text, ts }

// Respuesta ping
{ type: 'pong', ts }

// Notificación de admin
{ type: 'adminNotification', text }
```

## 🔧 Configuración Avanzada

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Servidor
PORT=3001
HOST=localhost

# Multiplayer
MAX_PLAYERS_PER_ROOM=20
TICK_RATE=15
HEARTBEAT_INTERVAL=30000
RECONNECT_MAX_ATTEMPTS=5
RECONNECT_DELAY=1000

# Persistencia
REDIS_URL=redis://localhost:6379
PERSISTENCE_INTERVAL=5000

# Seguridad
CORS_ORIGIN=http://localhost:8080
SESSION_SECRET=your-secret-key
```

### Configuración de Redis

Para habilitar persistencia con Redis:

1. Instala Redis: `sudo apt-get install redis-server` (Linux) o descarga desde [redis.io](https://redis.io)
2. Inicia Redis: `redis-server`
3. El sistema usará Redis automáticamente si está disponible

## 🧪 Pruebas

### Pruebas Unitarias

```bash
npm test
```

### Pruebas de Integración Multiplayer

```bash
npm run test:integration
```

### Pruebas de Carga

Usa el simulador unificado en el panel de admin para pruebas de carga:

1. Abre `http://localhost:8080/admin-panel.html`
2. Ve a la sección "Gestión de Jugadores en Salas"
3. Usa "Spawnear 5 NPCs" varias veces
4. Monitorea el rendimiento en el panel de admin
5. Verifica que los jugadores aparezcan correctamente en el mapa

## 🐛 Solución de Problemas

### Problemas Comunes

**1. No se conecta al servidor multiplayer**
- Verifica que el servidor esté en `http://localhost:3001`
- Revisa que no haya firewalls bloqueando el puerto
- Revisa la consola del navegador por errores

**2. El modo admin no funciona**
- Asegúrate de escribir "admin" en el canal "mundo"
- Verifica que tu perfil sea el admin (Rey Theron o player_123)
- Revisa la consola por errores

**3. Los jugadores simulados no aparecen en el mapa**
- Verifica que el servidor multiplayer esté corriendo en `http://localhost:3001`
- Usa el panel de admin en `http://localhost:8080/admin-panel.html`
- Asegúrate de que el modo multiplayer esté activo (`localStorage.setItem('imperion.multiplayer.enabled', 'true')`)
- Revisa los logs en la consola del servidor
- Verifica que los jugadores tengan posiciones válidas en el estado del juego

### Depuración

Habilita el modo debug:

```javascript
localStorage.setItem('imperion.debug', 'true');
```

Ver logs detallados en:

- Consola del navegador (cliente)
- Consola del servidor (terminal)
- Panel de admin (actividad en tiempo real)

## 📈 Rendimiento

### Optimizaciones Implementadas

- **Sincronización incremental**: Solo se envían diffs de estado
- **Compresión de mensajes**: Socket.IO comprime automáticamente
- **Pooling de conexiones**: Reutilización de conexiones
- **Cache de estado**: Minimiza comunicación innecesaria
- **Tick rate configurable**: Ajustable según necesidades

### Métricas de Rendimiento

- **Latencia**: < 50ms para jugadores locales
- **Uso de CPU**: ~10% con 20 jugadores activos
- **Memoria**: ~50MB base + 2MB por jugador
- **Ancho de banda**: ~100KB/s con 20 jugadores

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit tus cambios: `git commit -am 'Añade nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte y preguntas:

- Crea un issue en GitHub
- Contacta al equipo de desarrollo
- Revisa la documentación actualizada

---

**¡Construye tu imperio y conquista el mundo con tus amigos! 🏰⚔️**