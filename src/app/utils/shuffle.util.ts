import { Deck } from '../models/deck.model';

export function shuffleDeck(deck: Deck) {
  const cards = deck.toArray();

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  (deck as any).head = null;
  (deck as any).size = 0;

  cards.forEach(c => deck.push(c));
}