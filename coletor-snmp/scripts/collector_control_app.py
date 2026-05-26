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


# [DOC-FUNC] _runtime_dir
# Objetivo: apoia o aplicativo/rotina de controle do coletor local.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: resolve caminhos de runtime, mascara segredos, verifica processo ativo e organiza execucao segura do loop de coleta; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
# [DOC-DETAIL] _runtime_dir
# Explicacao didatica: Localiza a pasta onde o app de controle esta rodando, tanto em modo script quanto empacotado. Isso permite encontrar .env, logs e scripts sem depender do diretorio aberto no terminal.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def _runtime_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


# [DOC-FUNC] _resolve_base_dir
# Objetivo: apoia o aplicativo/rotina de controle do coletor local.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: resolve caminhos de runtime, mascara segredos, verifica processo ativo e organiza execucao segura do loop de coleta; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
# [DOC-DETAIL] _resolve_base_dir
# Explicacao didatica: Procura a raiz real do coletor avaliando candidatos com scripts, .env e data. Essa escolha evita que o app salve configuracao no lugar errado.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
TAIL_READ_BYTES = 512 * 1024
MAX_PANEL_CHARS = 14000
BRAND_LOGO_CANDIDATES = [
    Path(getattr(sys, "_MEIPASS", BASE_DIR)) / "assets" / "ntech-white.png",
    Path(getattr(sys, "_MEIPASS", BASE_DIR)) / "assets" / "ntech-black.png",
    BASE_DIR / "assets" / "ntech-white.png",
    BASE_DIR / "assets" / "ntech-black.png",
    BASE_DIR.parent / "inventario-unificado-web" / "public" / "brand" / "ntech-white.png",
    BASE_DIR.parent / "inventario-unificado-web" / "public" / "brand" / "ntech-black.png",
]
BRAND_ICON_CANDIDATES = [
    Path(getattr(sys, "_MEIPASS", BASE_DIR)) / "assets" / "ntech-n.png",
    BASE_DIR / "assets" / "ntech-n.png",
    BASE_DIR.parent / "inventario-unificado-web" / "public" / "brand" / "ntech-n.png",
]
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
# [DOC-DETAIL] load_env
# Explicacao didatica: Le o arquivo .env linha por linha e devolve um dicionario simples de chave/valor. Ignora comentarios e linhas vazias para a tela carregar apenas configuracoes validas.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] save_env
# Explicacao didatica: Mescla os valores editados na interface com o .env existente e grava tudo ordenado. Assim o usuario altera configuracoes sem apagar campos que a tela nao mostra.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] resolve_python_command
# Explicacao didatica: Escolhe qual executavel Python sera usado para iniciar o loop: primeiro tenta a .venv do projeto, depois python/pythonw do PATH e por fim o launcher py.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] acquire_single_instance_lock
# Explicacao didatica: Cria um lock de arquivo para impedir duas janelas do app abertas ao mesmo tempo. Isso evita dois botoes Iniciar controlando o mesmo coletor.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] acquire_single_instance_mutex
# Explicacao didatica: No Windows, cria um mutex global para reforcar que so existe uma instancia do app. E uma segunda camada de seguranca alem do lock de arquivo.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] release_single_instance_mutex
# Explicacao didatica: Fecha o handle do mutex quando o app encerra. Isso libera o Windows para permitir nova abertura no futuro.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def release_single_instance_mutex(handle):
    if os.name != "nt" or not handle:
        return
    try:
        ctypes.windll.kernel32.CloseHandle(handle)
    except Exception:
        pass


# [DOC-FUNC] is_pid_running
# Objetivo: apoia o aplicativo/rotina de controle do coletor local.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: resolve caminhos de runtime, mascara segredos, verifica processo ativo e organiza execucao segura do loop de coleta; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
# [DOC-DETAIL] is_pid_running
# Explicacao didatica: Verifica se o PID salvo ainda pertence a um processo vivo. No Windows usa API do sistema; em outros ambientes usa sinal zero.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] read_pid
# Explicacao didatica: Le o arquivo collector.pid para descobrir qual processo do loop esta rodando. Se o arquivo estiver vazio ou invalido, retorna None.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] write_pid
# Explicacao didatica: Grava o PID do processo iniciado pelo app. Esse numero permite parar o coletor depois sem procurar manualmente no Gerenciador de Tarefas.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def write_pid(pid: int):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    PID_PATH.write_text(str(pid), encoding="utf-8")


