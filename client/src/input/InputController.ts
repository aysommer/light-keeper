import { Vector2 } from '@light-keeper/shared';

/**
 * Клавиатура и мышь. Мышь управляет взглядом только в режиме pointer lock
 * (захватывается кликом по холсту, отпускается клавишей Esc).
 */
export class InputController {
  /**
   * Смещения мыши больше этого порога за одно событие отбрасываются: некоторые
   * браузеры присылают ложные скачки сразу после захвата указателя.
   */
  private static readonly MAX_MOUSE_DELTA = 250;
  /** Сколько пикселей прокрутки — один шаг колеса. */
  private static readonly WHEEL_STEP = 50;

  private readonly pressed = new Set<string>();
  private readonly justPressed = new Set<string>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private readonly lockListeners = new Set<(locked: boolean) => void>();

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!event.repeat) {
      this.justPressed.add(event.code);
    }
    this.pressed.add(event.code);
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };
  private readonly onBlur = (): void => {
    this.pressed.clear();
    this.justPressed.clear();
  };
  private readonly onMouseMove = (event: MouseEvent): void => {
    const isSpike =
      Math.abs(event.movementX) > InputController.MAX_MOUSE_DELTA ||
      Math.abs(event.movementY) > InputController.MAX_MOUSE_DELTA;
    if (this.isLocked && !isSpike) {
      this.mouseDeltaX += event.movementX;
      this.mouseDeltaY += event.movementY;
    }
  };
  private readonly onClick = (): void => {
    if (!this.isLocked) {
      void this.target.requestPointerLock();
    }
  };
  private readonly onLockChange = (): void => {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.lockListeners.forEach((listener) => listener(this.isLocked));
  };

  /** Колесо мыши: шаги с прошлого чтения (+ вниз, − вверх). */
  private wheelSteps = 0;
  private wheelAccumulated = 0;
  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.isLocked) {
      return;
    }
    // Тачпады шлют много мелких событий — копим до «щелчка» колеса.
    this.wheelAccumulated += event.deltaMode === 0 ? event.deltaY : event.deltaY * 40;
    while (Math.abs(this.wheelAccumulated) >= InputController.WHEEL_STEP) {
      const step = Math.sign(this.wheelAccumulated);
      this.wheelSteps += step;
      this.wheelAccumulated -= step * InputController.WHEEL_STEP;
    }
  };

  public constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('wheel', this.onWheel);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    target.addEventListener('click', this.onClick);
  }

  public get isLocked(): boolean {
    return document.pointerLockElement === this.target;
  }

  public isPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Была ли клавиша нажата с прошлого вызова (однократное срабатывание). */
  /** Клавишу нажали в этом кадре (не забирая нажатие у других). */
  public peekPress(code: string): boolean {
    return this.justPressed.has(code);
  }

  /** Шаги колеса с прошлого вызова: +1 — вниз (следующий предмет), −1 — вверх. */
  public consumeWheel(): number {
    const steps = this.wheelSteps;
    this.wheelSteps = 0;
    return steps;
  }

  public consumePress(code: string): boolean {
    return this.justPressed.delete(code);
  }

  /** Ось движения: `x` — вправо, `y` — вперёд. Значения −1, 0, 1. */
  public movementAxis(): Vector2 {
    const axis = (positive: string[], negative: string[]): number =>
      (positive.some((code) => this.pressed.has(code)) ? 1 : 0) -
      (negative.some((code) => this.pressed.has(code)) ? 1 : 0);
    return new Vector2(
      axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
      axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    );
  }

  /** Смещение мыши с прошлого вызова (в пикселях). */
  public consumeMouseDelta(): Vector2 {
    const delta = new Vector2(this.mouseDeltaX, this.mouseDeltaY);
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  public onPointerLockChange(listener: (locked: boolean) => void): void {
    this.lockListeners.add(listener);
  }

  public releasePointer(): void {
    if (this.isLocked) {
      document.exitPointerLock();
    }
  }

  public dispose(): void {
    this.releasePointer();
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.target.removeEventListener('click', this.onClick);
    this.lockListeners.clear();
  }
}
