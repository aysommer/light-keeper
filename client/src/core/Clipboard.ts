/**
 * Копирование текста в буфер обмена. Современный API работает только на
 * HTTPS и localhost, поэтому для сервера по обычному http:// есть запасной
 * способ — скрытое поле и команда копирования.
 */
export class Clipboard {
  public static async copy(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Нет разрешения — пробуем запасной способ.
      }
    }
    return Clipboard.copyWithTextArea(text);
  }

  private static copyWithTextArea(text: string): boolean {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    // Вне экрана, но в документе — иначе выделение не сработает.
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length);
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}
