class ChatManager {
    constructor() {
        this.roomChats = new Map();
        this.globalChat = [];
        this.maxMessagesPerRoom = 50;
        this.maxGlobalMessages = 100;
        this.lastMessageLog = 0;
        
        console.log('💬 ChatManager inicializado');
    }
    
    addMessage(roomId, message) {
        // Asegurarse de que el chat de la sala exista
        if (!this.roomChats.has(roomId)) {
            this.roomChats.set(roomId, []);
        }
        
        const roomChat = this.roomChats.get(roomId);
        
        // Añadir timestamp si no existe
        if (!message.ts) {
            message.ts = Date.now();
        }
        
        // Añadir ID único al mensaje
        if (!message.id) {
            message.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        roomChat.push(message);
        
        // Limitar número de mensajes
        if (roomChat.length > this.maxMessagesPerRoom) {
            roomChat.shift();
        }
        
        // También añadir al chat global si es un mensaje de sala
        if (roomId !== 'global') {
            this.addToGlobalChat({
                ...message,
                roomId: roomId
            });
        }
        
        console.log(`💬 Mensaje en ${roomId}: ${message.from || message.sender}: ${message.text}`);
    }
    
    addToGlobalChat(message) {
        // Añadir timestamp si no existe
        if (!message.ts) {
            message.ts = Date.now();
        }
        
        // Añadir ID único al mensaje
        if (!message.id) {
            message.id = `global_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        this.globalChat.push(message);
        
        // Limitar número de mensajes globales
        if (this.globalChat.length > this.maxGlobalMessages) {
            this.globalChat.shift();
        }
    }
    
    getRoomChat(roomId, limit = 20) {
        const roomChat = this.roomChats.get(roomId) || [];
        return roomChat.slice(-limit);
    }
    
    getGlobalChat(limit = 50) {
        return this.globalChat.slice(-limit);
    }
    
    getRecentMessages(roomId, since = 0) {
        const roomChat = this.roomChats.get(roomId) || [];
        return roomChat.filter(msg => msg.ts > since);
    }
    
    clearRoomChat(roomId) {
        if (this.roomChats.has(roomId)) {
            this.roomChats.set(roomId, []);
            console.log(`🧹 Chat de sala ${roomId} limpiado`);
        }
    }
    
    clearGlobalChat() {
        this.globalChat = [];
        console.log('🧹 Chat global limpiado');
    }
    
    searchMessages(roomId, query) {
        const roomChat = this.roomChats.get(roomId) || [];
        const lowercaseQuery = query.toLowerCase();
        
        return roomChat.filter(msg => 
            msg.text.toLowerCase().includes(lowercaseQuery) ||
            (msg.from && msg.from.toLowerCase().includes(lowercaseQuery)) ||
            (msg.sender && msg.sender.toLowerCase().includes(lowercaseQuery))
        );
    }
    
    getChatStats(roomId) {
        const roomChat = this.roomChats.get(roomId) || [];
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        
        const recentMessages = roomChat.filter(msg => msg.ts > oneHourAgo);
        const messagesByType = {};
        
        recentMessages.forEach(msg => {
            const type = msg.type || 'player';
            messagesByType[type] = (messagesByType[type] || 0) + 1;
        });
        
        return {
            totalMessages: roomChat.length,
            recentMessages: recentMessages.length,
            messagesByType: messagesByType,
            oldestMessage: roomChat.length > 0 ? roomChat[0].ts : null,
            newestMessage: roomChat.length > 0 ? roomChat[roomChat.length - 1].ts : null
        };
    }
    
    getGlobalChatStats() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        
        const recentMessages = this.globalChat.filter(msg => msg.ts > oneHourAgo);
        const messagesByType = {};
        
        recentMessages.forEach(msg => {
            const type = msg.type || 'player';
            messagesByType[type] = (messagesByType[type] || 0) + 1;
        });
        
        return {
            totalMessages: this.globalChat.length,
            recentMessages: recentMessages.length,
            messagesByType: messagesByType,
            oldestMessage: this.globalChat.length > 0 ? this.globalChat[0].ts : null,
            newestMessage: this.globalChat.length > 0 ? this.globalChat[this.globalChat.length - 1].ts : null
        };
    }
    
    broadcastMessage(message, roomId = null) {
        const broadcastMsg = {
            ...message,
            type: 'broadcast',
            ts: Date.now(),
            id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        if (roomId) {
            // Enviar a sala específica
            this.addMessage(roomId, broadcastMsg);
        } else {
            // Enviar a todas las salas
            for (const [currentRoomId] of this.roomChats) {
                this.addMessage(currentRoomId, broadcastMsg);
            }
        }
        
        console.log(`📢 Mensaje broadcast: ${message.text}`);
    }
    
    sendAdminNotification(roomId, text) {
        const notification = {
            from: '👑 Admin',
            text: text,
            type: 'admin_notification',
            ts: Date.now(),
            id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.addMessage(roomId, notification);
        console.log(`👑 Notificación de admin en ${roomId}: ${text}`);
    }
    
    sendSystemMessage(roomId, text) {
        const systemMsg = {
            from: 'Sistema',
            text: text,
            type: 'system',
            ts: Date.now(),
            id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.addMessage(roomId, systemMsg);
        console.log(`🤖 Mensaje de sistema en ${roomId}: ${text}`);
    }
    
    exportChatHistory(roomId, format = 'json') {
        const roomChat = this.roomChats.get(roomId) || [];
        
        if (format === 'json') {
            return JSON.stringify(roomChat, null, 2);
        } else if (format === 'txt') {
            return roomChat.map(msg => 
                `[${new Date(msg.ts).toISOString()}] ${msg.from || msg.sender}: ${msg.text}`
            ).join('\n');
        }
        
        return null;
    }
    
    cleanupOldMessages(maxAge = 86400000) { // 24 horas
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [roomId, roomChat] of this.roomChats) {
            const initialLength = roomChat.length;
            const filteredChat = roomChat.filter(msg => now - msg.ts < maxAge);
            
            if (filteredChat.length < initialLength) {
                this.roomChats.set(roomId, filteredChat);
                cleanedCount += (initialLength - filteredChat.length);
            }
        }
        
        // Limpiar chat global
        const initialGlobalLength = this.globalChat.length;
        this.globalChat = this.globalChat.filter(msg => now - msg.ts < maxAge);
        cleanedCount += (initialGlobalLength - this.globalChat.length);
        
        if (cleanedCount > 0) {
            console.log(`🧹 ${cleanedCount} mensajes antiguos eliminados`);
        }
        
        return cleanedCount;
    }
}

module.exports = ChatManager;