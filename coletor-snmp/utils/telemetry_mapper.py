# [DOC-CODEMAP] Arquivo: coletor-snmp\utils\telemetry_mapper.py
# [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
import re
import unicodedata
from datetime import datetime, timezone
from uuid import uuid4

_UNKNOWN_VALUES = {"", "desconhecido", "unknown", "n/a", "na", "none", "null", "-", "sem setor"}


# [DOC-FUNC] _to_utc_iso
# O que faz: Normaliza valores na funcao '_to_utc_iso', reduzindo variacoes de formato antes do processamento principal.
# Entradas: Recebe dados possivelmente incompletos ou heterogeneos (dt) e trata nulos, strings vazias e tipos mistos.
# Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
# Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
def _to_utc_iso(dt=None):
    base = dt or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return base.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# [DOC-FUNC] _normalize_text
# O que faz: Normaliza valores na funcao '_normalize_text', reduzindo variacoes de formato antes do processamento principal.
# Entradas: Recebe dados possivelmente incompletos ou heterogeneos (text) e trata nulos, strings vazias e tipos mistos.
# Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
# Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
def _normalize_text(text):
    if text is None:
        return ""
    normalized = unicodedata.normalize("NFKD", str(text))
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_only


# [DOC-FUNC] _clean_value
# O que faz: Normaliza valores na funcao '_clean_value', reduzindo variacoes de formato antes do processamento principal.
# Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
# Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
# Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
def _clean_value(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if _normalize_text(text).lower() in _UNKNOWN_VALUES:
        return None
    return text


# [DOC-FUNC] _pick_first
# O que faz: Orquestra a etapa '_pick_first' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
# Entradas: Trabalha com os parametros declarados (info, keys) e com contexto local carregado durante a execucao.
# Como executa: Encadeia avaliacoes condicionais, iteracao/transformacao de colecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
# Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
def _pick_first(info, keys):
    if not isinstance(info, dict):
        return None

    for key in keys:
        if key in info:
            clean = _clean_value(info.get(key))
            if clean:
                return clean
    return None


# [DOC-FUNC] make_supply_key
# O que faz: Normaliza valores na funcao 'make_supply_key', reduzindo variacoes de formato antes do processamento principal.
# Entradas: Recebe dados possivelmente incompletos ou heterogeneos (supply_name) e trata nulos, strings vazias e tipos mistos.
# Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
# Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
def make_supply_key(supply_name):
    clean = _normalize_text(supply_name).lower().strip()
    clean = re.sub(r"[^a-z0-9]+", "_", clean).strip("_")
    return clean or "suprimento"


# [DOC-FUNC] infer_manufacturer
# O que faz: Orquestra a etapa 'infer_manufacturer' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
# Entradas: Trabalha com os parametros declarados (model) e com contexto local carregado durante a execucao.
# Como executa: Encadeia avaliacoes condicionais, garantindo continuidade do processamento mesmo com entradas variaveis.
# Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
def infer_manufacturer(model):
    model_lower = (model or "").lower()
    if "lexmark" in model_lower or model_lower.startswith(("m", "xm", "cx")):
        return "Lexmark"
    if "hp" in model_lower:
        return "HP"
    if "brother" in model_lower:
        return "Brother"
    if "samsung" in model_lower:
        return "Samsung"
    if "ricoh" in model_lower:
        return "Ricoh"
    return None


# [DOC-FUNC] _normalize_model
# O que faz: Normaliza valores na funcao '_normalize_model', reduzindo variacoes de formato antes do processamento principal.
# Entradas: Recebe dados possivelmente incompletos ou heterogeneos (raw_model) e trata nulos, strings vazias e tipos mistos.
# Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
# Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
def _normalize_model(raw_model):
    clean_model = _clean_value(raw_model)
    if not clean_model:
        return None

    if re.fullmatch(r"[a-z]{1,3}\d{3,5}", clean_model.lower()):
        return clean_model.upper()
    return clean_model


def infer_supply_status(
    level_percent,
    printer_status,
    raw_current=None,
    raw_max=None,
    confidence=None,
):
    if printer_status == "offline":
        return "offline"
    if level_percent is None:
        return "unknown"
    if level_percent < 0:
        return "unknown"
    if level_percent == 0:
        if (
            confidence == "high"
            and isinstance(raw_current, int)
            and isinstance(raw_max, int)
            and raw_current == 0
            and raw_max > 0
        ):
            return "empty"
        return "unknown"
    if level_percent <= 5:
        return "critical"
    if level_percent <= 15:
        return "low"
    return "ok"


# [DOC-FUNC] generate_ingestao_id
# O que faz: Monta/comp?e estruturas na funcao 'generate_ingestao_id', consolidando campos dispersos em um objeto util para o fluxo.
# Entradas: Recebe parametros de origem (ip) com dados parciais e metadados para composicao final.
# Como executa: Seleciona campos relevantes, aplica regras de prioridade/fallback e organiza o resultado no formato esperado.
# Retorno/Efeitos: Entrega payload consolidado para a proxima camada (API, servico, persistencia ou interface).
def generate_ingestao_id(ip):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    safe_ip = (ip or "unknown").replace(".", "-")
    return f"evt-{safe_ip}-{timestamp}-{uuid4().hex[:8]}"


# [DOC-FUNC] _normalizar_suprimentos_para_pt
# O que faz: Normaliza valores na funcao '_normalizar_suprimentos_para_pt', reduzindo variacoes de formato antes do processamento principal.
# Entradas: Recebe dados possivelmente incompletos ou heterogeneos (suprimentos, status_evento) e trata nulos, strings vazias e tipos mistos.
# Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
# Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
def _normalizar_suprimentos_para_pt(suprimentos, status_evento):
    result = []
    for item in (suprimentos or []):
        if not isinstance(item, dict):
            continue

        nome = _pick_first(item, ["nome_suprimento", "supply_name", "suprimento"])
        if not nome:
            continue

        chave = _pick_first(item, ["chave_suprimento", "supply_key"]) or make_supply_key(nome)
        nivel = item.get("nivel_percentual")
        if nivel is None:
            nivel = item.get("level_percent")
        nivel_percentual = None
        if isinstance(nivel, (int, float)):
            nivel_percentual = float(nivel)

        status_informado = _pick_first(item, ["status_suprimento", "supply_status"])
        status_suprimento = status_informado or infer_supply_status(
            nivel_percentual,
            status_evento,
            raw_current=item.get("raw_value"),
            raw_max=None,
            confidence="low",
        )

        suprimento_pt = {
            "chave_suprimento": chave,
            "nome_suprimento": nome,
            "nivel_percentual": nivel_percentual,
            "status_suprimento": status_suprimento,
        }

        if "raw_value" in item:
            suprimento_pt["raw_value"] = item.get("raw_value")
        if item.get("raw_oid") is not None:
            suprimento_pt["raw_oid"] = item.get("raw_oid")
        if item.get("raw_name") is not None:
            suprimento_pt["raw_name"] = item.get("raw_name")
        if isinstance(item.get("raw_payload"), dict):
            suprimento_pt["payload_bruto"] = item.get("raw_payload")

        result.append(suprimento_pt)

    return result


# [DOC-FUNC] _montar_impressora_pt
# O que faz: Monta/comp?e estruturas na funcao '_montar_impressora_pt', consolidando campos dispersos em um objeto util para o fluxo.
# Entradas: Recebe parametros de origem (ip, printer_info) com dados parciais e metadados para composicao final.
# Como executa: Seleciona campos relevantes, aplica regras de prioridade/fallback e organiza o resultado no formato esperado.
# Retorno/Efeitos: Entrega payload consolidado para a proxima camada (API, servico, persistencia ou interface).
def _montar_impressora_pt(ip, printer_info):
    info = printer_info or {}

    modelo = _normalize_model(
        _pick_first(info, ["modelo", "model", "printer_model", "device_model"])
    )
    numero_serie = _pick_first(
        info,
        ["numero_serie", "serial_number", "serial", "sn", "serialNumber"],
    )
    fabricante = _pick_first(info, ["fabricante", "manufacturer", "brand", "marca"])
    endereco_mac = _pick_first(info, ["endereco_mac", "mac_address", "mac", "macAddress"])
    patrimonio = _pick_first(info, ["patrimonio", "asset_tag", "patrimony", "tag_patrimonio"])
    setor = _pick_first(info, ["setor", "sector", "local", "department"])
    localizacao = _pick_first(
        info,
        ["localizacao", "location_detail", "local_detalhe", "sala", "andar"],
    )
    hostname = _pick_first(info, ["hostname", "host_name", "dns_name"])

    if not fabricante:
        fabricante = infer_manufacturer(modelo or "")

    impressora = {"ip": ip}
    if patrimonio:
        impressora["patrimonio"] = patrimonio
    if setor:
        impressora["setor"] = setor
    if localizacao:
        impressora["localizacao"] = localizacao
    if modelo:
        impressora["modelo"] = modelo
    if fabricante:
        impressora["fabricante"] = fabricante
    if numero_serie:
        impressora["numero_serie"] = numero_serie
    if hostname:
        impressora["hostname"] = hostname
    if endereco_mac:
        impressora["endereco_mac"] = endereco_mac
    if isinstance(info.get("ativa"), bool):
        impressora["ativo"] = bool(info.get("ativa"))

    return impressora


def build_collector_payload(
    coletor_id,
    ip,
    printer_info,
    status,
    coletado_em=None,
    contador_total_paginas=None,
    suprimentos=None,
    payload_bruto=None,
):
    timestamp = coletado_em or _to_utc_iso()
    status_evento = _clean_value(status) or "unknown"
    impressora = _montar_impressora_pt(ip, printer_info)
    suprimentos_pt = _normalizar_suprimentos_para_pt(suprimentos, status_evento)

    evento = {
        "ingestao_id": generate_ingestao_id(ip),
        "coletado_em": timestamp,
        "status": status_evento,
        "impressora": impressora,
        "suprimentos": suprimentos_pt,
        "payload_bruto": payload_bruto or {"source": "flask-snmp"},
    }

    if contador_total_paginas is not None:
        try:
            evento["contador_total_paginas"] = int(contador_total_paginas)
        except Exception:
            pass

    return {
        "coletor_id": coletor_id,
        "coletado_em": timestamp,
        "eventos": [evento],
    }


# [DOC-FUNC] build_payload_from_cache_entries
# O que faz: Monta/comp?e estruturas na funcao 'build_payload_from_cache_entries', consolidando campos dispersos em um objeto util para o fluxo.
# Entradas: Recebe parametros de origem (coletor_id, ip, printer_info, cache_entries) com dados parciais e metadados para composicao final.
# Como executa: Seleciona campos relevantes, aplica regras de prioridade/fallback e organiza o resultado no formato esperado.
# Retorno/Efeitos: Entrega payload consolidado para a proxima camada (API, servico, persistencia ou interface).
def build_payload_from_cache_entries(coletor_id, ip, printer_info, cache_entries):
    entries = cache_entries or []
    online_entries = [item for item in entries if item.get("status") != "offline"]
    status = "online" if online_entries else "offline"
    base_entries = online_entries if online_entries else entries

    contador_total_paginas = None
    for item in base_entries:
        total = item.get("total_impressos")
        if isinstance(total, int):
            contador_total_paginas = total
            break

    suprimentos = []
    for item in online_entries:
        supply_name = item.get("suprimento")
        level = item.get("nivel")
        if not supply_name:
            continue

        nivel_percentual = int(level) if isinstance(level, (int, float)) and level >= 0 else None
        suprimentos.append(
            {
                "chave_suprimento": make_supply_key(supply_name),
                "nome_suprimento": supply_name,
                "nivel_percentual": nivel_percentual,
                "status_suprimento": infer_supply_status(
                    nivel_percentual,
                    status,
                    raw_current=None,
                    raw_max=None,
                    confidence="low",
                ),
                "raw_value": item.get("raw_supply_value"),
                "raw_oid": item.get("raw_supply_oid"),
                "raw_name": item.get("raw_supply_name"),
                "payload_bruto": {
                    "source": item.get("coleta_origem", "cache-derived"),
                    "raw_value": item.get("raw_supply_value"),
                    "raw_oid": item.get("raw_supply_oid"),
                    "raw_name": item.get("raw_supply_name"),
                    "raw_max_value": item.get("raw_supply_max"),
                    "raw_max_oid": item.get("raw_supply_max_oid"),
                },
            }
        )

    first_entry = base_entries[0] if base_entries else {}
    merged_info = dict(printer_info or {})
    if isinstance(first_entry, dict):
        merged_info.setdefault("local", first_entry.get("local"))
        merged_info.setdefault("patrimonio", first_entry.get("patrimonio"))
        merged_info.setdefault("modelo", first_entry.get("modelo"))

    return build_collector_payload(
        coletor_id=coletor_id,
        ip=ip,
        printer_info=merged_info,
        status=status,
        contador_total_paginas=contador_total_paginas,
        suprimentos=suprimentos,
        payload_bruto={
            "source": "flask-snmp",
            "mode": "cache-derived",
            "entries": len(entries),
        },
    )

