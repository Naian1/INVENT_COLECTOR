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


def _env_flag(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "1" if default else "0")).strip().lower()
    return raw in {"1", "true", "yes", "sim", "on"}


def is_history_enabled() -> bool:
    # Historico local diario agora e opcional (desligado por padrao).
    return _env_flag("COLLECTOR_SAVE_HISTORY", default=False)


os.makedirs(DATA_DIR, exist_ok=True)
if is_history_enabled():
    os.makedirs(HISTORY_DIR, exist_ok=True)


def load_printers():
    if os.path.exists(PRINTERS_FILE):
        with open(PRINTERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_printers(printers):
    with open(PRINTERS_FILE, "w", encoding="utf-8") as f:
        json.dump(printers, f, ensure_ascii=False, indent=2)


def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_settings(settings):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


def load_chamados():
    if os.path.exists(CHAMADOS_FILE):
        with open(CHAMADOS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def init_chamados():
    if not os.path.exists(CHAMADOS_FILE):
        save_chamados({})


def save_chamados(chamados):
    with open(CHAMADOS_FILE, "w", encoding="utf-8") as f:
        json.dump(chamados, f, ensure_ascii=False, indent=2)


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
