# [DOC-CODEMAP] Arquivo: coletor-snmp\scripts\collector_control_app.py
# [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
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
RUNTIME_LOG_PATH = LOG_DIR / "collector_loop_runtime.log"
BACKEND_TRACE_PATH = LOG_DIR / "collector_backend_trace.jsonl"
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


# [DOC-FUNC] load_env
# O que faz: A funcao 'load_env' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
# Entradas: Recebe os parametros: path. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] save_env
# O que faz: A funcao 'save_env' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
# Entradas: Recebe os parametros: path, values. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) percorre colecoes quando necessario para consolidar ou transformar resultados; 3) persiste alteracoes somente quando as regras de negocio permitem.
# Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
def save_env(path: Path, values):
    existing = load_env(path)
    existing.update(values)
    lines = [f"{k}={v}" for k, v in sorted(existing.items())]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# [DOC-FUNC] resolve_python_command
# O que faz: A funcao 'resolve_python_command' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] acquire_single_instance_lock
# O que faz: A funcao 'acquire_single_instance_lock' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] acquire_single_instance_mutex
# O que faz: A funcao 'acquire_single_instance_mutex' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] release_single_instance_mutex
# O que faz: A funcao 'release_single_instance_mutex' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
# Entradas: Recebe os parametros: handle. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] read_pid
# O que faz: A funcao 'read_pid' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] write_pid
# O que faz: A funcao 'write_pid' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
# Entradas: Recebe os parametros: pid. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def write_pid(pid: int):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    PID_PATH.write_text(str(pid), encoding="utf-8")


# [DOC-FUNC] clear_pid
# O que faz: A funcao 'clear_pid' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def clear_pid():
    try:
        PID_PATH.unlink(missing_ok=True)
    except Exception:
        pass


def mask_secret(secret: str, keep: int = 4) -> str:
    value = str(secret or "").strip()
    if not value:
        return "(vazio)"
    if len(value) <= keep:
        return "*" * len(value)
    return "*" * (len(value) - keep) + value[-keep:]


# [DOC-FUNC] tail_lines
# O que faz: A funcao 'tail_lines' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: path, max_lines. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def tail_lines(path: Path, max_lines: int = 80):
    try:
        if not path.exists():
            return []
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return lines[-max(1, max_lines):]
    except Exception:
        return []


# [DOC-FUNC] tail_jsonl
# O que faz: A funcao 'tail_jsonl' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: path, max_lines. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def tail_jsonl(path: Path, max_lines: int = 120):
    events = []
    try:
        if not path.exists():
            return events
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        for line in lines[-max(1, max_lines):]:
            clean = line.strip()
            if not clean:
                continue
            try:
                parsed = json.loads(clean)
                if isinstance(parsed, dict):
                    events.append(parsed)
            except Exception:
                continue
    except Exception:
        return []
    return events


# [DOC-FUNC] shorten_text
# O que faz: A funcao 'shorten_text' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: value, max_len. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def shorten_text(value, max_len: int = 140):
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    if len(text) <= max_len:
        return text
    return f"{text[:max_len - 3].rstrip()}..."


