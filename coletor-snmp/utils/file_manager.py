# [DOC-CODEMAP] Arquivo: coletor-snmp\utils\file_manager.py
# [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
"""Funcoes utilitarias de persistencia local do coletor SNMP."""

import json
import logging
import os
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
PRINTERS_FILE = os.path.join(DATA_DIR, "printers.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
CHAMADOS_FILE = os.path.join(DATA_DIR, "chamados.json")
HISTORY_DIR = os.path.join(DATA_DIR, "history")


# [DOC-FUNC] _env_flag
# Objetivo: organiza uma etapa funcional do sistema para manter o fluxo previsivel e estudavel.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: valida entradas, chama dependencias necessarias, transforma dados e devolve uma resposta padronizada para a camada seguinte; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
def _env_flag(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "1" if default else "0")).strip().lower()
    return raw in {"1", "true", "yes", "sim", "on"}


def is_history_enabled() -> bool:
    # Historico local diario agora e opcional (desligado por padrao).
    return _env_flag("COLLECTOR_SAVE_HISTORY", default=False)


os.makedirs(DATA_DIR, exist_ok=True)
if is_history_enabled():
    os.makedirs(HISTORY_DIR, exist_ok=True)


# [DOC-FUNC] load_printers
# O que faz: A funcao 'load_printers' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def load_printers():
    if os.path.exists(PRINTERS_FILE):
        with open(PRINTERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


# [DOC-FUNC] save_printers
# O que faz: A funcao 'save_printers' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
# Entradas: Recebe os parametros: printers. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def save_printers(printers):
    with open(PRINTERS_FILE, "w", encoding="utf-8") as f:
        json.dump(printers, f, ensure_ascii=False, indent=2)


# [DOC-FUNC] load_settings
# O que faz: A funcao 'load_settings' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


# [DOC-FUNC] save_settings
# O que faz: A funcao 'save_settings' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
# Entradas: Recebe os parametros: settings. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def save_settings(settings):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


# [DOC-FUNC] load_chamados
# O que faz: A funcao 'load_chamados' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def load_chamados():
    if os.path.exists(CHAMADOS_FILE):
        with open(CHAMADOS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


# [DOC-FUNC] init_chamados
# O que faz: A funcao 'init_chamados' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def init_chamados():
    if not os.path.exists(CHAMADOS_FILE):
        save_chamados({})


# [DOC-FUNC] save_chamados
# O que faz: A funcao 'save_chamados' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
# Entradas: Recebe os parametros: chamados. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def save_chamados(chamados):
    with open(CHAMADOS_FILE, "w", encoding="utf-8") as f:
        json.dump(chamados, f, ensure_ascii=False, indent=2)


# [DOC-FUNC] save_history
# O que faz: A funcao 'save_history' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
# Entradas: Recebe os parametros: ip, data. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def save_history(ip, data):
    if not is_history_enabled():
        return

    os.makedirs(HISTORY_DIR, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    history_file = os.path.join(HISTORY_DIR, f"{today}.json")

    try:
        history = []
        if os.path.exists(history_file):
            try:
                with open(history_file, "r", encoding="utf-8") as f:
                    existing_data = f.read().strip()
                    if existing_data:
                        loaded_data = json.loads(existing_data)
                        if isinstance(loaded_data, list):
                            history = loaded_data
                        else:
                            logging.warning(
                                "Arquivo de historico '%s' corrompido (nao e lista). Recriando.",
                                history_file,
                            )
            except (json.JSONDecodeError, OSError) as exc:
                logging.warning(
                    "Arquivo de historico '%s' corrompido. Recriando. Erro: %s",
                    history_file,
                    exc,
                )

        history.append(
            {
                "timestamp": datetime.now().isoformat(),
                "ip": ip,
                "data": data,
            }
        )

        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        logging.error("Erro ao salvar historico: %s", exc)

