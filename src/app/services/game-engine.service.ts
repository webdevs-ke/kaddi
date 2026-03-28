import { Injectable } from '@angular/core';
import { Card } from '../models/card.model';

@Injectable({ providedIn: 'root' })
export class GameEngine {

  /* ---------------- VALIDATION ---------------- */
  isValidSequence(
    cards: Card[],
    flags: any
  ): boolean {
    if (!cards.length) return false;

    const first = cards[0];

    /* ---------------- QUESTION MODE ---------------- */
    
    if (flags.questionSuit && flags.questionSuit !== undefined) {
      const last = cards[cards.length - 1]; // check a hand card, if valid in sequence
      const isQuestion =
        last.rank === '8' || last.rank === 'Q';

      // chaining questions
      if (isQuestion) {
        // SAME RANK always allowed
        if (last.rank === cards[cards.length - 2].rank) return true;
        // SWITCH (8 - Q) MUST match suit
        return last.suit === flags.questionSuit;
      }
      
      // answering 
      if (last.rank === 'A' || last.suit === flags.questionSuit) return true;

      return this.isSameRankSequence(cards);
    }

    /* ---------------- PICKER MODE ---------------- */
    if (flags.pickerStack > 0) {
      // only allow same picker rank OR Ace
      if (!(first.rank === flags.pickerRank || first.rank === 'A')) {
        return false;
      }

      // multi-card: must all match first rank
      return this.isSameRankSequence(cards);
    }

    /* ---------------- REQUESTED SUIT (ACE EFFECT) ---------------- */
    if (flags.requestedSuit) {
      if (!(first.suit === flags.requestedSuit || first.rank === 'A')) {
        return false;
      }

      return this.isSameRankSequence(cards);
    }

    /* ---------------- NORMAL RULES ---------------- */

    // first card must match top or be Ace
    const firstValid =
      first.suit === flags.validSuit ||
      first.rank === flags.validRank ||
      first.rank === 'A';

    if (!firstValid) return false;

    // rest must match first card rank (multi-play rule)
    return this.isSameRankSequence(cards);
  }

  /* ---------------- HELPERS ---------------- */
  private isSameRankSequence(cards: Card[]): boolean {
    const rank = cards[0].rank;
    return cards.every(c => c.rank === rank);
  }
}