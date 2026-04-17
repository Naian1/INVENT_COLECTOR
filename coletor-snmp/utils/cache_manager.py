import json
import ipaddress
import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .api_client import (
    fetch_printers_from_api,
    get_collector_config,
    replay_pending_payloads,
    send_telemetry_payload,
)
from .file_manager import (
    load_chamados,
    load_printers,
    load_settings,
    save_chamados,
    save_history,
    save_printers,
)
from .snmp_client import snmp_get, snmp_walk
from .telemetry_mapper import build_collector_payload, infer_supply_status, make_supply_key

# OIDs SNMP - supplies
OID_SUPPLY_DESCRIPTION_BASE = "1.3.6.1.2.1.43.11.1.1.6.1"
OID_SUPPLY_MAX_BASE = "1.3.6.1.2.1.43.11.1.1.8.1"
OID_SUPPLY_CURRENT_BASE = "1.3.6.1.2.1.43.11.1.1.9.1"

# OIDs SNMP - page counters
OID_PAGE_TOTAL_STANDARD = "1.3.6.1.2.1.43.10.2.1.4.1.1"

# Lexmark private counters (validated on 10.6.0.18)
OID_LEXMARK_MONO_SIDES_PRINTED = "1.3.6.1.4.1.641.6.4.2.1.1.4.1.3"
OID_LEXMARK_MONO_SIDES_PRINTED_ALT = "1.3.6.1.4.1.641.6.4.2.1.1.4.1.23"
OID_LEXMARK_SELECTED_SIDES = "1.3.6.1.4.1.641.6.4.2.1.1.4.1.1"
OID_LEXMARK_MEDIA_COUNT = "1.3.6.1.4.1.641.6.4.2.1.1.4.1.5"

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE_FILE = os.path.join(BASE_DIR, "dados_cache.json")
SUPPLY_SPECIAL_VALUES = {-1, -2, -3}


def _utc_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
def _ip_passes_filter(ip: str, rule: str) -> bool:
    candidate_ip = str(ip or "").strip()
    candidate_rule = str(rule or "").strip()
    if not candidate_ip or not candidate_rule:
        return False
    if "/" in candidate_rule:
        try:
            return ipaddress.ip_address(candidate_ip) in ipaddress.ip_network(
                candidate_rule,
                strict=False,
            )
        except ValueError:
            return False
    return candidate_ip.startswith(candidate_rule)
def _filter_printers_by_ip(printers: Dict[str, Any], ip_filters: List[str]) -> Dict[str, Any]:
    if not ip_filters:
        return printers
    filtered: Dict[str, Any] = {}
    for ip, info in printers.items():
        if any(_ip_passes_filter(ip, rule) for rule in ip_filters):
            filtered[ip] = info
    logging.info(
        "Filtro de IP ativo (%s). Impressoras elegiveis: %s de %s.",
        ", ".join(ip_filters),
        len(filtered),
        len(printers),
    )
    return filtered


def _safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text))
    except Exception:
        return None


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _detect_printer_family(info: Dict[str, Any]) -> str:
    model = _normalize_text(info.get("modelo") or info.get("model"))
    manufacturer = _normalize_text(info.get("fabricante") or info.get("manufacturer"))

    if "lexmark" in model or "lexmark" in manufacturer:
        return "lexmark"

    if model.startswith(("m", "xm", "cx", "ms")):
        return "lexmark"

    if "ricoh" in model or "ricoh" in manufacturer:
        return "ricoh"

    return "default"


def _oid_suffix(oid_base: str, full_oid: str) -> str:
    prefix = f"{oid_base}."
    if full_oid.startswith(prefix):
        return full_oid[len(prefix):]
    return full_oid


def _index_sort_key(index: str):
    parts = []
    for chunk in index.split("."):
        if chunk.isdigit():
            parts.append((0, int(chunk)))
        else:
            parts.append((1, chunk))
    return parts


