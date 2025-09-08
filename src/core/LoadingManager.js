export class LoadingManager {
    constructor(game, loadingScreenElements) {
        this.game = game; // Reference to the main game object
        this.loadingScreen = loadingScreenElements.loadingScreen;
        this.loadingPercentage = loadingScreenElements.loadingPercentage;
        this.progressBar = loadingScreenElements.progressBar;
        this.loadingStatus = loadingScreenElements.loadingStatus;
        this.loadingLogs = loadingScreenElements.loadingLogs;
    }

    async loadAllAssets() {
        this.logLoadingStatus('Iniciando carga de activos del juego...', 'info');
        const assetsToLoad = [
            ...this.game.mapRenderer.getImageListForPreloading(), // Get list from MapRenderer
            { type: 'video', src: 'assets/images/videos/huevocomunhatching.mp4' }
        ];

        let loadedCount = 0;
        const totalAssets = assetsToLoad.length;

        const updateProgress = (assetSrc, success = true) => {
            loadedCount++;
            const percentage = Math.floor((loadedCount / totalAssets) * 100);
            if (this.loadingPercentage) this.loadingPercentage.textContent = `${percentage}%`;
            if (this.progressBar) this.progressBar.style.width = `${percentage}%`;
            
            const fileName = assetSrc.split('/').pop();
            const statusMessage = success ? `Cargado: ${fileName}` : `Error al cargar: ${fileName}`;
            this.logLoadingStatus(statusMessage, success ? 'success' : 'error');
            if (this.loadingStatus) {
                this.loadingStatus.textContent = `Cargando: ${fileName}...`;
            }
        };

        const promises = assetsToLoad.map(asset => {
            return new Promise((resolve) => {
                this.logLoadingStatus(`Cargando ${asset.type}: ${asset.src}`, 'info');
                if (asset.type === 'image') {
                    const img = new Image();
                    img.onload = () => {
                        this.game.mapRenderer.images[asset.key] = img; // Assign to MapRenderer's images
                        updateProgress(asset.src, true);
                        resolve();
                    };
                    img.onerror = () => {
                        updateProgress(asset.src, false);
                        resolve(); // Resolve even on error to prevent Promise.all from hanging
                    };
                    img.src = asset.src;
                } else if (asset.type === 'video') {
                    const video = document.createElement('video');
                    video.oncanplaythrough = () => {
                        updateProgress(asset.src, true);
                        resolve();
                    };
                    video.onerror = (e) => {
                        updateProgress(asset.src, false);
                        resolve(); // Resolve even on error
                    };
                    video.src = asset.src;
                    video.load(); // Start loading the video
                }
            });
        });

        await Promise.all(promises);
        this.logLoadingStatus('Todos los activos esenciales cargados.', 'success');
        if (this.loadingStatus) this.loadingStatus.textContent = '¡Reino listo para la batalla!';
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay to show 100%
        this.logLoadingStatus('Proceso de carga de activos completado.', 'success');
    }

    logLoadingStatus(message, type = 'info') {
        if (this.loadingLogs) {
            const span = document.createElement('span');
            span.textContent = `${new Date().toLocaleTimeString('es-ES')}: ${message}`;
            span.classList.add(`log-${type}`);
            this.loadingLogs.appendChild(span);
            // Auto-scroll to the bottom
            this.loadingLogs.parentElement.scrollTop = this.loadingLogs.parentElement.scrollHeight;
        }
        console.log(`[Loading Log - ${type.toUpperCase()}] ${message}`);
    }
}