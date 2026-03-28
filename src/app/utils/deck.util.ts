import { Deck } from '../models/deck.model';
import { Card, CARD_WIDTH, CARD_HEIGHT } from '../models/card.model';

const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

export function createDeck(): Deck {
  const deck = new Deck();

  let spriteY = 0;

  for (let i = 0; i < suits.length; i++) {
    let value = 2;
    let spriteX = 0;

    for (let j = 0; j < ranks.length; j++) {
      deck.push(new Card(value++, suits[i], ranks[j], spriteX, spriteY));
      spriteX += CARD_WIDTH;
    }

    spriteY += CARD_HEIGHT;
  }
  return deck;
}