export class CanvasResizer {
    constructor(canvas, renderCallback) {
        this.canvas = canvas;
        this.renderCallback = renderCallback;
        this.resizeQueued = false;
        this.setupResizeObserver();
    }

    setupResizeObserver() {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (this.canvas.width !== Math.floor(width) || this.canvas.height !== Math.floor(height)) {
                    this.queueResize();
                }
            }
        });
        if (this.canvas.parentElement) {
            resizeObserver.observe(this.canvas.parentElement);
        }
    }

    queueResize() {
        if (!this.resizeQueued) {
            this.resizeQueued = true;
            requestAnimationFrame(() => {
                this._resizeCanvasInternal();
                this.resizeQueued = false;
            });
        }
    }

    _resizeCanvasInternal() {
        const parent = this.canvas.parentElement;
        if (!parent) return;

        const rect = parent.getBoundingClientRect();
        const targetWidth = Math.floor(rect.width);
        const targetHeight = Math.floor(rect.height);

        if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
            this.renderCallback(); // Call the render function provided by MapRenderer
        }
    }
}

