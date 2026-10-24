import Phaser from 'phaser';
import { ALL_SFX, SfxKey } from './SoundKeys';

const STORAGE_KEY = 'hare-tortoise.sfx';

/** Plays SFX and remembers the on/off toggle. No background music by design. */
class SoundManagerService {
  private enabled = true;
  private listeners = new Set<(on: boolean) => void>();
  private game: Phaser.Game | null = null;

  constructor() {
    try {
      this.enabled = globalThis.localStorage?.getItem(STORAGE_KEY) !== 'off';
    } catch {
      // ignore
    }
  }

  attach(game: Phaser.Game): void {
    this.game = game;
  }

  static preload(scene: Phaser.Scene): void {
    for (const key of ALL_SFX) scene.load.audio(key, [`audio/${key}.ogg`, `audio/${key}.mp3`]);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, this.enabled ? 'on' : 'off');
    } catch {
      // ignore
    }
    for (const fn of this.listeners) fn(this.enabled);
  }

  onChange(fn: (on: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  play(key: SfxKey, volume = 0.6): void {
    if (!this.enabled || !this.game) return;
    const sound = this.game.sound;
    if (!this.game.cache.audio.exists(key)) return;
    try {
      sound.play(key, { volume });
    } catch {
      // audio context may be locked until the first user gesture
    }
  }
}

export const SoundManager = new SoundManagerService();
export { SoundManagerService };
