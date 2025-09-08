// NEW FILE: NotificationManager.js
export class NotificationManager {
    constructor(game) {
        this.game = game;
        this.notificationContainer = document.getElementById('notificationContainer');
    }

    /**
     * Displays a notification pop-up.
     * @param {string} type - Notification type ('success', 'error', etc)
     * @param {string} message - Notification message
     * @param {number} [duration=5000] - Display duration in ms
     * @param {object|function} [onClickAction=null] - Action on click
     * @param {boolean} [persistent=false] - Don't auto-hide
     */
    showNotification(type, message, duration = 5000, onClickAction = null, persistent = false) {
        const notification = document.createElement('div');
        notification.classList.add('notification-item');
        
        let iconHtml = '';
        let notificationClass = ''; // For styling, e.g., 'notification-success'

        switch (type) {
            case 'battle_victory':
                iconHtml = '<img src="assets/images/units/milicia1.png" alt="Victory" class="notification-icon-img">';
                notificationClass = 'notification-success';
                break;
            case 'battle_defeat':
                iconHtml = '';
                notificationClass = 'notification-error';
                break;
            case 'trade_accepted':
                iconHtml = '<img src="assets/images/ui/balance_scale.png" alt="Trade" class="notification-icon-img">';
                notificationClass = 'notification-success';
                break;
            case 'trade_rejected':
                iconHtml = '';
                notificationClass = 'notification-error';
                break;
            case 'private_offer_received':
                iconHtml = '';
                notificationClass = 'notification-info';
                break;
            case 'info':
                iconHtml = '';
                notificationClass = 'notification-info';
                break;
            case 'error':
                iconHtml = '';
                notificationClass = 'notification-error';
                break;
            case 'success':
            default:
                iconHtml = '';
                notificationClass = 'notification-success';
                break;
        }

        notification.classList.add(notificationClass);
        
        notification.innerHTML = `
            <span class="notification-icon">${iconHtml}</span>
            <div class="notification-content">
                <span class="notification-message">${message}</span>
            </div>
            <button class="notification-close">×</button>
        `;

        this.notificationContainer.prepend(notification); // Add to the top to stack downwards

        // Force reflow to ensure CSS transition applies
        void notification.offsetWidth; 
        notification.classList.add('show');

        // Click handler for the whole notification item
        notification.addEventListener('click', (event) => {
            // Prevent event from bubbling up from the close button
            if (event.target.classList.contains('notification-close')) {
                return; 
            }

            if (onClickAction) {
                if (typeof onClickAction === 'function') {
                    onClickAction();
                } else if (typeof onClickAction === 'object' && onClickAction.type) {
                    switch (onClickAction.type) {
                        case 'open_private_trade':
                            if (onClickAction.npcId) {
                                // Now using the correct TradeSystem.openPrivateTradeModal
                                this.game.tradeSystem.openPrivateTradeModal(onClickAction.npcId, onClickAction.offerData);
                            }
                            break;
                        case 'open_battle_report':
                            if (onClickAction.battleId) {
                                this.game.battleManager.openBattleReport(onClickAction.battleId);
                            }
                            break;
                        case 'center_on_caravan':
                            if (onClickAction.caravanId) {
                                this.game.centerOnCaravan(onClickAction.caravanId);
                            }
                            break;
                        // Add more custom action types here
                    }
                }
            }
            // Always close the notification on click
            this.hideNotification(notification);
        });

        // Close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.hideNotification(notification);
        });

        // Auto-hide after duration (only if not persistent)
        if (!persistent) {
            setTimeout(() => {
                this.hideNotification(notification);
            }, duration);
        }
    }

    /**
     * Hides a notification
     * @param {HTMLElement} notification - Notification element
     */
    hideNotification(notification) {
        notification.classList.remove('show');
        notification.classList.add('hide'); // Start fade-out animation

        // Remove element after animation completes
        notification.addEventListener('transitionend', () => {
            if (notification.classList.contains('hide')) {
                notification.remove();
            }
        }, { once: true });
    }
}