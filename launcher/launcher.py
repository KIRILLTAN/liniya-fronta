"""Лаунчер «Линии фронта»: скачивает последнюю версию игры с GitHub и запускает её."""
import json
import os
import ssl
import subprocess
import sys
import threading
import tkinter as tk
import urllib.request

REPO = 'KIRILLTAN/liniya-fronta'
ASSET = 'LiniyaFronta.exe'
API = f'https://api.github.com/repos/{REPO}/releases/latest'
TITLE = 'Линия фронта'

BG, PANEL, LINE, FG, MUTED = '#0a0e12', '#121820', '#232c38', '#e6edf3', '#8b98a8'
ACC, ACC_HI, GREEN, RED = '#2f6fd1', '#4a86e8', '#4cc38a', '#e5463c'


def base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


GAME_DIR = os.path.join(base_dir(), 'game')
GAME_EXE = os.path.join(GAME_DIR, ASSET)
VERSION_FILE = os.path.join(GAME_DIR, 'version.txt')


def resource(name):
    return os.path.join(getattr(sys, '_MEIPASS', base_dir()), name)


def http_get(url, accept='application/vnd.github+json'):
    req = urllib.request.Request(url, headers={'User-Agent': 'LiniyaFronta-Launcher', 'Accept': accept})
    return urllib.request.urlopen(req, timeout=20, context=ssl.create_default_context())


def installed_version():
    if not os.path.exists(GAME_EXE):
        return None
    try:
        with open(VERSION_FILE, encoding='utf-8') as f:
            return f.read().strip() or '?'
    except OSError:
        return '?'


def fmt_mb(n):
    return f'{n / 1048576:.1f} МБ'


