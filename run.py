"""
Life OS — запуск в виде отдельного окна (Windows/Mac/Linux).

Первый раз:
    pip install pywebview

Дальше просто:
    python run.py

Это откроет life_os.html в собственном окне (без адресной строки браузера),
используя системный веб-движок (WebView2 на Windows). Все данные хранятся
в браузерном хранилище этого окна (localStorage) — они привязаны именно
к этому способу запуска, поэтому запускай всегда через run.py, а не то
через обычный браузер (там будет отдельное, "пустое" хранилище).
"""

import os
import sys

try:
    import webview
except ImportError:
    print("Не найден пакет pywebview. Установи его командой:")
    print("    pip install pywebview")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(HERE, "life_os.html")

if not os.path.exists(HTML_PATH):
    print(f"Не найден файл {HTML_PATH}. Положи run.py и life_os.html в одну папку.")
    sys.exit(1)

if __name__ == "__main__":
    webview.create_window("Life OS", HTML_PATH, width=1100, height=800, min_size=(720, 600))
    webview.start()
