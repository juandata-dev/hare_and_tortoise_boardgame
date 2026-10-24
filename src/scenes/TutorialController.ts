import { isNumberSquare } from '../game/Board';
import type { GameEvent, GameState, PlayerState } from '../game/GameState';
import { t } from '../i18n/I18n';
import type { CoachOverlay, RaceCardOverlay } from '../ui/Overlays';

export type TutorialStep =
  | 'welcome' | 'movement' | 'carrot' | 'number' | 'lettuce' | 'hare'
  | 'tortoise' | 'low' | 'many' | 'finish' | 'first_finish';

export const TUTORIAL_STEPS: TutorialStep[] = [
  'welcome', 'movement', 'carrot', 'number', 'lettuce', 'hare', 'tortoise', 'low', 'many', 'finish', 'first_finish',
];

/** Watches GameState events and pauses the game with coach messages (§ 8). */
export class TutorialController {
  readonly shown = new Set<TutorialStep>();

  constructor(
    private coach: CoachOverlay,
    private raceCard: RaceCardOverlay,
    private state: GameState,
    private humanId: number,
  ) {}

  private title(step: TutorialStep) {
    return `${t('menu.tutorial')} · ${TUTORIAL_STEPS.indexOf(step) + 1}/${TUTORIAL_STEPS.length}`;
  }

  async show(step: TutorialStep, heading?: string): Promise<void> {
    if (this.shown.has(step)) return;
    this.shown.add(step);
    await this.coach.show(`tutorial.${step}`, heading ?? this.title(step));
  }

  async onStart() {
    await this.show('welcome');
  }

  async beforeHumanAction(p: PlayerState) {
    if (!this.shown.has('movement')) {
      this.raceCard.show();
      await this.show('movement');
      this.raceCard.close();
    }
    if (this.state.canMoveBackward(p.id)) await this.show('tortoise');
    if (p.carrots < 20) await this.show('low');
    if (p.carrots > 80) await this.show('many');
    if (p.pos >= 55) await this.show('finish');
  }

  async onEvent(e: GameEvent) {
    switch (e.type) {
      case 'move': {
        if (e.player !== this.humanId || e.kind === 'restart') return;
        const sq = this.state.board[e.to];
        if (sq === 'CARROT') await this.show('carrot');
        if (isNumberSquare(sq)) await this.show('number');
        break;
      }
      case 'lettuceArrive':
        await this.show('lettuce');
        break;
      case 'hareDraw':
        await this.show('hare');
        break;
      case 'finish':
        await this.show('first_finish');
        break;
      default:
        break;
    }
  }

  /** Steps the game never triggered are shown as a recap so all 11 are covered. */
  async recap() {
    for (const step of TUTORIAL_STEPS) {
      if (!this.shown.has(step)) await this.show(step, `${t('tutorial.recap')} · ${this.title(step)}`);
    }
  }
}
