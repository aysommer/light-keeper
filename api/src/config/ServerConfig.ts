/** Настройки сервера, читаемые из переменных окружения. */
export class ServerConfig {
  public static readonly DEFAULT_PORT = 3000;
  public static readonly DEFAULT_HOST = '0.0.0.0';

  public constructor(
    public readonly port: number,
    public readonly host: string,
  ) {}

  public static fromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
    return new ServerConfig(
      ServerConfig.parsePort(env['PORT']),
      env['HOST'] ?? ServerConfig.DEFAULT_HOST,
    );
  }

  private static parsePort(raw: string | undefined): number {
    if (raw === undefined || raw === '') {
      return ServerConfig.DEFAULT_PORT;
    }
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Некорректный PORT: "${raw}"`);
    }
    return port;
  }
}
