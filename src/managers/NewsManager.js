export class NewsManager {
    constructor(game) {
        this.game = game; // Reference to the main game object
        this.news = [
            "Bienvenido a Imperion: Reinos en Guerra",
            "Tu imperio comienza en las tierras de Theron",
            "Explora el mapa para encontrar recursos",
            "Construye tu ejército para expandir tu territorio"
        ];
        this.currentNewsIndex = 0;
        this.newsSliderInterval = null; // To store the interval ID
    }

    setupNewsSlider() {
        const newsText = document.getElementById('newsText');
        const prevBtn = document.getElementById('newsPrev');
        const nextBtn = document.getElementById('newsNext');
        
        if (!newsText || !prevBtn || !nextBtn) {
            console.error("News slider elements not found.");
            return;
        }

        prevBtn.addEventListener('click', () => {
            this.currentNewsIndex = (this.currentNewsIndex - 1 + this.news.length) % this.news.length;
            this.updateNewsDisplay();
        });
        
        nextBtn.addEventListener('click', () => {
            this.currentNewsIndex = (this.currentNewsIndex + 1) % this.news.length;
            this.updateNewsDisplay();
        });
        
        // Clear any existing interval to prevent duplicates
        if (this.newsSliderInterval) {
            clearInterval(this.newsSliderInterval);
        }
        this.newsSliderInterval = setInterval(() => {
            this.currentNewsIndex = (this.currentNewsIndex + 1) % this.news.length;
            this.updateNewsDisplay();
        }, 10000);
        
        this.updateNewsDisplay(); // Initial display
    }

    updateNewsDisplay() {
        const newsText = document.getElementById('newsText');
        if (newsText) {
            newsText.textContent = this.news[this.currentNewsIndex];
        }
    }

    addNews(message, type = 'general') {
        this.news.push(message);
        if (this.news.length > 50) { // Keep max 50 news items
            this.news.shift();
        }
        console.log(`[News] ${message}`);
        // If the news panel is active, update it
        if (this.game.currentView === 'newsPanel') {
            this.updateNewsPanelDisplay();
        }
    }

    clearNews() {
        this.news = ["Historial de noticias limpiado"]; // Reset with one message
        this.updateNewsPanelDisplay();
        // Corrected: Call NewsManager's own addNews method
        this.game.newsManager.addNews("Sistema de noticias reiniciado", 'system'); 
        this.game.uiManager.closeModal(); // Close modal if open (used to be modal)
    }

    updateNewsPanelDisplay() {
        const fullNewsList = document.getElementById('fullNewsList');
        const newsCount = document.getElementById('newsCount');
        
        if (!fullNewsList || !newsCount) return; // Ensure elements exist

        const newsHTML = this.news.map((newsItem, index) => {
            const timestamp = new Date().toLocaleTimeString('es-ES'); 
            return `
                <div class="news-item">
                    <div class="news-timestamp">${timestamp}</div>
                    <div class="news-message">${newsItem}</div>
                </div>
            `;
        }).reverse().join(''); // Reverse to show latest news first

        fullNewsList.innerHTML = newsHTML || '<p style="text-align: center; color: #c9b037;">No hay noticias disponibles</p>';
        newsCount.textContent = this.news.length;
    }
}