# [DOC-CODEMAP] Arquivo: coletor-snmp\utils\telemetry_mapper.py
# [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
import re
import unicodedata
from datetime import datetime, timezone
from uuid import uuid4

_UNKNOWN_VALUES = {"", "desconhecido", "unknown", "n/a", "na", "none", "null", "-", "sem setor"}


# [DOC-FUNC] _to_utc_iso
# O que faz: A funcao '_to_utc_iso' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
# Entradas: Recebe os parametros: dt. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def _to_utc_iso(dt=None):
    base = dt or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return base.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# [DOC-FUNC] _normalize_text
# O que faz: A funcao '_normalize_text' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
# Entradas: Recebe os parametros: text. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def _normalize_text(text):
    if text is None:
        return ""
    normalized = unicodedata.normalize("NFKD", str(text))
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_only


# [DOC-FUNC] _clean_value
# O que faz: A funcao '_clean_value' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
# Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
# O que faz: A funcao '_pick_first' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: info, keys. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
# O que faz: A funcao 'make_supply_key' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: supply_name. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def make_supply_key(supply_name):
    clean = _normalize_text(supply_name).lower().strip()
    clean = re.sub(r"[^a-z0-9]+", "_", clean).strip("_")
    return clean or "suprimento"


# [DOC-FUNC] infer_manufacturer
# O que faz: A funcao 'infer_manufacturer' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: model. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
# O que faz: A funcao '_normalize_model' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
# Entradas: Recebe os parametros: raw_model. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def _normalize_model(raw_model):
    clean_model = _clean_value(raw_model)
    if not clean_model:
        return None

    if re.fullmatch(r"[a-z]{1,3}\d{3,5}", clean_model.lower()):
        return clean_model.upper()
    return clean_model


# [DOC-FUNC] infer_supply_status
# Objetivo: monta ou classifica dados enviados pelo coletor para a API de telemetria.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: recebe snapshot bruto da impressora, normaliza campos obrigatorios e organiza impressora, pagecount e suprimentos em um payload unico; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
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
# O que faz: A funcao 'generate_ingestao_id' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: ip. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
def generate_ingestao_id(ip):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    safe_ip = (ip or "unknown").replace(".", "-")
    return f"evt-{safe_ip}-{timestamp}-{uuid4().hex[:8]}"


# [DOC-FUNC] _normalizar_suprimentos_para_pt
# O que faz: A funcao '_normalizar_suprimentos_para_pt' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
# Entradas: Recebe os parametros: suprimentos, status_evento. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) persiste alteracoes somente quando as regras de negocio permitem.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
# O que faz: A funcao '_montar_impressora_pt' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: ip, printer_info. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


# [DOC-FUNC] build_collector_payload
# Objetivo: monta ou classifica dados enviados pelo coletor para a API de telemetria.
# Entradas: usa parametros da assinatura e/ou variaveis de ambiente ja carregadas pelo modulo.
# Como executa: recebe snapshot bruto da impressora, normaliza campos obrigatorios e organiza impressora, pagecount e suprimentos em um payload unico; em caso de erro, preserva diagnostico em log ou excecao contextualizada.
# Saida/Efeito: devolve dados normalizados ou executa a acao esperada sem mudar regras de negocio fora desta funcao.
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
# O que faz: A funcao 'build_payload_from_cache_entries' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
# Entradas: Recebe os parametros: coletor_id, ip, printer_info, cache_entries. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
# Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
# Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