def _build_oid_map(entries: List[Dict[str, Any]], oid_base: str) -> Dict[str, Dict[str, Any]]:
    mapping: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        full_oid = str(entry.get("oid") or "")
        if not full_oid:
            continue
        index = _oid_suffix(oid_base, full_oid)
        mapping[index] = {
            "oid": full_oid,
            "value": entry.get("value"),
        }
    return mapping


def traduz_suprimento(nome: str) -> str:
    traducao = {
        "Black Toner": "Toner Preto",
        "Cyan Toner": "Toner Ciano",
        "Magenta Toner": "Toner Magenta",
        "Yellow Toner": "Toner Amarelo",
        "Black Cartridge": "Cartucho Preto",
        "Cyan Cartridge": "Cartucho Ciano",
        "Magenta Cartridge": "Cartucho Magenta",
        "Yellow Cartridge": "Cartucho Amarelo",
        "Fuser": "Fusor",
        "Waste Toner": "Tonel de Residuo",
        "Maintenance Kit": "Kit de Manutencao",
        "Imaging Unit": "Unidade de Imagem",
        "Drum": "Cilindro",
        "Belt": "Correia",
    }

    nome_str = str(nome or "")
    for termo_ing, termo_pt in traducao.items():
        if termo_ing.lower() in nome_str.lower():
            return termo_pt
    return nome_str or "Desconhecido"


def _interpret_supply_level(raw_current: Optional[int], raw_max: Optional[int]) -> Dict[str, Any]:
    if raw_current is None:
        return {
            "level_percent": None,
            "confidence": "none",
            "reason": "missing_current",
        }

    if raw_max is None:
        return {
            "level_percent": None,
            "confidence": "none",
            "reason": "missing_max",
        }

    if raw_current in SUPPLY_SPECIAL_VALUES:
        return {
            "level_percent": None,
            "confidence": "none",
            "reason": f"special_current_{raw_current}",
        }

    if raw_max in SUPPLY_SPECIAL_VALUES or raw_max <= 0:
        return {
            "level_percent": None,
            "confidence": "none",
            "reason": f"invalid_max_{raw_max}",
        }

    if raw_current < 0:
        return {
            "level_percent": None,
            "confidence": "none",
            "reason": f"invalid_current_{raw_current}",
        }

    percent = round((raw_current / raw_max) * 100)
    confidence = "high"
    reason = "ratio_current_over_max"

    if raw_current > raw_max:
        confidence = "low"
        reason = "current_greater_than_max"

    percent = max(0, min(100, percent))
    return {
        "level_percent": percent,
        "confidence": confidence,
        "reason": reason,
    }


