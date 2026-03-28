import { Card, CARD_WIDTH, CARD_HEIGHT } from '../models/card.model';

const sprite = new Image();
sprite.src = 'sprites/cards.gif';

export function drawCard(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number) {
  ctx.save();

  ctx.translate(x + 40, y + 60);
  ctx.rotate(card.rotation);
  ctx.translate(-40, -60);

  if (card.faceUp) {
    ctx.drawImage(sprite, card.spriteX, card.spriteY, CARD_WIDTH, CARD_HEIGHT, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  } else {
    ctx.drawImage(sprite, 0, 4 * CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  ctx.restore();
}