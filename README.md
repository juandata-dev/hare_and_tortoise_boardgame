# Hare & Tortoise — Digital Edition

A digital adaptation of *Hase und Igel* (David Parlett, Ravensburger 1978, Spiel des Jahres 1979), built with
**Phaser 3 + TypeScript (strict) + Vite**. 2–4 players, any mix of humans (local hotseat) and bots (Easy / Medium),
Spanish and English, a guided tutorial and synthesized sound effects.

## Running

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules, AI and i18n unit tests (Vitest)
npm run build      # type-check + production bundle in dist/
npm run audio      # regenerate public/audio/*.ogg|mp3 (needs python3 + numpy + ffmpeg)
```

Append `?renderer=canvas` to the URL to force the Canvas renderer on machines without GPU acceleration.

## Project layout

```
src/
  game/      Pure TypeScript rules — no Phaser imports (unit-tested)
    Board.ts       BOARD array, square helpers, n(n+1)/2 cost
    Rules.ts       legal moves, positions, finish/number/tortoise rules, hare-card targets
    GameState.ts   authoritative turn state machine + event stream
    HareCards.ts   12-card Ravensburger deck
    AIPlayer.ts    Easy / Medium bots
  scenes/    Boot, Preload, Menu, Setup, Game, Tutorial (+ TutorialController), GameOver
  ui/        Board renderer, HUD, action panel, overlays (hare card, race card, hand-off, coach), procedural art
  i18n/      en.ts, es.ts, I18n singleton (t())
  audio/     SoundManager + SFX keys
public/audio/  12 SFX in .ogg + .mp3
scripts/generate_audio.py
tests/
```

## Turn flow

`GameState` drives each turn: `beginTurn()` (missed turn → lettuce chew → number-square bonus → stuck/restart check),
`applyAction()` (move / tortoise retreat / stay on carrots → resolve square → hare card), `resolveHareChoice()` for
"Win or lose 10", then `endTurn()`. Every change is emitted as a `GameEvent`; the `GameScene` queues and animates
those events, so the rules never depend on rendering. Bots receive the same read-only state and return an `Action`.

## Decisions & deviations from the PRD draft

- **Board verified, 65 positions (HOME = 64).** The PRD asked to verify its best-effort array. The Software Challenge
  reference implementation (`software-challenge/backend`, `games/hui/.../plugin2025/Board.kt`) keeps the official
  lettuce/tortoise positions and lists each segment in printed-board order before (optionally) shuffling. The
  unshuffled order gives START + 63 squares + HOME, square 10 = first lettuce, 9 tortoises, 4 lettuces, 5 flags,
  and the fixed final stretch `HARE, CARROT, FLAG, CARROT, HARE, CARROT, HOME` (the post-1986 ending, one index
  lower than the PRD guessed). `BOARD` in `Board.ts` uses that order; all rules read from it.
- **Number squares** pay at the start of the player's next turn (i.e. before they move away) when their race position
  matches. Positions are recomputed then, so being overtaken in between loses the bonus.
- **Backward move** is only to the *nearest* tortoise behind; if it is occupied the retreat is blocked (§ 3.4).
- **Hare-card moves** (next/last carrot, move up/drop back) never trigger another hare draw or tortoise reward;
  landing on a lettuce square this way starts the lettuce sequence.
- **Game end:** the race ends when only one player is still racing (they take last place). A safety cap of 3,000
  turns ranks remaining players by position; simulations never reach it.
- **Medium AI** implements every factor of § 7.2 plus two planning terms (carrot budget for the remaining distance
  and a penalty for holding lettuces with no lettuce square ahead) — without them bots could loop forever near HOME.
  Easy AI also sheds carrots near HOME. In simulation Medium beats Easy in > 60 % of games.
- **Tutorial coverage:** steps fire on the triggers in § 8.1; any step the game never triggered (e.g. "too many
  carrots") is shown as a recap before the results screen, so all 11 are always covered.
- **Language toggle** uses `ES ▸ EN` text instead of flag emoji, because Windows does not render flag emoji.
- **Artwork** is drawn procedurally in the earthy 1978 Ravensburger style (no copyrighted scans are shipped).
  Static board art is baked into one render texture so the board costs one draw per frame.
- **Sound effects** are synthesized by `scripts/generate_audio.py` and committed as `.ogg` + `.mp3`.
- **Hotseat hand-off screen** appears before each human turn when 2+ humans play (not with a single human vs bots).
