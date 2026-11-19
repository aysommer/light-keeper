import { randomInt } from 'node:crypto';
import { Lobby } from './Lobby.ts';
import type { LobbyOptions } from './Lobby.ts';
import { LobbyCodeGenerator } from './LobbyCodeGenerator.ts';
import { LobbyError } from './LobbyError.ts';
import type { LobbyParticipant } from './LobbyParticipant.ts';

export interface LobbyManagerOptions extends LobbyOptions {
  /** Предел одновременно открытых комнат. */
  readonly maxLobbies: number;
}

/** Реестр комнат: создание, вход по коду, выход, готовность. Игрок может быть только в одной комнате. */
export class LobbyManager {
  public static readonly DEFAULT_OPTIONS: LobbyManagerOptions = {
    countdownSeconds: 3,
    maxLobbies: 500,
    createSeed: () => randomInt(1, 2 ** 31),
  };

  private readonly lobbies = new Map<string, Lobby>();
  private readonly lobbyByParticipant = new Map<string, Lobby>();

  public constructor(
    private readonly options: LobbyManagerOptions = LobbyManager.DEFAULT_OPTIONS,
    private readonly codes: LobbyCodeGenerator = new LobbyCodeGenerator(),
  ) {}

  public get lobbyCount(): number {
    return this.lobbies.size;
  }

  public lobbyOf(participantId: string): Lobby | undefined {
    return this.lobbyByParticipant.get(participantId);
  }

  public create(participant: LobbyParticipant): Lobby {
    if (this.lobbies.size >= this.options.maxLobbies) {
      throw new LobbyError('server_full', 'Сервер переполнен, попробуй позже');
    }
    this.leaveCurrent(participant.id);
    const code = this.codes.generate((candidate) => this.lobbies.has(candidate));
    const lobby = new Lobby(code, this.options);
    this.lobbies.set(code, lobby);
    this.enter(lobby, participant);
    return lobby;
  }

  public join(participant: LobbyParticipant, code: string): Lobby {
    const lobby = this.lobbies.get(code);
    if (!lobby) {
      throw new LobbyError('lobby_not_found', `Комната ${code} не найдена`);
    }
    if (lobby.has(participant.id)) {
      return lobby;
    }
    this.leaveCurrent(participant.id);
    this.enter(lobby, participant);
    return lobby;
  }

  /** Явный выход: игрок получает подтверждение `lobby:left`. */
  public leave(participant: LobbyParticipant): void {
    if (!this.lobbyByParticipant.has(participant.id)) {
      throw new LobbyError('not_in_lobby', 'Ты не в комнате');
    }
    this.leaveCurrent(participant.id);
    participant.send({ type: 'lobby:left' });
  }

  public setReady(participant: LobbyParticipant, ready: boolean): void {
    const lobby = this.lobbyByParticipant.get(participant.id);
    if (!lobby) {
      throw new LobbyError('not_in_lobby', 'Ты не в комнате');
    }
    lobby.setReady(participant.id, ready);
  }

  /** Отключение: тихо убирает игрока из комнаты. */
  public disconnect(participantId: string): void {
    this.leaveCurrent(participantId);
  }

  public dispose(): void {
    this.lobbies.forEach((lobby) => lobby.dispose());
    this.lobbies.clear();
    this.lobbyByParticipant.clear();
  }

  private enter(lobby: Lobby, participant: LobbyParticipant): void {
    lobby.add(participant);
    this.lobbyByParticipant.set(participant.id, lobby);
  }

  private leaveCurrent(participantId: string): void {
    const lobby = this.lobbyByParticipant.get(participantId);
    if (!lobby) {
      return;
    }
    this.lobbyByParticipant.delete(participantId);
    lobby.remove(participantId);
    if (lobby.isEmpty) {
      lobby.dispose();
      this.lobbies.delete(lobby.code);
    }
  }
}
