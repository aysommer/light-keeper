/**
 * Предмет в руке игрока (слоты 1–4): лампа (светит), компас (стрелка на напарника),
 * ключи (чтобы вставить в замок) и записка с кодом.
 */
export type HeldItem = 'lamp' | 'compass' | 'key' | 'note';

export const HELD_ITEMS: readonly HeldItem[] = ['lamp', 'compass', 'key', 'note'];
