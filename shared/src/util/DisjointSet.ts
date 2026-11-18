/** Система непересекающихся множеств (union-find) со сжатием путей. */
export class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  public constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array<number>(size).fill(0);
  }

  public find(element: number): number {
    let root = element;
    while (this.parentOf(root) !== root) {
      root = this.parentOf(root);
    }
    let current = element;
    while (current !== root) {
      const next = this.parentOf(current);
      this.parent[current] = root;
      current = next;
    }
    return root;
  }

  /** Объединяет множества. Возвращает `false`, если элементы уже были в одном множестве. */
  public union(a: number, b: number): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) {
      return false;
    }
    const rankA = this.rank[rootA] ?? 0;
    const rankB = this.rank[rootB] ?? 0;
    if (rankA < rankB) {
      this.parent[rootA] = rootB;
    } else if (rankA > rankB) {
      this.parent[rootB] = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA] = rankA + 1;
    }
    return true;
  }

  public connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  private parentOf(element: number): number {
    const parent = this.parent[element];
    if (parent === undefined) {
      throw new Error(`Элемент ${element} вне DisjointSet`);
    }
    return parent;
  }
}
