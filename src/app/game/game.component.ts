import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  inject
} from '@angular/core';

import {
  ReactiveFormsModule,
  FormControl,
  Validators,
  FormArray
} from '@angular/forms';

import { createDeck } from '../utils/deck.util';
import { shuffleDeck } from '../utils/shuffle.util';

import { Card, CARD_WIDTH, CARD_HEIGHT } from '../models/card.model';
import { Deck } from '../models/deck.model';
import { Tableau } from '../models/tableau.model';
import { Player } from '../models/player.model';

import { drawCard } from '../canvas/renderer';
import { Animator } from '../canvas/animator';
import { CardMoveAnimation } from '../canvas/card-move.animation';
import { getPlayerPosition } from '../canvas/layout';

import { GameFSM } from '../services/game-fsm.service';

@Component({
  selector: 'app-game',
  imports: [ReactiveFormsModule],
  templateUrl: './game.component.html'
})
export class GameComponent implements AfterViewInit {

  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  ctx!: CanvasRenderingContext2D;  
  private fsm = inject(GameFSM);

  // Game state
  deck!: Deck;
  tableau = new Tableau();
  players: Player[] = [];

  minDeck = 3;
  turnTime = 30;
  timerInterval: any;

  // Forms
  playerCountControl = new FormControl(2, {
    nonNullable: true,
    validators: [Validators.min(2), Validators.max(5)]
  });

  playerNames = new FormArray<FormControl<string>>([]);

  // UI state
  enterNames = true;
  started = false;

  animator = new Animator();

  centerX = 450;
  centerY = 300;
  
  draggingCard: Card | null = null;
  dragX = 0;
  dragY = 0;
  dragOffsetX = 0;
  dragOffsetY = 0;

  hoveringTableau: boolean = false;

  pendingAce: boolean = false;

  gameOver: boolean = false;
  gamesPlayed: number[] = [];

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;

