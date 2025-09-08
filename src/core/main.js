// NEW FILE: main.js
// This file acts as the entry point, importing all necessary modules
// and initializing the game when the DOM is ready.

import { ImperionGame } from '../core/GameCore.js';
import { CanvasResizer } from '../map/CanvasResizer.js';
import { MapRenderer } from '../map/MapRenderer.js';
import { ResourceManager } from '../managers/ResourceManager.js';
import { UIManager } from '../managers/UIManager.js';
import { GameActions } from '../actions/GameActions.js';
import { ChatSystem } from '../chat/ChatSystem.js';
import { MarketSellManager } from '../trade/MarketSellManager.js';
import { MarketSellUIManager } from '../trade/MarketSellUIManager.js';
import { NpcOfferGenerator } from '../utils/NpcOfferGenerator.js';
import { PublicTradeManager } from '../trade/PublicTradeManager.js';
import { TradeSystem } from '../trade/TradeSystem.js';
import { PrivateTradeUIManager } from '../trade/PrivateTradeUIManager.js';
import { PrivateTradeUIHelper } from '../trade/PrivateTradeUIHelper.js';
import { PrivateTradeManager } from '../trade/PrivateTradeManager.js';
import { PrivateTradeOfferState } from '../trade/PrivateTradeOfferState.js';
import { PrivateTradeLogic } from '../trade/PrivateTradeLogic.js';
import { DragonManager } from '../managers/DragonManager.js';
import { ProfileManager } from '../managers/ProfileManager.js';
import { LoadingManager } from '../core/LoadingManager.js';
import { ExplorationManager } from '../managers/ExplorationManager.js';
import { TroopManager } from '../managers/TroopManager.js';
import { DiplomacyManager } from '../managers/DiplomacyManager.js';
import { NewsManager } from '../managers/NewsManager.js';
import { BattleManager } from '../managers/BattleManager.js';
import { WelcomeManager } from '../managers/WelcomeManager.js';
import { SidePanelManager } from '../managers/SidePanelManager.js';
import { TradeDisplayHelper } from '../trade/TradeDisplayHelper.js';
import { PublicOfferUIManager } from '../trade/PublicOfferUIManager.js';
import { ScienceManager } from '../managers/ScienceManager.js';

console.log("main.js: Script loaded. Initializing ImperionGame...");

// Initialize the game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    console.log("main.js: DOMContentLoaded event fired. Starting game initialization.");
    try {
        const imperionGameInstance = new ImperionGame();
        window.game = imperionGameInstance; 
        imperionGameInstance.init();
    } catch (error) {
        console.error("main.js: Error during game initialization:", error);
        const loadingLogsElement = document.getElementById('loadingLogs');
        if (loadingLogsElement) {
            loadingLogsElement.innerHTML += `<span class="log-error">Error crítico al iniciar juego: ${error.message}</span>`;
            loadingLogsElement.parentElement.scrollTop = loadingLogsElement.parentElement.scrollHeight;
        }
        alert("Error crítico al iniciar el juego. Consulta la consola del navegador para más detalles.");
    }
});