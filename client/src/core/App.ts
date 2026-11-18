import { GameScreen } from '../ui/GameScreen.ts';
import type { Screen } from '../ui/Screen.ts';
import { ServerStatusIndicator } from '../ui/ServerStatusIndicator.ts';
import { TitleScreen } from '../ui/TitleScreen.ts';
import { ApiClient } from './ApiClient.ts';

/** Корень клиентского приложения: собирает зависимости и переключает экраны. */
export class App {
  private readonly api = new ApiClient();
  private current: Screen | null = null;

  public constructor(private readonly root: HTMLElement) {}

  public mount(): void {
    this.showTitle();
  }

  private showTitle(): void {
    this.show(
      new TitleScreen(new ServerStatusIndicator(this.api), () => this.showGame(this.pickSeed())),
    );
  }

  private showGame(seed: number): void {
    this.show(new GameScreen(seed, () => this.showTitle()));
  }

  private show(screen: Screen): void {
    this.current?.dispose();
    this.current = screen;
    this.root.replaceChildren(screen.element);
    screen.mount();
  }

  /** Seed из адреса (`?seed=123`) или случайный. */
  private pickSeed(): number {
    const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'));
    if (Number.isInteger(fromUrl) && fromUrl > 0) {
      return fromUrl;
    }
    return Math.floor(Math.random() * 2 ** 31);
  }
}
