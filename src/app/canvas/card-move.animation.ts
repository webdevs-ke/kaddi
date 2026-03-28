import { Animation } from './animator';
import { Card } from '../models/card.model';
import { drawCard } from './renderer';

export class CardMoveAnimation implements Animation {
  done = false;

  private t = 0;
  private duration = 0.3;

  constructor(
    private card: Card,
    private fromX: number,
    private fromY: number,
    private toX: number,
    private toY: number,
    private onComplete?: () => void
  ) {}

  update(dt: number) {
    this.t += dt / this.duration;

    if (this.t >= 1) {
      this.t = 1;
      this.done = true;
      this.onComplete?.();
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const t = this.ease(this.t);
    const x = this.fromX + (this.toX - this.fromX) * t;
    const y = this.fromY + (this.toY - this.fromY) * t;

    drawCard(ctx, this.card, x, y);
  }

  private ease(t: number) {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}