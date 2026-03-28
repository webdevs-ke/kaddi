import { Card } from "./card.model";

export class CardNode {
    constructor(
        public card: Card,
        public next: CardNode | null = null
    ) {}
}
  
export class Pile {
    protected head: CardNode | null = null;
    protected size = 0;

    push(card: Card) {
        const node = new CardNode(card, this.head);
        this.head = node;
        this.size++;
    }

    pop() {
        if (!this.head) return null;
        const card = this.head.card;
        this.head = this.head.next;
        this.size--;
        return card;
    }

    isEmpty() {
        return this.size === 0;
    }

    getSize() {
        return this.size;
    }
    
    toArray() {
        const arr: Card[] = [];
        let curr = this.head;

        while (curr) {
          arr.push(curr.card);
          curr = curr.next;
        }

        return arr;
    }
}
