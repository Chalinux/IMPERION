export class ProfileManager {
    constructor(game) {
        this.game = game;
        // Default player profile data
        this.playerProfile = {
            username: 'Rey Theron',
            userId: 'player_123',
            avatarUrl: 'assets/images/units/milicia1.png', // Default placeholder
            friends: [
                { id: 'friend1', name: 'Lord Vael', avatar: 'assets/images/units/milicia1.png', status: 'Online' },
                { id: 'friend2', name: 'Lady Elara', avatar: 'assets/images/units/archer-sprite.png', status: 'Offline' },
                { id: 'friend3', name: 'Sir Kael', avatar: 'assets/images/units/cavalry-sprite.png', status: 'Online' },
            ]
        };
    }

    async loadProfile() {
        // Use default profile - no external dependencies
        this.game.logLoadingStatus("Perfil de usuario cargado: Rey Theron", 'info');
        
        /* MPHOOK: Load multiplayer profile data */
        if (this.game.multiplayer) {
            try {
                const profileData = await this.game.multiplayer.loadProfileData();
                if (profileData) {
                    this.playerProfile = { ...this.playerProfile, ...profileData };
                }
            } catch (error) {
                console.warn('Failed to load multiplayer profile:', error);
            }
        }
    }

    // Moved from UIManager.js
    updateProfileView() {
        const profileUsername = document.getElementById('profileUsername');
        const profileUserId = document.getElementById('profileUserId');
        const profileAvatar = document.getElementById('profileAvatar');
        const profileCityTroops = document.getElementById('profileCityTroops');
        const profileTechnologies = document.getElementById('profileTechnologies');
        const profileDragonsCount = document.getElementById('profileDragonsCount');
        const friendsListContainer = document.getElementById('friendsListContainer');

        if (profileUsername) profileUsername.textContent = this.playerProfile.username;
        if (profileUserId) profileUserId.textContent = this.playerProfile.userId;
        if (profileAvatar) profileAvatar.src = this.playerProfile.avatarUrl;
        
        const cityTile = this.game.mapRenderer.map[this.game.playerCity.y][this.game.playerCity.x];
        if (profileCityTroops) {
            const totalTroops = Object.values(cityTile.troops).reduce((sum, count) => sum + count, 0);
            profileCityTroops.textContent = totalTroops.toLocaleString();
        }

        // Use TradeStateManager for player technologies
        if (profileTechnologies) profileTechnologies.textContent = this.game.tradeSystem.tradeStateManager.playerTechnologies.size;
        if (profileDragonsCount) profileDragonsCount.textContent = this.game.playerDragons.length;

        // Populate friends list
        if (friendsListContainer) {
            let friendsHtml = '';
            if (this.playerProfile.friends.length === 0) {
                friendsHtml = '<p style="text-align: center; color: #c9b037;">No tienes amigos en tu lista.</p>';
            } else {
                friendsHtml = this.playerProfile.friends.map(friend => `
                    <div class="list-item friend-item">
                        <img src="${friend.avatar}" alt="${friend.name}" class="friend-avatar">
                        <span class="friend-name">${friend.name}</span>
                        <span class="friend-status" style="color: ${friend.status === 'Online' ? '#90ee90' : '#c9b037'};">${friend.status}</span>
                    </div>
                `).join('');
            }
            friendsListContainer.innerHTML = friendsHtml;
        }
    }

    // Moved from UIManager.js
    async handleProfileImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // Limit to 2MB
            this.game.uiManager.notificationManager.showNotification('error', 'La imagen de perfil no debe exceder los 2MB.');
            return;
        }

        try {
            this.game.uiManager.notificationManager.showNotification('info', 'Subiendo imagen de perfil...');
            const imageUrl = await window.websim.upload(file);
            if (imageUrl) {
                this.playerProfile.avatarUrl = imageUrl;
                document.getElementById('profileAvatar').src = imageUrl;
                this.game.uiManager.notificationManager.showNotification('success', 'Imagen de perfil actualizada.');
            } else {
                this.game.uiManager.notificationManager.showNotification('error', 'Fallo al subir la imagen.');
            }
        } catch (error) {
            console.error('Error uploading profile image:', error);
            this.game.uiManager.notificationManager.showNotification('error', 'Error al subir la imagen de perfil.');
        }
    }
}