def _resolve_page_counter(ip: str, info: Dict[str, Any], community_str: str) -> Dict[str, Any]:
    family = _detect_printer_family(info)

    strategies = {
        "lexmark": [
            {
                "counter_name": "lexmark_mono_sides_printed",
                "oid": OID_LEXMARK_MONO_SIDES_PRINTED,
                "confidence": "high",
            },
            {
                "counter_name": "lexmark_mono_sides_printed_alt",
                "oid": OID_LEXMARK_MONO_SIDES_PRINTED_ALT,
                "confidence": "high",
            },
            {
                "counter_name": "printer_mib_prtMarkerLifeCount_fallback",
                "oid": OID_PAGE_TOTAL_STANDARD,
                "confidence": "low",
            },
        ],
        "ricoh": [
            {
                "counter_name": "printer_mib_prtMarkerLifeCount",
                "oid": OID_PAGE_TOTAL_STANDARD,
                "confidence": "medium",
            }
        ],
        "default": [
            {
                "counter_name": "printer_mib_prtMarkerLifeCount",
                "oid": OID_PAGE_TOTAL_STANDARD,
                "confidence": "medium",
            }
        ],
    }

    candidates = strategies.get(family, strategies["default"])
    diagnostics: List[Dict[str, Any]] = []

    selected_value = None
    selected_meta = None

    for candidate in candidates:
        response = snmp_get(candidate["oid"], ip, community_str)
        raw_value = response.get("value") if response.get("ok") else None
        parsed = _safe_int(raw_value)

        diagnostics.append(
            {
                "counter_name": candidate["counter_name"],
                "oid": candidate["oid"],
                "raw_value": raw_value,
                "parsed_value": parsed,
                "ok": bool(response.get("ok")),
                "error": response.get("error"),
                "confidence": candidate["confidence"],
            }
        )

        if parsed is not None and parsed >= 0 and selected_value is None:
            selected_value = parsed
            selected_meta = candidate

    if family == "lexmark":
        for name, oid in [
            ("lexmark_selected_sides", OID_LEXMARK_SELECTED_SIDES),
            ("lexmark_media_count", OID_LEXMARK_MEDIA_COUNT),
        ]:
            response = snmp_get(oid, ip, community_str)
            raw_value = response.get("value") if response.get("ok") else None
            diagnostics.append(
                {
                    "counter_name": name,
                    "oid": oid,
                    "raw_value": raw_value,
                    "parsed_value": _safe_int(raw_value),
                    "ok": bool(response.get("ok")),
                    "error": response.get("error"),
                    "confidence": "diagnostic",
                }
            )

    result = {
        "family": family,
        "page_count_total": selected_value,
        "counter_name": selected_meta["counter_name"] if selected_meta else None,
        "counter_oid": selected_meta["oid"] if selected_meta else None,
        "counter_confidence": selected_meta["confidence"] if selected_meta else "none",
        "diagnostics": diagnostics,
    }

    logging.debug(
        "[page-debug] ip=%s family=%s selected_counter=%s oid=%s value=%s",
        ip,
        family,
        result["counter_name"],
        result["counter_oid"],
        result["page_count_total"],
    )

    return result


