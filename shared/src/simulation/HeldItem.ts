/**
 * Предмет в руке игрока (слоты 1–6): лампа (светит), компас (стрелка на напарника),
 * ключи (чтобы вставить в замок), записка с кодом, флажки-ориентиры и гусь-призрак.
 */
export type HeldItem = 'lamp' | 'compass' | 'key' | 'note' | 'flag' | 'goose';

export const HELD_ITEMS: readonly HeldItem[] = ['lamp', 'compass', 'key', 'note', 'flag', 'goose'];
