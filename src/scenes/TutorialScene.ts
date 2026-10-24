import type { GameEvent, PlayerState } from '../game/GameState';
import { t } from '../i18n/I18n';
import { CoachOverlay } from '../ui/Overlays';
import { GameScene } from './GameScene';
import { TutorialController } from './TutorialController';

/** A full guided game against one Medium bot, with coach pop-ups. */
export class TutorialScene extends GameScene {
  private tutorial!: TutorialController;

  constructor() {
    super('Tutorial');
  }

  create(): void {
    super.create();
    const human = this.state.players.find((p) => p.kind === 'human')!;
    this.tutorial = new TutorialController(new CoachOverlay(this), this.raceCard, this.state, human.id);
  }

  protected topBarExtras() {
    return [
      { label: () => t('btn.skip'), onClick: () => this.scene.start('Menu'), width: 220 },
      { label: () => t('btn.race_card'), onClick: () => this.raceCard.toggle(), width: 220 },
    ];
  }

  protected async onGameStart() {
    await this.tutorial.onStart();
  }

  protected async beforeHumanAction(p: PlayerState) {
    await this.tutorial.beforeHumanAction(p);
  }

  protected async afterEvent(e: GameEvent) {
    await this.tutorial.onEvent(e);
  }

  protected async onGameOver() {
    await this.tutorial.recap();
  }
}