# [DOC-FUNC] stop_pid
# O que faz: A funcao 'stop_pid' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: pid. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
    # [DOC-FUNC] __init__
    # O que faz: A funcao '__init__' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Recebe os parametros: root. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Collector Control - Inventario")
        self.root.geometry("780x540")
        self.root.minsize(760, 520)

        self.tray_icon = None
        self.tray_thread = None
        self.running = False
        self.starting = False
        self.backend_panel_text = None

        self.vars = {}
        env_values = load_env(ENV_PATH)
        for key, default in DEFAULTS.items():
            self.vars[key] = tk.StringVar(value=env_values.get(key, default))

        self.status_var = tk.StringVar(value="Status: verificando...")
        self.pid_var = tk.StringVar(value="PID: -")

        self._build_ui()
        self.refresh_status()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    # [DOC-FUNC] _build_ui
    # O que faz: A funcao '_build_ui' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

        ttk.Label(
            outer,
            text="Backend ao vivo (SNMP, payload e POST em execucao):",
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor="w", pady=(2, 4))
        panel_frame = ttk.Frame(outer)
        panel_frame.pack(fill="both", expand=True)
        self.backend_panel_text = tk.Text(panel_frame, height=11, wrap="none", font=("Consolas", 10))
        scroll_y = ttk.Scrollbar(panel_frame, orient="vertical", command=self.backend_panel_text.yview)
        scroll_x = ttk.Scrollbar(panel_frame, orient="horizontal", command=self.backend_panel_text.xview)
        self.backend_panel_text.configure(yscrollcommand=scroll_y.set, xscrollcommand=scroll_x.set)
        self.backend_panel_text.grid(row=0, column=0, sticky="nsew")
        scroll_y.grid(row=0, column=1, sticky="ns")
        scroll_x.grid(row=1, column=0, sticky="ew")
        panel_frame.columnconfigure(0, weight=1)
        panel_frame.rowconfigure(0, weight=1)
        self.backend_panel_text.configure(state="disabled")
        self.refresh_backend_panel()

    # [DOC-FUNC] _set_busy
    # O que faz: A funcao '_set_busy' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
    # Entradas: Recebe os parametros: busy. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def _set_busy(self, busy: bool):
        state = "disabled" if busy else "normal"
        for btn in [self.btn_save, self.btn_start, self.btn_stop, self.btn_refresh, self.btn_logs, self.btn_tray]:
            try:
                btn.configure(state=state)
            except Exception:
                pass

    # [DOC-FUNC] save_config
    # O que faz: A funcao 'save_config' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
    # Entradas: Recebe os parametros: silent. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) percorre colecoes quando necessario para consolidar ou transformar resultados; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

    # [DOC-FUNC] start_collector
    # O que faz: A funcao 'start_collector' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def start_collector(self):
        if self.starting:
            return
        self.starting = True
        self._set_busy(True)
        self.status_var.set("Status: iniciando...")

        # [DOC-FUNC] worker
        # O que faz: A funcao 'worker' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
        # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
        # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
        # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

            # [DOC-FUNC] done
            # O que faz: A funcao 'done' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
            # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
            # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
            # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

    # [DOC-FUNC] stop_collector
    # O que faz: A funcao 'stop_collector' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def stop_collector(self):
        if self.starting:
            return
        self._set_busy(True)
        self.status_var.set("Status: parando...")

        # [DOC-FUNC] worker
        # O que faz: A funcao 'worker' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
        # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
        # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
        # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

            # [DOC-FUNC] done
            # O que faz: A funcao 'done' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
            # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
            # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
            # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
            def done():
                self._set_busy(False)
                self.refresh_status()
                if err:
                    messagebox.showerror("Erro", f"Falha ao parar coletor: {err}")

            self.root.after(0, done)

        threading.Thread(target=worker, daemon=True).start()

    # [DOC-FUNC] refresh_status
    # O que faz: A funcao 'refresh_status' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
        self.refresh_backend_panel()

    # [DOC-FUNC] open_logs
    # O que faz: A funcao 'open_logs' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def open_logs(self):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(str(LOG_DIR))
        else:
            messagebox.showinfo("Logs", str(LOG_DIR))

    # [DOC-FUNC] _compact_ts
    # O que faz: A funcao '_compact_ts' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Recebe os parametros: ts. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def _compact_ts(self, ts):
        text = str(ts or "").strip()
        if "T" in text and "." in text:
            try:
                hhmmss = text.split("T", 1)[1].split(".", 1)[0]
                return hhmmss
            except Exception:
                return text
        if "|" in text:
            return text
        return text[-8:] if len(text) >= 8 else text

    # [DOC-FUNC] _format_payload_for_panel
    # O que faz: A funcao '_format_payload_for_panel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
    # Entradas: Recebe os parametros: raw_payload. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def _format_payload_for_panel(self, raw_payload):
        if not raw_payload:
            return "(ainda nao houve POST de telemetria nesta sessao)"

        try:
            payload_obj = json.loads(str(raw_payload))
        except Exception:
            return shorten_text(raw_payload, max_len=1200)

        coletor_id = payload_obj.get("coletor_id")
        eventos = payload_obj.get("eventos") if isinstance(payload_obj, dict) else None
        first_event = eventos[0] if isinstance(eventos, list) and eventos else {}
        printer = first_event.get("impressora") if isinstance(first_event, dict) else {}
        supplies = first_event.get("suprimentos") if isinstance(first_event, dict) else []

        summary_lines = [
            f"coletor_id: {coletor_id or '-'}",
            f"ingestao_id: {first_event.get('ingestao_id') or '-'}",
            f"ip: {printer.get('ip') or '-'} | status: {first_event.get('status') or '-'}",
            f"setor: {printer.get('setor') or '-'}",
            f"contador_total_paginas: {first_event.get('contador_total_paginas')}",
            f"qtd_suprimentos: {len(supplies) if isinstance(supplies, list) else 0}",
        ]

        supply_lines = []
        if isinstance(supplies, list):
            for item in supplies[:8]:
                if not isinstance(item, dict):
                    continue
                supply_lines.append(
                    f"- {item.get('chave_suprimento')}: {item.get('nivel_percentual')}% ({item.get('status_suprimento')})"
                )
        if not supply_lines:
            supply_lines.append("- (sem suprimentos)")

        pretty_json = json.dumps(payload_obj, indent=2, ensure_ascii=False)
        # Limite para manter o painel responsivo mesmo com payloads grandes.
        pretty_json = shorten_text(pretty_json, max_len=4200)

        return (
            "Resumo:\n"
            + "\n".join(summary_lines)
            + "\nSuprimentos:\n"
            + "\n".join(supply_lines)
            + "\n\nJSON:\n"
            + pretty_json
        )

    # [DOC-FUNC] _event_line
    # O que faz: A funcao '_event_line' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
    # Entradas: Recebe os parametros: event. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def _event_line(self, event):
        ts = self._compact_ts(event.get("ts"))
        ev = str(event.get("event") or "").strip().lower()
        if ev == "snmp_walk_start":
            return f"[{ts}] SNMP WALK  {shorten_text(event.get('command_equivalent'), 130)}"
        if ev == "snmp_get_start":
            return f"[{ts}] SNMP GET   {shorten_text(event.get('command_equivalent'), 130)}"
        if ev == "telemetry_post_start":
            return (
                f"[{ts}] POST START {shorten_text(event.get('url'), 70)} "
                f"id={event.get('ingestao_id')}"
            )
        if ev == "telemetry_post_ok":
            return f"[{ts}] POST OK    status={event.get('status')} id={event.get('ingestao_id')}"
        if ev == "telemetry_post_error":
            return f"[{ts}] POST ERRO  {shorten_text(event.get('error'), 120)}"
        if ev == "supabase_get_printers_start":
            return f"[{ts}] GET SB START {shorten_text(event.get('url'), 120)}"
        if ev == "supabase_get_printers_ok":
            return f"[{ts}] GET SB OK    status={event.get('status')} registros={event.get('rows')}"
        if ev == "supabase_get_printers_error":
            return f"[{ts}] GET SB ERRO  {shorten_text(event.get('error'), 120)}"
        return f"[{ts}] {ev} -> {event}"

    # [DOC-FUNC] build_backend_panel_snapshot
    # O que faz: A funcao 'build_backend_panel_snapshot' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) persiste alteracoes somente quando as regras de negocio permitem.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def build_backend_panel_snapshot(self):
        payload = {k: v.get().strip() for k, v in self.vars.items()}
        trace_events = tail_jsonl(BACKEND_TRACE_PATH, max_lines=300)
        last_payload = None
        lines = []
        for event in reversed(trace_events):
            ev = str(event.get("event") or "").lower()
            if ev == "telemetry_post_start" and not last_payload:
                last_payload = str(event.get("payload") or "")
            if ev in {
                "snmp_walk_start",
                "snmp_get_start",
                "telemetry_post_start",
                "telemetry_post_ok",
                "telemetry_post_error",
                "supabase_get_printers_start",
                "supabase_get_printers_ok",
                "supabase_get_printers_error",
            }:
                lines.append(self._event_line(event))
            if len(lines) >= 20:
                break
        lines.reverse()
        if not lines:
            lines = ["(sem execucoes rastreadas ainda; inicie o coletor para preencher)"]

        runtime_tail = tail_lines(RUNTIME_LOG_PATH, max_lines=12)
        if not runtime_tail:
            runtime_tail = ["(sem linhas de log ainda)"]

        token_masked = mask_secret(payload.get("COLLECTOR_API_TOKEN", ""))
        api_url = payload.get("COLLECTOR_API_URL", "")
        supabase_url = payload.get("COLLECTOR_SUPABASE_URL", "")
        pid = read_pid()
        running = bool(pid and is_pid_running(pid))
        status_line = f"rodando (PID {pid})" if running else "parado"

        if not last_payload:
            last_payload = "(ainda nao houve POST de telemetria nesta sessao)"
        payload_pretty = self._format_payload_for_panel(last_payload)

        # Snapshot textual unico: facilita copiar/colar em chamados e documentação de suporte.
        return (
            "==================== STATUS ====================\n"
            f"Coletor: {status_line}\n"
            f"API Telemetria: {api_url or '(nao configurada)'}\n"
            f"Supabase URL: {supabase_url or '(nao configurada)'}\n"
            f"Token (mascarado): {token_masked}\n"
            "\n================ COMANDOS SNMP (equivalente) ================\n"
            "snmpwalk -v2c -c <community> <ip> 1.3.6.1.2.1.43.11.1.1.6.1\n"
            "snmpwalk -v2c -c <community> <ip> 1.3.6.1.2.1.43.11.1.1.8.1\n"
            "snmpwalk -v2c -c <community> <ip> 1.3.6.1.2.1.43.11.1.1.9.1\n"
            "snmpget  -v2c -c <community> <ip> 1.3.6.1.2.1.43.10.2.1.4.1.1\n"
            "\n================ ULTIMO PAYLOAD ENVIADO ================\n"
            f"{payload_pretty}\n"
            "\n================ EXECUCOES BACKEND (real) ================\n"
            + "\n".join(lines)
            + "\n\n================ RUNTIME LOG (ultimas linhas) ================\n"
            + "\n".join(runtime_tail)
        )

    # [DOC-FUNC] refresh_backend_panel
    # O que faz: A funcao 'refresh_backend_panel' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
    # Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
    def refresh_backend_panel(self):
        if self.backend_panel_text is None or not self.backend_panel_text.winfo_exists():
            return
        self.backend_panel_text.configure(state="normal")
        self.backend_panel_text.delete("1.0", "end")
        self.backend_panel_text.insert("1.0", self.build_backend_panel_snapshot())
        self.backend_panel_text.configure(state="disabled")

    # [DOC-FUNC] _build_tray_image
    # O que faz: A funcao '_build_tray_image' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def _build_tray_image(self):
        if Image is None:
            return None
        img = Image.new("RGB", (64, 64), color=(20, 33, 61))
        draw = ImageDraw.Draw(img)
        draw.rectangle((6, 6, 58, 58), outline=(66, 135, 245), width=3)
        draw.text((20, 18), "C", fill=(255, 255, 255))
        return img

    # [DOC-FUNC] minimize_to_tray
    # O que faz: A funcao 'minimize_to_tray' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    def minimize_to_tray(self):
        if self.tray_icon is not None:
            self.root.withdraw()
            return

        if pystray is None or Image is None:
            self.root.iconify()
            return

        self.root.withdraw()

        # [DOC-FUNC] on_show
        # O que faz: A funcao 'on_show' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
        # Entradas: Recebe os parametros: icon, _item. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
        # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
        # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
        def on_show(icon, _item):
            try:
                icon.stop()
            except Exception:
                pass
            self.tray_icon = None
            self.root.after(0, self.root.deiconify)

        # [DOC-FUNC] on_start
        # O que faz: A funcao 'on_start' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
        # Entradas: Recebe os parametros: _icon, _item. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
        # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
        # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
        def on_start(_icon, _item):
            self.root.after(0, self.start_collector)

        def on_stop(_icon, _item):
            self.root.after(0, self.stop_collector)

        # [DOC-FUNC] on_quit
        # O que faz: A funcao 'on_quit' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
        # Entradas: Recebe os parametros: icon, _item. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
        # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
        # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

        # [DOC-FUNC] run_icon
        # O que faz: A funcao 'run_icon' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
        # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
        # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
        # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
        def run_icon():
            icon.run()

        self.tray_thread = threading.Thread(target=run_icon, daemon=True)
        self.tray_thread.start()

    # [DOC-FUNC] on_close
    # O que faz: A funcao 'on_close' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] main
# O que faz: A funcao 'main' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

    # [DOC-FUNC] periodic_refresh
    # O que faz: A funcao 'periodic_refresh' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

