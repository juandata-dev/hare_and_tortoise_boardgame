export const SFX = {
  move: 'sfx_move',
  carrotGain: 'sfx_carrot_gain',
  carrotLose: 'sfx_carrot_lose',
  lettuceChew: 'sfx_lettuce_chew',
  hareDraw: 'sfx_hare_draw',
  hareGood: 'sfx_hare_good',
  hareBad: 'sfx_hare_bad',
  finish: 'sfx_finish',
  invalid: 'sfx_invalid',
  buttonClick: 'sfx_button_click',
  turnStart: 'sfx_turn_start',
  backward: 'sfx_backward',
} as const;

export type SfxKey = (typeof SFX)[keyof typeof SFX];
export const ALL_SFX: SfxKey[] = Object.values(SFX);
