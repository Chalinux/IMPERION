class SpectatorManager {
    constructor() {
        this.spectators = new Map();
        this.roomSpectators = new Map();
        this.spectatorStats = new Map();
        
        console.log('👁️ SpectatorManager inicializado');
    }
    
    addSpectator(spectatorId, roomId, socket) {
        // Añadir al registro global de espectadores
        this.spectators.set(spectatorId, {
            id: spectatorId,
            roomId: roomId,
            socket: socket,
            joinedAt: Date.now(),
            lastActivity: Date.now(),
            isWatching: true
        });
        
        // Añadir al registro de espectadores por sala
        if (!this.roomSpectators.has(roomId)) {
            this.roomSpectators.set(roomId, new Map());
        }
        
        this.roomSpectators.get(roomId).set(spectatorId, {
            id: spectatorId,
            socket: socket,
            joinedAt: Date.now(),
            lastActivity: Date.now()
        });
        
        // Inicializar estadísticas del espectador
        this.spectatorStats.set(spectatorId, {
            totalWatchTime: 0,
            messagesRead: 0,
            actionsObserved: 0,
            lastSeen: Date.now()
        });
        
        console.log(`👁️ Espectador ${spectatorId} unido a sala ${roomId}`);
        return true;
    }
    
    removeSpectator(spectatorId) {
        const spectator = this.spectators.get(spectatorId);
        if (!spectator) return false;
        
        const roomId = spectator.roomId;
        
        // Remover del registro global
        this.spectators.delete(spectatorId);
        
        // Remover del registro de sala
        if (this.roomSpectators.has(roomId)) {
            this.roomSpectators.get(roomId).delete(spectatorId);
            
            // Si no hay más espectadores en la sala, eliminar el registro
            if (this.roomSpectators.get(roomId).size === 0) {
                this.roomSpectators.delete(roomId);
            }
        }
        
        // Actualizar estadísticas
        const stats = this.spectatorStats.get(spectatorId);
        if (stats) {
            stats.totalWatchTime += Date.now() - stats.lastSeen;
            stats.lastSeen = Date.now();
        }
        
        console.log(`👁️ Espectador ${spectatorId} removido de sala ${roomId}`);
        return true;
    }
    
    getSpectator(spectatorId) {
        return this.spectators.get(spectatorId);
    }
    
    getSpectatorsInRoom(roomId) {
        return this.roomSpectators.get(roomId) || new Map();
    }
    
    getAllSpectators() {
        return Array.from(this.spectators.values());
    }
    
    getSpectatorCount(roomId) {
        return this.getSpectatorsInRoom(roomId).size;
    }
    
    getTotalSpectatorCount() {
        return this.spectators.size;
    }
    
    updateSpectatorActivity(spectatorId) {
        const spectator = this.spectators.get(spectatorId);
        if (spectator) {
            spectator.lastActivity = Date.now();
            
            const stats = this.spectatorStats.get(spectatorId);
            if (stats) {
                stats.lastSeen = Date.now();
            }
            
            return true;
        }
        return false;
    }
    
    recordSpectatorMessage(spectatorId) {
        const stats = this.spectatorStats.get(spectatorId);
        if (stats) {
            stats.messagesRead++;
            return true;
        }
        return false;
    }
    
    recordSpectatorAction(spectatorId) {
        const stats = this.spectatorStats.get(spectatorId);
        if (stats) {
            stats.actionsObserved++;
            return true;
        }
        return false;
    }
    
    getSpectatorStats(spectatorId) {
        const stats = this.spectatorStats.get(spectatorId);
        if (!stats) return null;
        
        const spectator = this.spectators.get(spectatorId);
        if (!spectator) return null;
        
        return {
            ...stats,
            roomId: spectator.roomId,
            joinedAt: spectator.joinedAt,
            lastActivity: spectator.lastActivity,
            isActive: Date.now() - spectator.lastActivity < 30000 // activo si ha estado activo en los últimos 30 segundos
        };
    }
    
    getRoomSpectatorStats(roomId) {
        const roomSpectators = this.getSpectatorsInRoom(roomId);
        const stats = {
            totalSpectators: roomSpectators.size,
            activeSpectators: 0,
            totalWatchTime: 0,
            totalMessagesRead: 0,
            totalActionsObserved: 0,
            averageWatchTime: 0
        };
        
        let totalWatchTime = 0;
        
        for (const spectator of roomSpectators.values()) {
            const spectatorStats = this.spectatorStats.get(spectator.id);
            if (spectatorStats) {
                totalWatchTime += spectatorStats.totalWatchTime;
                stats.totalMessagesRead += spectatorStats.messagesRead;
                stats.totalActionsObserved += spectatorStats.actionsObserved;
                
                if (Date.now() - spectator.lastActivity < 30000) {
                    stats.activeSpectators++;
                }
            }
        }
        
        stats.totalWatchTime = totalWatchTime;
        stats.averageWatchTime = roomSpectators.size > 0 ? totalWatchTime / roomSpectators.size : 0;
        
        return stats;
    }
    
    getAllSpectatorStats() {
        const allStats = [];
        
        for (const [spectatorId, stats] of this.spectatorStats) {
            const spectator = this.spectators.get(spectatorId);
            if (spectator) {
                allStats.push({
                    spectatorId: spectatorId,
                    roomId: spectator.roomId,
                    joinedAt: spectator.joinedAt,
                    lastActivity: spectator.lastActivity,
                    ...stats,
                    isActive: Date.now() - spectator.lastActivity < 30000
                });
            }
        }
        
        return allStats;
    }
    
    getMostActiveSpectators(limit = 10) {
        const allStats = this.getAllSpectatorStats();
        
        return allStats
            .sort((a, b) => b.totalWatchTime - a.totalWatchTime)
            .slice(0, limit);
    }
    
    cleanupInactiveSpectators(inactiveTime = 300000) { // 5 minutos
        const now = Date.now();
        const toRemove = [];
        
        for (const [spectatorId, spectator] of this.spectators) {
            if (now - spectator.lastActivity > inactiveTime) {
                toRemove.push(spectatorId);
            }
        }
        
        for (const spectatorId of toRemove) {
            this.removeSpectator(spectatorId);
        }
        
        // Solo imprimir mensaje si se eliminaron espectadores
        if (toRemove.length > 0) {
            console.log(`🧹 ${toRemove.length} espectadores inactivos eliminados`);
        }
        
        return toRemove.length;
    }
    
    sendSpectatorUpdate(roomId, update) {
        const roomSpectators = this.getSpectatorsInRoom(roomId);
        
        for (const spectator of roomSpectators.values()) {
            try {
                spectator.socket.emit('spectatorUpdate', update);
                this.recordSpectatorAction(spectator.id);
            } catch (error) {
                console.warn(`⚠️ Error enviando update a espectador ${spectator.id}:`, error);
            }
        }
    }
    
    sendSpectatorChat(roomId, chatMessage) {
        const roomSpectators = this.getSpectatorsInRoom(roomId);
        
        for (const spectator of roomSpectators.values()) {
            try {
                spectator.socket.emit('spectatorChat', chatMessage);
                this.recordSpectatorMessage(spectator.id);
            } catch (error) {
                console.warn(`⚠️ Error enviando chat a espectador ${spectator.id}:`, error);
            }
        }
    }
    
    sendSpectatorAction(roomId, action) {
        const roomSpectators = this.getSpectatorsInRoom(roomId);
        
        for (const spectator of roomSpectators.values()) {
            try {
                spectator.socket.emit('spectatorAction', action);
                this.recordSpectatorAction(spectator.id);
            } catch (error) {
                console.warn(`⚠️ Error enviando acción a espectador ${spectator.id}:`, error);
            }
        }
    }
    
    exportSpectatorData(roomId = null) {
        const data = {
            exportedAt: Date.now(),
            version: '1.0'
        };
        
        if (roomId) {
            // Exportar datos de una sala específica
            const roomSpectators = this.getSpectatorsInRoom(roomId);
            data.roomId = roomId;
            data.spectators = Array.from(roomSpectators.values()).map(s => ({
                id: s.id,
                joinedAt: s.joinedAt,
                lastActivity: s.lastActivity
            }));
            data.stats = this.getRoomSpectatorStats(roomId);
        } else {
            // Exportar todos los datos
            data.spectators = this.getAllSpectators();
            data.stats = {
                totalSpectators: this.getTotalSpectatorCount(),
                allStats: this.getAllSpectatorStats()
            };
        }
        
        return data;
    }
}

module.exports = SpectatorManager;