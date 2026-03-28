export interface Animation {
    update(dt: number): void;
    draw(ctx: CanvasRenderingContext2D): void;
    done: boolean;
}
  
export class Animator {
    private animations: Animation[] = [];
    private lastTime = 0;

    start(ctx: CanvasRenderingContext2D,
            drawBackground: () => void
        ) {
        const loop = (time: number) => {
            const dt = (time - this.lastTime) / 1000;
            this.lastTime = time;

            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            drawBackground()

            this.animations.forEach(a => {
                a.update(dt);
                a.draw(ctx);
            });

            this.animations = this.animations.filter(a => !a.done);

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    add(animation: Animation) {
        this.animations.push(animation);
    }

    clear() {
        this.animations = [];
    }
}