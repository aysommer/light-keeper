import { Application } from './Application.ts';

const app = new Application();

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} — останавливаю сервер`);
  await app.stop();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

const address = await app.start();
console.log(`Light Keeper слушает http://${address.address}:${address.port}`);
if (process.env['LK_DEBUG'] === '1') {
  console.log('Отладочные команды включены (LK_DEBUG=1)');
}