def _collect_supply_rows(
    ip: str,
    local: str,
    info: Dict[str, Any],
    total_prints: Optional[int],
    desc_entries: List[Dict[str, Any]],
    max_entries: List[Dict[str, Any]],
    curr_entries: List[Dict[str, Any]],
    chamados: Dict[str, Any],
    source_tag: str,
    chamados_lock: Optional[threading.Lock] = None,
) -> Dict[str, Any]:
    desc_map = _build_oid_map(desc_entries, OID_SUPPLY_DESCRIPTION_BASE)
    max_map = _build_oid_map(max_entries, OID_SUPPLY_MAX_BASE)
    curr_map = _build_oid_map(curr_entries, OID_SUPPLY_CURRENT_BASE)

    cache_rows: List[Dict[str, Any]] = []
    payload_supplies: List[Dict[str, Any]] = []

    for index in sorted(desc_map.keys(), key=_index_sort_key):
        desc_item = desc_map[index]
        max_item = max_map.get(index)
        curr_item = curr_map.get(index)

        raw_name = str(desc_item.get("value") or "Desconhecido")
        nome_traduzido = traduz_suprimento(raw_name)

        raw_current_value = curr_item.get("value") if curr_item else None
        raw_max_value = max_item.get("value") if max_item else None
        raw_current_int = _safe_int(raw_current_value)
        raw_max_int = _safe_int(raw_max_value)

        interpreted = _interpret_supply_level(raw_current_int, raw_max_int)
        level_percent = interpreted["level_percent"]
        supply_status = infer_supply_status(
            level_percent,
            "online",
            raw_current=raw_current_int,
            raw_max=raw_max_int,
            confidence=interpreted["confidence"],
        )

        chamado_key = f"{ip}_{nome_traduzido}"
        if level_percent is not None and level_percent >= 95:
            if chamados_lock:
                with chamados_lock:
                    if chamado_key in chamados:
                        logging.info(
                            "Suprimento '%s' da impressora %s foi trocado. Removendo chamado '%s'.",
                            nome_traduzido,
                            ip,
                            chamados[chamado_key]["numero"],
                        )
                        del chamados[chamado_key]
                        save_chamados(chamados)
            elif chamado_key in chamados:
                logging.info(
                    "Suprimento '%s' da impressora %s foi trocado. Removendo chamado '%s'.",
                    nome_traduzido,
                    ip,
                    chamados[chamado_key]["numero"],
                )
                del chamados[chamado_key]
                save_chamados(chamados)

        nivel_cache = level_percent if level_percent is not None else -1

        row = {
            "ip": ip,
            "local": local,
            "patrimonio": info.get("patrimonio", ""),
            "modelo": info.get("modelo", "Desconhecido"),
            "suprimento": nome_traduzido,
            "nivel": nivel_cache,
            "restante": "Desconhecido",
            "total_impressos": total_prints if total_prints is not None else 0,
            "ultima_atualizacao": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "online",
            "coleta_origem": source_tag,
            "raw_supply_name": raw_name,
            "raw_supply_oid": curr_item.get("oid") if curr_item else None,
            "raw_supply_value": raw_current_int,
            "raw_supply_max": raw_max_int,
            "raw_supply_max_oid": max_item.get("oid") if max_item else None,
            "supply_interpretation_reason": interpreted["reason"],
            "supply_interpretation_confidence": interpreted["confidence"],
            "supply_status": supply_status,
        }
        cache_rows.append(row)

        payload_supplies.append(
            {
                "supply_key": make_supply_key(nome_traduzido),
                "supply_name": nome_traduzido,
                "level_percent": level_percent,
                "supply_status": supply_status,
                "raw_value": raw_current_int,
                "raw_oid": curr_item.get("oid") if curr_item else None,
                "raw_name": raw_name,
                "raw_payload": {
                    "source": source_tag,
                    "raw_value": raw_current_int,
                    "raw_oid": curr_item.get("oid") if curr_item else None,
                    "raw_name": raw_name,
                    "raw_max_value": raw_max_int,
                    "raw_max_oid": max_item.get("oid") if max_item else None,
                    "raw_description_oid": desc_item.get("oid"),
                    "interpretation_reason": interpreted["reason"],
                    "interpretation_confidence": interpreted["confidence"],
                },
            }
        )

        logging.debug(
            "[supplies-debug] ip=%s source=%s idx=%s raw_name=%s descr_oid=%s curr_oid=%s curr_raw=%s max_oid=%s max_raw=%s level=%s status=%s key=%s reason=%s confidence=%s",
            ip,
            source_tag,
            index,
            raw_name,
            desc_item.get("oid"),
            curr_item.get("oid") if curr_item else None,
            raw_current_int,
            max_item.get("oid") if max_item else None,
            raw_max_int,
            level_percent,
            supply_status,
            make_supply_key(nome_traduzido),
            interpreted["reason"],
            interpreted["confidence"],
        )

        save_history(
            ip,
            {
                "suprimento": nome_traduzido,
                "nivel": nivel_cache,
                "total_impressos": total_prints if total_prints is not None else 0,
            },
        )

    return {
        "cache_rows": cache_rows,
        "payload_supplies": payload_supplies,
    }


