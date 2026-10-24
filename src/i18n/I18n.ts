import { en, I18nKey } from './en';
import { es } from './es';

export type Lang = 'es' | 'en';
export type Params = Record<string, string | number>;

const DICTS: Record<Lang, Record<I18nKey, string>> = { en, es };
const STORAGE_KEY = 'hare-tortoise.lang';

/** Singleton translator. All display text goes through `t()`. */
class I18nService {
  private lang: Lang = 'es';
  private listeners = new Set<(lang: Lang) => void>();

  constructor() {
    try {
      const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (saved === 'es' || saved === 'en') this.lang = saved;
      else if (globalThis.navigator?.language && !globalThis.navigator.language.startsWith('es')) this.lang = 'en';
    } catch {
      // storage unavailable: keep default
    }
  }

  get language(): Lang {
    return this.lang;
  }

  t(key: I18nKey | string, params?: Params): string {
    const dict = DICTS[this.lang] as Record<string, string>;
    let s = dict[key] ?? (en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  }

  setLanguage(lang: Lang): void {
    if (lang === this.lang) return;
    this.lang = lang;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
    for (const fn of this.listeners) fn(lang);
  }

  toggle(): void {
    this.setLanguage(this.lang === 'es' ? 'en' : 'es');
  }

  onChange(fn: (lang: Lang) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  ordinal(n: number): string {
    return this.t(`hud.ordinal_${n}`);
  }
}

export const I18n = new I18nService();
export const t = (key: I18nKey | string, params?: Params) => I18n.t(key, params);