# [DOC-FUNC] clear_pid
# O que faz: A funcao 'clear_pid' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
# [DOC-DETAIL] clear_pid
# Explicacao didatica: Remove o arquivo de PID quando o processo para. Isso evita a tela mostrar coletor rodando quando ele ja foi encerrado.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def clear_pid():
    try:
        PID_PATH.unlink(missing_ok=True)
    except Exception:
        pass


# [DOC-FUNC] mask_secret
# Objetivo: apoia o aplicativo/rotina de controle do coletor local.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: resolve caminhos de runtime, mascara segredos, verifica processo ativo e organiza execucao segura do loop de coleta; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
# [DOC-DETAIL] mask_secret
# Explicacao didatica: Mascara token e chaves antes de mostrar na interface/log. Mantem apenas os ultimos caracteres para conferencia visual sem expor segredo inteiro.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] tail_lines
# Explicacao didatica: Le apenas as ultimas linhas de um arquivo de log. Isso deixa a tela leve mesmo quando o log completo esta grande.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def tail_lines(path: Path, max_lines: int = 80):
    try:
        if not path.exists():
            return []
        # Le somente o final do arquivo. O trace/log pode passar de GB;
        # carregar tudo na UI derruba RAM e disco.
        with path.open("rb") as handle:
            handle.seek(0, os.SEEK_END)
            size = handle.tell()
            handle.seek(max(0, size - TAIL_READ_BYTES), os.SEEK_SET)
            chunk = handle.read()
        lines = chunk.decode("utf-8", errors="replace").splitlines()
        return lines[-max(1, max_lines):]
    except Exception:
        return []


# [DOC-FUNC] tail_jsonl
# O que faz: A funcao 'tail_jsonl' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: path, max_lines. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
# [DOC-DETAIL] tail_jsonl
# Explicacao didatica: Le eventos JSONL recentes e converte cada linha em objeto. Eventos invalidos sao ignorados para nao quebrar a interface.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def tail_jsonl(path: Path, max_lines: int = 120):
    events = []
    try:
        if not path.exists():
            return events
        # Mesmo raciocinio de tail_lines: JSONL de backend cresce muito em
        # producao. Ler apenas o fim evita picos de GB na interface Tkinter.
        with path.open("rb") as handle:
            handle.seek(0, os.SEEK_END)
            size = handle.tell()
            handle.seek(max(0, size - TAIL_READ_BYTES), os.SEEK_SET)
            chunk = handle.read()
        lines = chunk.decode("utf-8", errors="replace").splitlines()
        if size > TAIL_READ_BYTES and lines:
            lines = lines[1:]
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
# [DOC-DETAIL] shorten_text
# Explicacao didatica: Reduz textos longos para caber no painel. Remove quebras de linha e coloca reticencias quando ultrapassa o limite.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def shorten_text(value, max_len: int = 140):
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    if len(text) <= max_len:
        return text
    return f"{text[:max_len - 3].rstrip()}..."


# [DOC-FUNC] file_size_label
# Objetivo: mostra tamanho de logs/cache sem abrir o arquivo inteiro.
# Entradas: caminho do arquivo que sera medido.
# Como executa: usa metadados do sistema de arquivos (`stat`) em vez de ler conteudo.
# Saida/Efeito: devolve texto curto para o painel tecnico do aplicativo.
def file_size_label(path: Path) -> str:
    try:
        if not path.exists():
            return "0 MB"
        size_mb = path.stat().st_size / (1024 * 1024)
        if size_mb >= 1024:
            return f"{size_mb / 1024:.2f} GB"
        return f"{size_mb:.2f} MB"
    except Exception:
        return "indisponivel"


