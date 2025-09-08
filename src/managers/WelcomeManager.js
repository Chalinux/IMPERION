export class WelcomeManager {
    constructor(game) {
        this.game = game;
    }

    /**
     * Method to display a welcome modal
     * Moved from UIManager.js to modularize.
     */
    showWelcomeModal() {
        this.game.uiManager.showModal('👑 ¡Bienvenido a Imperion: Reinos en Guerra! 👑', `
            <div class="welcome-modal">
                <h3 class="welcome-title">Saludos, ¡Noble Soberano!</h3>
                <p>Tu viaje para forjar el imperio más grande de todos los tiempos comienza ahora. En estas tierras, la estrategia, la diplomacia y el poder militar serán tus herramientas más valiosas.</p>
                <ul>
                    <li><strong>Mapa Mundial:</strong> Explora y expande tu territorio.</li>
                    <li><strong>Recursos:</strong> Administra sabiamente la comida, madera, piedra, metal e Imperion.</li>
                    <li><strong>Tropas:</strong> Recluta y entrena ejércitos para proteger y conquistar.</li>
                    <li><strong>Dragones:</strong> Descubre y entrena estas poderosas bestias para tu causa.</li>
                    <li><strong>Comercio y Diplomacia:</strong> Interactúa con otros reinos para tu beneficio.</li>
                </ul>
                <p>¡Que tu reinado sea largo y glorioso!</p>
                <button class="medieval-btn" onclick="game.uiManager.closeModal()" style="margin-top: 20px;">
                    Comenzar mi Reinado
                </button>
            </div>
        `);
    }
}

