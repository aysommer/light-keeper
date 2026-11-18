import './styles/main.css';
import { App } from './core/App.ts';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Не найден контейнер #app');
}

new App(root).mount();
