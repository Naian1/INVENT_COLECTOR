import argparse
import json
import os
import sys


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.api_client import fetch_printers_from_api, get_collector_config, send_telemetry_payload
from utils.file_manager import load_printers, save_printers
from utils.telemetry_mapper import build_collector_payload, build_payload_from_cache_entries


def _group_cache_by_ip(cache_rows):
    grouped = {}
    for row in cache_rows:
        ip = row.get("ip")
        if not ip:
            continue
        grouped.setdefault(ip, []).append(row)
    return grouped


def run_test(ip=None, refresh_cache=True, dry_run=False, real_read=False):
    printers = load_printers()
    remote = fetch_printers_from_api(log_prefix="[test-printers-sync]")
    if remote.get("success") and isinstance(remote.get("printers"), dict):
        printers = remote["printers"]
        save_printers(printers)

    if real_read:
        target_ip = ip or next(iter(printers.keys()))
        if target_ip not in printers:
            raise RuntimeError(f"IP {target_ip} não encontrado em data/printers.json.")

        from utils.cache_manager import collect_printer_snapshot

        printer_info = printers.get(target_ip, {})
        community_str = printer_info.get("comunidade", "public")
        snapshot = collect_printer_snapshot(
            ip=target_ip,
            info=printer_info,
            community_str=community_str,
            chamados={},
            source_tag="snmp_real_manual_test",
        )

        payload = build_collector_payload(
            coletor_id=get_collector_config().get("collector_id", "collector-hgg-01"),
            ip=target_ip,
            printer_info=printer_info,
            status=snapshot.get("status", "unknown"),
            coletado_em=snapshot.get("collected_at"),
            contador_total_paginas=snapshot.get("page_count_total"),
            suprimentos=snapshot.get("supplies", []),
            payload_bruto={
                "source": "flask-snmp",
                "mode": "manual-real-read",
                "page_counter": snapshot.get("page_counter"),
            },
        )

        print("[test] Diagnóstico de contador de páginas:")
        print(json.dumps(snapshot.get("page_counter"), ensure_ascii=False, indent=2))

        print("[test] Payload montado (leitura real):")
        print(json.dumps(payload, ensure_ascii=False, indent=2))

        if dry_run:
            print("[test] DRY RUN ativado. Payload NÃO enviado.")
            return

        result = send_telemetry_payload(payload, log_prefix="[manual-real-test]")
        print("[test] Resultado do envio:")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if refresh_cache:
        from utils.cache_manager import atualizar_cache

        print("[test] Atualizando cache antes do envio...")
        cache_rows = atualizar_cache()
    else:
        cache_file = os.path.join(BASE_DIR, "dados_cache.json")
        if not os.path.exists(cache_file):
            raise RuntimeError("dados_cache.json não encontrado. Rode sem --no-refresh primeiro.")
        with open(cache_file, "r", encoding="utf-8") as file:
            cache_rows = json.load(file)

    grouped = _group_cache_by_ip(cache_rows)
    if not grouped:
        raise RuntimeError("Nenhum dado de impressora encontrado para teste.")

    target_ip = ip or next(iter(grouped.keys()))
    if target_ip not in grouped:
        raise RuntimeError(f"IP {target_ip} não encontrado nos dados de cache atuais.")

    collector_config = get_collector_config()
    payload = build_payload_from_cache_entries(
        coletor_id=collector_config.get("collector_id", "collector-hgg-01"),
        ip=target_ip,
        printer_info=printers.get(target_ip, {}),
        cache_entries=grouped[target_ip],
    )

    print("[test] Payload montado:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    if dry_run:
        print("[test] DRY RUN ativado. Payload NÃO enviado.")
        return

    result = send_telemetry_payload(payload, log_prefix="[manual-test]")
    print("[test] Resultado do envio:")
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Teste manual de envio da telemetria do PjIMPRESS para a API nova."
    )
    parser.add_argument("--ip", help="IP da impressora para teste (opcional).")
    parser.add_argument(
        "--no-refresh",
        action="store_true",
        help="Não roda SNMP novamente. Usa dados de dados_cache.json.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Monta e imprime o payload, sem enviar.",
    )
    parser.add_argument(
        "--real-read",
        action="store_true",
        help="Ignora cache e faz leitura SNMP real da impressora por IP.",
    )
    args = parser.parse_args()

    run_test(
        ip=args.ip,
        refresh_cache=not args.no_refresh,
        dry_run=args.dry_run,
        real_read=args.real_read,
    )


if __name__ == "__main__":
    main()