# [DOC-FUNC] resolve_brand_logo_path
# Objetivo: encontra uma logo NTECH leve para personalizar o app sem exigir asset duplicado no coletor.
# Entradas: usa candidatos conhecidos dentro do coletor e do frontend.
# Como executa: testa caminhos em ordem e retorna o primeiro arquivo existente.
# Saida/Efeito: devolve Path ou None; nao altera arquivo nem regra de coleta.
def resolve_brand_logo_path():
    for candidate in BRAND_LOGO_CANDIDATES:
        try:
            if candidate.exists():
                return candidate
        except Exception:
            continue
    return None


# [DOC-FUNC] resolve_brand_icon_path
# Objetivo: encontra o icone NTECH usado na barra da janela, bandeja e executavel.
# Entradas: usa candidatos conhecidos dentro do pacote, coletor e frontend.
# Como executa: testa caminhos em ordem e retorna o primeiro arquivo existente.
# Saida/Efeito: devolve Path ou None; nao altera coleta nem configuracao.
def resolve_brand_icon_path():
    for candidate in BRAND_ICON_CANDIDATES:
        try:
            if candidate.exists():
                return candidate
        except Exception:
            continue
    return None


# [DOC-FUNC] fit_window_to_screen
# Objetivo: abre a janela ja encaixada no monitor, sem exigir redimensionamento manual.
# Entradas: janela Tk principal.
# Como executa: usa um tamanho fixo confortavel e centraliza no monitor atual.
# Saida/Efeito: aplica geometry inicial de forma segura; nao altera regras do coletor.
def fit_window_to_screen(root: tk.Tk):
    try:
        screen_w = root.winfo_screenwidth()
        screen_h = root.winfo_screenheight()
        width = min(1240, max(1080, screen_w - 80))
        height = min(700, max(640, screen_h - 90))
        x = max(0, int((screen_w - width) / 2))
        y = max(0, int((screen_h - height) / 2) - 10)
        root.geometry(f"{width}x{height}+{x}+{y}")
        root.minsize(width, height)
        root.maxsize(width, height)
        root.resizable(False, False)
    except Exception:
        root.geometry("1180x680")
        root.minsize(1180, 680)
        root.maxsize(1180, 680)
        root.resizable(False, False)


# [DOC-FUNC] stop_pid
# O que faz: A funcao 'stop_pid' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: pid. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
# [DOC-DETAIL] stop_pid
# Explicacao didatica: Encerra o processo do coletor pelo PID. No Windows usa taskkill com arvore de processos para evitar deixar subprocessos presos.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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


