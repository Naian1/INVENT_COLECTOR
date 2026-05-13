# [DOC-CODEMAP] Arquivo: coletor-snmp\utils\runtime_trace.py
# [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOG_DIR = os.path.join(BASE_DIR, "logs")
TRACE_FILE = os.path.join(LOG_DIR, "collector_backend_trace.jsonl")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# [DOC-FUNC] _sanitize
# O que faz: Normaliza valores na funcao '_sanitize', reduzindo variacoes de formato antes do processamento principal.
# Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value, max_len) e trata nulos, strings vazias e tipos mistos.
# Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
# Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
def _sanitize(value: Any, max_len: int = 2400):
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value
    if isinstance(value, (dict, list)):
        try:
            text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except Exception:
            text = str(value)
    else:
        text = str(value)

    # A UI de acompanhamento lê uma linha JSON por evento.
    # Remover quebras evita quebrar o formato jsonl e facilita auditoria.
    clean = text.replace("\r", " ").replace("\n", " ").strip()
    if len(clean) <= max_len:
        return clean
    return f"{clean[:max_len].rstrip()}..."


# [DOC-FUNC] append_backend_trace
# O que faz: Orquestra a etapa 'append_backend_trace' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
# Entradas: Trabalha com os parametros declarados (event, payload) e com contexto local carregado durante a execucao.
# Como executa: Encadeia iteracao/transformacao de colecoes, tratamento explicito de excecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
# Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
def append_backend_trace(event: str, **payload: Dict[str, Any]):
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        record = {"ts": _utc_now_iso(), "event": str(event or "").strip() or "unknown"}
        for key, value in payload.items():
            record[str(key)] = _sanitize(value)
        with open(TRACE_FILE, "a", encoding="utf-8") as trace_file:
            trace_file.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        # Nao deve quebrar o coletor por falha de telemetria local.
        pass

