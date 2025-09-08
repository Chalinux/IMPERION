// ... existing game loop code ...

// Process exploration completion
const completedExplorationsCoords = []; // Store coordinates as objects {x, y}
const currentTime = performance.now();

// Collect all completed explorations in one pass
// Iterate over a shallow copy of the map entries to safely modify `this.exploringTiles` later
for (const [key, exploreData] of [...this.exploringTiles.entries()]) { 
    if (currentTime - exploreData.startTime >= exploreData.duration) {
        completedExplorationsCoords.push({ x: exploreData.x, y: exploreData.y });
    }
}

// Now, process each completed exploration and remove it from the map
let needsMapRender = false;
for (const { x, y } of completedExplorationsCoords) {
    const tileKey = `${x},${y}`;
    // Important: Check if the tile is still in the map before resolving and deleting.
    // This prevents issues if a tile was manually modified or removed via debug tools,
    // or if an exploration was somehow already handled.
    if (this.exploringTiles.has(tileKey)) { 
        this.resolveExploration(x, y);
        this.exploringTiles.delete(tileKey);
        needsMapRender = true; // Mark that map needs re-rendering
        
        // Update side panel if relevant tile was selected
        if (this.selectedTile && this.selectedTile.x === x && this.selectedTile.y === y) {
            this.selectTile(this.selectedTile.x, this.selectedTile.y);
        }
    }
}

// Render map only if explorations were resolved OR if other conditions require rendering
if (needsMapRender || this.movingArmies.size > 0 || this.exploringTiles.size > 0) {
    this.mapRenderer.render();
}
// ... rest of the code ...