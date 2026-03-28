import { Pile } from './pile.model';

export class Tableau extends Pile {
    peek() {
      return this.head ? this.head.card : null;
    }
}
