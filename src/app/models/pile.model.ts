import { Card } from "./card.model";


/** LinkedList's Node (object)
 * 
 * Node (object) contains two fields, data (Card object) and pointer to next (Node object OR null)
 * 
 * Last Node in the list points to null (object)
 * 
 * Any other Node points to another Node.
 * 
*/

export class CardNode {
    constructor(
        public card: Card,
        public next: CardNode | null = null
    ) {}
}
  

/** LINKED-LIST OR Pile (object) - LIFO
 * 
 * This is a stacked data structure. Like a neatly piled set of books,
 * the bottom book is placed first but retrieved last - that's how we keep
 * track of the end of the list. The top book would be stacked last but
 * retrieved first - that's how we keep track of the start of the list.
 * 
 * Traversal happens through message passing whereby one Node keeps track
 * of the one next to it and therefore is privy to its content. The linked
 * list is a conceptual data structure, that is, contents do not share 
 * memory blocks or require contiguous addresses like in array data structures.
 * 
 * The linked list itself stores only two data fields, the head Node aka the one
 * stacked most recently, and it's size (number). Using the head Node and it's 
 * pointer to the Node next to it, and so on, and knowing that the last node 
 * will be the one that points to null, we can easily traverse the list.
 * 
 * Through traversal, we can lookup, add, remove Nodes while adjusting the 
 * list's size. Add and remove operations are also conceptual, as it simply 
 * involves linking or unlinking Nodes by adjusting their next pointers.
 * 
*/

export class Pile {
    protected head: CardNode | null = null;
    protected size = 0;

    push(card: Card) {
        const node = new CardNode(card, this.head);
        this.head = node;
        this.size++;
    }

    pop(): Card | null {
        if (!this.head) return null;
        const card = this.head.card;
        this.head = this.head.next;
        this.size--;
        return card;
    }

    peek(): Card | null {
        return this.head ? this.head.card : null;
    }
    
    isEmpty(): boolean {
        return this.size === 0;
    }

    getSize(): number {
        return this.size;
    }
    
    toArray(): Card[] {
        const arr: Card[] = [];
        let curr = this.head;

        while (curr) {
          arr.push(curr.card);
          curr = curr.next;
        }

        return arr;
    }
}