class Launcher:
    def __init__(self, root):
        self.root = root
        self.release = None   # {'tag', 'url', 'size', 'notes'}
        self.busy = False
        root.title(TITLE)
        root.configure(bg=BG)
        root.geometry('560x360')
        root.resizable(False, False)
        try:
            root.iconbitmap(resource('app.ico'))
        except tk.TclError:
            pass

        tk.Label(root, text='ЛИНИЯ ФРОНТА', bg=BG, fg=FG, font=('Segoe UI', 26, 'bold')).pack(pady=(34, 0))
        tk.Label(root, text='стратегия · БПЛА · ПВО · заводы · фронт', bg=BG, fg=MUTED, font=('Segoe UI', 10)).pack()

        card = tk.Frame(root, bg=PANEL, highlightbackground=LINE, highlightthickness=1)
        card.pack(fill='x', padx=36, pady=(28, 0))
        self.ver = tk.Label(card, text='', bg=PANEL, fg=FG, font=('Segoe UI', 10), anchor='w')
        self.ver.pack(fill='x', padx=16, pady=(12, 2))
        self.status = tk.Label(card, text='Проверяю обновления…', bg=PANEL, fg=MUTED, font=('Segoe UI', 9), anchor='w')
        self.status.pack(fill='x', padx=16)
        self.bar = tk.Canvas(card, height=8, bg=LINE, highlightthickness=0)
        self.bar.pack(fill='x', padx=16, pady=(10, 14))
        self.fill = self.bar.create_rectangle(0, 0, 0, 8, fill=ACC, width=0)

        self.btn = tk.Label(root, text='ИГРАТЬ', bg=ACC, fg='white', font=('Segoe UI', 15, 'bold'), cursor='hand2', padx=10, pady=10)
        self.btn.pack(fill='x', padx=36, pady=(22, 0))
        self.btn.bind('<Button-1>', lambda e: self.on_button())
        self.btn.bind('<Enter>', lambda e: self.btn.enabled and self.btn.config(bg=ACC_HI))
        self.btn.bind('<Leave>', lambda e: self.btn.enabled and self.btn.config(bg=ACC))
        self.btn.enabled = False
        self.set_button('ПОДОЖДИТЕ…', False)

        self.show_version()
        threading.Thread(target=self.check, daemon=True).start()

    # ---------- интерфейс ----------
    def ui(self, fn, *args):
        self.root.after(0, fn, *args)

    def set_button(self, text, enabled):
        self.btn.enabled = enabled
        self.btn.config(text=text, bg=ACC if enabled else LINE, fg='white' if enabled else MUTED,
                        cursor='hand2' if enabled else 'arrow')

    def set_status(self, text, color=MUTED):
        self.status.config(text=text, fg=color)

    def set_progress(self, frac):
        self.bar.update_idletasks()
        self.bar.coords(self.fill, 0, 0, self.bar.winfo_width() * max(0.0, min(1.0, frac)), 8)

    def show_version(self):
        v = installed_version()
        latest = self.release['tag'] if self.release else None
        text = f'Установлена версия: {v}' if v else 'Игра ещё не установлена'
        if latest:
            text += f'   ·   последняя: {latest}'
        self.ver.config(text=text)

    def refresh(self):
        self.show_version()
        v = installed_version()
        if self.release and v != self.release['tag']:
            label = 'ОБНОВИТЬ' if v else 'УСТАНОВИТЬ'
            self.set_button(f"{label} ({fmt_mb(self.release['size'])})", True)
            self.set_status('Доступна новая версия.' if v else 'Нажмите, чтобы скачать игру.', FG)
            self.set_progress(0)
        elif v:
            self.set_button('ИГРАТЬ', True)
            self.set_progress(1)
            if self.release:
                self.set_status('Установлена последняя версия.', GREEN)
        else:
            self.set_button('НЕТ СОЕДИНЕНИЯ', False)

    # ---------- логика ----------
    def check(self):
        try:
            with http_get(API) as r:
                data = json.load(r)
            asset = next((a for a in data.get('assets', []) if a.get('name') == ASSET), None)
            if not asset:
                raise RuntimeError('в последнем выпуске нет файла игры')
            self.release = {'tag': data.get('tag_name', '?'), 'url': asset['browser_download_url'], 'size': asset.get('size', 0)}
            self.ui(self.refresh)
        except Exception as e:  # нет сети, GitHub недоступен и т. п.
            msg = f'Не удалось проверить обновления: {e}'
            if installed_version():
                msg += ' Можно играть в установленную версию.'
            self.ui(self.set_status, msg, RED)
            self.ui(self.refresh)

    def on_button(self):
        if not self.btn.enabled or self.busy:
            return
        if self.release and installed_version() != self.release['tag']:
            self.busy = True
            self.set_button('СКАЧИВАНИЕ…', False)
            threading.Thread(target=self.download, daemon=True).start()
        elif installed_version():
            self.play()

    def download(self):
        rel = self.release
        part = GAME_EXE + '.part'
        try:
            os.makedirs(GAME_DIR, exist_ok=True)
            with http_get(rel['url'], accept='application/octet-stream') as r, open(part, 'wb') as f:
                total = int(r.headers.get('Content-Length') or rel['size'] or 0)
                done = 0
                while True:
                    chunk = r.read(256 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
                    done += len(chunk)
                    if total:
                        self.ui(self.set_progress, done / total)
                        self.ui(self.set_status, f'Скачивание: {fmt_mb(done)} из {fmt_mb(total)}', FG)
            if total and done != total:
                raise RuntimeError('файл скачался не полностью')
            try:
                os.replace(part, GAME_EXE)
            except PermissionError:
                raise RuntimeError('игра сейчас запущена — закройте её и нажмите ещё раз')
            with open(VERSION_FILE, 'w', encoding='utf-8') as f:
                f.write(rel['tag'])
            self.ui(self.set_status, f"Готово: установлена версия {rel['tag']}.", GREEN)
        except Exception as e:
            try:
                os.remove(part)
            except OSError:
                pass
            self.ui(self.set_status, f'Ошибка загрузки: {e}', RED)
        finally:
            self.busy = False
            self.ui(self.refresh)

    def play(self):
        try:
            subprocess.Popen([GAME_EXE], cwd=GAME_DIR)
        except OSError as e:
            self.set_status(f'Не удалось запустить игру: {e}', RED)
            return
        self.root.after(800, self.root.destroy)


def main():
    root = tk.Tk()
    Launcher(root)
    root.mainloop()


if __name__ == '__main__':
    main()