    this.ctx = canvas.getContext('2d')!;
    this.animator.start(this.ctx, () => this.drawGame());

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));    
  }

  isValidTurnCard(card: Card | null): boolean {
    if (!card) return false;

    return this.fsm.isValidPlay(card);
  }

  hasDealt(): boolean {
    return (this.fsm.ctx.turnCards.length > 0);
  }

  canDeal(): boolean {
    return (this.currentPlayer.hand.toArray().some(c => this.isValidTurnCard(c)))
  }

  isPlayerKaddi(): boolean {
    return (this.fsm.state !== 'QUESTION_ACTIVE' && 
            this.currentPlayer.hand.getSize() === 1 && 
            this.currentPlayer.isKaddi()
    );
  }

  /* ---------------- TIMER ---------------- */

  startTimer(time: number) {
    clearInterval(this.timerInterval);
  
    this.turnTime = time;
  
    this.timerInterval = setInterval(() => {
      this.turnTime--;
  
      if (this.turnTime <= 0) {
        clearInterval(this.timerInterval);  
        this.handleTimeout();              
      }
    }, 1000);
  }
  
  startTurnTimer() {
    this.currentPlayer.kaddiState = this.isPlayerKaddi();

    if (this.canDeal()) {
      this.startTimer(30);

    } else {
      this.startTimer(3);
    }
  }

  handleTimeout() {
    this.resetDeck();

    if (this.draggingCard) {
      this.animateReturnToHand();  
    }

    if (!this.hasDealt()) {
      // new player has not dealt, pick
      const count =
        this.fsm.state === 'PICKER_ACTIVE'
          ? this.fsm.ctx.pickerStack
          : 1;
  
      this.animatePickCards(count);
    } else {
      if (this.fsm.state === 'QUESTION_ACTIVE') {
        // current player has dealt question(s) without answer(s)
        this.animatePickCards(1);
      }
    }

    this.currentPlayer.kaddiState = this.isPlayerKaddi();

    this.fsm.dispatch({ type: 'TIMEOUT' });
    this.startTurnTimer();
  }

  /* ---------------- INPUT ---------------- */
  onMouseDown(event: MouseEvent) {  
    if (!this.started || this.pendingAce) return;

    const { x, y } = this.getMousePos(event);
  
    const player = this.currentPlayer;
    const cards = player.hand.toArray();
  
    const pos = getPlayerPosition(
      this.fsm.ctx.currentPlayerIndex,
      this.players.length,
      this.centerX,
      this.centerY,
      250
    );  
  
    // top-most first
    for (let i = 0; i <= cards.length - 1; i++) {
      const card = cards[i];
  
      const cardX = pos.x - (cards.length * 10) + i * 20;
      const cardY = pos.y + 10;

      const visibleWidth = 20; // overlap spacing
  
      const isInside =
        x >= cardX &&
        x <= cardX + (i === cards.length - 1 ? CARD_WIDTH : visibleWidth) &&
        y >= cardY &&
        y <= cardY + CARD_HEIGHT;
  
      if (isInside && this.isValidTurnCard(card)) {  
        this.draggingCard = card;  
        this.dragOffsetX = x - cardX;
        this.dragOffsetY = y - cardY;  
        this.dragX = cardX;
        this.dragY = cardY;  
        return;
      }
    }
  }

  onMouseMove(event: MouseEvent) {
    if (!this.draggingCard) {
      return;
    }
  
    const { x, y } = this.getMousePos(event);
  
    this.dragX = x - this.dragOffsetX;
    this.dragY = y - this.dragOffsetY;

    const tx = this.centerX + 60;
    const ty = this.centerY - 60;

    this.hoveringTableau =
      x >= tx &&
      x <= tx + CARD_WIDTH &&
      y >= ty &&
      y <= ty + CARD_HEIGHT
  }

  onMouseUp(event: MouseEvent) {
    const { x, y } = this.getMousePos(event);

    if (this.pendingAce) {
      this.handleAceClick(x, y);
      return;
    }    

    if (!this.draggingCard) {
      this.handleDeckClick(x, y);
      return;
    }    
  
    // Tableau drop zone
    const tx = this.centerX + 60;
    const ty = this.centerY - 60;

    const dropped = 
      x >= tx && x <= tx + CARD_WIDTH && y >= ty && y <= ty + CARD_HEIGHT;    
    
    if (dropped && this.isValidTurnCard(this.draggingCard) && this.turnTime > 1) {      
      const card = this.draggingCard;

      this.animator.add(
        new CardMoveAnimation(
          card,
          this.dragX,
          this.dragY,
          tx,
          ty,
          () => this.completePlay(card)
        )
      );        
    } else { // dragging card dropped elsewhere, not tableau | invalid | timeout
      this.animateReturnToHand();
    } 
  }

  /* ---------------- ACE ---------------- */
  handleAceClick(x: number, y: number) {
    const suits = ['hearts', 'spades', 'diamonds', 'clubs'];

    suits.forEach((suit, i) => {
      const sx = this.centerX - 100 + i * 60;
      const sy = this.centerY - 150;

      if (x >= sx && x <= sx + 30 && y >= sy && y <= sy + 30) {
        this.currentPlayer.kaddiState = this.isPlayerKaddi() ? true : false;
        this.fsm.dispatch({ type: 'SELECT_SUIT', suit });
        this.pendingAce = false;        
        this.startTurnTimer();
      }
    });
  }

  handleDeckClick(x: number, y: number) {
    if (this.pendingAce) return;

    const dx = this.centerX - 40;
    const dy = this.centerY - 60;
  
    const isDeck =
      x >= dx &&
      x <= dx + CARD_WIDTH &&
      y >= dy &&
      y <= dy + CARD_HEIGHT;
  
    if (!isDeck || this.turnTime <= 1) return;

    this.pickFromDeck();    
  }

  resetDeck() {
    if (this.deck.getSize() > this.minDeck) return;

    const cards = this.deck.toArray();
    const top = this.tableau.pop();          
    if(!top || !cards.length) return;
    
    const newDeck = new Deck();
    while(!this.tableau.isEmpty()) {
      const card = this.tableau.pop();
      if(!card) break;
      
      card.rotation = 0;
      card.faceUp = false;
      newDeck.push(card)
    }
    
    this.tableau.push(top);    
    shuffleDeck(newDeck);

    for (let i=cards.length-1; i>=0; i--) {
      newDeck.push(cards[i]);
    }
    
    this.deck = newDeck;
  }

  pickFromDeck() {
    this.resetDeck();

    const isTarget =
      this.fsm.ctx.currentPlayerIndex === this.fsm.ctx.pickerTarget;
  
    // block illegal pick
    if (this.fsm.state === 'PICKER_ACTIVE' && !isTarget) return;
  
    if (!this.hasDealt()) {
      // new player has not dealt
      const count =
        this.fsm.state === 'PICKER_ACTIVE'
          ? this.fsm.ctx.pickerStack
          : 1;
      
      this.animatePickCards(count);
      this.currentPlayer.kaddiState = this.isPlayerKaddi();
      this.fsm.dispatch({ type: 'PICK' });
      this.startTurnTimer();
    } else {
      if (this.fsm.state === 'QUESTION_ACTIVE') {
        // current player has dealt question(s) without answer(s)
        this.animatePickCards(1);
        this.currentPlayer.kaddiState = this.isPlayerKaddi();
        this.fsm.dispatch({ type: 'PICK' });
        this.startTurnTimer();
      }
    }
  }

  /* ---------------- PLAY ---------------- */
  completePlay(card: Card) {
    const player = this.currentPlayer;
  
    player.hand.remove(card);
  
    card.faceUp = true;
    card.rotation = (Math.random() - 0.5) * 0.8;
  
    this.tableau.push(card);
    this.draggingCard = null;
    this.hoveringTableau = false;

    this.fsm.dispatch({ type: 'PLAY_CARD', card });

    if (this.won()) {        
      this.restart(this.fsm.ctx.currentPlayerIndex);
      return;
    }

    if (this.fsm.state === 'ACE_SELECTION') {
      this.pendingAce = true;
      return;
    }

    this.startTurnTimer();
  }

  won (): boolean {
    if (!this.currentPlayer.hand.isEmpty() || !this.currentPlayer.kaddiState)
      return false;

    if(this.players.some(p => p.hand.isEmpty() && p !== this.currentPlayer)) 
      return false;    

    this.gamesPlayed.push(this.fsm.ctx.currentPlayerIndex);
    this.gameOver = true;

    return true;
  }

  animateReturnToHand () {
    this.hoveringTableau = false;
    const player = this.currentPlayer;
    const cards = player.hand.toArray();
    const card = this.draggingCard;

    if (!card) return;    
  
    const index = cards.indexOf(card);
  
    const pos = getPlayerPosition(
      this.fsm.ctx.currentPlayerIndex,
      this.players.length,
      this.centerX,
      this.centerY,
      250
    );
  
    const targetX = pos.x - (cards.length * 10) + index * 20;
    const targetY = pos.y + 10;
  
    this.animator.add(
      new CardMoveAnimation(
        card,
        this.dragX,
        this.dragY,
        targetX,
        targetY
      )
    );
    this.draggingCard = null;
  }

  getMousePos(event: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
  
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }  

  animatePickCards(count: number) {
    const player = this.currentPlayer;
  
    const deckX = this.centerX - 40;
    const deckY = this.centerY - 60;
  
    const pos = getPlayerPosition(
      this.fsm.ctx.currentPlayerIndex,
      this.players.length,
      this.centerX,
      this.centerY,
      250
    );
  
    let i = 0;
  
    const pickNext = () => {
      if (i >= count) {                     
        return;
      }
  
      const card = this.deck.pop();
      if (!card) return;
  
      const handCards = player.hand.toArray();
  
      const targetX =
        pos.x - (handCards.length * 10) + handCards.length * 20;
  
      const targetY = pos.y + 10;
  
      this.animator.add(
        new CardMoveAnimation(
          card,
          deckX,
          deckY,
          targetX,
          targetY,
          () => {
            player.hand.push(card);
          }
        )
      );
  
      i++;
      setTimeout(pickNext, 150); // stagger animation
    };
  
    pickNext();
  }

  setupPlayers() {
    if (this.playerCountControl.invalid) return;

    const count = this.playerCountControl.value;

    this.playerNames.clear();

    for (let i = 0; i < count; i++) {
      this.playerNames.push(
        new FormControl('', {
          nonNullable: true,
          validators: [Validators.required, Validators.minLength(2)]
        })
      );
    }

    this.enterNames = true;
  }

  get currentPlayer() {
    return this.players[this.fsm.ctx.currentPlayerIndex];
  }

  endTurn() {
    this.handleTimeout();
    return;
  }

  animateShuffle(done: () => void) {
    let times = 15;
  
    const shuffleStep = () => {
      shuffleDeck(this.deck);
  
      times--;
      if (times > 0) {
        setTimeout(shuffleStep, 50);
      } else {
        done();
      }
    };
  
    shuffleStep();
  }

  dealCardsAnimated() {
    const deckX = this.centerX - 40;
    const deckY = this.centerY - 60;
  
    let round = 0;
    let playerIndex = 0;
  
    const dealNext = () => {
      if (round >= 3) {
        this.placeInitialTableau();
        this.startTurnTimer();
        return;
      }
  
      const player = this.players[playerIndex];
      const pos = getPlayerPosition(
        playerIndex,
        this.players.length,
        this.centerX,
        this.centerY,
        220
      );
  
      const card = this.deck.pop();
      if (!card) return;
  
      const targetX = pos.x;
      const targetY = pos.y;
  
      this.animator.add(
        new CardMoveAnimation(
          card,
          deckX,
          deckY,
          targetX,
          targetY,
          () => {
            player.hand.push(card);
          }
        )
      );
  
      playerIndex++;
  
      if (playerIndex >= this.players.length) {
        playerIndex = 0;
        round++;
      }
  
      setTimeout(dealNext, 200);
    };
  
    dealNext();
  }

  placeInitialTableau() {
    const card = this.deck.pop();
    if (!card) return;
  
    card.faceUp = true;
    card.rotation = (Math.random() - 0.5) * 0.8;
  
    this.animator.add(
      new CardMoveAnimation(
        card,
        this.centerX - 40,
        this.centerY - 60,
        this.centerX + 60,
        this.centerY - 60,
        () => {
          this.tableau.push(card);
        }
      )
    );
    
    if (!this.fsm.isAce(card.rank)) {      
      this.fsm.initValids({ suit: card.suit, rank: card.rank })
    }

    if (this.fsm.isPicker(card.rank)) {
      this.fsm.initPicker(card.rank);
    }
  }

  restart(winner: number) {    
    this.animator.clear();
    this.fsm.restart(winner);

    this.turnTime = 30;
    this.tableau = new Tableau();
    this.started = false;
    this.pendingAce = false;
    this.players = [];
    this.gameOver = false;
    this.startGame();
  }

  startGame() {
    // if (this.playerNames.invalid) return;

    // this.players = this.playerNames.controls.map(
    //   ctrl => new Player(ctrl.value)
    // );

    if (this.started) {
      this.restart(this.gamesPlayed.length ? this.gamesPlayed[this.gamesPlayed.length - 1] : 0);
      return;
    } 
    
    this.players.push(new Player("DROID"));
    this.players.push(new Player("BEN.K"));        

    this.fsm.setPlayersCount(this.players.length);
    this.deck = createDeck();

    this.animateShuffle(() => {
      this.dealCardsAnimated();      
    });
    
    this.started = true;
    return;
  }

  getSuitSymbol(name: string) {
    const map: any = {
      hearts: '♥',
      spades: '♠',
      diamonds: '♦',
      clubs: '♣'
    };
  
    return map[name] || name;
  }

  drawGame() {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
  
    ctx.fillStyle = '#0b5';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // 🟫 Draw Deck (face down stack)
    const deckCards = this.deck?.toArray() || [];
  
    deckCards.slice(0, 5).forEach((card, i) => {
      drawCard(ctx, card, cx - 40 + i * 0.5, cy - 60 + i * 0.5);
    });
  
    if (!(this.fsm.state === 'QUESTION_ACTIVE') && this.fsm.ctx.turnCards.length > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(this.centerX - 40, this.centerY - 60, CARD_WIDTH, CARD_HEIGHT);
    }

    if (this.fsm.state === 'QUESTION_ACTIVE') {
      const symbol = this.getSuitSymbol(this.fsm.ctx.questionSuit!);
    
      ctx.fillStyle = 'orange';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
    
      ctx.fillText(
        `Answer (${symbol}) or Pick`,
        this.centerX,
        this.centerY - 140
      );
    }

    if (this.fsm.ctx.requestedSuit) {
      const symbol = this.getSuitSymbol(this.fsm.ctx.requestedSuit);
    
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.centerX - 120, this.centerY - 130, 240, 40);
    
      ctx.fillStyle = 'yellow';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
    
      ctx.fillText(
        `Suit: ${symbol}`,
        this.centerX,
        this.centerY - 100
      );
    }

    // Draw Tableau
    const tableauCards = this.tableau.toArray();

    for (let i = tableauCards.length - 1; i >= 0; i--) {
      const card = tableauCards[i];

      card.faceUp = true;

      drawCard(
        ctx,
        card,
        cx + 60 + i * 0.5,
        cy - 60 + i * 0.5
      );
    }
  
    // Draw Players + Hands
    this.players.forEach((player, i) => {
      const pos = getPlayerPosition(
        i,
        this.players.length,
        cx,
        cy,
        250
      );
  
      // 👤 Draw player name
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.name || `P${i + 1}`, pos.x, pos.y);

      ctx.fillStyle = 'black';
      ctx.font = '18px Serif';
      ctx.textAlign = 'right';
      ctx.fillText((player.kaddiState && player.hand.getSize() === 1) ? 'KADDI' : '', pos.x + 100, pos.y);
  
      // ⏱️ Draw timer for current player
      if (i === this.fsm.ctx.currentPlayerIndex) {
        ctx.fillStyle = 'yellow';
        ctx.font = '18px Arial';
        ctx.fillText(
          `${this.turnTime}s`,
          pos.x,
          pos.y - 20
        );
      }
      // 🃏 Draw hand cards
      const handCards = player.hand.toArray();
  
      handCards.forEach((card, j) => {
        // Skip dragged card
        if (card === this.draggingCard) return;

        card.faceUp = true; // or hide opponents' later
        const cardX = pos.x - (handCards.length * 10) + j * 20;
        const cardY = pos.y + 10 // lift selected cards
  
        drawCard(ctx, card, cardX, cardY);

        const isPlayable =
            i === this.fsm.ctx.currentPlayerIndex && this.isValidTurnCard(card);

        if (isPlayable) {
          ctx.strokeStyle = 'rgba(0,255,255,0.3)';
          ctx.strokeRect(cardX, cardY, CARD_WIDTH, CARD_HEIGHT);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(cardX, cardY, CARD_WIDTH, CARD_HEIGHT);
        }
      });

      if (this.started && !handCards.length) {
        ctx.strokeStyle = 'rgba(78,35,255,0.5)';
        ctx.strokeRect(pos.x, pos.y + 10, CARD_WIDTH, CARD_HEIGHT);
        ctx.fillStyle = 'rgba(255,35,12,0.3)';
        ctx.fillRect(pos.x, pos.y + 10, CARD_WIDTH, CARD_HEIGHT);
      }
    });
    
    if (this.draggingCard) {
      drawCard(ctx, this.draggingCard, this.dragX, this.dragY);
    }

    const tx = this.centerX + 60;
    const ty = this.centerY - 60;

    if (this.hoveringTableau) {
      ctx.strokeStyle = 'yellow';
      ctx.lineWidth = 3;
      ctx.strokeRect(tx - 2, ty - 2, 85, 121);
    }

    if (this.pendingAce) {
      this.drawAceSelection();
    }
  }

  drawAceSelection() {
    const ctx = this.ctx;
  
    const suits = ['♥', '♠', '♦', '♣'];
  
    const startX = this.centerX - 100;
    const startY = this.centerY - 150;
  
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(startX - 20, startY - 40, 240, 120);
  
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText('Choose Suit', startX + 60, startY - 10);
  
    suits.forEach((suit, i) => {
      const x = startX + i * 60;
      const y = startY + 20;
  
      ctx.fillStyle = 'white';
      ctx.font = '30px Arial';
      ctx.fillText(suit, x, y);
    });
  }

  drawKaddiSelection() {
    const ctx = this.ctx;
  
    const suits = ['♥', '♠', '♦', '♣'];
  
    const startX = this.centerX - 100;
    const startY = this.centerY - 150;
  
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(startX - 20, startY - 40, 240, 120);
  
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText('Choose Suit', startX + 60, startY - 10);
  
    suits.forEach((suit, i) => {
      const x = startX + i * 60;
      const y = startY + 20;
  
      ctx.fillStyle = 'white';
      ctx.font = '30px Arial';
      ctx.fillText(suit, x, y);
    });
  }
}