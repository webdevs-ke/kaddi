import { Injectable } from '@angular/core';
import { Card } from '../models/card.model';
import { GameEngine } from './game-engine.service';

export type GameState =
  | 'NORMAL_TURN'
  | 'QUESTION_ACTIVE'
  | 'PICKER_ACTIVE'
  | 'ACE_SELECTION'
  | 'KICKBACK_CHAIN';

interface GameContext {
  validSuit: string, 
  validRank: string,

  currentPlayerIndex: number;
  direction: 1 | -1;

  questionSuit?: string;

  pickerStack: number;
  pickerRank?: '2' | '3';
  pickerTarget?: number;

  requestedSuit?: string;

  kickbackCount: number;

  turnCards: Card[]; // track cards played this turn
}

type GameEvent =
  | { type: 'PLAY_CARD'; card: Card }
  | { type: 'END_TURN' }
  | { type: 'TIMEOUT' }
  | { type: 'PICK' }
  | { type: 'SELECT_SUIT'; suit: string };

@Injectable({ providedIn: 'root' })
export class GameFSM {
  constructor(private engine: GameEngine) {}

  state: GameState = 'NORMAL_TURN';

  ctx: GameContext = {
    validSuit: '', 
    validRank: '',
    currentPlayerIndex: 0,
    direction: 1,
    pickerStack: 0,
    kickbackCount: 0,
    turnCards: []
  };

  playersCount = 2;
  isGameStart: boolean = true;

  setPlayersCount(count: number) {
    this.playersCount = count;
  }

  /* ---------------- VALIDATION ---------------- */
  isValidPlay(card: Card): boolean {
    const sequence = [...this.ctx.turnCards, card];

    // GAME START LOGIC
    if (this.isGameStart) {
      // first tableau card is ACE?
      if (this.ctx.validRank === '' && this.ctx.validSuit === '') {
        return true;
      }        
    }
    return this.engine.isValidSequence(sequence, this.ctx);
  }

  /* ---------------- DISPATCH ---------------- */
  dispatch(event: GameEvent) {
    // Handle card accumulation centrally
    if (event.type === 'PLAY_CARD') {
      this.ctx.turnCards.push(event.card);

      if (event.card.rank !== 'A') {
        this.ctx.validRank = event.card.rank;
        this.ctx.validSuit = event.card.suit;
      }

      this.isGameStart = false;
    }

    switch (this.state) {
      case 'NORMAL_TURN': return this.normal(event);
      case 'QUESTION_ACTIVE': return this.question(event);
      case 'PICKER_ACTIVE': return this.picker(event);
      case 'ACE_SELECTION': return this.ace(event);
      case 'KICKBACK_CHAIN': return this.kickback(event);
    }
  }

  /* ---------------- NORMAL ---------------- */
  private normal(event: GameEvent) {
    if (event.type === 'PLAY_CARD') {
      const card = event.card;

      // QUESTION
      if (card.rank === '8' || card.rank === 'Q') {
        this.ctx.questionSuit = card.suit;
        this.state = 'QUESTION_ACTIVE';
        return;
      }

      // PICKER
      if (card.rank === '2' || card.rank === '3') {
        this.ctx.pickerStack = parseInt(card.rank);
        this.ctx.pickerRank = card.rank as any;

        this.ctx.pickerTarget = this.isGameStart
          ? this.ctx.currentPlayerIndex
          : this.nextIndex();

        this.state = 'PICKER_ACTIVE';
        return;
      }

      // ACE
      if (card.rank === 'A') {
        this.state = 'ACE_SELECTION';
        return;
      }

      // KICKBACK
      if (card.rank === 'K') {
        this.ctx.kickbackCount = 1;
        this.state = 'KICKBACK_CHAIN';
        return;
      }      
      // continue dealing
    }

    if (event.type === 'PICK' || event.type === 'TIMEOUT' || event.type === 'END_TURN') {
      this.advanceTurn();
    }
  }

