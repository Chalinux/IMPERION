export class DragonManager {
    constructor(game) {
        this.game = game;
    }

    openDragonIncubation() {
        this.game.uiManager.showModal('🐉 Altar de Incubación', `
            <div class="dragon-altar-modal">
                <h2 class="altar-title">🔥 Altar de los Dragones Ancestrales 🔥</h2>
                <div class="altar-container">
                    <img src="assets/images/dragons/huevodedragoncomun.png" alt="Altar con Huevo de Dragón" class="altar-image">
                    <p class="altar-description">
                        Un antiguo altar rúnico pulsa con energía mágica. Un huevo de dragón común descansa sobre la piedra sagrada, 
                        esperando el momento adecuado para eclosionar. Las llamas eternas danzan alrededor del altar, 
                        susurrando secretos de los dragones ancestrales.
                    </p>
                    <button class="incubate-btn" onclick="game.dragonManager.startDragonHatching()">
                        ⚡ Iniciar Incubación ⚡
                    </button>
                </div>
            </div>
        `);
    }

    startDragonHatching() {
        const modalBody = document.getElementById('modalBody');
        // Show loading state while video preloads
        modalBody.innerHTML = `
            <div class="dragon-altar-modal">
                <h2 class="altar-title">Preparando Incubación...</h2>
                <div class="altar-container">
                    <p class="altar-description">Cargando la magia de la eclosión...</p>
                    <div class="loading-spinner"></div>
                </div>
            </div>
        `;

        // Create video element dynamically to load it
        const video = document.createElement('video');
        video.src = "assets/images/videos/huevocomunhatching.mp4";
        video.muted = true;
        video.autoplay = false; // Don't autoplay until ready and in DOM
        video.preload = 'auto'; // Suggest preloading
        video.currentTime = 0; // Ensure it starts from the beginning if played again

        // The video is now preloaded at game start by `loadAllAssets`.
        // So `oncanplaythrough` should fire very quickly or be already true.
        // We can just proceed to playing it directly after a tiny delay for DOM update.
        
        setTimeout(() => {
            modalBody.innerHTML = `
                <div class="dragon-altar-modal">
                    <h2 class="altar-title">🔥 El Huevo está Eclosionando 🔥</h2>
                    <div class="altar-container">
                        <video class="hatching-video" autoplay muted>
                            <source src="assets/images/videos/huevocomunhatching.mp4" type="video/mp4">
                            Tu navegador no soporta el elemento video.
                        </video>
                        <p class="altar-description">
                            La magia antigua fluye a través del huevo... ¡Algo está emergiendo!
                        </p>
                    </div>
                </div>
            `;
            // Get the newly inserted video element (it's a new element, so re-query)
            const newVideoElement = modalBody.querySelector('.hatching-video');
            if (newVideoElement) {
                newVideoElement.play();

                // Call revealBabyDragon after 4 seconds (1 second less than original 5s duration)
                setTimeout(() => {
                    // Stop video and jump to end to ensure final frame is shown before reveal
                    if (newVideoElement && !newVideoElement.paused) {
                        newVideoElement.currentTime = newVideoElement.duration; // Jump to end
                        newVideoElement.pause(); // Pause it
                    }
                    this.revealBabyDragon();
                }, 4000); // Trigger reveal after 4 seconds
            } else {
                console.warn("Video element not found after setting innerHTML. Proceeding to reveal.");
                // Fallback if video element somehow fails to render/be found
                setTimeout(() => {
                    this.revealBabyDragon();
                }, 4000); // Proceed after 4 seconds even without video playback
            }
        }, 50); // Small delay to allow DOM to update before trying to play video
    }

    // New method to reveal a baby dragon after hatching animation
    revealBabyDragon() {
        const newDragon = {
            id: `dragon_${Date.now()}`,
            name: 'Draquito',
            rarity: 'Común',
            element: 'Fuego',
            level: 1,
            xp: 0,
            max_xp: 100,
            hp: 100,
            max_hp: 100,
            attack: 10,
            defense: 5,
            ability: { name: 'Llamita Tibia', description: 'Un ataque de aliento débil.' },
            empireBuffs: { food_rate: 5, wood_rate: 5 }, // Example: Small buff to resource production
            image: 'assets/images/dragons/commonbabydragon1.png'
        };

        this.game.playerDragons.push(newDragon);
        this.game.resourceManager.updateResourceDisplay(); // Update resource rates affected by new dragon buffs

        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div class="dragon-altar-modal">
                <h2 class="altar-title">🎉 ¡Un Nuevo Dragón ha Nacido! 🎉</h2>
                <div class="altar-container">
                    <div class="dragon-reveal">
                        <h3>🐲 ${newDragon.name}, el Dragón ${newDragon.rarity} 🐲</h3>
                        <img src="${newDragon.image}" alt="Dragón Bebé" class="baby-dragon-image">
                        <div class="dragon-stats">
                            <p><strong>Rareza:</strong> ${newDragon.rarity}</p>
                            <p><strong>Elemento:</strong> ${newDragon.element}</p>
                            <p><strong>Nivel:</strong> ${newDragon.level}</p>
                            <p><strong>Habilidad:</strong> ${newDragon.ability.name}</p>
                            <p><strong>Buff al Imperio:</strong> +${newDragon.empireBuffs.food_rate} Comida/h, +${newDragon.empireBuffs.wood_rate} Madera/h</p>
                        </div>
                        <p class="altar-description">
                            Un pequeño dragón ha emergido del huevo. Sus ojos brillan con curiosidad juvenil 
                            y pequeñas llamas danzan en su aliento. Aunque es solo un bebé, promete convertirse 
                            en un poderoso aliado con el tiempo y entrenamiento adecuados.
                        </p>
                        <button class="incubate-btn" onclick="game.uiManager.closeModal()">
                            ✨ Aceptar Dragón ✨
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add news about the new dragon
        this.game.newsManager.addNews(`¡Un nuevo dragón bebé ha nacido en tu guarida! ${newDragon.name} se ha unido a tu imperio.`, 'dragón');
        this.game.uiManager.notificationManager.showNotification('success', '¡Felicidades! Un dragón bebé ha nacido en tu guarida.', 8000);
        this.game.uiManager.updateDragonsView(); // Update the dragons view to show the new dragon
    }
}