/** Предмет в руке игрока: лампа (светит) или компас (лампа убрана и не светит). */
export type HeldItem = 'lamp' | 'compass';

export const HELD_ITEMS: readonly HeldItem[] = ['lamp', 'compass'];
