import './styles/main.css';
import { App } from './core/App.ts';
import { CharacterAssets } from './scene/CharacterAssets.ts';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Не найден контейнер #app');
}

new App(root).mount();
// Модели героев грузятся заранее, пока игроки в меню и лобби.
CharacterAssets.load().catch(() => {
  // Не загрузились — в игре останутся стикмены.
});
