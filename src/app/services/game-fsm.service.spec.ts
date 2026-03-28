import { TestBed } from '@angular/core/testing';

import { GameFSM } from './game-fsm.service';

describe('GameFSM', () => {
  let service: GameFSM;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameFSM);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
