import type { CellRect } from '../CellRect.ts';
import { CorridorTemplate } from './CorridorTemplate.ts';
import { HallTemplate } from './HallTemplate.ts';
import { OfficeTemplate } from './OfficeTemplate.ts';
import type { RoomTemplate } from './RoomTemplate.ts';

/** Выбирает шаблон по форме комнаты: первый подходящий в порядке регистрации. */
export class RoomTemplateRegistry {
  public constructor(private readonly templates: readonly RoomTemplate[]) {
    if (templates.length === 0) {
      throw new Error('RoomTemplateRegistry: нужен хотя бы один шаблон');
    }
  }

  public static createDefault(): RoomTemplateRegistry {
    return new RoomTemplateRegistry([
      new CorridorTemplate(),
      new HallTemplate(),
      new OfficeTemplate(),
    ]);
  }

  public select(cells: CellRect): RoomTemplate {
    const template = this.templates.find((candidate) => candidate.matches(cells));
    if (!template) {
      throw new Error(`Нет шаблона для комнаты ${cells.width}×${cells.height}`);
    }
    return template;
  }
}
