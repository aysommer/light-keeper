// Дымовой тест собранного сервера (dist/index.js): запускается ли он,
// отвечает ли /health и здоровается ли по WebSocket. Ловит ошибки сборки,
// которых не видно в тестах на исходниках (например, require в ES-модуле).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const server = spawn(process.execPath, [entry], {
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', RECORDS_FILE: '', LK_DEBUG: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const fail = (message) => {
  console.error(`smoke: ${message}`);
  server.kill();
  process.exit(1);
};
const timer = setTimeout(() => fail('сервер не ответил за 10 с'), 10_000);
let errors = '';
server.stderr.on('data', (chunk) => (errors += chunk));
server.on('exit', (code) => {
  if (code !== null && code !== 0) fail(`сервер упал (код ${code}):\n${errors}`);
});

server.stdout.on('data', async (chunk) => {
  const match = /слушает http:\/\/[^:]+:(\d+)/.exec(String(chunk));
  if (!match) return;
  const port = match[1];
  try {
    const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    if (health.status !== 'ok') fail('/health ответил не ok');
    const records = await (await fetch(`http://127.0.0.1:${port}/records`)).json();
    if (!Array.isArray(records.records)) fail('/records без таблицы');
    const welcome = await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      socket.onopen = () =>
        socket.send(JSON.stringify({ type: 'hello', protocolVersion: health.protocolVersion }));
      socket.onmessage = (event) => {
        socket.close();
        resolve(JSON.parse(event.data));
      };
      socket.onerror = () => reject(new Error('WebSocket не подключился'));
    });
    if (welcome.type !== 'welcome') fail(`WebSocket ответил ${welcome.type}`);
    clearTimeout(timer);
    console.log('smoke: собранный сервер работает (HTTP и WebSocket)');
    server.kill();
    process.exit(0);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
});