  /* ---------------- QUESTION ---------------- */
  private question(event: GameEvent) {
    if (event.type === 'PLAY_CARD') {
      const c = event.card;

      if (c.rank === '8' || c.rank === 'Q') return; // continue dealing

      if (c.rank === 'A') {
        this.ctx.questionSuit = undefined;
        this.state = 'ACE_SELECTION'; // continue playing - handle suit selection
        return;
      }

      if (c.suit === this.ctx.questionSuit) {
        this.state = 'NORMAL_TURN';
        this.ctx.questionSuit = undefined;

        if (c.rank === '2' || c.rank === '3') {
          this.ctx.pickerStack = parseInt(c.rank);
          this.ctx.pickerTarget = this.nextIndex();
          this.state = 'PICKER_ACTIVE';
        }
        // continue dealing
        return;
      }
    }

    if (event.type === 'PICK' || event.type === 'TIMEOUT' || event.type === 'END_TURN') {
      this.ctx.questionSuit = undefined;
      this.state = 'NORMAL_TURN';
      this.advanceTurn();
    }
  }

  /* ---------------- PICKER ---------------- */
  private picker(event: GameEvent) {
    if (event.type === 'PLAY_CARD') {
      const c = event.card;

      if (c.rank === '2' || c.rank === '3') {
        this.ctx.pickerStack = parseInt(c.rank);
        this.ctx.pickerTarget = this.nextIndex();
        // continue dealing
        return;
      }

      if (c.rank === 'A') {
        // neutralize picker, valid suit & rank don't change (same as picker's)
        this.ctx.pickerStack = 0;
        this.ctx.pickerTarget = undefined;
        this.state = 'NORMAL_TURN';
        this.advanceTurn();
        return;
      }

      return;
    }

    if (event.type === 'PICK' || event.type === 'TIMEOUT' || event.type === 'END_TURN') {
      if (this.ctx.currentPlayerIndex === this.ctx.pickerTarget) {
        this.ctx.pickerStack = 0;
        this.ctx.pickerTarget = undefined;
        this.state = 'NORMAL_TURN';        
      }
      this.advanceTurn();    
    }
  }

  /* ---------------- ACE ---------------- */
  private ace(event: GameEvent) {
    if (event.type === 'SELECT_SUIT') {
      this.ctx.validRank = '';
      this.ctx.validSuit = event.suit; // handle suit selection, set selected
      this.state = 'NORMAL_TURN';
      this.advanceTurn();
    }
  }

  /* ---------------- KICKBACK ---------------- */
  private kickback(event: GameEvent) {
    if (event.type === 'PLAY_CARD') {
      if (event.card.rank === 'K') {
        this.ctx.kickbackCount++;
        if (this.ctx.kickbackCount % 2 === 0) {
          // even number kickbacks, turn restarts
          this.ctx.kickbackCount = 0;
          this.state = 'NORMAL_TURN';
          this.ctx.turnCards = []
        }
        return;
      }

      if (this.ctx.kickbackCount >= 2) {
        this.state = 'NORMAL_TURN';
        return this.normal(event);
      }
    }

    if (event.type === 'PICK' || event.type === 'END_TURN' || event.type === 'TIMEOUT') {
      if (this.playersCount > 2 && this.ctx.kickbackCount % 2 === 1) {
        this.ctx.direction *= -1;
      }

      this.ctx.kickbackCount = 0;
      this.state = 'NORMAL_TURN';
      this.advanceTurn();
    }
  }

  /* ---------------- HELPERS ---------------- */
  private advanceTurn() {
    const t = this.playersCount;

    this.ctx.currentPlayerIndex =
      (this.ctx.currentPlayerIndex + this.ctx.direction + t) % t;
    
    this.ctx.turnCards = [];
  }

  private nextIndex() {
    const t = this.playersCount;

    return (
      (this.ctx.currentPlayerIndex + this.ctx.direction + t) % t
    );
  }
}