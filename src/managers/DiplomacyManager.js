export class DiplomacyManager {
    constructor(game) {
        this.game = game;
    }

    updateDiplomacyView() {
        const listContainer = document.getElementById('diplomacy-list-container');
        if (!listContainer) return;

        const allContacts = [...this.game.npcEmpires, ...this.game.activeCaravans];

        let htmlContent = '';
        if (allContacts.length === 0) {
            htmlContent = '<p style="text-align: center; color: #c9b037;">No hay otros imperios o caravanas con los que interactuar.</p>';
        } else {
            htmlContent = allContacts.map(contact => {
                if (contact.isCaravan) {
                    // Special rendering for caravans
                    const expiresIn = Math.max(0, Math.floor((contact.expires - performance.now()) / 1000));
                    return `
                        <div class="list-item">
                            <h5 class="item-title">📜 ${contact.name}</h5>
                            <p>Estado: <span style="color: ${this.getRelationColor('neutral')};">Mercader Ambulante</span></p>
                            <p>Se marchará en: ${Math.floor(expiresIn / 60)}m ${expiresIn % 60}s</p>
                            <div class="item-actions">
                                <button class="medieval-btn" onclick="game.tradeSystem.privateTradeManager.openPrivateTradeModal('${contact.id}')">🤝 Comerciar con Caravana</button>
                            </div>
                        </div>
                    `;
                } else {
                    // Standard rendering for NPCs
                    return `
                        <div class="list-item">
                            <h5 class="item-title">${contact.name}</h5>
                            <p>Estado: <span style="color: ${this.getRelationColor(contact.initialRelation)};">${this.getRelationText(contact.initialRelation)}</span></p>
                            <div class="item-actions">
                                <button class="medieval-btn" onclick="game.tradeSystem.privateTradeManager.openPrivateTradeModal('${contact.id}')">🤝 Comercio Privado</button>
                                <button class="medieval-btn" onclick="game.diplomacyManager.proposeAlliance('${contact.id}')">Proponer Alianza</button>
                                <button class="medieval-btn" onclick="game.diplomacyManager.declareWar('${contact.id}')">Declarar Guerra</button>
                                <button class="medieval-btn" onclick="game.diplomacyManager.sendResources('${contact.id}')">Enviar Recursos</button>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        }
        listContainer.innerHTML = htmlContent;
    }

    getRelationColor(relation) {
        switch (relation) {
            case 'allied': return 'green';
            case 'neutral': return 'yellow';
            case 'hostile': return 'red';
            default: return 'white';
        }
    }

    getRelationText(relation) {
        switch (relation) {
            case 'allied': return 'Aliado';
            case 'neutral': return 'Neutral';
            case 'hostile': return 'Hostil';
            default: return 'Desconocido';
        }
    }

    proposeAlliance(npcId) {
        const npc = this.game.getNpcById(npcId);
        if (npc) {
            this.game.newsManager.addNews(`Has propuesto una alianza a ${npc.name}.`);
            this.game.uiManager.notificationManager.showNotification('info', `Propuesta de alianza a ${npc.name}.`);
        }
    }

    declareWar(npcId) {
        const npc = this.game.getNpcById(npcId);
        if (npc) {
            this.game.newsManager.addNews(`¡Has declarado la guerra a ${npc.name}!`);
            this.game.uiManager.notificationManager.showNotification('error', `¡Guerra declarada a ${npc.name}!`);
        }
    }

    sendResources(npcId) {
        const npc = this.game.getNpcById(npcId);
        if (npc) {
            this.game.newsManager.addNews(`Has enviado recursos a ${npc.name}. (Funcionalidad pendiente)`);
            this.game.uiManager.notificationManager.showNotification('info', `Enviando recursos a ${npc.name}...`);
        }
    }
}