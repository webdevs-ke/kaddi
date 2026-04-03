import { Card } from '../models/card.model';

export function isSameRankSequence(ranks: string[]): boolean {
  return ranks.every(r => r === ranks[0]);
}