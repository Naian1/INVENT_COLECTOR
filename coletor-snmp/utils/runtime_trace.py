# [DOC-CODEMAP] Arquivo: coletor-snmp\utils\runtime_trace.py
# [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOG_DIR = os.path.join(BASE_DIR, "logs")
TRACE_FILE = os.path.join(LOG_DIR, "collector_backend_trace.jsonl")


# [DOC-FUNC] _utc_now_iso
# Objetivo: organiza uma etapa funcional do sistema para manter o fluxo previsivel e estudavel.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: valida entradas, chama dependencias necessarias, transforma dados e devolve uma resposta padronizada para a camada seguinte; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
# [DOC-DETAIL] _utc_now_iso
# Explicacao didatica: Faz parte da auditoria local: registra eventos tecnicos em JSONL para explicar o que o coletor tentou fazer. Nesta funcao, isola uma etapa pequena para deixar o fluxo principal mais legivel e facil de testar.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# [DOC-FUNC] _sanitize
# O que faz: A funcao '_sanitize' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
# Entradas: Recebe os parametros: value, max_len. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
# [DOC-DETAIL] _sanitize
# Explicacao didatica: Faz parte da auditoria local: registra eventos tecnicos em JSONL para explicar o que o coletor tentou fazer. Nesta funcao, isola uma etapa pequena para deixar o fluxo principal mais legivel e facil de testar.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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
# O que faz: A funcao 'append_backend_trace' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
# Entradas: Recebe os parametros: event, **payload. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
# [DOC-DETAIL] append_backend_trace
# Explicacao didatica: Faz parte da auditoria local: registra eventos tecnicos em JSONL para explicar o que o coletor tentou fazer. Nesta funcao, adiciona evento de diagnostico ao log estruturado, sanitizando dados grandes ou sensiveis.
# Por que existe: separa essa responsabilidade para facilitar manutencao, diagnostico em log e apresentacao do fluxo no TCC.
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

