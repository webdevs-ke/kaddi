import { Injectable } from '@angular/core';
import { Card } from '../models/card.model';
import { isSameRankSequence } from '../utils/card-sequence';

@Injectable({ providedIn: 'root' })
export class GameEngine {

  /* ---------------- VALIDATION ---------------- */

  isValidSequence(
    cards: Card[],
    fsmCtxt: any
  ): boolean {
    if (!cards.length) return false;

    const ranks: string[] = cards.map(c => c.rank);
    const first = cards[0];

    /* ---------------- QUESTION MODE ---------------- */
    
    if (fsmCtxt.questionSuit && fsmCtxt.questionSuit !== undefined) {
      const last = cards[cards.length - 1]; // check a hand card, if valid in sequence
      const isQuestion =
        last.rank === '8' || last.rank === 'Q';

      // chaining questions
      if (isQuestion) {
        // SAME RANK always allowed
        if (last.rank === cards[cards.length - 2].rank) return true;
        // SWITCH (8 - Q) MUST match suit
        return last.suit === fsmCtxt.questionSuit;
      }
      
      // answering 
      if (last.rank === 'A' || last.suit === fsmCtxt.questionSuit) return true;

      return isSameRankSequence(ranks);
    }

    /* ---------------- PICKER MODE ---------------- */

    if (fsmCtxt.pickerStack > 0) {
      // only allow same picker rank OR Ace
      if (!(first.rank === fsmCtxt.pickerRank || first.rank === 'A')) {
        return false;
      }

      // multi-card: must all match first rank
      return isSameRankSequence(ranks);
    }

    /* ---------------- JUMP MODE ---------------- */

    if (fsmCtxt.jumpCount > 0) {
      // only allow J
      if (first.rank !== 'J') {
        return false;
      }

      // multi-card: must all match first rank
      return isSameRankSequence(ranks);
    }

    /* ---------------- REQUESTED SUIT (ACE EFFECT) ---------------- */

    if (fsmCtxt.requestedSuit) {
      if (!(first.suit === fsmCtxt.requestedSuit || first.rank === 'A')) {
        return false;
      }

      return isSameRankSequence(ranks);
    }

    /* ---------------- NORMAL RULES ---------------- */

    // first card must match top or be Ace
    const firstValid =
      first.suit === fsmCtxt.validSuit ||
      first.rank === fsmCtxt.validRank ||
      first.rank === 'A';

    if (!firstValid) return false;

    // rest must match first card rank (multi-play rule)
    return isSameRankSequence(ranks);
  }
}