# [DOC-DETAIL] CollectorControlApp
# Explicacao didatica: Classe principal da janela Tkinter. Ela concentra interface, botoes, status, logs, configuracao e controle de iniciar/parar o loop.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
class CollectorControlApp:
    # [DOC-FUNC] __init__
    # O que faz: A funcao '__init__' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Recebe os parametros: root. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    # [DOC-DETAIL] __init__
    # Explicacao didatica: Inicializa estado da tela, carrega variaveis, cria widgets e prepara verificacao periodica. Nao inicia coleta automaticamente.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("NTECH Collector Control")
        fit_window_to_screen(self.root)
        self.root.configure(bg="#07111f")

        self.tray_icon = None
        self.tray_thread = None
        self.running = False
        self.starting = False
        self.backend_panel_text = None
        self.logo_image = None
        self.icon_image = None
        self.config_expanded = False
        self.config_body = None
        self.config_toggle_btn = None

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
    # [DOC-DETAIL] _build_ui
    # Explicacao didatica: Monta visualmente a tela: campos do .env, botoes de iniciar/parar, status e painel de diagnostico. Cada widget fica ligado ao estado da classe.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
    def _build_ui(self):
        palette = {
            "app": "#07111f",
            "surface": "#0f1b2d",
            "surface_2": "#13233a",
            "border": "#223752",
            "text": "#edf5ff",
            "muted": "#93a9c7",
            "blue": "#38bdf8",
            "blue_2": "#2563eb",
            "green": "#22c55e",
            "red": "#ef4444",
            "field": "#eaf1fb",
            "field_text": "#08111f",
            "console": "#020817",
        }
        self.palette = palette

        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure(".", font=("Segoe UI", 9))
        style.configure("App.TFrame", background=palette["app"])
        style.configure("Panel.TFrame", background=palette["surface"], relief="flat")
        style.configure("Title.TLabel", background=palette["app"], foreground=palette["text"], font=("Segoe UI", 22, "bold"))
        style.configure("Subtitle.TLabel", background=palette["app"], foreground="#b9d9ff", font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=palette["app"], foreground=palette["muted"], font=("Segoe UI", 9))
        style.configure("Status.TLabel", background=palette["app"], foreground=palette["blue"], font=("Segoe UI", 10, "bold"))
        style.configure("TLabel", background=palette["app"], foreground=palette["text"])
        style.configure("TButton", padding=(12, 7), font=("Segoe UI", 9, "bold"), borderwidth=0)
        style.map("TButton", background=[("active", "#1e40af")])
        style.configure("Primary.TButton", padding=(14, 8), font=("Segoe UI", 9, "bold"), background=palette["blue_2"], foreground="#ffffff")
        style.configure("Danger.TButton", padding=(14, 8), font=("Segoe UI", 9, "bold"), background="#7f1d1d", foreground="#ffffff")
        style.configure("Ghost.TButton", padding=(12, 7), font=("Segoe UI", 9, "bold"), background=palette["surface_2"], foreground=palette["text"])
        style.configure("TEntry", fieldbackground=palette["field"], foreground=palette["field_text"], bordercolor=palette["border"], lightcolor=palette["border"], darkcolor=palette["border"])
        style.configure("Vertical.TScrollbar", background=palette["surface_2"], troughcolor=palette["console"], bordercolor=palette["surface_2"], arrowcolor=palette["text"])
        style.configure("Horizontal.TScrollbar", background=palette["surface_2"], troughcolor=palette["console"], bordercolor=palette["surface_2"], arrowcolor=palette["text"])

        icon_path = resolve_brand_icon_path()
        if icon_path is not None:
            try:
                self.icon_image = tk.PhotoImage(file=str(icon_path))
                self.root.iconphoto(True, self.icon_image)
            except Exception:
                self.icon_image = None

        outer = tk.Frame(self.root, bg=palette["app"], padx=18, pady=16)
        outer.pack(fill="both", expand=True)

        header = tk.Frame(outer, bg=palette["app"])
        header.pack(fill="x", pady=(0, 14))
        logo_path = resolve_brand_logo_path()
        logo_shell = tk.Frame(header, bg="#081a32", highlightbackground=palette["border"], highlightthickness=1, padx=12, pady=8)
        logo_shell.pack(side="left", padx=(0, 14))
        if logo_path is not None:
            try:
                self.logo_image = tk.PhotoImage(file=str(logo_path)).subsample(4, 4)
                tk.Label(logo_shell, image=self.logo_image, bg="#081a32").pack()
            except Exception:
                self.logo_image = None
        if self.logo_image is None:
            tk.Label(logo_shell, text="NTECH", bg="#081a32", fg="#f8fafc", font=("Segoe UI", 16, "bold")).pack()
            tk.Label(logo_shell, text="SNMP", bg="#081a32", fg=palette["blue"], font=("Segoe UI", 8, "bold")).pack(anchor="e")

        title_box = tk.Frame(header, bg=palette["app"])
        title_box.pack(side="left", fill="x", expand=True)
        ttk.Label(title_box, text="NTECH Collector Control", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            title_box,
            text="Operacao local do coletor SNMP: iniciar, parar, auditar payloads e acompanhar saude sem pesar na maquina.",
            style="Subtitle.TLabel",
        ).pack(anchor="w", pady=(3, 0))

        status_card = tk.Frame(header, bg=palette["surface"], highlightbackground=palette["border"], highlightthickness=1, padx=14, pady=9)
        status_card.pack(side="right", fill="y")
        tk.Label(status_card, text="STATUS", bg=palette["surface"], fg=palette["muted"], font=("Segoe UI", 8, "bold")).pack(anchor="e")
        tk.Label(status_card, textvariable=self.status_var, bg=palette["surface"], fg=palette["blue"], font=("Segoe UI", 10, "bold")).pack(anchor="e", pady=(2, 0))
        tk.Label(status_card, textvariable=self.pid_var, bg=palette["surface"], fg=palette["muted"], font=("Segoe UI", 9)).pack(anchor="e")

        path_bar = tk.Frame(outer, bg=palette["surface"], highlightbackground=palette["border"], highlightthickness=1, padx=12, pady=8)
        path_bar.pack(fill="x", pady=(0, 14))
        tk.Label(path_bar, text="Base", bg=palette["surface"], fg=palette["blue"], font=("Segoe UI", 8, "bold")).pack(side="left", padx=(0, 8))
        tk.Label(path_bar, text=str(BASE_DIR), bg=palette["surface"], fg=palette["text"], font=("Segoe UI", 9)).pack(side="left")
        tk.Label(path_bar, text="  |  ENV", bg=palette["surface"], fg=palette["blue"], font=("Segoe UI", 8, "bold")).pack(side="left", padx=(12, 8))
        tk.Label(path_bar, text=str(ENV_PATH), bg=palette["surface"], fg=palette["text"], font=("Segoe UI", 9)).pack(side="left")

        main = tk.PanedWindow(outer, orient="vertical", bg=palette["app"], bd=0, sashwidth=8, sashrelief="flat")
        main.pack(fill="both", expand=True)

        config_card = tk.Frame(main, bg=palette["surface"], highlightbackground=palette["border"], highlightthickness=1, padx=14, pady=12)
        main.add(config_card, stretch="never", minsize=280)

        card_header = tk.Frame(config_card, bg=palette["surface"])
        card_header.pack(fill="x", pady=(0, 10))
        tk.Label(card_header, text="Configuracao do coletor", bg=palette["surface"], fg=palette["text"], font=("Segoe UI", 13, "bold")).pack(side="left")
        self.config_toggle_btn = ttk.Button(
            card_header,
            text="Mostrar configuracao",
            command=self.toggle_config_panel,
            style="Ghost.TButton",
        )
        self.config_toggle_btn.pack(side="right")
        tk.Label(
            card_header,
            text="Campos sensiveis ficam mascarados",
            bg=palette["surface"],
            fg=palette["muted"],
            font=("Segoe UI", 9),
        ).pack(side="right", padx=(0, 12))

        form = tk.Frame(config_card, bg=palette["surface"])
        self.config_body = form

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

        columns = 2
        for idx, (label, key) in enumerate(fields):
            row = idx // columns
            col = (idx % columns) * 2
            tk.Label(form, text=label, bg=palette["surface"], fg=palette["muted"], font=("Segoe UI", 8, "bold")).grid(row=row * 2, column=col, sticky="w", pady=(0, 2), padx=(0, 10))
            show = "*" if "TOKEN" in key or key.endswith("_KEY") else ""
            entry = ttk.Entry(form, textvariable=self.vars[key], width=48, show=show)
            entry.grid(row=row * 2 + 1, column=col, columnspan=2, sticky="we", padx=(0, 14), pady=(0, 8))

        for col in range(columns * 2):
            form.columnconfigure(col, weight=1 if col % 2 == 0 else 0)

        actions = tk.Frame(config_card, bg=palette["surface"])
        actions.pack(fill="x", pady=(2, 0))

        self.btn_save = ttk.Button(actions, text="Salvar .env", command=self.save_config, style="Ghost.TButton")
        self.btn_save.pack(side="left")
        self.btn_start = ttk.Button(actions, text="Iniciar coletor", command=self.start_collector, style="Primary.TButton")
        self.btn_start.pack(side="left", padx=8)
        self.btn_stop = ttk.Button(actions, text="Parar coletor", command=self.stop_collector, style="Danger.TButton")
        self.btn_stop.pack(side="left")
        self.btn_refresh = ttk.Button(actions, text="Atualizar status", command=self.refresh_status, style="Ghost.TButton")
        self.btn_refresh.pack(side="left", padx=8)
        self.btn_logs = ttk.Button(actions, text="Abrir logs", command=self.open_logs, style="Ghost.TButton")
        self.btn_logs.pack(side="left")
        self.btn_tray = ttk.Button(actions, text="Minimizar para bandeja", command=self.minimize_to_tray, style="Ghost.TButton")
        self.btn_tray.pack(side="right")

        console_card = tk.Frame(main, bg=palette["surface"], highlightbackground=palette["border"], highlightthickness=1, padx=14, pady=12)
        main.add(console_card, stretch="always", minsize=280)

        console_header = tk.Frame(console_card, bg=palette["surface"])
        console_header.pack(fill="x", pady=(0, 8))
        tk.Label(console_header, text="Backend ao vivo", bg=palette["surface"], fg=palette["text"], font=("Segoe UI", 13, "bold")).pack(side="left")
        tk.Label(console_header, text="SNMP, payload, POST e ultimos logs", bg=palette["surface"], fg=palette["muted"], font=("Segoe UI", 9)).pack(side="left", padx=(10, 0))

        panel_frame = tk.Frame(console_card, bg=palette["console"], highlightbackground=palette["border"], highlightthickness=1)
        panel_frame.pack(fill="both", expand=True)
        self.backend_panel_text = tk.Text(
            panel_frame,
            height=13,
            wrap="none",
            font=("Consolas", 10),
            bg=palette["console"],
            fg="#dbeafe",
            insertbackground="#dbeafe",
            selectbackground="#1d4ed8",
            relief="flat",
            padx=12,
            pady=10,
        )
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

    # [DOC-FUNC] toggle_config_panel
    # Objetivo: mostra/oculta os campos de configuracao para deixar a operacao diaria mais limpa.
    # Entradas: usa estado interno da janela (`config_expanded`).
    # Como executa: alterna o pack do frame de campos e atualiza o texto do botao.
    # Saida/Efeito: muda apenas a interface; nao salva .env nem altera coleta.
    def toggle_config_panel(self):
        if self.config_body is None:
            return
        self.config_expanded = not self.config_expanded
        if self.config_expanded:
            self.config_body.pack(fill="x", before=self.btn_save.master, pady=(0, 8))
            if self.config_toggle_btn is not None:
                self.config_toggle_btn.configure(text="Ocultar configuracao")
        else:
            self.config_body.pack_forget()
            if self.config_toggle_btn is not None:
                self.config_toggle_btn.configure(text="Mostrar configuracao")

    # [DOC-FUNC] _set_busy
    # O que faz: A funcao '_set_busy' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
    # Entradas: Recebe os parametros: busy. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    # [DOC-DETAIL] _set_busy
    # Explicacao didatica: Ativa/desativa estado ocupado nos botoes durante operacoes demoradas. Isso evita duplo clique em iniciar/parar enquanto uma thread trabalha.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] save_config
    # Explicacao didatica: Pega valores digitados na tela e grava no .env. Pode rodar silenciosamente antes de iniciar o coletor.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] start_collector
    # Explicacao didatica: Dispara a rotina de inicio em thread separada para nao travar a interface. Ela valida processo existente, salva config e abre o loop Python.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
        # [DOC-DETAIL] worker
        # Explicacao didatica: Executa trabalho pesado em background dentro de botoes do app. Mantem a janela responsiva enquanto inicia ou para processos.
        # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
            # [DOC-DETAIL] done
            # Explicacao didatica: Participa do fluxo do coletor Python. Nesta funcao, isola uma etapa pequena para deixar o fluxo principal mais legivel e facil de testar.
            # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] stop_collector
    # Explicacao didatica: Dispara a parada do coletor em thread separada. Usa o PID salvo para encerrar o processo certo e depois atualiza a tela.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
        # [DOC-DETAIL] worker
        # Explicacao didatica: Executa trabalho pesado em background dentro de botoes do app. Mantem a janela responsiva enquanto inicia ou para processos.
        # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
            # [DOC-DETAIL] done
            # Explicacao didatica: Participa do fluxo do coletor Python. Nesta funcao, isola uma etapa pequena para deixar o fluxo principal mais legivel e facil de testar.
            # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] refresh_status
    # Explicacao didatica: Atualiza indicadores da janela: se o coletor esta rodando, PID atual, ultimas linhas de log e painel tecnico.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] open_logs
    # Explicacao didatica: Abre a pasta de logs no explorador do Windows para facilitar suporte e auditoria manual.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] _compact_ts
    # Explicacao didatica: Formata timestamps longos para caberem no painel de eventos. Mantem o horario mais importante para leitura rapida.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] _format_payload_for_panel
    # Explicacao didatica: Transforma o ultimo payload JSON em resumo legivel: coletor, IP, status, pagecount e suprimentos. Tambem mostra JSON completo reduzido.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] _event_line
    # Explicacao didatica: Converte eventos tecnicos do runtime_trace em linhas humanas. Ajuda a entender GET SNMP, POST de telemetria e erros sem abrir JSON bruto.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] build_backend_panel_snapshot
    # Explicacao didatica: Monta um relatorio textual completo da situacao do coletor: status, endpoints, comandos SNMP equivalentes, payload e logs.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
    def build_backend_panel_snapshot(self):
        payload = {k: v.get().strip() for k, v in self.vars.items()}
        trace_events = tail_jsonl(BACKEND_TRACE_PATH, max_lines=120)
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
        snapshot = (
            "==================== STATUS ====================\n"
            f"Coletor: {status_line}\n"
            f"API Telemetria: {api_url or '(nao configurada)'}\n"
            f"Supabase URL: {supabase_url or '(nao configurada)'}\n"
            f"Token (mascarado): {token_masked}\n"
            f"Trace backend: {file_size_label(BACKEND_TRACE_PATH)} | Log runtime: {file_size_label(RUNTIME_LOG_PATH)}\n"
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
        if len(snapshot) > MAX_PANEL_CHARS:
            return snapshot[:MAX_PANEL_CHARS].rstrip() + "\n\n... painel limitado para manter a interface leve ..."
        return snapshot

    # [DOC-FUNC] refresh_backend_panel
    # O que faz: A funcao 'refresh_backend_panel' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
    # Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
    # [DOC-DETAIL] refresh_backend_panel
    # Explicacao didatica: Recarrega o painel tecnico da interface com o snapshot atual. Mantem o texto somente leitura para evitar edicao acidental.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] _build_tray_image
    # Explicacao didatica: Gera um icone simples para a bandeja do sistema quando pystray esta disponivel.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] minimize_to_tray
    # Explicacao didatica: Esconde a janela e cria menu na bandeja com Mostrar, Iniciar, Parar e Sair. Se pystray nao existir, apenas minimiza.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
        # [DOC-DETAIL] on_show
        # Explicacao didatica: Callback da bandeja para reabrir a janela principal.
        # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
        # [DOC-DETAIL] on_start
        # Explicacao didatica: Callback da bandeja para iniciar o coletor pela mesma regra do botao da interface.
        # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
        def on_start(_icon, _item):
            self.root.after(0, self.start_collector)

        # [DOC-DETAIL] on_stop
        # Explicacao didatica: Callback da bandeja para parar o coletor pela mesma regra do botao da interface.
        # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
        def on_stop(_icon, _item):
            self.root.after(0, self.stop_collector)

        # [DOC-FUNC] on_quit
        # O que faz: A funcao 'on_quit' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
        # Entradas: Recebe os parametros: icon, _item. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
        # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
        # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
        # [DOC-DETAIL] on_quit
        # Explicacao didatica: Callback da bandeja para encerrar icone e fechar a aplicacao.
        # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
        # [DOC-DETAIL] run_icon
        # Explicacao didatica: Executa o loop do icone da bandeja em thread separada para nao bloquear a janela Tkinter.
        # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
        def run_icon():
            icon.run()

        self.tray_thread = threading.Thread(target=run_icon, daemon=True)
        self.tray_thread.start()

    # [DOC-FUNC] on_close
    # O que faz: A funcao 'on_close' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
    # Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
    # Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
    # Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
    # [DOC-DETAIL] on_close
    # Explicacao didatica: Ao fechar, registra estado final e encerra icone de bandeja. Nao altera dados do banco; apenas fecha o app local.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# [DOC-DETAIL] main
# Explicacao didatica: Ponto de entrada do app visual. Garante instancia unica, cria janela, agenda refresh e entra no loop Tkinter.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
    # [DOC-DETAIL] periodic_refresh
    # Explicacao didatica: Agenda atualizacao automatica de status a cada poucos segundos para a tela refletir o processo real.
    # Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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

