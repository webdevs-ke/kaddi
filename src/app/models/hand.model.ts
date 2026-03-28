import { Card } from "./card.model";
import { Pile } from './pile.model';

export class Hand extends Pile {
    remove(target: Card): boolean {
        if (!this.head) return false;
      
        // 🟢 Case 1: removing head
        if (this.head.card === target) {
          this.head = this.head.next;
          this.size--;
          return true;
        }
      
        // 🟡 Traverse list
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
