import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { HARE_CARD_I18N } from '../src/game/HareCards';

describe('i18n', () => {
  it('es and en define the same keys with non-empty strings', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const v of [...Object.values(es), ...Object.values(en)]) expect(v.length).toBeGreaterThan(0);
  });
  it('every hare card has text', () => {
    for (const key of Object.values(HARE_CARD_I18N)) expect(en).toHaveProperty(key);
  });
});
