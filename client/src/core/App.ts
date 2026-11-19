import type { ClientMessage, LobbySnapshot, ServerMessageOf } from '@light-keeper/shared';
import { ConnectionError, NetworkClient } from '../network/NetworkClient.ts';
import { ErrorMessages } from '../ui/ErrorMessages.ts';
import { GameScreen } from '../ui/GameScreen.ts';
import { LobbyScreen } from '../ui/LobbyScreen.ts';
import type { Screen } from '../ui/Screen.ts';
import { ServerStatusIndicator } from '../ui/ServerStatusIndicator.ts';
import { TitleScreen } from '../ui/TitleScreen.ts';
import { ApiClient } from './ApiClient.ts';

/**
 * Корень клиентского приложения: переключает экраны и управляет сетевым подключением.
 *
 * Поток: титульный экран → (создать / войти по коду) → лобби → партия.
 * Сетевое соединение открывается при входе в комнату и закрывается при возврате в меню.
 */
export class App {
  private readonly api = new ApiClient();
  private current: Screen | null = null;
  private network: NetworkClient | null = null;
  private subscriptions: Array<() => void> = [];
  private pendingNotice: string | null = null;

  public constructor(private readonly root: HTMLElement) {}

  public mount(): void {
    this.showTitle();
  }

  private showTitle(error: string | null = null): void {
    this.dropNetwork();
    const title: TitleScreen = new TitleScreen(
      new ServerStatusIndicator(this.api),
      {
        onCreateLobby: () => void this.enterLobby(title, { type: 'lobby:create' }),
        onJoinLobby: (code) => void this.enterLobby(title, { type: 'lobby:join', code }),
        onStartSolo: () =>
          this.show(
            new GameScreen({
              seed: this.pickSoloSeed(),
              match: null,
              onExit: () => this.showTitle(),
            }),
          ),
      },
      error,
    );
    this.show(title);
  }

  private async enterLobby(title: TitleScreen, request: ClientMessage): Promise<void> {
    title.setBusy(true);
    try {
      const network = await this.ensureNetwork();
      network.send(request);
    } catch (error) {
      this.dropNetwork();
      title.setBusy(false);
      title.showError(
        ErrorMessages.text(error instanceof ConnectionError ? error.code : 'connection_failed'),
      );
    }
  }

  private async ensureNetwork(): Promise<NetworkClient> {
    if (this.network?.isConnected) {
      return this.network;
    }
    this.dropNetwork();
    const network = new NetworkClient();
    this.network = network;
    this.subscriptions = [
      network.on('lobby:state', (message) => this.handleLobbyState(message.lobby)),
      network.on('lobby:left', () => this.showTitle()),
      network.on('match:start', (message) => this.showMatch(network, message)),
      network.on('match:aborted', () => {
        this.pendingNotice = 'Напарник вышел из игры.';
      }),
      network.on('error', (message) => this.handleServerError(ErrorMessages.text(message.code))),
      network.onClose(() => this.showTitle(ErrorMessages.text('connection_lost'))),
    ];
    await network.connect();
    return network;
  }

  private handleLobbyState(snapshot: LobbySnapshot): void {
    const network = this.network;
    if (!network?.playerId) {
      return;
    }
    if (snapshot.status === 'in_game' && this.current instanceof GameScreen) {
      return;
    }
    let lobbyScreen: LobbyScreen;
    if (this.current instanceof LobbyScreen) {
      lobbyScreen = this.current;
      lobbyScreen.update(snapshot);
    } else {
      lobbyScreen = new LobbyScreen(network.playerId, snapshot, {
        onReady: (ready) => network.send({ type: 'lobby:ready', ready }),
        onLeave: () => network.send({ type: 'lobby:leave' }),
      });
      this.show(lobbyScreen);
    }
    if (this.pendingNotice) {
      lobbyScreen.showNotice(this.pendingNotice);
      this.pendingNotice = null;
    }
  }

  private handleServerError(text: string): void {
    if (this.current instanceof TitleScreen) {
      this.current.setBusy(false);
      this.current.showError(text);
    } else if (this.current instanceof LobbyScreen) {
      this.current.showNotice(text);
    }
  }

  private showMatch(network: NetworkClient, start: ServerMessageOf<'match:start'>): void {
    if (!network.playerId) {
      return;
    }
    this.show(
      new GameScreen({
        seed: start.seed,
        match: {
          network,
          playerId: network.playerId,
          color: start.you,
          players: start.players,
        },
        onExit: () => this.showTitle(),
      }),
    );
  }

  private show(screen: Screen): void {
    this.current?.dispose();
    this.current = screen;
    this.root.replaceChildren(screen.element);
    screen.mount();
  }

  private dropNetwork(): void {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions = [];
    this.network?.disconnect();
    this.network = null;
  }

  /** Seed для одиночной прогулки: из адреса (`?seed=123`) или случайный. */
  private pickSoloSeed(): number {
    const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'));
    if (Number.isInteger(fromUrl) && fromUrl > 0) {
      return fromUrl;
    }
    return Math.floor(Math.random() * 2 ** 31);
  }
}
