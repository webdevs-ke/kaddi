import { Hand } from './hand.model';

export class Player {
  constructor(
    public name: string,
    public hand: Hand = new Hand()
  ) {}
}
