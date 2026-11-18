import { ServerStatusIndicator } from '../ui/ServerStatusIndicator.ts';
import { TitleScreen } from '../ui/TitleScreen.ts';
import { ApiClient } from './ApiClient.ts';

/** Корень клиентского приложения: собирает зависимости и монтирует экраны. */
export class App {
  private readonly api = new ApiClient();

  public constructor(private readonly root: HTMLElement) {}

  public mount(): void {
    const status = new ServerStatusIndicator(this.api);
    const screen = new TitleScreen(status);
    this.root.replaceChildren(screen.element);
    void status.refresh();
  }
}