def collect_printer_snapshot(
    ip: str,
    info: Dict[str, Any],
    community_str: str = "public",
    chamados: Optional[Dict[str, Any]] = None,
    source_tag: str = "snmp_real",
    chamados_lock: Optional[threading.Lock] = None,
) -> Dict[str, Any]:
    chamados = chamados if isinstance(chamados, dict) else {}
    local = info.get("local", "Desconhecido")
    collected_at_utc = _utc_iso_now()

    desc_entries = snmp_walk(ip, OID_SUPPLY_DESCRIPTION_BASE, community_str)
    if not desc_entries:
        offline_row = {
            "ip": ip,
            "local": local,
            "patrimonio": info.get("patrimonio", ""),
            "modelo": info.get("modelo", "Desconhecido"),
            "suprimento": "Offline",
            "nivel": 0,
            "restante": "N/A",
            "estimado_paginas": "N/A",
            "total_impressos": "",
            "ultima_atualizacao": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "offline",
            "coleta_origem": source_tag,
        }

        return {
            "status": "offline",
            "collected_at": collected_at_utc,
            "rows": [offline_row],
            "supplies": [],
            "page_count_total": None,
            "raw_payload": {
                "source": "flask-snmp",
                "mode": "cache_update",
                "offline": True,
            },
            "page_counter": None,
        }

    max_entries = snmp_walk(ip, OID_SUPPLY_MAX_BASE, community_str)
    curr_entries = snmp_walk(ip, OID_SUPPLY_CURRENT_BASE, community_str)

    page_counter = _resolve_page_counter(ip, info, community_str)
    total_prints = page_counter.get("page_count_total")

    supplies_result = _collect_supply_rows(
        ip=ip,
        local=local,
        info=info,
        total_prints=total_prints,
        desc_entries=desc_entries,
        max_entries=max_entries,
        curr_entries=curr_entries,
        chamados=chamados,
        source_tag=source_tag,
        chamados_lock=chamados_lock,
    )

    return {
        "status": "online",
        "collected_at": collected_at_utc,
        "rows": supplies_result["cache_rows"],
        "supplies": supplies_result["payload_supplies"],
        "page_count_total": total_prints,
        "raw_payload": {
            "source": "flask-snmp",
            "mode": "cache_update",
            "supplies_count": len(supplies_result["payload_supplies"]),
            "page_counter": {
                "family": page_counter.get("family"),
                "counter_name": page_counter.get("counter_name"),
                "counter_oid": page_counter.get("counter_oid"),
                "counter_confidence": page_counter.get("counter_confidence"),
            },
        },
        "page_counter": page_counter,
    }


def _push_to_new_api(
    collector_id: str,
    ip: str,
    info: Dict[str, Any],
    status: str,
    collected_at_utc: str,
    page_count_total: Optional[int],
    supplies: List[Dict[str, Any]],
    raw_payload: Dict[str, Any],
):
    payload = build_collector_payload(
        coletor_id=collector_id,
        ip=ip,
        printer_info=info,
        status=status,
        coletado_em=collected_at_utc,
        contador_total_paginas=page_count_total,
        suprimentos=supplies,
        payload_bruto=raw_payload,
    )
    send_telemetry_payload(payload, log_prefix=f"[collector:{ip}]")


def _coletar_e_enviar_impressora(
    ip: str,
    info: Dict[str, Any],
    default_community: str,
    chamados: Dict[str, Any],
    chamados_lock: threading.Lock,
    collector_id: str,
) -> List[Dict[str, Any]]:
    community_str = info.get("comunidade") or default_community
    snapshot = collect_printer_snapshot(
        ip=ip,
        info=info,
        community_str=community_str,
        chamados=chamados,
        source_tag="snmp_real",
        chamados_lock=chamados_lock,
    )

    if snapshot["status"] == "offline":
        logging.warning(
            "Impressora %s (%s) parece estar offline. Nenhuma resposta SNMP.",
            ip,
            info.get("local", "Desconhecido"),
        )

    _push_to_new_api(
        collector_id=collector_id,
        ip=ip,
        info=info,
        status=snapshot["status"],
        collected_at_utc=snapshot["collected_at"],
        page_count_total=snapshot["page_count_total"],
        supplies=snapshot["supplies"],
        raw_payload=snapshot["raw_payload"],
    )

    return snapshot["rows"]


