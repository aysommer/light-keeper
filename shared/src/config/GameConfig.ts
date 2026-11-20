/** Параметры процедурной генерации мира. Все длины — в метрах. */
export interface WorldSettings {
  /** Сторона квадратной клетки сетки пространства. */
  readonly cellSize: number;
  /** Размер пространства в клетках (квадрат) в зависимости от номера. */
  readonly space: {
    /** Сторона первого пространства, клеток. */
    readonly initialSize: number;
    /** Каждые сколько пространств сторона растёт на 1 клетку. */
    readonly growthEvery: number;
    /** Максимальная сторона, клеток. */
    readonly maxSize: number;
  };
  readonly wallThickness: number;
  /** Высота стен и потолка. */
  readonly ceilingHeight: number;
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
    /** Вероятность канистры в комнате в первом пространстве. */
    readonly baseChance: number;
    /** Нижняя граница вероятности в далёких пространствах. */
    readonly minChance: number;
    /** Множитель вероятности за каждое пройденное пространство. */
    readonly decayPerSpace: number;
    /** Максимальное смещение канистры от центра клетки. */
    readonly jitter: number;
  };
}

export interface PlayerSettings {
  /** Радиус коллизии игрока. */
  readonly radius: number;
  /** Высота глаз (камеры от первого лица). */
  readonly eyeHeight: number;
  /** Скорость шага, м/с. */
  readonly walkSpeed: number;
  /** Скорость бега, м/с. */
  readonly runSpeed: number;
}

export interface MatchSettings {
  /** Длительность перехода между пространствами (затемнение), с. */
  readonly transitionSeconds: number;
}

/** Правила лампы: масло и нагрев. Масло и нагрев — в процентах (0–100). */
export interface LampSettings {
  /** На сколько секунд горения хватает полной лампы. */
  readonly oilSeconds: number;
  /** Базовая скорость нагрева горящей лампы в руке, %/с. */
  readonly heatBaseRate: number;
  /** Множитель нагрева у только что взятой лампы. */
  readonly heatMinFactor: number;
  /** За сколько секунд непрерывного удержания множитель нагрева растёт на 1. */
  readonly heatRampSeconds: number;
  /** Остывание убранной (или погасшей) лампы, %/с. */
  readonly stowedCoolRate: number;
  /** Остывание перегревшейся лампы, %/с. */
  readonly overheatCoolRate: number;
  /** До какого нагрева должна остыть перегревшаяся лампа, чтобы снова загореться, %. */
  readonly relightHeat: number;
  /** С какого нагрева предупреждать о перегреве, %. */
  readonly warningHeat: number;
  /** Ниже этого уровня масла лампа тускнеет, %. */
  readonly dimBelowOil: number;
  /** Яркость лампы на последних каплях масла (доля от полной). */
  readonly minBrightness: number;
  /** Ниже этого уровня масла предупреждать, что оно на исходе, %. */
  readonly lowOil: number;
}

/** Канистры с маслом: подбор и заправка лампы. */
export interface CanisterSettings {
  /** С какого расстояния игрок подбирает канистру, м. */
  readonly pickupDistance: number;
  /** Сколько канистр можно нести. */
  readonly maxCarried: number;
  /** Сколько удерживать клавишу заправки, стоя на месте, с. */
  readonly refuelSeconds: number;
  /** Сколько масла (%) даёт одна канистра. */
  readonly amount: number;
  /** Лампу с таким уровнем масла (%) и выше заправлять не нужно. */
  readonly fullAt: number;
}

/** Правила обмена лампами («горячая картошка»). */
export interface ExchangeSettings {
  /** Наибольшее расстояние между игроками для обмена, м. */
  readonly distance: number;
  /** Наибольший угол между взглядом и направлением на напарника, градусы. */
  readonly maxAngleDegrees: number;
  /** Сколько секунд ждёт предложение обмена ответного нажатия напарника. */
  readonly offerSeconds: number;
  /** Пауза после обмена, с. */
  readonly cooldownSeconds: number;
  /** На сколько процентов остывает каждая лампа при обмене. */
  readonly heatRelief: number;
}

/** Правила двери выхода и ключа. */
export interface ExitSettings {
  /** Сколько удерживать `E`, чтобы открыть дверь, с. */
  readonly openSeconds: number;
  /** Сколько времени после открытия есть, чтобы войти обоим, с. */
  readonly timerSeconds: number;
  /** С какого расстояния (от точки перед дверью) можно открыть дверь и войти, м. */
  readonly interactDistance: number;
  /** С какого расстояния горящая лампа проявляет скрытую дверь, м. */
  readonly revealDistance: number;
  /** С какого расстояния игрок подбирает ключ, м. */
  readonly keyPickupDistance: number;
  /** Ширина и высота дверного полотна, м. */
  readonly doorWidth: number;
  readonly doorHeight: number;
  /** Доля самых дальних комнат, из которых выбирается комната двери и ключа. */
  readonly farthestShare: number;
}

/** Единая точка настроек баланса игры. */
export class GameConfig {
  public static readonly world: WorldSettings = {
    cellSize: 4,
    space: {
      initialSize: 6,
      growthEvery: 2,
      maxSize: 12,
    },
    wallThickness: 0.2,
    ceilingHeight: 3,
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
      decayPerSpace: 0.9,
      jitter: 0.6,
    },
  };

  public static readonly player: PlayerSettings = {
    radius: 0.3,
    eyeHeight: 1.6,
    walkSpeed: 2.2,
    runSpeed: 3.8,
  };

  public static readonly match: MatchSettings = {
    transitionSeconds: 1.5,
  };

  public static readonly lamp: LampSettings = {
    oilSeconds: 150,
    heatBaseRate: 1.6,
    heatMinFactor: 0.5,
    heatRampSeconds: 20,
    stowedCoolRate: 5,
    overheatCoolRate: 8,
    relightHeat: 30,
    warningHeat: 75,
    dimBelowOil: 35,
    minBrightness: 0.25,
    lowOil: 20,
  };

  public static readonly canister: CanisterSettings = {
    pickupDistance: 0.9,
    maxCarried: 2,
    refuelSeconds: 1.5,
    amount: 50,
    fullAt: 95,
  };

  public static readonly exchange: ExchangeSettings = {
    distance: 2,
    maxAngleDegrees: 35,
    offerSeconds: 3,
    cooldownSeconds: 2,
    heatRelief: 25,
  };

  public static readonly exit: ExitSettings = {
    openSeconds: 3,
    timerSeconds: 30,
    interactDistance: 1.3,
    revealDistance: 3,
    keyPickupDistance: 0.9,
    doorWidth: 1,
    doorHeight: 2.1,
    farthestShare: 0.3,
  };
}
