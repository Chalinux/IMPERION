// JavaScript NotificationHelper
export function showTradeActionNotification(type, message, game) {
    if (game.newsManager) {
        game.newsManager.addNews(message, 'comercio');
    }
    
    if (game.uiManager) {
        const icon = type === 'success' ? 
            { class: 'trade_accepted', text: '✅' } : 
            { class: 'error', text: '❌' };
            
        // Now using NotificationManager for displaying
        game.uiManager.notificationManager.showNotification(
            icon.class, 
            message,
            5000
        );
    }
}