def atualizar_cache():
    """Atualiza o cache local e envia 1 payload por impressora para a API nova."""
    logging.info("Iniciando atualizacao do cache.")
    settings = load_settings()
    default_community = settings.get("community", "public")
    chamados = load_chamados()

    collector_config = get_collector_config()
    collector_id = collector_config.get("collector_id", "collector-hgg-01")
    ip_filters = collector_config.get("ip_filters") or []
    max_workers = max(1, int(collector_config.get("max_workers") or 1))
    replay_pending = bool(collector_config.get("replay_pending", True))
    replay_max_per_cycle = int(collector_config.get("replay_max_per_cycle") or 80)
    require_remote_printers = bool(collector_config.get("require_remote_printers", False))
    printers_source = collector_config.get("printers_source", "api")
    printers = {}

    if collector_config.get("sync_printers_from_api", False):
        remote = fetch_printers_from_api(log_prefix="[collector-printers-sync]")
        if remote.get("success") and isinstance(remote.get("printers"), dict):
            printers = remote["printers"]
            logging.info(
                "[collector-printers-sync] Fonte remota '%s' aplicada (%s registros).",
                remote.get("source", printers_source),
                len(printers),
            )
            try:
                save_printers(printers)
            except Exception as sync_save_exc:
                logging.warning(
                    "Falha ao salvar printers.json apos sync remoto: %s",
                    sync_save_exc,
                )
        else:
            if require_remote_printers:
                raise RuntimeError(
                    "Sync remoto obrigatorio falhou. "
                    f"Fonte={remote.get('source', printers_source)} Motivo={remote.get('error')}"
                )
            printers = load_printers()
            logging.warning(
                "Nao foi possivel sincronizar impressoras da fonte remota '%s'. "
                "Mantendo printers.json local. Motivo: %s",
                remote.get("source", printers_source),
                remote.get("error"),
            )
    else:
        if require_remote_printers:
            raise RuntimeError(
                "COLLECTOR_REQUIRE_REMOTE_PRINTERS=true exige "
                "COLLECTOR_SYNC_PRINTERS_FROM_API=true."
            )
        printers = load_printers()

    if not printers:
        raise RuntimeError(
            "Nenhuma impressora carregada para coleta. "
            "Verifique sync remoto, token, permissao e filtros."
        )

    printers = _filter_printers_by_ip(printers, ip_filters)

    impressoras_ativas = [
        (ip, info)
        for ip, info in printers.items()
        if isinstance(info, dict) and info.get("ativa", True)
    ]

    logging.info(
        "Coleta iniciada com %s impressoras ativas (workers=%s).",
        len(impressoras_ativas),
        max_workers,
    )

    dados: List[Dict[str, Any]] = []
    chamados_lock = threading.Lock()

    if max_workers <= 1 or len(impressoras_ativas) <= 1:
        for ip, info in impressoras_ativas:
            try:
                rows = _coletar_e_enviar_impressora(
                    ip=ip,
                    info=info,
                    default_community=default_community,
                    chamados=chamados,
                    chamados_lock=chamados_lock,
                    collector_id=collector_id,
                )
                dados.extend(rows)
            except Exception as printer_exc:
                logging.error("Erro ao acessar impressora %s: %s", ip, printer_exc)
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(
                    _coletar_e_enviar_impressora,
                    ip,
                    info,
                    default_community,
                    chamados,
                    chamados_lock,
                    collector_id,
                ): ip
                for ip, info in impressoras_ativas
            }

            for future in as_completed(futures):
                ip = futures[future]
                try:
                    rows = future.result()
                    dados.extend(rows)
                except Exception as printer_exc:
                    logging.error("Erro ao acessar impressora %s: %s", ip, printer_exc)

    with open(CACHE_FILE, "w", encoding="utf-8") as file:
        json.dump(dados, file, ensure_ascii=False, indent=2)

    if replay_pending:
        replay_pending_payloads(max_items=replay_max_per_cycle, log_prefix="[collector-replay]")

    logging.info("Atualizacao do cache concluida.")
    return dados
