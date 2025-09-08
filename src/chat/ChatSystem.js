export class ChatSystem {
    constructor(game) {
        this.game = game;
        this.currentChannel = 'mundo';
        this.isExpanded = false;
        this.messages = {
            mundo: [],
            clan: [],
            region: [],
            comercio: []
        };
        
        this.chatContainer = document.getElementById('chatContainer');
        this.chatToggle = document.getElementById('chatToggle'); // Single persistent toggle
        this.chatContentWrapper = document.getElementById('chatContentWrapper');

        this.chatMessages = null;
        this.chatInput = null;
        this.chatSend = null;
        this.chatTabs = null;
        this.chatEmojiBtn = null;
        this.chatClearBtn = null;
        this.isChatHtmlLoaded = false;
        
        this.addWelcomeMessages();
    }

    async setupChatSystem() {
        if (this.chatToggle) {
            this.chatToggle.addEventListener('click', (e) => this.handleToggleClick(e));
        }
        this.chatContentWrapper.style.display = 'none';
    }

    async handleToggleClick(event) {
        event.stopPropagation(); 
        
        if (!this.isExpanded) {
            if (!this.isChatHtmlLoaded) {
                this.game.logLoadingStatus('Cargando interfaz del sistema de chat...', 'info');
                try {
                    const response = await fetch('ui/html/chat-panel.html');
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const htmlContent = await response.text();
                    this.chatContentWrapper.innerHTML = htmlContent;
                    this.isChatHtmlLoaded = true;
                    this._initializeChatUI();
                    this.game.logLoadingStatus('Interfaz de chat cargada.', 'success');
                } catch (error) {
                    console.error("Failed to load chat panel HTML:", error);
                    this.game.logLoadingStatus(`Error al cargar chat: ${error.message}`, 'error');
                    return;
                }
            }
            this.toggleChatExpansion();
        } else {
            this.toggleChatExpansion();
        }
    }

    _initializeChatUI() {
        this.chatMessages = this.chatContentWrapper.querySelector('#chatMessages');
        this.chatInput = this.chatContentWrapper.querySelector('#chatInput');
        this.chatSend = this.chatContentWrapper.querySelector('#chatSend');
        this.chatTabs = this.chatContentWrapper.querySelectorAll('.chat-tab');
        this.chatEmojiBtn = this.chatContentWrapper.querySelector('#chatEmojiBtn');
        this.chatClearBtn = this.chatContentWrapper.querySelector('#chatClearBtn');

        const sendMessage = () => {
            const message = this.chatInput.value.trim();
            if (message) {
                this.handleMessage(message);
                this.chatInput.value = '';
            }
        };
        
        this.chatSend.addEventListener('click', sendMessage);
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        this.chatTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const channel = tab.getAttribute('data-channel');
                this.switchChannel(channel);
            });
        });

        if (this.chatEmojiBtn) {
            this.chatEmojiBtn.addEventListener('click', () => {
                this.chatInput.value += '👍';
                this.chatInput.focus();
            });
        }

        if (this.chatClearBtn) {
            this.chatClearBtn.addEventListener('click', () => {
                this.clearCurrentChannel();
            });
        }

        this.updateChatDisplay();
        this.scrollToBottom();
    }

    toggleChatExpansion() {
        this.isExpanded = !this.isExpanded;
        this.chatContainer.classList.toggle('expanded', this.isExpanded);
        
        // Use a very short timeout to allow the transition to start before changing display
        setTimeout(() => {
            if(this.chatContentWrapper) { // Check if it exists (it should if expanded)
                 this.chatContentWrapper.style.display = this.isExpanded ? 'flex' : 'none';
            }
        }, this.isExpanded ? 0 : 300); // No delay when opening, delay when closing to match transition

        if (this.isExpanded) {
            this.scrollToBottom();
            this.chatToggle.textContent = '✖';
            // Move toggle button into the chat header
            const placeholder = this.chatContentWrapper.querySelector('.chat-close-btn-placeholder');
            if (placeholder) {
                placeholder.appendChild(this.chatToggle);
            }
        } else {
            this.chatToggle.textContent = '💬';
            // Move toggle button back to the main chat container
            this.chatContainer.prepend(this.chatToggle);
        }
    }
    
    handleMessage(message) {
        // Multiplayer admin commands
        if (this.game.multiplayer && this.game.multiplayer.isConnected) {
            if (message.toLowerCase().startsWith('/kick ')) {
                const playerName = message.substring(6).trim();
                this.game.multiplayer.kickPlayer(playerName);
                return;
            }
            
            if (message.toLowerCase().startsWith('/broadcast ')) {
                const broadcastMessage = message.substring(11).trim();
                this.game.multiplayer.broadcastMessage(broadcastMessage);
                return;
            }
            
            if (message.toLowerCase() === '/players') {
                this.game.multiplayer.requestPlayerList();
                return;
            }
            
            if (message.toLowerCase() === '/rooms') {
                this.game.multiplayer.requestRoomList();
                return;
            }
        }

        /* MPHOOK: Send chat message to multiplayer server */
        if (this.game.multiplayer && this.game.multiplayer.isConnected) {
            this.game.multiplayer.sendChatMessage(message, this.currentChannel);
            return; // Don't process locally if multiplayer is active
        }

        // Add player message (local only)
        this.addMessage('Jugador', message, 'player');
        
        // Simulate responses based on channel and message
        setTimeout(() => {
            this.generateResponse(message);
        }, 500 + Math.random() * 1500);
    }
    
    generateResponse(originalMessage) {
        const responses = {
            mundo: [
                'Otro jugador: Interesante estrategia',
                'Comandante: Las fuerzas enemigas se acercan',
                'Explorador: Nuevas tierras descubiertas al norte',
                'Mercader: Los precios del metal han subido'
            ],
            clan: [
                'Líder del Clan: Preparémonos para la próxima batalla',
                'Aliado: Necesitamos refuerzos en el frente este',
                'Estratega: Propongo atacar al amanecer',
                'Veterano: En mis días, las batallas eran diferentes'
            ],
            region: [
                'Gobernador: Nuevas regulaciones comerciales',
                'Guardia: Todo tranquilo en las fronteras',
                'Ciudadano: Los dragones han sido vistos cerca',
                'Herrero: Necesito más metal para las armas'
            ],
            comercio: [
                'Comerciante: Excelente oferta de piedra',
                'Caravana: Llegada de especias del sur',
                'Banquero: Los préstamos están disponibles',
                'Tasador: Los precios fluctúan constantemente'
            ]
        };
        
        const channelResponses = responses[this.currentChannel] || responses.mundo;
        const randomResponse = channelResponses[Math.floor(Math.random() * channelResponses.length)];
        
        this.addMessage('NPC', randomResponse, 'npc');
    }
    
    addMessage(sender, message, type = 'player') {
        const timestamp = new Date().toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const messageObj = {
            sender,
            message,
            type,
            timestamp,
            channel: this.currentChannel
        };
        
        this.messages[this.currentChannel].push(messageObj);
        
        // Keep only last 50 messages per channel
        if (this.messages[this.currentChannel].length > 50) {
            this.messages[this.currentChannel].shift();
        }
        
        // Only update display and scroll if UI elements are loaded
        if (this.isChatHtmlLoaded) {
            this.updateChatDisplay();
            this.scrollToBottom();
        }
    }
    
    switchChannel(channel) {
        if (this.messages[channel]) {
            this.currentChannel = channel;
            
            // Update tab appearance (only if UI elements are loaded)
            if (this.chatTabs) {
                this.chatTabs.forEach(tab => {
                    tab.classList.remove('active');
                });
                this.chatContentWrapper.querySelector(`[data-channel="${channel}"]`).classList.add('active');
            }
            
            this.updateChatDisplay();
        }
    }
    
    updateChatDisplay() {
        if (!this.chatMessages) return; // Ensure chatMessages element exists
        
        const messages = this.messages[this.currentChannel] || [];
        
        this.chatMessages.innerHTML = messages.map(msg => {
            const typeClass = msg.type === 'debug' ? 'chat-debug-message' : 
                             msg.type === 'system' ? 'chat-system-message' : '';
            
            return `
                <div class="chat-message ${typeClass}">
                    <span class="chat-timestamp">${msg.timestamp}</span>
                    <span class="chat-player">${msg.sender}:</span>
                    <span class="chat-text">${msg.message}</span>
                </div>
            `;
        }).join('');
    }
    
    scrollToBottom() {
        if (this.chatMessages) { // Ensure chatMessages element exists
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
    
    clearCurrentChannel() {
        if (this.messages[this.currentChannel]) {
            this.messages[this.currentChannel] = [];
            this.updateChatDisplay();
            this.addMessage('Sistema', `Historial del canal '${this.currentChannel}' limpiado.`, 'system');
        }
    }

    addWelcomeMessages() {
        // Add welcome messages immediately, they'll be displayed once UI is ready
        this.addMessage('Sistema', 'Bienvenido al chat de Imperion', 'system');
        
        // Add some initial NPC messages
        setTimeout(() => {
            this.addMessage('Heraldo', 'Nuevas tierras esperan ser conquistadas', 'npc');
        }, 2000);
        
        setTimeout(() => {
            this.addMessage('Consejero', 'Recuerda gestionar tus recursos sabiamente', 'npc');
        }, 4000);
    }
}