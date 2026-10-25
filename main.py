"""Линия фронта — настольное приложение (окно на движке Microsoft Edge WebView2)."""
import json
import os
import re
import shutil
import sys
import time

# Снимаем привязку к частоте монитора: игра сама ограничивает кадры (по умолчанию 144 FPS)
os.environ.setdefault('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS',
                      '--disable-frame-rate-limit --disable-gpu-vsync')

import webview  # noqa: E402

import mp_server  # noqa: E402

APP_NAME = 'Линия фронта'
WINDOW = None
HOSTING = None


def resource(*parts):
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)


def game_dir():
    """Папка игры: рядом с .exe (или с main.py при запуске из исходников)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def old_saves_dir():
    docs = os.path.join(os.path.expanduser('~'), 'Documents')
    return os.path.join(docs if os.path.isdir(docs) else os.path.expanduser('~'), APP_NAME, 'saves')


def saves_dir():
    path = os.path.join(game_dir(), 'saves')
    first = not os.path.isdir(path)
    os.makedirs(path, exist_ok=True)
    old = old_saves_dir()
    if first and os.path.isdir(old):  # перенос сохранений из прежнего места («Документы»)
        for name in os.listdir(old):
            if name.endswith('.json') and not os.path.exists(os.path.join(path, name)):
                shutil.copy2(os.path.join(old, name), os.path.join(path, name))
    return path


def slot_path(slot):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,32}', str(slot)):
        raise ValueError('bad slot name')
    return os.path.join(saves_dir(), f'{slot}.json')


def _dialog(kind):
    fd = getattr(webview, 'FileDialog', None)
    if fd is not None:
        return getattr(fd, kind)
    return getattr(webview, kind + '_DIALOG')


class Api:
    # ---------- сохранения ----------
    def save(self, slot, data):
        tmp = slot_path(slot) + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(data)
        os.replace(tmp, slot_path(slot))
        return True

    def load(self, slot):
        with open(slot_path(slot), encoding='utf-8') as f:
            return f.read()

    def delete(self, slot):
        path = slot_path(slot)
        if os.path.exists(path):
            os.remove(path)
        return True

    def list_saves(self):
        result = []
        for name in sorted(os.listdir(saves_dir())):
            if not name.endswith('.json'):
                continue
            path = os.path.join(saves_dir(), name)
            try:
                with open(path, encoding='utf-8') as f:
                    d = json.load(f)
            except (OSError, ValueError):
                continue
            result.append({'slot': name[:-5], 'title': d.get('title', ''), 'country': d.get('country', ''),
                           'gameDate': d.get('gameDate', ''), 'mtime': os.path.getmtime(path)})
        result.sort(key=lambda e: -e['mtime'])
        return json.dumps(result, ensure_ascii=False)

    def saves_path(self):
        return saves_dir()

    def export_save(self, slot):
        """Сохраняет слот в выбранный пользователем файл."""
        src = slot_path(slot)
        with open(src, encoding='utf-8') as f:
            title = json.load(f).get('title', slot)
        safe = re.sub(r'[\\/:*?"<>|]+', '_', title)[:60] or slot
        res = WINDOW.create_file_dialog(_dialog('SAVE'), directory=os.path.expanduser('~'), save_filename=f'{safe}.lfsave')
        if not res:
            return ''
        dst = res if isinstance(res, str) else res[0]
        shutil.copyfile(src, dst)
        return dst

    def import_save(self):
        """Копирует выбранный файл сохранения в папку saves и возвращает имя нового слота."""
        res = WINDOW.create_file_dialog(_dialog('OPEN'), allow_multiple=False, file_types=('Сохранения (*.lfsave;*.json)', 'Все файлы (*.*)'))
        if not res:
            return ''
        src = res[0] if isinstance(res, (list, tuple)) else res
        with open(src, encoding='utf-8') as f:
            data = f.read()
        json.loads(data)  # проверка формата
        slot = 'imp' + str(int(time.time()))
        self.save(slot, data)
        return slot

    # ---------- сеть ----------
    def mp_host_start(self, name):
        global HOSTING
        if HOSTING:
            HOSTING.stop()
        HOSTING = mp_server.Hosting(str(name)[:30] or 'Комната')
        return json.dumps(HOSTING.info(), ensure_ascii=False)

    def mp_host_stop(self):
        global HOSTING
        if HOSTING:
            HOSTING.stop()
            HOSTING = None
        return True

    def mp_scan(self):
        return json.dumps(mp_server.scan(), ensure_ascii=False)


def selftest(window):
    """LF_SELFTEST=путь: дождаться загрузки карты, записать результат в файл и закрыть окно."""
    out = os.environ['LF_SELFTEST']
    result = 'timeout'
    for _ in range(60):
        time.sleep(1)
        try:
            n = window.evaluate_js('typeof provs!=="undefined"&&provs.length?provs.length+" регионов, "+C.filter(c=>c.alive).length+" стран, ошибка: "+document.getElementById("loadMsg").textContent:""')
        except Exception as e:  # окно ещё не готово
            n = ''
            result = repr(e)
        if n:
            time.sleep(4)
            result = n + ' | ' + str(window.evaluate_js('fpsShown')) + ' FPS'
            break
    with open(out, 'w', encoding='utf-8') as f:
        f.write(result)
    window.destroy()


def main():
    global WINDOW
    saves_dir()  # создаёт папку saves рядом с игрой и переносит старые сохранения
    storage = os.path.join(os.path.dirname(old_saves_dir()), 'webview')
    WINDOW = webview.create_window(
        APP_NAME,
        url=resource('app', 'index.html'),
        js_api=Api(),
        width=1600,
        height=950,
        min_size=(1100, 700),
        background_color='#0A0E12',
        maximized=True,
        text_select=True,
    )
    test = selftest if os.environ.get('LF_SELFTEST') else None
    webview.start(test, WINDOW, gui='edgechromium', http_server=True, private_mode=False, storage_path=storage)
    if HOSTING:
        HOSTING.stop()


if __name__ == '__main__':
    main()
