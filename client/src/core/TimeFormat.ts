/** Форматирование длительности для экранов итогов и рекордов. */
export class TimeFormat {
  /** «7:05» или «1:02:09» для часа и дольше. */
  public static duration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = String(total % 60).padStart(2, '0');
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
      : `${minutes}:${rest}`;
  }

  /** Дата рекорда: «20.11.2026». */
  public static date(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
  }

  /** «1 пространство», «3 пространства», «5 пространств». */
  public static spaces(count: number): string {
    const tens = count % 100;
    const units = count % 10;
    const word =
      tens >= 11 && tens <= 14
        ? 'пространств'
        : units === 1
          ? 'пространство'
          : units >= 2 && units <= 4
            ? 'пространства'
            : 'пространств';
    return `${count} ${word}`;
  }
}
