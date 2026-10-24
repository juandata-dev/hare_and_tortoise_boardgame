import { t } from '../i18n/I18n';

export function playerName(p: { name: string; nameKey?: string; nameN?: number }): string {
  return p.nameKey ? t(p.nameKey, { n: p.nameN ?? '' }) : p.name;
}
