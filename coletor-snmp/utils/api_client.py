import json
import logging
import os
import time
from datetime import datetime, timezone
from urllib import error, parse, request


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENV_FILE = os.path.join(BASE_DIR, ".env")
DATA_DIR = os.path.join(BASE_DIR, "data")
PENDING_QUEUE_FILE = os.path.join(DATA_DIR, "collector_pending.jsonl")
INVALID_PENDING_QUEUE_FILE = os.path.join(DATA_DIR, "collector_pending_invalid.jsonl")

_ENV_CACHE = None


def _load_env_file():
    global _ENV_CACHE
    if _ENV_CACHE is not None:
        return _ENV_CACHE

    loaded = {}
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as file:
                for line in file:
                    clean = line.strip()
                    if not clean or clean.startswith("#") or "=" not in clean:
                        continue
                    key, value = clean.split("=", 1)
                    loaded[key.strip()] = value.strip().strip('"').strip("'")
        except Exception as exc:
            logging.warning(f"Nao foi possivel carregar .env ({ENV_FILE}): {exc}")

    _ENV_CACHE = loaded
    return loaded


def _get_env(name, default_value=None):
    file_env = _load_env_file()
    return os.getenv(name) or file_env.get(name, default_value)


def _parse_list_env(raw_value):
    raw = str(raw_value or "").strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _parse_int_env(raw_value, default_value=1, min_value=1, max_value=64):
    try:
        parsed = int(str(raw_value).strip())
    except Exception:
        parsed = default_value
    return max(min_value, min(max_value, parsed))


def _parse_float_env(raw_value, default_value=1.0, min_value=0.0, max_value=300.0):
    try:
        parsed = float(str(raw_value).strip())
    except Exception:
        parsed = default_value
    return max(min_value, min(max_value, parsed))


def _parse_bool_env(raw_value, default_value=False):
    if raw_value is None:
        return default_value
    text = str(raw_value).strip().lower()
    if text in {"1", "true", "yes", "sim", "on"}:
        return True
    if text in {"0", "false", "no", "nao", "off"}:
        return False
    return default_value


def _compact_error_message(exc):
    reason = getattr(exc, "reason", None)
    base = reason if reason is not None else exc
    text = str(base or "").replace("\r", " ").replace("\n", " ").strip()
    if text.startswith("<urlopen error ") and text.endswith(">"):
        text = text[len("<urlopen error ") : -1]
    return text or str(type(exc).__name__)


def _shorten_text(text, max_len=180):
    clean = str(text or "").replace("\r", " ").replace("\n", " ").strip()
    if len(clean) <= max_len:
        return clean
    return f"{clean[:max_len].rstrip()}..."


def _extract_http_error_hint(raw_body):
    try:
        parsed = json.loads(raw_body)
    except Exception:
        return None

    if not isinstance(parsed, dict):
        return None

    erro = _clean_text_value(parsed.get("erro")) if "erro" in parsed else None
    dados = parsed.get("dados")
    detalhes = []
    if isinstance(dados, dict):
        erros = dados.get("erros")
        if isinstance(erros, list):
            for item in erros[:3]:
                if not isinstance(item, dict):
                    continue
                ingestao = _clean_text_value(item.get("ingestao_id"))
                mensagem = _clean_text_value(item.get("erro"))
                if ingestao and mensagem:
                    detalhes.append(f"{ingestao}: {mensagem}")
                elif mensagem:
                    detalhes.append(mensagem)

    hint_parts = []
    if erro:
        hint_parts.append(erro)
    if detalhes:
        hint_parts.append(" | ".join(detalhes))
    if not hint_parts:
        return None
    return _shorten_text(" :: ".join(hint_parts), max_len=900)


