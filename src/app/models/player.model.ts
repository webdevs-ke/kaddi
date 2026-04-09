import { Hand } from './hand.model';
import { isSameRankSequence } from '../utils/card-sequence';

export class Player {
  private kaddi = false;

  constructor(
    public name: string,
    public hand: Hand = new Hand()
  ) {}

  isKaddi (): boolean {
    if (this.hand.isEmpty()) return false;

    const kaddiRanks = ['4','5','6','7','9','10'];
    const cards = this.hand.toArray();

    return (kaddiRanks.includes(cards[0].rank) && isSameRankSequence(cards.map(c => c.rank)));
  }

  set kaddiState (kaddi: boolean) {
    this.kaddi = kaddi;
  }

  get kaddiState (): boolean {
    return this.kaddi;
  }
}
