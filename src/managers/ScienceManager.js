export class ScienceManager {
    constructor(game) {
        this.game = game;
        this.researchedTechs = new Set(); // Start with no techs researched initially for a fresh tree

        // Interaction state
        this.scale = 0.8;
        this.offsetX = 0; // Will be set by resetZoom
        this.offsetY = 0; // Will be set by resetZoom
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.interactionSetup = false;
        this.container = null;
        this.content = null;

        // NEW: Animation properties for smooth zoom
        this.animationFrameId = null;
        this.animationDuration = 500; // milliseconds for zoom transition
        this.startScale = 0;
        this.startX = 0;
        this.startY = 0;
        this.targetScale = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.animationStartTime = 0;

        // NEW: Define quadrant layout as fractions of the tech-tree-content size (which is 200% of container)
        this.quadrantLayout = {
            military: { x_frac: 0, y_frac: 0, w_frac: 0.5, h_frac: 0.5 },
            economy: { x_frac: 0, y_frac: 0.5, w_frac: 0.5, h_frac: 0.5 },
            science: { x_frac: 0.5, y_frac: 0, w_frac: 0.5, h_frac: 0.5 },
            empire: { x_frac: 0.5, y_frac: 0.5, w_frac: 0.5, h_frac: 0.5 },
        };

        this.techTree = {
            military: {
                id: 'military', name: "Militar", color: "#d32f2f", techs: {}
            },
            economy: {
                id: 'economy', name: "Economía", color: "#f9a825", techs: {}
            },
            science: {
                id: 'science', name: "Ciencia", color: "#1976d2", techs: {}
            },
            empire: {
                id: 'empire', name: "Imperio", color: "#7b1fa2", techs: {}
            },
        };
        this._populateTechTreeFromStateManager();
    }

    // NEW: Method to populate the local tech tree structure from the TradeStateManager
    _populateTechTreeFromStateManager() {
        const allTechnologies = this.game.tradeSystem.tradeStateManager.tradeItemTypes.technology;
        for (const techId in allTechnologies) {
            const techData = allTechnologies[techId];
            if (techData.quadrant && this.techTree[techData.quadrant]) {
                this.techTree[techData.quadrant].techs[techId] = {
                    name: techData.name,
                    icon: techData.icon,
                    cost: techData.value, // Cost is 'value' in TradeStateManager
                    requires: techData.requires,
                    pos: techData.pos
                };
            }
        }
    }

    isResearchable(techId) {
        const quadrant = this.findQuadrantForTech(techId);
        if (!quadrant) return false;

        const tech = this.techTree[quadrant].techs[techId];
        if (!tech.requires || tech.requires.length === 0) return true;

        return tech.requires.every(req => this.researchedTechs.has(req));
    }

    findQuadrantForTech(techId) {
        for (const quadrantKey in this.techTree) {
            if (this.techTree[quadrantKey].techs[techId]) {
                return quadrantKey;
            }
        }
        return null;
    }

    researchTech(techId) {
        if (this.researchedTechs.has(techId)) {
            this.game.uiManager.notificationManager.showNotification('info', 'Tecnología ya investigada.');
            return;
        }

        if (!this.isResearchable(techId)) {
            this.game.uiManager.notificationManager.showNotification('error', 'Requisitos previos no cumplidos.');
            return;
        }

        const quadrant = this.findQuadrantForTech(techId);
        const tech = this.techTree[quadrant].techs[techId];
        
        if (this.game.resourceManager.resources.imperion >= tech.cost) {
            this.game.resourceManager.spendResources({ imperion: tech.cost });
            this.researchedTechs.add(techId);
            // Add technology to player's TradeStateManager technologies
            this.game.tradeSystem.tradeStateManager.playerTechnologies.add(techId); 

            this.game.newsManager.addNews(`¡Has investigado ${tech.name}!`, 'system');
            this.game.uiManager.notificationManager.showNotification('success', `¡Tecnología ${tech.name} investigada!`);
            this.renderTechTree(); // Re-render to update node states
        } else {
            this.game.uiManager.notificationManager.showNotification('error', 'Imperion insuficiente para investigar.');
        }
    }

    renderTechTree() {
        this.container = document.getElementById('tech-tree-container');
        if (!this.container) return;

        // Create a content wrapper for panning and zooming if it doesn't exist
        if (!this.content) {
            // NEW: Create both content div and SVG container as siblings inside tech-tree-container
            this.container.innerHTML = '<div id="tech-tree-content"></div><svg id="tech-tree-svg-container"></svg>';
            this.content = document.getElementById('tech-tree-content');
            // Initial render, set to overview state
            this.resetZoom(true); // Pass true to indicate it's initial setup and not a user right-click
        }

        let quadrantsHtml = '';
        // Create Quadrants
        for (const key in this.techTree) {
            const quadrant = this.techTree[key];
            const quadrantData = this.quadrantLayout[key]; // Get layout data

            quadrantsHtml += `
                <div class="tech-quadrant" id="quadrant-${quadrant.id}" 
                     style="top: ${quadrantData.y_frac * 100}%; left: ${quadrantData.x_frac * 100}%; 
                            width: ${quadrantData.w_frac * 100}%; height: ${quadrantData.h_frac * 100}%;
                            border-color: ${quadrant.color}; background: radial-gradient(circle, ${quadrant.color}1A 0%, rgba(0,0,0,0.3) 70%);">
                    <h4 class="quadrant-title" style="border-color: ${quadrant.color}; border-bottom-color: ${quadrant.color};">${quadrant.name}</h4>
                </div>
            `;
        }
        this.content.innerHTML = quadrantsHtml;

        // Ensure SVG exists and set its dimensions to match container for direct pixel drawing
        const svgContainer = document.getElementById('tech-tree-svg-container');
        if (svgContainer) {
            const containerRect = this.container.getBoundingClientRect();
            svgContainer.setAttribute('width', containerRect.width.toString());
            svgContainer.setAttribute('height', containerRect.height.toString());
        }

        for (const key in this.techTree) {
            const quadrant = this.techTree[key];
            const quadrantEl = document.getElementById(`quadrant-${quadrant.id}`);

            // NEW: Add click listener to the quadrant itself for zooming
            if (quadrantEl) {
                quadrantEl.addEventListener('click', (e) => {
                    // Only trigger zoom if the quadrant background itself is clicked, or its title
                    if (e.target === quadrantEl || e.target.classList.contains('quadrant-title')) {
                        e.stopPropagation(); // Prevent main handleMouseDown for drag
                        this.zoomToQuadrant(quadrant.id);
                    }
                });
            }

            for (const techId in quadrant.techs) {
                const tech = quadrant.techs[techId];
                const node = document.createElement('div');
                node.id = `tech-node-${techId}`;
                node.className = 'tech-node';
                node.style.left = tech.pos.x;
                node.style.top = tech.pos.y;
                
                let stateClass = 'locked';
                if (this.researchedTechs.has(techId)) {
                    stateClass = 'unlocked';
                } else if (this.isResearchable(techId)) {
                    stateClass = 'researchable';
                }
                node.classList.add(stateClass);
                
                node.innerHTML = `
                    <div class="tech-node-icon">${tech.icon}</div>
                    <div class="tech-node-name">${tech.name}</div>
                    <div class="tech-node-cost">${tech.cost} 👑</div>
                `;
                
                node.onclick = (e) => { // Keep existing onclick for research
                    e.stopPropagation(); // Prevent quadrant click from firing if clicked on a node, and prevent main handleMouseDown for drag
                    this.researchTech(techId);
                };
                // Keep data-tooltip for UIManager to pick up
                node.dataset.tooltip = `${tech.name}: Costo: ${tech.cost} Imperion.`;
                if (tech.requires && tech.requires.length > 0 && !this.researchedTechs.has(techId)) {
                    const requiredTechsNames = tech.requires.map(reqId => {
                        const reqQuadrant = this.findQuadrantForTech(reqId);
                        return this.techTree[reqQuadrant].techs[reqId].name;
                    }).join(', ');
                    node.dataset.tooltip += ` Requisitos: ${requiredTechsNames}.`;
                }

                quadrantEl.appendChild(node);
            }
        }

        if (!this.interactionSetup) {
            this.setupInteraction();
        }
        
        // Initial transform
        this.applyTransform();
        // Call UIManager to re-scan for tooltips after dynamic content is added
        this.game.uiManager.setupTooltips(); 
    }
    
    // NEW: Start a smooth zoom animation
    _startZoomAnimation(targetScale, targetX, targetY) {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.startScale = this.scale;
        this.startX = this.offsetX;
        this.startY = this.offsetY;
        this.targetScale = targetScale;
        this.targetX = targetX;
        this.targetY = targetY;
        this.animationStartTime = performance.now();

        this.animationFrameId = requestAnimationFrame(this._zoomAnimationLoop.bind(this));
    }

    // NEW: Animation loop for smooth zooming
    _zoomAnimationLoop(currentTime) {
        const elapsed = currentTime - this.animationStartTime;
        let progress = Math.min(1, elapsed / this.animationDuration);

        // Ease-out quadratic easing for a smoother feel
        progress = progress * (2 - progress); 

        this.scale = this.startScale + (this.targetScale - this.startScale) * progress;
        this.offsetX = this.startX + (this.targetX - this.startX) * progress;
        this.offsetY = this.startY + (this.targetY - this.startY) * progress;

        this.applyTransform();

        if (progress < 1) {
            this.animationFrameId = requestAnimationFrame(this._zoomAnimationLoop.bind(this));
        } else {
            this.animationFrameId = null;
        }
    }

    // NEW: Zoom to a specific quadrant
    zoomToQuadrant(quadrantId) {
        const quadrantData = this.quadrantLayout[quadrantId];
        if (!quadrantData) return;

        const containerRect = this.container.getBoundingClientRect();
        const currentContainerWidth = containerRect.width;
        const currentContainerHeight = containerRect.height;

        // tech-tree-content is 200% of its parent (#tech-tree-container)
        const techContentWidth = currentContainerWidth * 2; 
        const techContentHeight = currentContainerHeight * 2;

        const targetQuadrantX_content = quadrantData.x_frac * techContentWidth;
        const targetQuadrantY_content = quadrantData.y_frac * techContentHeight;
        const targetQuadrantW_content = quadrantData.w_frac * techContentWidth;
        const targetQuadrantH_content = quadrantData.h_frac * techContentHeight;

        const paddingFactor = 0.9; // 10% padding
        let newScale = Math.min(
            currentContainerWidth / targetQuadrantW_content,
            currentContainerHeight / targetQuadrantH_content
        ) * paddingFactor;
        
        newScale = Math.min(newScale, 2.5); // Cap max zoom to prevent extreme close-ups
        newScale = Math.max(newScale, 0.4); // Ensure minimum zoom

        const quadrantCenterX_content = targetQuadrantX_content + targetQuadrantW_content / 2;
        const quadrantCenterY_content = targetQuadrantY_content + targetQuadrantH_content / 2;

        const screenCenterX = currentContainerWidth / 2;
        const screenCenterY = currentContainerHeight / 2;

        // Calculate offsetX and offsetY to center the quadrant
        // The offsetX/Y are the translate values of the top-left of the tech-tree-content
        const newOffsetX = screenCenterX - (quadrantCenterX_content * newScale);
        const newOffsetY = screenCenterY - (quadrantCenterY_content * newScale);
        
        this._startZoomAnimation(newScale, newOffsetX, newOffsetY);
        this.game.uiManager._hideTooltip(); // Hide any active tooltip when zooming
    }

    // NEW: Reset zoom to overview
    resetZoom(isInitialSetup = false) {
        if (!this.container) return; // Ensure container is available

        const containerRect = this.container.getBoundingClientRect();
        // The conceptual content is 200% of the container
        const techContentWidth = containerRect.width * 2;
        const techContentHeight = containerRect.height * 2;
        
        const newScale = 0.45; // NEW: Adjusted scale for a more zoomed-out overview
        
        // Calculate offsets to center the *entire 200% content* scaled by the new scale
        const newOffsetX = (containerRect.width / 2) - (techContentWidth / 2 * newScale);
        const newOffsetY = (containerRect.height / 2) - (techContentHeight / 2 * newScale);

        if (!isInitialSetup) { // Only show news if user explicitly triggers reset
            this.game.newsManager.addNews('Volviendo a la vista general del árbol tecnológico.', 'system');
        }
        
        this._startZoomAnimation(newScale, newOffsetX, newOffsetY);
        this.game.uiManager._hideTooltip(); // Hide any active tooltip when zooming
    }
    
    // NEW: Methods for pan and zoom interaction
    setupInteraction() {
        if (!this.container) return;
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.container.addEventListener('mouseleave', this.handleMouseUp.bind(this)); // Stop dragging if mouse leaves
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        // NEW: Right-click listener for resetting zoom
        this.container.addEventListener('contextmenu', this.handleRightClick.bind(this)); 
        this.interactionSetup = true;
    }
    
    handleMouseDown(e) {
        if (this.animationFrameId) { // Cancel ongoing animation if user starts interacting
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (!this.container) return; // Ensure container exists

        if (e.button === 2) { // Right-click (button 2)
            e.preventDefault(); // Prevent default context menu
            this.isDragging = false; // Ensure dragging isn't initiated
            this.resetZoom(); // Reset zoom on right-click
            return;
        }
        // Only proceed to dragging if it's a left click AND not on an interactive element (node or quadrant itself/title)
        // Clicks on tech-nodes or tech-quadrants are handled by their specific event listeners with stopPropagation.
        // This condition now correctly ensures dragging only starts when clicking the "empty" background.
        if (e.button === 0 && !e.target.closest('.tech-node') && !e.target.closest('.tech-quadrant')) {
            e.preventDefault(); // Prevent text selection and default click behavior
            this.isDragging = true;
            this.dragStart.x = e.clientX - this.offsetX;
            this.dragStart.y = e.clientY - this.offsetY;
            this.container.style.cursor = 'grabbing';
        } else {
            this.isDragging = false; // Ensure dragging is false for clicks on interactive elements
        }
        this.game.uiManager._hideTooltip(); // Hide tooltip on any mousedown
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        this.offsetX = e.clientX - this.dragStart.x;
        this.offsetY = e.clientY - this.dragStart.y;
        this.applyTransform();
        this.game.uiManager._hideTooltip(); // Hide tooltip when dragging
    }

    handleMouseUp() {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
    }

    handleWheel(e) {
        if (this.animationFrameId) { // Cancel ongoing animation if user starts interacting
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        e.preventDefault();
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.4, Math.min(2.5, this.scale * zoomFactor)); // Updated min/max bounds based on user feedback
        
        // Calculate world coordinates relative to the *unscaled* 200% content.
        // Then apply the new scale to get new offsets.
        const worldX = (mouseX - this.offsetX) / this.scale;
        const worldY = (mouseY - this.offsetY) / this.scale;
        
        this.offsetX = mouseX - worldX * newScale;
        this.offsetY = mouseY - worldY * newScale;
        this.scale = newScale;
        
        this.applyTransform();
        this.game.uiManager._hideTooltip(); // Hide tooltip when zooming
    }
    
    // NEW: Handle right-click for resetting zoom
    handleRightClick(e) {
        e.preventDefault(); // Prevent default context menu
        this.resetZoom();
    }
    
    applyTransform() {
        if (!this.content) return;
        this.content.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
    }
}