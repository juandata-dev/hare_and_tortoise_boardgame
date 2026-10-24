import { Rng, shuffle } from './Random';

export type HareCardType =
  | 'MISS_TURN'
  | 'EXTRA_TURN'
  | 'FREE_RIDE'
  | 'CHEW_LETTUCE'
  | 'WIN_LOSE_10'
  | 'NEXT_CARROT'
  | 'LAST_CARROT'
  | 'MOVE_UP'
  | 'DROP_BACK';

/** Ravensburger hare deck composition (12 cards). */
export const HARE_DECK_COMPOSITION: Record<HareCardType, number> = {
  MISS_TURN: 1,
  EXTRA_TURN: 1,
  FREE_RIDE: 1,
  CHEW_LETTUCE: 2,
  WIN_LOSE_10: 2,
  NEXT_CARROT: 2,
  LAST_CARROT: 1,
  MOVE_UP: 1,
  DROP_BACK: 1,
};

export const HARE_CARD_TYPES = Object.keys(HARE_DECK_COMPOSITION) as HareCardType[];

/** i18n key for each card's text. */
export const HARE_CARD_I18N: Record<HareCardType, string> = {
  MISS_TURN: 'hare.miss_turn',
  EXTRA_TURN: 'hare.extra_turn',
  FREE_RIDE: 'hare.free_ride',
  CHEW_LETTUCE: 'hare.chew_lettuce',
  WIN_LOSE_10: 'hare.win_lose_10',
  NEXT_CARROT: 'hare.next_carrot',
  LAST_CARROT: 'hare.last_carrot',
  MOVE_UP: 'hare.move_up',
  DROP_BACK: 'hare.drop_back',
};

export class HareDeck {
  private cards: HareCardType[];

  constructor(rng: Rng, order?: HareCardType[]) {
    if (order) {
      this.cards = order.slice();
    } else {
      const all: HareCardType[] = [];
      for (const t of HARE_CARD_TYPES) {
        for (let i = 0; i < HARE_DECK_COMPOSITION[t]; i++) all.push(t);
      }
      this.cards = shuffle(all, rng);
    }
  }

  get size(): number {
    return this.cards.length;
  }

  peekAll(): readonly HareCardType[] {
    return this.cards;
  }

  /** Draw the top card and return it to the bottom of the pile. */
  draw(): HareCardType {
    const card = this.cards.shift();
    if (!card) throw new Error('Hare deck is empty');
    this.cards.push(card);
    return card;
  }

  clone(): HareDeck {
    const d = Object.create(HareDeck.prototype) as HareDeck;
    d.cards = this.cards.slice();
    return d;
  }
}
