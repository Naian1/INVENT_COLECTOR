import json
import msvcrt
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import tkinter as tk
import ctypes
from pathlib import Path
from tkinter import messagebox, ttk

try:
    import pystray
    from PIL import Image, ImageDraw
except Exception:
    pystray = None
    Image = None
    ImageDraw = None


def _runtime_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def _resolve_base_dir() -> Path:
    runtime_dir = _runtime_dir()
    candidates = [runtime_dir, runtime_dir.parent, runtime_dir.parent.parent, Path.cwd()]

    best = candidates[0]
    best_score = -1
    seen = set()
    for candidate in candidates:
        candidate = candidate.resolve()
        if candidate in seen:
            continue
        seen.add(candidate)

        score = 0
        if (candidate / "scripts" / "run_collector_loop.py").exists():
            score += 3
        if (candidate / ".env").exists():
            score += 2
        if (candidate / "data").exists():
            score += 1
        if score > best_score:
            best = candidate
            best_score = score
    return best


BASE_DIR = _resolve_base_dir()
ENV_PATH = BASE_DIR / ".env"
LOG_DIR = BASE_DIR / "logs"
PID_PATH = LOG_DIR / "collector.pid"
RUNTIME_STATE = LOG_DIR / "collector_app_state.json"
APP_LOCK_PATH = LOG_DIR / "collector_control_app.lock"
MUTEX_NAME = "Global\\INVENT_COLLECTOR_COLLECTOR_CONTROL_APP"
ERROR_ALREADY_EXISTS = 183
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
STILL_ACTIVE = 259

DEFAULTS = {
    "COLLECTOR_API_URL": "",
    "COLLECTOR_PRINTERS_URL": "",
    "COLLECTOR_API_TOKEN": "",
    "COLLECTOR_ID": "collector-hgg-01",
    "COLLECTOR_LOOP_INTERVAL": "300",
    "COLLECTOR_LOG_LEVEL": "INFO",
    "COLLECTOR_IP_FILTERS": "172.,10.6.",
    "COLLECTOR_PRINTERS_SOURCE": "supabase",
    "COLLECTOR_SUPABASE_URL": "",
    "COLLECTOR_SUPABASE_KEY": "",
    "COLLECTOR_SUPABASE_PRINTERS_TABLE": "inventario",
    "COLLECTOR_CACHE_MAX_ROWS": "3000",
    "COLLECTOR_LOG_MAX_MB": "20",
    "COLLECTOR_LOG_BACKUPS": "5",
}


def load_env(path: Path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#") or "=" not in clean:
            continue
        key, val = clean.split("=", 1)
        values[key.strip()] = val.strip()
    return values


def save_env(path: Path, values):
    existing = load_env(path)
    existing.update(values)
    lines = [f"{k}={v}" for k, v in sorted(existing.items())]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def resolve_python_command():
    candidates = [
        BASE_DIR / ".venv" / "Scripts" / "pythonw.exe",
        BASE_DIR / ".venv" / "Scripts" / "python.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return [str(candidate)]

    py_from_path = shutil.which("pythonw") or shutil.which("python")
    if py_from_path:
        return [py_from_path]

    py_launcher = shutil.which("py")
    if py_launcher:
        return [py_launcher, "-3"]

    raise RuntimeError("Python nao encontrado para executar o coletor.")


def acquire_single_instance_lock():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    lock_file = open(APP_LOCK_PATH, "a+")
    try:
        lock_file.seek(0)
        if lock_file.read(1) == "":
            lock_file.write("1")
            lock_file.flush()
        lock_file.seek(0)
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        return lock_file
    except OSError:
        lock_file.close()
        return None


def acquire_single_instance_mutex():
    if os.name != "nt":
        return object()
    handle = ctypes.windll.kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if not handle:
        return None
    if ctypes.windll.kernel32.GetLastError() == ERROR_ALREADY_EXISTS:
        ctypes.windll.kernel32.CloseHandle(handle)
        return None
    return handle


def release_single_instance_mutex(handle):
    if os.name != "nt" or not handle:
        return
    try:
        ctypes.windll.kernel32.CloseHandle(handle)
    except Exception:
        pass


def is_pid_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        try:
            kernel32 = ctypes.windll.kernel32
            process = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, int(pid))
            if not process:
                return False
            exit_code = ctypes.c_ulong()
            ok = kernel32.GetExitCodeProcess(process, ctypes.byref(exit_code))
            kernel32.CloseHandle(process)
            return bool(ok and exit_code.value == STILL_ACTIVE)
        except Exception:
            return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def read_pid():
    try:
        if not PID_PATH.exists():
            return None
        raw = PID_PATH.read_text(encoding="utf-8").strip()
        if not raw:
            return None
        return int(raw)
    except Exception:
        return None


def write_pid(pid: int):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    PID_PATH.write_text(str(pid), encoding="utf-8")


def clear_pid():
    try:
        PID_PATH.unlink(missing_ok=True)
    except Exception:
        pass


def stop_pid(pid: int):
    if pid <= 0:
        return
    try:
        run_kwargs = {
            "capture_output": True,
            "text": True,
            "timeout": 10,
        }
        if os.name == "nt":
            run_kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], **run_kwargs)
    except Exception:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass


class CollectorControlApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Collector Control - Inventario")
        self.root.geometry("780x540")
        self.root.minsize(760, 520)

        self.tray_icon = None
        self.tray_thread = None
        self.running = False
        self.starting = False

        self.vars = {}
        env_values = load_env(ENV_PATH)
        for key, default in DEFAULTS.items():
            self.vars[key] = tk.StringVar(value=env_values.get(key, default))

        self.status_var = tk.StringVar(value="Status: verificando...")
        self.pid_var = tk.StringVar(value="PID: -")

        self._build_ui()
        self.refresh_status()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def _build_ui(self):
        outer = ttk.Frame(self.root, padding=12)
        outer.pack(fill="both", expand=True)

        ttk.Label(outer, text="Controle do coletor SNMP", font=("Segoe UI", 14, "bold")).pack(anchor="w")
        ttk.Label(
            outer,
            text="Inicia/parar coletor, ajustar .env e rodar em background sem travar terminal.",
        ).pack(anchor="w", pady=(4, 8))
        ttk.Label(outer, text=f"Base: {BASE_DIR} | ENV: {ENV_PATH}", foreground="#444").pack(anchor="w", pady=(0, 8))

        form = ttk.Frame(outer)
        form.pack(fill="x")

        fields = [
            ("URL API telemetria", "COLLECTOR_API_URL"),
            ("URL lista impressoras (fallback API)", "COLLECTOR_PRINTERS_URL"),
            ("Token coletor", "COLLECTOR_API_TOKEN"),
            ("Collector ID", "COLLECTOR_ID"),
            ("Intervalo (s)", "COLLECTOR_LOOP_INTERVAL"),
            ("Log level (DEBUG/INFO/WARNING/ERROR)", "COLLECTOR_LOG_LEVEL"),
            ("Filtro de IPs (ex: 172.,10.6.)", "COLLECTOR_IP_FILTERS"),
            ("Fonte impressoras (api/supabase)", "COLLECTOR_PRINTERS_SOURCE"),
            ("Supabase URL", "COLLECTOR_SUPABASE_URL"),
            ("Supabase KEY", "COLLECTOR_SUPABASE_KEY"),
            ("Tabela impressoras", "COLLECTOR_SUPABASE_PRINTERS_TABLE"),
            ("Cache max rows", "COLLECTOR_CACHE_MAX_ROWS"),
            ("Log max MB (rotacao)", "COLLECTOR_LOG_MAX_MB"),
            ("Log backups", "COLLECTOR_LOG_BACKUPS"),
        ]

        for idx, (label, key) in enumerate(fields):
            ttk.Label(form, text=label).grid(row=idx, column=0, sticky="w", pady=4)
            show = "*" if "TOKEN" in key or key.endswith("_KEY") else ""
            ttk.Entry(form, textvariable=self.vars[key], width=80, show=show).grid(row=idx, column=1, sticky="we", padx=(8, 0), pady=4)

        form.columnconfigure(1, weight=1)

        actions = ttk.Frame(outer)
        actions.pack(fill="x", pady=(12, 6))

        self.btn_save = ttk.Button(actions, text="Salvar config (.env)", command=self.save_config)
        self.btn_save.pack(side="left")
        self.btn_start = ttk.Button(actions, text="Iniciar coletor", command=self.start_collector)
        self.btn_start.pack(side="left", padx=8)
        self.btn_stop = ttk.Button(actions, text="Parar coletor", command=self.stop_collector)
        self.btn_stop.pack(side="left")
        self.btn_refresh = ttk.Button(actions, text="Atualizar status", command=self.refresh_status)
        self.btn_refresh.pack(side="left", padx=8)
        self.btn_logs = ttk.Button(actions, text="Abrir logs", command=self.open_logs)
        self.btn_logs.pack(side="left")
        self.btn_tray = ttk.Button(actions, text="Minimizar para bandeja", command=self.minimize_to_tray)
        self.btn_tray.pack(side="right")

        state = ttk.Frame(outer)
        state.pack(fill="x", pady=(6, 10))
        ttk.Label(state, textvariable=self.status_var, foreground="#114488").pack(anchor="w")
        ttk.Label(state, textvariable=self.pid_var).pack(anchor="w")

        help_box = tk.Text(outer, height=10, wrap="word")
        help_box.pack(fill="both", expand=True)
        help_box.insert(
            "1.0",
            "Dicas:\n"
            "- Inicia em background (sem console) e salva PID em logs/collector.pid.\n"
            "- Log principal: logs/collector_loop_runtime.log (com rotacao automatica).\n"
            "- COLLECTOR_LOG_MAX_MB e COLLECTOR_LOG_BACKUPS controlam a rotacao do log.\n"
            "- COLLECTOR_CACHE_MAX_ROWS limita tamanho do dados_cache.json.\n"
            "- Minimizacao para bandeja requer pystray+pillow\n",
        )
        help_box.config(state="disabled")

    def _set_busy(self, busy: bool):
        state = "disabled" if busy else "normal"
        for btn in [self.btn_save, self.btn_start, self.btn_stop, self.btn_refresh, self.btn_logs, self.btn_tray]:
            try:
                btn.configure(state=state)
            except Exception:
                pass

    def save_config(self, silent: bool = False):
        try:
            payload = {k: v.get().strip() for k, v in self.vars.items()}
            save_env(ENV_PATH, payload)
            if not silent:
                messagebox.showinfo("Config", ".env atualizado com sucesso.")
            return True
        except Exception as exc:
            if not silent:
                messagebox.showerror("Erro", f"Falha ao salvar .env: {exc}")
            return False

    def start_collector(self):
        if self.starting:
            return
        self.starting = True
        self._set_busy(True)
        self.status_var.set("Status: iniciando...")

        def worker():
            err = None
            started_pid = None
            try:
                if not self.save_config(silent=True):
                    raise RuntimeError("Falha ao salvar .env")

                existing = read_pid()
                if existing and is_pid_running(existing):
                    started_pid = existing
                else:
                    LOG_DIR.mkdir(parents=True, exist_ok=True)
                    python_cmd = resolve_python_command()
                    if getattr(sys, "frozen", False):
                        same_exe = len(python_cmd) == 1 and Path(python_cmd[0]).resolve() == Path(sys.executable).resolve()
                        if same_exe:
                            raise RuntimeError("Protecao anti-loop: EXE nao pode chamar ele mesmo.")

                    cmd = python_cmd + [
                        str(BASE_DIR / "scripts" / "run_collector_loop.py"),
                        "--interval",
                        self.vars["COLLECTOR_LOOP_INTERVAL"].get().strip() or "300",
                        "--log-level",
                        self.vars["COLLECTOR_LOG_LEVEL"].get().strip() or "INFO",
                        "--log-max-mb",
                        self.vars["COLLECTOR_LOG_MAX_MB"].get().strip() or "20",
                        "--log-backups",
                        self.vars["COLLECTOR_LOG_BACKUPS"].get().strip() or "5",
                    ]

                    creationflags = 0
                    startupinfo = None
                    if os.name == "nt":
                        creationflags = (
                            getattr(subprocess, "CREATE_NO_WINDOW", 0)
                            | getattr(subprocess, "DETACHED_PROCESS", 0)
                            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                        )
                        startupinfo = subprocess.STARTUPINFO()
                        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                        startupinfo.wShowWindow = 0

                    proc = subprocess.Popen(
                        cmd,
                        cwd=str(BASE_DIR),
                        stdin=subprocess.DEVNULL,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=creationflags,
                        startupinfo=startupinfo,
                        close_fds=False if os.name == "nt" else True,
                    )
                    write_pid(proc.pid)
                    started_pid = proc.pid
            except Exception as exc:
                err = str(exc)

            def done():
                self.starting = False
                self._set_busy(False)
                self.refresh_status()
                if err:
                    messagebox.showerror("Erro", f"Falha ao iniciar coletor: {err}")
                elif started_pid:
                    self.status_var.set(f"Status: rodando em background (PID {started_pid})")

            self.root.after(0, done)

        threading.Thread(target=worker, daemon=True).start()

    def stop_collector(self):
        if self.starting:
            return
        self._set_busy(True)
        self.status_var.set("Status: parando...")

        def worker():
            err = None
            try:
                pid = read_pid()
                if pid:
                    stop_pid(pid)
                    time.sleep(0.5)
                    clear_pid()
            except Exception as exc:
                err = str(exc)

            def done():
                self._set_busy(False)
                self.refresh_status()
                if err:
                    messagebox.showerror("Erro", f"Falha ao parar coletor: {err}")

            self.root.after(0, done)

        threading.Thread(target=worker, daemon=True).start()

    def refresh_status(self):
        pid = read_pid()
        running = bool(pid and is_pid_running(pid))
        if running:
            self.status_var.set("Status: rodando em background")
            self.pid_var.set(f"PID: {pid}")
            self.running = True
        else:
            self.status_var.set("Status: parado")
            self.pid_var.set("PID: -")
            self.running = False
            if pid:
                clear_pid()

    def open_logs(self):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(str(LOG_DIR))
        else:
            messagebox.showinfo("Logs", str(LOG_DIR))

    def _build_tray_image(self):
        if Image is None:
            return None
        img = Image.new("RGB", (64, 64), color=(20, 33, 61))
        draw = ImageDraw.Draw(img)
        draw.rectangle((6, 6, 58, 58), outline=(66, 135, 245), width=3)
        draw.text((20, 18), "C", fill=(255, 255, 255))
        return img

    def minimize_to_tray(self):
        if self.tray_icon is not None:
            self.root.withdraw()
            return

        if pystray is None or Image is None:
            self.root.iconify()
            return

        self.root.withdraw()

        def on_show(icon, _item):
            try:
                icon.stop()
            except Exception:
                pass
            self.tray_icon = None
            self.root.after(0, self.root.deiconify)

        def on_start(_icon, _item):
            self.root.after(0, self.start_collector)

        def on_stop(_icon, _item):
            self.root.after(0, self.stop_collector)

        def on_quit(icon, _item):
            try:
                icon.stop()
            except Exception:
                pass
            self.tray_icon = None
            self.root.after(0, self.root.destroy)

        menu = pystray.Menu(
            pystray.MenuItem("Mostrar", on_show),
            pystray.MenuItem("Iniciar coletor", on_start),
            pystray.MenuItem("Parar coletor", on_stop),
            pystray.MenuItem("Sair", on_quit),
        )

        icon = pystray.Icon("collector-control", self._build_tray_image(), "Collector Control", menu)
        self.tray_icon = icon

        def run_icon():
            icon.run()

        self.tray_thread = threading.Thread(target=run_icon, daemon=True)
        self.tray_thread.start()

    def on_close(self):
        try:
            state = {"last_closed_at": int(time.time()), "was_running": self.running}
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            RUNTIME_STATE.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass

        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass
        self.root.destroy()


def main():
    mutex_handle = acquire_single_instance_mutex()
    if mutex_handle is None:
        root = tk.Tk()
        root.withdraw()
        messagebox.showwarning("Collector Control", "O aplicativo ja esta aberto.")
        root.destroy()
        return

    app_lock = acquire_single_instance_lock()
    if app_lock is None:
        root = tk.Tk()
        root.withdraw()
        messagebox.showwarning("Collector Control", "O aplicativo ja esta aberto.")
        root.destroy()
        release_single_instance_mutex(mutex_handle)
        return

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    root = tk.Tk()
    app = CollectorControlApp(root)

    def periodic_refresh():
        app.refresh_status()
        root.after(5000, periodic_refresh)

    root.after(5000, periodic_refresh)
    try:
        root.mainloop()
    finally:
        try:
            msvcrt.locking(app_lock.fileno(), msvcrt.LK_UNLCK, 1)
        except Exception:
            pass
        app_lock.close()
        release_single_instance_mutex(mutex_handle)


if __name__ == "__main__":
    main()
