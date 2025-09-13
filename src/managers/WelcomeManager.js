export class WelcomeManager {
    constructor(game) {
        this.game = game;
        // Check if player has already selected a name in this session or previously
        this.playerNameSelected = sessionStorage.getItem('playerNameSelected') === 'true' ||
                                 this.game.profileManager?.hasSelectedCustomName;
    }

    /**
     * Method to display name selection modal first
     */
    showNameSelectionModal() {
        this.game.uiManager.showModal('👑 ¡Elige tu Nombre de Soberano! 👑', `
            <div class="name-selection-modal">
                <h3 class="welcome-title">¡Bienvenido a Imperion!</h3>
                <p>Antes de comenzar tu reinado, elige un nombre único que represente tu imperio. Este nombre será visible para todos los jugadores.</p>

                <div class="name-input-container">
                    <label for="playerNameInput">Nombre de tu Imperio:</label>
                    <input type="text" id="playerNameInput" placeholder="Ej: Alejandro Magno" maxlength="20" />
                    <div id="nameError" class="name-error" style="display: none;"></div>
                </div>

                <div class="name-requirements">
                    <small>• El nombre debe tener entre 3 y 20 caracteres</small><br>
                    <small>• Solo letras, números y espacios</small><br>
                    <small>• Debe ser único entre todos los jugadores</small>
                </div>

                <button class="medieval-btn" onclick="game.welcomeManager.submitPlayerName()" style="margin-top: 20px;">
                    Confirmar Nombre
                </button>
            </div>
        `);

        // Focus on input field
        setTimeout(() => {
            const input = document.getElementById('playerNameInput');
            if (input) {
                input.focus();
                // Pre-fill with profile name if available
                if (this.game.profileManager?.playerProfile?.username) {
                    input.value = this.game.profileManager.playerProfile.username;
                }
            }
        }, 100);
    }

    /**
     * Handle name submission
     */
    async submitPlayerName() {
        const input = document.getElementById('playerNameInput');
        const errorDiv = document.getElementById('nameError');

        if (!input || !errorDiv) return;

        const name = input.value.trim();

        // Validate name
        if (!this.validatePlayerName(name)) {
            return;
        }

        // Check if multiplayer is connected
        if (!this.game.multiplayer?.isConnected) {
            this.showNameError('Conectando al servidor... Inténtalo de nuevo en unos segundos.');
            return;
        }

        // Check uniqueness
        const isUnique = await this.checkNameUniqueness(name);
        if (!isUnique) {
            this.showNameError('Este nombre ya está en uso. Elige otro.');
            return;
        }

        // Name is valid and unique, proceed
        try {
            // First join the multiplayer room with the selected name
            if (this.game.multiplayer && !this.game.multiplayer.currentRoom) {
                const joinSuccess = await this.game.multiplayer.joinRoom('dev_global', name);
                if (!joinSuccess) {
                    throw new Error('Failed to join multiplayer room');
                }
            } else {
                // If already joined, update the name
                await this.setPlayerName(name);
            }

            this.playerNameSelected = true;

            // Save the selected name to localStorage for persistence
            this.game.profileManager.saveSelectedName(name, this.game.multiplayer?.playerId);
            
            // Mark name as selected in sessionStorage for this session
            sessionStorage.setItem('playerNameSelected', 'true');
            sessionStorage.setItem('hasShownWelcomeModal', 'true');

            // Close name selection modal and show welcome modal
            this.game.uiManager.closeModal();
            this.showWelcomeModal();

            // Now that we have a name, request map data and center on player
            if (this.game.multiplayer && this.game.multiplayer.isConnected) {
                this.game.multiplayer.requestMapData();
                // Wait a bit for the map data
                setTimeout(() => {
                    if (this.game.mapRenderer && this.game.mapRenderer.mapInteractionManager) {
                        this.game.mapRenderer.mapInteractionManager.centerOnPlayerCity();
                        this.game.mapRenderer.render();
                    }
                }, 200);
            }

        } catch (error) {
            console.error('Error setting player name:', error);
            this.showNameError('Error al guardar el nombre. Inténtalo de nuevo.');
        }
    }

    /**
     * Validate player name format
     */
    validatePlayerName(name) {
        const errorDiv = document.getElementById('nameError');

        if (name.length < 3) {
            this.showNameError('El nombre debe tener al menos 3 caracteres.');
            return false;
        }

        if (name.length > 20) {
            this.showNameError('El nombre no puede tener más de 20 caracteres.');
            return false;
        }

        if (!/^[a-zA-Z0-9\s]+$/.test(name)) {
            this.showNameError('El nombre solo puede contener letras, números y espacios.');
            return false;
        }

        this.hideNameError();
        return true;
    }

    /**
     * Check if name is unique against server
     */
    async checkNameUniqueness(name) {
        if (!this.game.multiplayer?.isConnected) {
            throw new Error('No conectado al servidor');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Name uniqueness check timeout'));
            }, 5000);

            // Listen for the result
            const handleResult = (data) => {
                clearTimeout(timeout);
                this.game.multiplayer.off('nameUniquenessResult', handleResult);

                if (data.error) {
                    reject(new Error(data.error));
                } else {
                    resolve(data.unique || false);
                }
            };

            this.game.multiplayer.on('nameUniquenessResult', handleResult);

            // Send request to server
            this.game.multiplayer.networkManager.send('checkNameUniqueness', {
                name: name,
                playerId: this.game.multiplayer.playerId
            });
        });
    }

    /**
     * Set player name on server
     */
    async setPlayerName(name) {
        if (!this.game.multiplayer?.isConnected) {
            // If not connected, just update locally
            this.game.currentPlayerName = name;
            return;
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Set player name timeout'));
            }, 5000);

            // Listen for the result
            const handleResult = (data) => {
                clearTimeout(timeout);
                this.game.multiplayer.off('setPlayerNameResult', handleResult);

                if (data.success) {
                    this.game.currentPlayerName = data.name;
                    console.log(`Player name set to: ${data.name}`);
                    resolve();
                } else {
                    reject(new Error(data.error || 'Failed to set player name'));
                }
            };

            this.game.multiplayer.on('setPlayerNameResult', handleResult);

            // Send request to server
            this.game.multiplayer.networkManager.send('setPlayerName', {
                name: name,
                playerId: this.game.multiplayer.playerId
            });
        });
    }

    /**
     * Show name error message
     */
    showNameError(message) {
        const errorDiv = document.getElementById('nameError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Hide name error message
     */
    hideNameError() {
        const errorDiv = document.getElementById('nameError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    /**
     * Method to display a welcome modal
     * Moved from UIManager.js to modularize.
     */
    showWelcomeModal() {
        // Check if welcome modal has already been shown in this session
        const hasShownWelcome = sessionStorage.getItem('hasShownWelcomeModal');
        if (hasShownWelcome) {
            console.log('🎉 Modal de bienvenida ya mostrado en esta sesión, omitiendo...');
            return;
        }
        
        this.game.uiManager.showModal('👑 ¡Bienvenido a Imperion: Reinos en Guerra! 👑', `
            <div class="welcome-modal">
                <h3 class="welcome-title">Saludos, ¡Noble Soberano ${this.game.currentPlayerName || 'Jugador'}!</h3>
                <p>Tu viaje para forjar el imperio más grande de todos los tiempos comienza ahora. En estas tierras, la estrategia, la diplomacia y el poder militar serán tus herramientas más valiosas.</p>
                <ul>
                    <li><strong>Mapa Mundial:</strong> Explora y expande tu territorio.</li>
                    <li><strong>Recursos:</strong> Administra sabiamente la comida, madera, piedra, metal e Imperion.</li>
                    <li><strong>Tropas:</strong> Recluta y entrena ejércitos para proteger y conquistar.</li>
                    <li><strong>Dragones:</strong> Descubre y entrena estas poderosas bestias para tu causa.</li>
                    <li><strong>Comercio y Diplomacia:</strong> Interactúa con otros reinos para tu beneficio.</li>
                </ul>
                <p>¡Que tu reinado sea largo y glorioso!</p>
                <button class="medieval-btn" onclick="game.uiManager.closeModal(); sessionStorage.setItem('hasShownWelcomeModal', 'true');" style="margin-top: 20px;">
                    Comenzar mi Reinado
                </button>
            </div>
        `);
        
        // Mark as shown when modal is closed
        const originalCloseModal = this.game.uiManager.closeModal;
        this.game.uiManager.closeModal = function() {
            originalCloseModal.call(this);
            sessionStorage.setItem('hasShownWelcomeModal', 'true');
        };
    }
}

