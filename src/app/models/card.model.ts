export const CARD_WIDTH = 81;
export const CARD_HEIGHT = 117.4;

export class Card {
    constructor(
      public value: number,
      public suit: string,
      public rank: string,
      public spriteX: number,
      public spriteY: number,
      public faceUp: boolean = false,
      public rotation: number = 0
    ) {}
}