def _clean_text_value(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def get_collector_config():
    base_url = (_get_env("COLLECTOR_API_BASE_URL", "") or "").strip().rstrip("/")
    if base_url:
        telemetry_url = f"{base_url}/api/coletor/telemetria"
    else:
        telemetry_url = _get_env("COLLECTOR_API_URL", "http://localhost:3000/api/coletor/telemetria")
    printers_url = _get_env(
        "COLLECTOR_PRINTERS_URL",
        telemetry_url.replace("/api/coletor/telemetria", "/api/coletor/impressoras"),
    )
    sync_from_api_raw = str(_get_env("COLLECTOR_SYNC_PRINTERS_FROM_API", "true")).strip().lower()
    sync_from_api = sync_from_api_raw in {"1", "true", "yes", "sim", "on"}
    ip_filters = _parse_list_env(_get_env("COLLECTOR_IP_FILTERS", ""))
    max_workers = _parse_int_env(_get_env("COLLECTOR_MAX_WORKERS", "1"), default_value=1)

    timeout_seconds = _parse_int_env(
        _get_env("COLLECTOR_API_TIMEOUT", "8"),
        default_value=8,
        min_value=3,
        max_value=120,
    )
    sync_timeout_seconds = _parse_int_env(
        _get_env("COLLECTOR_SYNC_TIMEOUT", str(timeout_seconds)),
        default_value=timeout_seconds,
        min_value=3,
        max_value=120,
    )
    sync_retries = _parse_int_env(
        _get_env("COLLECTOR_SYNC_RETRIES", "3"),
        default_value=3,
        min_value=1,
        max_value=10,
    )
    sync_retry_backoff_seconds = _parse_float_env(
        _get_env("COLLECTOR_SYNC_RETRY_BACKOFF", "2"),
        default_value=2.0,
        min_value=0.0,
        max_value=30.0,
    )
    telemetry_retries = _parse_int_env(
        _get_env("COLLECTOR_API_RETRIES", "2"),
        default_value=2,
        min_value=1,
        max_value=10,
    )
    telemetry_retry_backoff_seconds = _parse_float_env(
        _get_env("COLLECTOR_API_RETRY_BACKOFF", "1.5"),
        default_value=1.5,
        min_value=0.0,
        max_value=30.0,
    )
    replay_pending = _parse_bool_env(_get_env("COLLECTOR_REPLAY_PENDING", "true"), default_value=True)
    replay_max_per_cycle = _parse_int_env(
        _get_env("COLLECTOR_REPLAY_MAX_PER_CYCLE", "80"),
        default_value=80,
        min_value=1,
        max_value=5000,
    )
    printers_source = str(_get_env("COLLECTOR_PRINTERS_SOURCE", "api")).strip().lower()
    if printers_source not in {"api", "supabase"}:
        printers_source = "api"
    require_remote_printers = _parse_bool_env(
        _get_env("COLLECTOR_REQUIRE_REMOTE_PRINTERS", "false"),
        default_value=False,
    )
    default_snmp_community = (_get_env("COLLECTOR_DEFAULT_SNMP_COMMUNITY", "public") or "public").strip()
    if not default_snmp_community:
        default_snmp_community = "public"
    supabase_url = (_get_env("COLLECTOR_SUPABASE_URL", "") or "").strip().rstrip("/")
    supabase_key = (_get_env("COLLECTOR_SUPABASE_KEY", "") or "").strip()
    supabase_printers_table = (
        _get_env("COLLECTOR_SUPABASE_PRINTERS_TABLE", "impressoras") or "impressoras"
    ).strip()
    if not supabase_printers_table:
        supabase_printers_table = "impressoras"

    # Filtro opcional para schema baseado em inventario (ex.: cd_tipo_equipamento=2)
    supabase_printers_filter_column = (_get_env("COLLECTOR_SUPABASE_PRINTERS_FILTER_COLUMN", "") or "").strip()
    supabase_printers_filter_value = (_get_env("COLLECTOR_SUPABASE_PRINTERS_FILTER_VALUE", "") or "").strip()

    # Compatibilidade com formato legado: COLLECTOR_SUPABASE_PRINTERS_FILTER=coluna=valor
    raw_filter = (_get_env("COLLECTOR_SUPABASE_PRINTERS_FILTER", "") or "").strip()
    if raw_filter and not (supabase_printers_filter_column and supabase_printers_filter_value):
        if "=" in raw_filter:
            parts = raw_filter.split("=", 1)
            supabase_printers_filter_column = (parts[0] or "").strip()
            supabase_printers_filter_value = (parts[1] or "").strip()

    return {
        "base_url": base_url or None,
        "url": telemetry_url,
        "printers_url": printers_url,
        "token": _get_env("COLLECTOR_API_TOKEN", ""),
        "collector_id": _get_env("COLLECTOR_ID", "collector-hgg-01"),
        "timeout_seconds": timeout_seconds,
        "sync_timeout_seconds": sync_timeout_seconds,
        "sync_retries": sync_retries,
        "sync_retry_backoff_seconds": sync_retry_backoff_seconds,
        "telemetry_retries": telemetry_retries,
        "telemetry_retry_backoff_seconds": telemetry_retry_backoff_seconds,
        "replay_pending": replay_pending,
        "replay_max_per_cycle": replay_max_per_cycle,
        "sync_printers_from_api": sync_from_api,
        "ip_filters": ip_filters,
        "max_workers": max_workers,
        "printers_source": printers_source,
        "require_remote_printers": require_remote_printers,
        "default_snmp_community": default_snmp_community,
        "supabase_url": supabase_url,
        "supabase_key": supabase_key,
        "supabase_printers_table": supabase_printers_table,
        "supabase_printers_filter_column": supabase_printers_filter_column,
        "supabase_printers_filter_value": supabase_printers_filter_value,
    }


def _normalize_remote_printers(records, default_community):
    printers = {}
    for item in records:
        if not isinstance(item, dict):
            continue
        ip = str(item.get("ip") or "").strip()
        if not ip:
            continue

        setor = item.get("setor") or item.get("local") or "Desconhecido"
        comunidade = str(item.get("comunidade") or default_community or "public").strip()
        if not comunidade:
            comunidade = "public"

        printers[ip] = {
            "local": setor,
            "patrimonio": item.get("patrimonio") or "",
            "modelo": item.get("modelo") or "Desconhecido",
            "fabricante": item.get("fabricante") or "",
            "numero_serie": item.get("numero_serie") or "",
            "hostname": item.get("hostname") or "",
            "comunidade": comunidade,
            "ativa": bool(item.get("ativa", item.get("ativo", True))),
            "ip": ip,
            "setor": setor,
            "localizacao": item.get("localizacao") or None,
        }
    return printers


def _normalize_remote_printers_from_inventario(
    records,
    default_community,
    filter_column="",
    filter_value="",
):
    printers = {}

    filter_column = str(filter_column or "").strip()
    filter_value = str(filter_value or "").strip()

    for item in records:
        if not isinstance(item, dict):
            continue

        ip = str(item.get("nr_ip") or "").strip()
        if not ip:
            continue

        equipamento = item.get("equipamento") or {}
        if not isinstance(equipamento, dict):
            equipamento = {}

        setor_data = item.get("setor") or {}
        if not isinstance(setor_data, dict):
            setor_data = {}

        if filter_column and filter_value:
            if filter_column == "cd_tipo_equipamento":
                actual_value = equipamento.get("cd_tipo_equipamento")
            else:
                actual_value = item.get(filter_column)

            if str(actual_value) != filter_value:
                continue

        setor_nome = (
            setor_data.get("nm_setor")
            or item.get("setor")
            or item.get("local")
            or "Desconhecido"
        )

        comunidade = str(item.get("comunidade") or default_community or "public").strip()
        if not comunidade:
            comunidade = "public"

        printers[ip] = {
            "local": setor_nome,
            "patrimonio": item.get("nr_patrimonio") or "",
            "modelo": equipamento.get("nm_modelo") or equipamento.get("nm_equipamento") or "Desconhecido",
            "fabricante": equipamento.get("nm_marca") or "",
            "numero_serie": item.get("nr_serie") or "",
            "hostname": item.get("hostname") or "",
            "comunidade": comunidade,
            "ativa": str(item.get("ie_situacao") or "A").upper() == "A",
            "ip": ip,
            "setor": setor_nome,
            "localizacao": setor_nome,
        }

    return printers


def _fetch_printers_via_api(config, log_prefix):
    if not config["token"]:
        msg = "COLLECTOR_API_TOKEN nao configurado. Sync de impressoras desativado."
        logging.warning(f"{log_prefix} {msg}")
        return {"success": False, "skipped": True, "error": msg, "source": "api"}

    url = config.get("printers_url")
    if not url:
        return {
            "success": False,
            "error": "COLLECTOR_PRINTERS_URL nao configurado.",
            "source": "api",
        }

    headers = {"Authorization": f"Bearer {config['token']}"}
    retries = int(config.get("sync_retries") or 1)
    sync_timeout = int(config.get("sync_timeout_seconds") or config.get("timeout_seconds") or 8)
    backoff = float(config.get("sync_retry_backoff_seconds") or 0)

    last_error = "Erro desconhecido no sync de impressoras."
    last_status_code = None

    for attempt in range(1, retries + 1):
        req = request.Request(url, headers=headers, method="GET")
        try:
            with request.urlopen(req, timeout=sync_timeout) as response:
                raw_body = response.read().decode("utf-8", errors="replace")
                parsed = json.loads(raw_body)

                if not isinstance(parsed, dict) or not parsed.get("sucesso"):
                    last_error = "Resposta invalida da API de impressoras."
                    raise ValueError(last_error)

                dados = parsed.get("dados") or {}
                impressoras_lista = dados.get("impressoras") if isinstance(dados, dict) else None
                if not isinstance(impressoras_lista, list):
                    last_error = "Lista de impressoras ausente na resposta."
                    raise ValueError(last_error)

                printers = _normalize_remote_printers(
                    impressoras_lista,
                    default_community=config.get("default_snmp_community", "public"),
                )

                if attempt > 1:
                    logging.info("%s Sync recuperado na tentativa %s/%s.", log_prefix, attempt, retries)
                logging.info("%s Lista de impressoras sincronizada (%s registros).", log_prefix, len(printers))
                return {
                    "success": True,
                    "printers": printers,
                    "status_code": response.status,
                    "source": "api",
                }

        except error.HTTPError as http_err:
            error_body = _shorten_text(http_err.read().decode("utf-8", errors="replace").strip())
            last_status_code = http_err.code
            body_suffix = f": {error_body}" if error_body else ""
            last_error = f"HTTP {http_err.code}{body_suffix}"
            is_final = attempt >= retries or http_err.code < 500
            if is_final:
                logging.error("%s Sync tentativa %s/%s falhou: %s", log_prefix, attempt, retries, last_error)
            else:
                logging.warning(
                    "%s Sync tentativa %s/%s falhou: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )
            if http_err.code < 500:
                break

        except (error.URLError, TimeoutError) as conn_err:
            last_error = f"Erro de conexao/timeout: {_compact_error_message(conn_err)}"
            if attempt >= retries:
                logging.error("%s Sync tentativa %s/%s falhou: %s", log_prefix, attempt, retries, last_error)
            else:
                logging.warning(
                    "%s Sync tentativa %s/%s falhou: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )

        except Exception as exc:
            last_error = f"Falha inesperada no sync: {_compact_error_message(exc)}"
            if attempt >= retries:
                logging.error("%s Sync tentativa %s/%s falhou: %s", log_prefix, attempt, retries, last_error)
            else:
                logging.warning(
                    "%s Sync tentativa %s/%s falhou: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )

        if attempt < retries and backoff > 0:
            time.sleep(backoff * attempt)

    return {"success": False, "status_code": last_status_code, "error": last_error, "source": "api"}


def _fetch_printers_via_supabase(config, log_prefix):
    supabase_url = str(config.get("supabase_url") or "").strip().rstrip("/")
    supabase_key = str(config.get("supabase_key") or "").strip()
    table_name = str(config.get("supabase_printers_table") or "impressoras").strip()
    filter_column = str(config.get("supabase_printers_filter_column") or "").strip()
    filter_value = str(config.get("supabase_printers_filter_value") or "").strip()

    if not supabase_url:
        return {
            "success": False,
            "error": "COLLECTOR_SUPABASE_URL nao configurado.",
            "source": "supabase",
        }
    if not supabase_key:
        return {
            "success": False,
            "error": "COLLECTOR_SUPABASE_KEY nao configurado.",
            "source": "supabase",
        }

    table_encoded = parse.quote(table_name, safe="")
    inventory_mode = table_name.lower() == "inventario"

    if inventory_mode:
        select_fields = parse.quote(
            "nr_inventario,nr_ip,nr_patrimonio,nr_serie,ie_situacao,cd_setor,"
            "equipamento:cd_equipamento(cd_tipo_equipamento,nm_marca,nm_modelo,nm_equipamento),"
            "setor:cd_setor(nm_setor)"
        )
        # Para schema Daniel/public: inventario guarda IP/patrimonio/serie,
        # equipamento guarda tipo/modelo/marca, setor guarda localização.
        url = (
            f"{supabase_url}/rest/v1/{table_encoded}"
            f"?select={select_fields}&nr_ip=not.is.null&ie_situacao=eq.A"
        )
    else:
        select_fields = parse.quote(
            "id,ip,patrimonio,modelo,fabricante,numero_serie,hostname,setor,localizacao,ativo"
        )
        url = f"{supabase_url}/rest/v1/{table_encoded}?select={select_fields}&ativo=eq.true"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json",
    }

    retries = int(config.get("sync_retries") or 1)
    sync_timeout = int(config.get("sync_timeout_seconds") or config.get("timeout_seconds") or 8)
    backoff = float(config.get("sync_retry_backoff_seconds") or 0)

    last_error = "Erro desconhecido no sync de impressoras via Supabase."
    last_status_code = None

    for attempt in range(1, retries + 1):
        req = request.Request(url, headers=headers, method="GET")
        try:
            with request.urlopen(req, timeout=sync_timeout) as response:
                raw_body = response.read().decode("utf-8", errors="replace")
                parsed = json.loads(raw_body)
                if not isinstance(parsed, list):
                    last_error = "Resposta invalida do Supabase (esperado array)."
                    raise ValueError(last_error)

                if inventory_mode:
                    printers = _normalize_remote_printers_from_inventario(
                        parsed,
                        default_community=config.get("default_snmp_community", "public"),
                        filter_column=filter_column,
                        filter_value=filter_value,
                    )
                else:
                    printers = _normalize_remote_printers(
                        parsed,
                        default_community=config.get("default_snmp_community", "public"),
                    )
                if attempt > 1:
                    logging.info("%s Sync recuperado na tentativa %s/%s.", log_prefix, attempt, retries)
                logging.info(
                    "%s Lista de impressoras sincronizada via Supabase (%s registros).",
                    log_prefix,
                    len(printers),
                )
                return {
                    "success": True,
                    "printers": printers,
                    "status_code": response.status,
                    "source": "supabase",
                }

        except error.HTTPError as http_err:
            error_body = _shorten_text(http_err.read().decode("utf-8", errors="replace").strip())
            last_status_code = http_err.code
            body_suffix = f": {error_body}" if error_body else ""
            last_error = f"HTTP {http_err.code}{body_suffix}"
            is_final = attempt >= retries or http_err.code < 500
            if is_final:
                logging.error("%s Sync tentativa %s/%s falhou: %s", log_prefix, attempt, retries, last_error)
            else:
                logging.warning(
                    "%s Sync tentativa %s/%s falhou: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )
            if http_err.code < 500:
                break

        except (error.URLError, TimeoutError) as conn_err:
            last_error = f"Erro de conexao/timeout: {_compact_error_message(conn_err)}"
            if attempt >= retries:
                logging.error("%s Sync tentativa %s/%s falhou: %s", log_prefix, attempt, retries, last_error)
            else:
                logging.warning(
                    "%s Sync tentativa %s/%s falhou: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )

        except Exception as exc:
            last_error = f"Falha inesperada no sync: {_compact_error_message(exc)}"
            if attempt >= retries:
                logging.error("%s Sync tentativa %s/%s falhou: %s", log_prefix, attempt, retries, last_error)
            else:
                logging.warning(
                    "%s Sync tentativa %s/%s falhou: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )

        if attempt < retries and backoff > 0:
            time.sleep(backoff * attempt)

    return {
        "success": False,
        "status_code": last_status_code,
        "error": last_error,
        "source": "supabase",
    }


def fetch_printers_from_api(log_prefix="[collector-api]"):
    config = get_collector_config()
    source = str(config.get("printers_source") or "api").strip().lower()

    if source == "supabase":
        supabase_result = _fetch_printers_via_supabase(config=config, log_prefix=log_prefix)
        if supabase_result.get("success"):
            return supabase_result

        status_code = supabase_result.get("status_code")
        should_fallback = status_code in {401, 403} or not status_code
        if should_fallback:
            logging.warning(
                "%s Falha no sync via Supabase (%s). Tentando fallback via API protegida.",
                log_prefix,
                supabase_result.get("error"),
            )
            api_result = _fetch_printers_via_api(config=config, log_prefix=log_prefix)
            if api_result.get("success"):
                return api_result

            return {
                "success": False,
                "source": "supabase->api",
                "status_code": api_result.get("status_code") or status_code,
                "error": (
                    "Falha no sync de impressoras. "
                    f"Supabase: {supabase_result.get('error')} | "
                    f"API: {api_result.get('error')}"
                ),
            }

        return supabase_result
    return _fetch_printers_via_api(config=config, log_prefix=log_prefix)


def _queue_pending_payload(payload, reason):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        record = {
            "queued_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
            "payload": payload,
        }
        with open(PENDING_QUEUE_FILE, "a", encoding="utf-8") as queue_file:
            queue_file.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as exc:
        logging.error(f"Falha ao salvar payload pendente: {exc}")


def _archive_invalid_pending_record(record, reason):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        archived = {
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
            "record": record,
        }
        with open(INVALID_PENDING_QUEUE_FILE, "a", encoding="utf-8") as queue_file:
            queue_file.write(json.dumps(archived, ensure_ascii=False) + "\n")
    except Exception as exc:
        logging.error("Falha ao arquivar pendencia invalida: %s", exc)


def _extract_ingestao_id(payload):
    ingestao_id = None
    if isinstance(payload, dict):
        eventos = payload.get("eventos")
        if isinstance(eventos, list) and eventos:
            primeiro = eventos[0]
            if isinstance(primeiro, dict):
                ingestao_id = primeiro.get("ingestao_id")
        if ingestao_id is None:
            ingestao_id = payload.get("ingestao_id") or payload.get("ingest_id")
    return ingestao_id


def send_telemetry_payload(payload, log_prefix="[collector-api]", queue_on_failure=True):
    config = get_collector_config()

    if not config["token"]:
        msg = "COLLECTOR_API_TOKEN nao configurado. Envio externo desativado."
        logging.warning(f"{log_prefix} {msg}")
        return {"success": False, "skipped": True, "error": msg}

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config['token']}",
    }

    req = request.Request(config["url"], data=body, headers=headers, method="POST")
    retries = int(config.get("telemetry_retries") or 1)
    backoff = float(config.get("telemetry_retry_backoff_seconds") or 0)

    ingestao_id = _extract_ingestao_id(payload)

    last_error = "Falha desconhecida ao enviar telemetria."
    last_status_code = None

    for attempt in range(1, retries + 1):
        req = request.Request(config["url"], data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=config["timeout_seconds"]) as response:
                raw_body = response.read().decode("utf-8", errors="replace")
                try:
                    parsed = json.loads(raw_body)
                except json.JSONDecodeError:
                    parsed = {"raw_response": raw_body}

                if attempt > 1:
                    logging.info(
                        "%s Envio recuperado na tentativa %s/%s (ingestao_id=%s).",
                        log_prefix,
                        attempt,
                        retries,
                        ingestao_id,
                    )
                logging.info(
                    "%s Telemetria enviada (status=%s, ingestao_id=%s).",
                    log_prefix,
                    response.status,
                    ingestao_id,
                )
                return {
                    "success": True,
                    "status_code": response.status,
                    "response": parsed,
                }

        except error.HTTPError as http_err:
            raw_error_body = http_err.read().decode("utf-8", errors="replace").strip()
            error_body = _shorten_text(raw_error_body)
            last_status_code = http_err.code
            body_suffix = f": {error_body}" if error_body else ""
            last_error = f"HTTP {http_err.code}{body_suffix}"
            if http_err.code == 422:
                hint = _extract_http_error_hint(raw_error_body)
                if hint:
                    logging.error("%s Detalhe 422: %s", log_prefix, hint)
            is_final = attempt >= retries or http_err.code < 500
            if is_final:
                logging.error(
                    "%s Falha no envio (tentativa %s/%s): %s",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )
            else:
                logging.warning(
                    "%s Tentativa %s/%s falhou no envio: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )
            if http_err.code < 500:
                break

        except (error.URLError, TimeoutError) as conn_err:
            last_error = f"Erro de conexao/timeout: {_compact_error_message(conn_err)}"
            if attempt >= retries:
                logging.error(
                    "%s Falha no envio (tentativa %s/%s): %s",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )
            else:
                logging.warning(
                    "%s Tentativa %s/%s falhou no envio: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )

        except Exception as exc:
            last_error = f"Falha inesperada no envio: {_compact_error_message(exc)}"
            if attempt >= retries:
                logging.error(
                    "%s Falha no envio (tentativa %s/%s): %s",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )
            else:
                logging.warning(
                    "%s Tentativa %s/%s falhou no envio: %s. Tentando novamente.",
                    log_prefix,
                    attempt,
                    retries,
                    last_error,
                )

        if attempt < retries and backoff > 0:
            time.sleep(backoff * attempt)

    if queue_on_failure:
        _queue_pending_payload(payload, last_error)
    return {"success": False, "status_code": last_status_code, "error": last_error}


def replay_pending_payloads(max_items=None, log_prefix="[collector-replay]"):
    if not os.path.exists(PENDING_QUEUE_FILE):
        return {"success": True, "processed": 0, "sent": 0, "remaining": 0}

    try:
        with open(PENDING_QUEUE_FILE, "r", encoding="utf-8") as queue_file:
            raw_lines = queue_file.readlines()
    except Exception as exc:
        logging.error("%s Falha ao ler fila pendente: %s", log_prefix, exc)
        return {"success": False, "error": str(exc), "processed": 0, "sent": 0}

    if not raw_lines:
        return {"success": True, "processed": 0, "sent": 0, "remaining": 0}

    pending_records = []
    for line in raw_lines:
        clean = line.strip()
        if not clean:
            continue
        try:
            pending_records.append(json.loads(clean))
        except Exception:
            # Preserva linhas corrompidas para inspeção manual.
            pending_records.append({"_raw_line": clean, "_invalid": True})

    limit = len(pending_records) if not max_items else max(1, int(max_items))
    processed = 0
    sent = 0
    dropped_client_error = 0
    dropped_invalid = 0
    kept_records = []

    for idx, record in enumerate(pending_records, start=1):
        if idx > limit:
            kept_records.append(record)
            continue

        processed += 1
        payload = record.get("payload") if isinstance(record, dict) else None
        if not isinstance(payload, dict):
            dropped_invalid += 1
            _archive_invalid_pending_record(
                record,
                reason="registro pendente sem payload JSON valido",
            )
            logging.warning(
                "%s Registro pendente invalido foi arquivado e removido da fila.",
                log_prefix,
            )
            continue

        ingestao_id = _extract_ingestao_id(payload)
        result = send_telemetry_payload(
            payload,
            log_prefix=f"{log_prefix}:{ingestao_id or 'sem-id'}",
            queue_on_failure=False,
        )
        if result.get("success"):
            sent += 1
        else:
            status_code = result.get("status_code")
            is_non_retryable_client_error = (
                isinstance(status_code, int)
                and 400 <= status_code < 500
                and status_code != 429
            )
            if is_non_retryable_client_error:
                dropped_client_error += 1
                logging.warning(
                    "%s:%s Removendo pendencia nao-retryable (HTTP %s).",
                    log_prefix,
                    ingestao_id or "sem-id",
                    status_code,
                )
            else:
                kept_records.append(record)

    try:
        if kept_records:
            with open(PENDING_QUEUE_FILE, "w", encoding="utf-8") as queue_file:
                for record in kept_records:
                    queue_file.write(json.dumps(record, ensure_ascii=False) + "\n")
        else:
            with open(PENDING_QUEUE_FILE, "w", encoding="utf-8") as queue_file:
                queue_file.write("")
    except Exception as exc:
        logging.error("%s Falha ao atualizar fila pendente: %s", log_prefix, exc)
        return {
            "success": False,
            "processed": processed,
            "sent": sent,
            "remaining": len(kept_records),
            "error": str(exc),
        }

    remaining = len(kept_records)
    if processed > 0:
        logging.info(
            "%s Replay pendentes: processados=%s enviados=%s descartados_4xx=%s descartados_invalidos=%s restantes=%s",
            log_prefix,
            processed,
            sent,
            dropped_client_error,
            dropped_invalid,
            remaining,
        )
    return {
        "success": True,
        "processed": processed,
        "sent": sent,
        "dropped_client_error": dropped_client_error,
        "dropped_invalid": dropped_invalid,
        "remaining": remaining,
    }
