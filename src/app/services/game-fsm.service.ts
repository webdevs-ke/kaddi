import { Injectable } from '@angular/core';
import { Card } from '../models/card.model';
import { GameEngine } from './game-engine.service';

export type GameState =
  | 'NORMAL_TURN'
  | 'QUESTION_ACTIVE'
  | 'PICKER_ACTIVE'
  | 'ACE_SELECTION'
  | 'JUMP_ACTIVE'
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
  jumpCount: number;
  kickbackCount: number;

  turnCards: Card[]; // tracks cards played this turn
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
    jumpCount: 0,
    kickbackCount: 0,
    turnCards: []
  };

  playersCount = 2;
  isGameStart: boolean = true;

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
    // Handle card accumulation during turn
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
      case 'JUMP_ACTIVE': return this.jump(event);
      case 'KICKBACK_CHAIN': return this.kickback(event);
    }
  }

  /* ---------------- NORMAL ---------------- */
  private normal(event: GameEvent) {
    if (event.type === 'PLAY_CARD') {
      const c = event.card;

      // QUESTION
      if (this.isQuestion(c.rank)) {
        this.ctx.questionSuit = c.suit;
        this.state = 'QUESTION_ACTIVE';
        return;
      }

      // PICKER
      if (this.isPicker(c.rank)) {
        this.ctx.pickerStack = parseInt(c.rank);
        this.ctx.pickerRank = c.rank as any;

        this.ctx.pickerTarget = this.nextIndex();

        this.state = 'PICKER_ACTIVE';
        return;
      }

      // ACE
      if (this.isAce(c.rank)) {
        this.state = 'ACE_SELECTION';
        return;
      }
      
      // JUMP
      if (this.isJump(c.rank)) {
        this.ctx.jumpCount = 1;
        this.state = 'JUMP_ACTIVE';
        return;
      }     

      // KICKBACK
      if (this.isKickback(c.rank)) {
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

      if (this.isQuestion(c.rank)) {
        // question dealt, change question suit, continue dealing
        this.ctx.questionSuit = c.suit;
        return;
      } 

      if (this.isAce(c.rank)) {
        this.ctx.questionSuit = undefined;
        this.state = 'ACE_SELECTION'; // continue playing - handle suit selection
        return;
      }

      if (this.isAnswer({ suit: c.suit, rank: c.rank })) { // answer dealt
        this.state = 'NORMAL_TURN';
        this.ctx.questionSuit = undefined;

        if (this.isPicker(c.rank)) {
          this.ctx.pickerStack = parseInt(c.rank);
          this.ctx.pickerTarget = this.nextIndex();
          this.state = 'PICKER_ACTIVE';
        }
        // continue dealing
        this.ctx.turnCards = [c]
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

      if (this.isPicker(c.rank)) {
        this.ctx.pickerStack = parseInt(c.rank);
        this.ctx.pickerTarget = this.nextIndex();
        // continue dealing
        return;
      }

      if (this.isAce(c.rank)) {
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
      if (this.isKickback(event.card.rank)) {
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

  /* ---------------- JUMP ---------------- */
  private jump(event: GameEvent) {
    if (event.type === 'PLAY_CARD') {
      if (this.isJump(event.card.rank)) {
        this.ctx.jumpCount++;
      }
    }

    if (event.type === 'PICK' || event.type === 'TIMEOUT' || event.type === 'END_TURN') {        
      if (this.ctx.jumpCount === 0) {
        this.state = 'NORMAL_TURN';        
      } else {
        this.ctx.jumpCount--;
      }
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

  setPlayersCount(count: number) {
    this.playersCount = count;
  }

  initValids(c: any) {
    this.ctx.validRank = c.rank;
    this.ctx.validSuit = c.suit;
  }

  initPicker(rank: string) {
    this.ctx.pickerStack = parseInt(rank);
    this.ctx.pickerRank = rank as any;

    this.ctx.pickerTarget = this.ctx.currentPlayerIndex;

    this.state = 'PICKER_ACTIVE';
  }

  restart (winner: number = 0) {
    this.state = 'NORMAL_TURN';
    this.isGameStart = true;

    this.ctx = {
      validSuit: '', 
      validRank: '',
      currentPlayerIndex: winner,
      direction: 1,
      pickerStack: 0,
      kickbackCount: 0,
      jumpCount: 0,
      turnCards: []
    };
  }

  isAce(rank: string): boolean {
    return rank === 'A'
  }

  isPicker(rank: string): boolean {
    return rank === '2' || rank === '3'
  }

  isJump(rank: string): boolean {
    return rank === 'J'
  }

  isKickback(rank: string): boolean {
    return rank === 'K'
  }

  isQuestion(rank: string): boolean {
    return rank === 'Q' || rank === '8'
  }

  isAnswer(c: any): boolean {
    return !this.isQuestion(c.rank) && c.suit === this.ctx.questionSuit
  }
}