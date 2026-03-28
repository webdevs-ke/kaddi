export interface GameFlags {
  pickerStack: number;          // total cards to pick
  pickerRank?: '2' | '3';       // active picker type

  requestedSuit?: string;       // from Ace

  jumpCount: number;            // number of skips

  direction: 1 | -1;            // 1 cw, -1 ccw

  questionActive?: boolean;
  questionSuit?: string;
}