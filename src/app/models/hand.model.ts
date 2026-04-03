import { Card } from "./card.model";
import { Pile } from './pile.model';


/**
 * LINKED-LIST OR Hand (Pile object)
 * 
 * Apart from removing the card at the top, the Hand LL can remove
 * a card from any point in the list sequence - targetted removal.
 * 
 */

export class Hand extends Pile {
  override toArray(): Card[] {
    return super.toArray().reverse();
  }

  remove(target: Card): boolean {
    if (!this.head) return false;
  
    // Case 1: removing head Node
    if (this.head.card === target) {
      this.head = this.head.next;
      this.size--;
      return true;
    }
  
    //  Case 2: Traversal to remove a non-head Node
    let current = this.head;
  
    while (current.next) {
      if (current.next.card === target) {
        current.next = current.next.next;
        this.size--;
        return true;
      }
      current = current.next;
    }
  
    return false;
  }
}