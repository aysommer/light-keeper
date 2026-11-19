import { MessageCodec } from '@light-keeper/shared';
import type { PlayerInput } from '@light-keeper/shared';
import type { NetworkClient } from './NetworkClient.ts';

/** Копит команды ввода и отправляет их пачками — не чаще раза в `intervalMs`. */
export class InputSender {
  private buffer: PlayerInput[] = [];
  private sinceFlushMs = 0;

  public constructor(
    private readonly network: NetworkClient,
    private readonly intervalMs = 50,
  ) {}

  public push(command: PlayerInput): void {
    this.buffer.push(command);
    if (this.buffer.length >= MessageCodec.MAX_INPUT_COMMANDS) {
      this.flush();
    }
  }

  public update(deltaSeconds: number): void {
    this.sinceFlushMs += deltaSeconds * 1000;
    if (this.sinceFlushMs >= this.intervalMs) {
      this.flush();
    }
  }

  private flush(): void {
    this.sinceFlushMs = 0;
    if (this.buffer.length === 0) {
      return;
    }
    this.network.send({ type: 'input', commands: this.buffer });
    this.buffer = [];
  }
}
