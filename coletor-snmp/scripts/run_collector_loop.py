import argparse
import logging
import os
import signal
import sys
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.api_client import fetch_printers_from_api, get_collector_config
from utils.cache_manager import atualizar_cache
from utils.file_manager import load_settings


STOP = False


def _handle_stop(signum, _frame):
    global STOP
    STOP = True
    logging.info("[collector-loop] Sinal recebido (%s). Encerrando com seguranca...", signum)


def _resolve_interval(cli_interval):
    if cli_interval and cli_interval > 0:
        return cli_interval

    env_interval = os.getenv("COLLECTOR_LOOP_INTERVAL", "").strip()
    if env_interval:
        try:
            parsed = int(env_interval)
            if parsed > 0:
                return parsed
        except ValueError:
            pass

    settings = load_settings()
    settings_interval = settings.get("intervalo_atualizacao")
    try:
        parsed_settings = int(settings_interval)
        if parsed_settings > 0:
            return parsed_settings
    except Exception:
        pass

    return 300


def run_loop(interval_seconds, run_once=False):
    cycle = 0
    while not STOP:
        cycle += 1
        started = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        logging.info("[collector-loop] Ciclo %s iniciado em %s", cycle, started)

        try:
            rows = atualizar_cache()
            total_rows = len(rows) if isinstance(rows, list) else 0
            logging.info("[collector-loop] Ciclo %s concluido. Linhas cache: %s", cycle, total_rows)
        except Exception as exc:
            logging.exception("[collector-loop] Erro no ciclo %s: %s", cycle, exc)

        if run_once:
            break

        sleep_for = max(5, int(interval_seconds))
        for _ in range(sleep_for):
            if STOP:
                break
            time.sleep(1)

    logging.info("[collector-loop] Finalizado.")


def main():
    parser = argparse.ArgumentParser(
        description="Executa somente o coletor (SNMP -> API) sem subir o frontend legado Flask."
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=0,
        help="Intervalo entre ciclos em segundos. Se omitido, usa COLLECTOR_LOOP_INTERVAL, depois settings.json, depois 300.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Executa apenas 1 ciclo de coleta e encerra.",
    )
    parser.add_argument(
        "--log-level",
        default=os.getenv("COLLECTOR_LOG_LEVEL", "INFO"),
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Nivel de log no terminal.",
    )
    parser.add_argument(
        "--check-connection",
        action="store_true",
        help=(
            "Valida conexao/autenticacao da fonte remota de impressoras "
            "e encerra sem coletar SNMP."
        ),
    )
    parser.add_argument(
        "--log-file",
        default=os.getenv(
            "COLLECTOR_LOG_FILE",
            os.path.join(BASE_DIR, "logs", "collector_loop_runtime.log"),
        ),
        help="Arquivo de log persistente do coletor.",
    )
    parser.add_argument(
        "--log-max-mb",
        type=int,
        default=int(os.getenv("COLLECTOR_LOG_MAX_MB", "20")),
        help="Tamanho maximo do arquivo de log antes de rotacionar.",
    )
    parser.add_argument(
        "--log-backups",
        type=int,
        default=int(os.getenv("COLLECTOR_LOG_BACKUPS", "5")),
        help="Quantidade de arquivos de backup de log.",
    )
    args = parser.parse_args()

    handlers = [logging.StreamHandler(sys.stdout)]
    if args.log_file:
        os.makedirs(os.path.dirname(args.log_file), exist_ok=True)
        handlers.append(
            RotatingFileHandler(
                args.log_file,
                maxBytes=max(1, int(args.log_max_mb)) * 1024 * 1024,
                backupCount=max(1, int(args.log_backups)),
                encoding="utf-8",
            )
        )

    logging.basicConfig(
        level=getattr(logging, str(args.log_level).upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
    )

    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)

    interval_seconds = _resolve_interval(args.interval)
    logging.info("[collector-loop] Intervalo configurado: %ss", interval_seconds)
    cfg = get_collector_config()
    logging.info("[collector-loop] API destino: %s", cfg.get("url"))
    logging.info(
        "[collector-loop] Sync impressoras: "
        f"habilitado={cfg.get('sync_printers_from_api')} "
        f"timeout={cfg.get('sync_timeout_seconds')}s "
        f"retries={cfg.get('sync_retries')} "
        f"backoff={cfg.get('sync_retry_backoff_seconds')}s"
    )
    logging.info(
        "[collector-loop] Envio telemetria: "
        f"timeout={cfg.get('timeout_seconds')}s "
        f"retries={cfg.get('telemetry_retries')} "
        f"backoff={cfg.get('telemetry_retry_backoff_seconds')}s"
    )
    logging.info(
        "[collector-loop] Replay pendentes: "
        f"habilitado={cfg.get('replay_pending')} "
        f"max_por_ciclo={cfg.get('replay_max_per_cycle')}"
    )
    filtros = cfg.get("ip_filters") or []
    logging.info("[collector-loop] Filtro de IP: %s", ", ".join(filtros) if filtros else "desativado")
    logging.info("[collector-loop] Workers paralelos: %s", cfg.get("max_workers"))
    logging.info(
        "[collector-loop] Fonte impressoras remota: %s | remoto obrigatorio=%s",
        cfg.get("printers_source"),
        cfg.get("require_remote_printers"),
    )

    if args.check_connection:
        result = fetch_printers_from_api(log_prefix="[collector-check]")
        if result.get("success"):
            logging.info(
                "[collector-check] Conexao validada com sucesso via '%s' (%s impressoras).",
                result.get("source", cfg.get("printers_source")),
                len(result.get("printers") or {}),
            )
            return 0
        logging.error(
            "[collector-check] Falha na validacao remota via '%s': %s",
            result.get("source", cfg.get("printers_source")),
            result.get("error"),
        )
        return 1

    run_loop(interval_seconds=interval_seconds, run_once=args.once)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
