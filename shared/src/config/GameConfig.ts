/** Параметры процедурной генерации мира. Все длины — в метрах. */
export interface WorldSettings {
  /** Сторона квадратной клетки сетки чанка. */
  readonly cellSize: number;
  /** Клеток поперёк пути (ось x). */
  readonly columns: number;
  /** Клеток вдоль пути (ось y) в одном чанке. */
  readonly rowsPerChunk: number;
  readonly wallThickness: number;
  readonly doorWidth: number;
  /** Вероятность дополнительной двери между уже связанными комнатами (создаёт петли). */
  readonly extraDoorChance: number;
  readonly pillarSize: number;
  /** Вероятность, что в зале будут колонны. */
  readonly hallPillarChance: number;
  readonly desk: {
    readonly width: number;
    readonly depth: number;
    /** Зазор между столом и стенами. */
    readonly wallGap: number;
    /** Вероятность стола в каждой клетке офиса. */
    readonly chancePerCell: number;
  };
  readonly oil: {
    /** Вероятность канистры в комнате на старте. */
    readonly baseChance: number;
    /** Нижняя граница вероятности на большой дистанции. */
    readonly minChance: number;
    /** Множитель вероятности за каждый пройденный чанк. */
    readonly decayPerChunk: number;
    /** Максимальное смещение канистры от центра клетки. */
    readonly jitter: number;
  };
}

export interface PlayerSettings {
  /** Радиус коллизии игрока. */
  readonly radius: number;
}

/** Единая точка настроек баланса игры. */
export class GameConfig {
  public static readonly world: WorldSettings = {
    cellSize: 4,
    columns: 6,
    rowsPerChunk: 5,
    wallThickness: 0.2,
    doorWidth: 1.4,
    extraDoorChance: 0.15,
    pillarSize: 0.6,
    hallPillarChance: 0.7,
    desk: {
      width: 1.0,
      depth: 0.6,
      wallGap: 0.2,
      chancePerCell: 0.5,
    },
    oil: {
      baseChance: 0.2,
      minChance: 0.08,
      decayPerChunk: 0.97,
      jitter: 0.6,
    },
  };

  public static readonly player: PlayerSettings = {
    radius: 0.3,
  };
}
