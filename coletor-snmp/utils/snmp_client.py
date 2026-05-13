# [DOC-CODEMAP] Arquivo: coletor-snmp\utils\snmp_client.py
# [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
import asyncio
import logging
from typing import Any, Dict, List

from .runtime_trace import append_backend_trace

_USING_LEGACY_HLAPI = False

try:
    # Legacy pysnmp API (sync) - works on older pysnmp versions.
    from pysnmp.hlapi import (  # type: ignore
        CommunityData as _LegacyCommunityData,
        ContextData as _LegacyContextData,
        ObjectIdentity as _LegacyObjectIdentity,
        ObjectType as _LegacyObjectType,
        SnmpEngine as _LegacySnmpEngine,
        UdpTransportTarget as _LegacyUdpTransportTarget,
        getCmd as _legacy_get_cmd,
        nextCmd as _legacy_next_cmd,
    )

    _USING_LEGACY_HLAPI = True
except Exception:
    _USING_LEGACY_HLAPI = False

if not _USING_LEGACY_HLAPI:
    # pysnmp>=7 API (async/coroutine).
    from pysnmp.hlapi.v3arch import (  # type: ignore
        CommunityData as _AsyncCommunityData,
        ContextData as _AsyncContextData,
        ObjectIdentity as _AsyncObjectIdentity,
        ObjectType as _AsyncObjectType,
        SnmpEngine as _AsyncSnmpEngine,
        UdpTransportTarget as _AsyncUdpTransportTarget,
        get_cmd as _async_get_cmd,
        next_cmd as _async_next_cmd,
    )


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


# [DOC-FUNC] _run_async
# O que faz: Executa a rotina principal de 'run async' no contexto deste modulo.
# Entradas: Parametros esperados: coro.
# Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
# Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
def _run_async(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # Fallback for environments where an event loop is already active.
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


async def _snmp_get_async(
    ip: str,
    oid: str,
    community: str = "public",
    timeout: float = 2,
    retries: int = 1,
) -> Dict[str, Any]:
    target = await _AsyncUdpTransportTarget.create((ip, 161), timeout=timeout, retries=retries)
    error_indication, error_status, _, var_binds = await _async_get_cmd(
        _AsyncSnmpEngine(),
        _AsyncCommunityData(community, mpModel=1),
        target,
        _AsyncContextData(),
        _AsyncObjectType(_AsyncObjectIdentity(oid)),
    )
    if error_indication or error_status or not var_binds:
        return {"ok": False, "ip": ip, "oid": oid, "error": _stringify(error_indication or error_status)}

    var_bind = var_binds[0]
    return {
        "ok": True,
        "ip": ip,
        "oid": _stringify(var_bind[0]),
        "value": _stringify(var_bind[1]),
    }


async def _snmp_walk_async(
    ip: str,
    oid_base: str,
    community: str = "public",
    timeout: float = 2,
    retries: int = 1,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    target = await _AsyncUdpTransportTarget.create((ip, 161), timeout=timeout, retries=retries)
    current = _AsyncObjectType(_AsyncObjectIdentity(oid_base))
    rows: List[Dict[str, Any]] = []

    for _ in range(limit):
        error_indication, error_status, _, var_binds = await _async_next_cmd(
            _AsyncSnmpEngine(),
            _AsyncCommunityData(community, mpModel=1),
            target,
            _AsyncContextData(),
            current,
            lexicographicMode=False,
        )
        if error_indication or error_status or not var_binds:
            break

        var_bind = var_binds[0]
        oid = _stringify(var_bind[0])
        if oid != oid_base and not oid.startswith(f"{oid_base}."):
            break

        rows.append(
            {
                "ok": True,
                "ip": ip,
                "oid": oid,
                "value": _stringify(var_bind[1]),
            }
        )
        current = _AsyncObjectType(_AsyncObjectIdentity(oid))

    return rows


def snmp_get(
    oid: str,
    ip: str,
    community_str: str = "public",
    timeout: float = 2,
    retries: int = 1,
) -> Dict[str, Any]:
    try:
        # Cada GET gera rastros locais para o painel "Backend ao vivo" do app de controle.
        append_backend_trace(
            "snmp_get_start",
            ip=ip,
            oid=oid,
            community=community_str,
            timeout=timeout,
            retries=retries,
            command_equivalent=f"snmpget -v2c -c {community_str} {ip} {oid}",
        )
        if _USING_LEGACY_HLAPI:
            # Caminho síncrono (pysnmp legado), mantido por compatibilidade de ambiente.
            error_indication, error_status, _, var_binds = next(
                _legacy_get_cmd(
                    _LegacySnmpEngine(),
                    _LegacyCommunityData(community_str, mpModel=1),
                    _LegacyUdpTransportTarget((ip, 161), timeout=timeout, retries=retries),
                    _LegacyContextData(),
                    _LegacyObjectType(_LegacyObjectIdentity(oid)),
                )
            )
            if error_indication or error_status or not var_binds:
                append_backend_trace(
                    "snmp_get_error",
                    ip=ip,
                    oid=oid,
                    error=_stringify(error_indication or error_status),
                )
                return {
                    "ok": False,
                    "ip": ip,
                    "oid": oid,
                    "error": _stringify(error_indication or error_status),
                }

            var_bind = var_binds[0]
            append_backend_trace(
                "snmp_get_ok",
                ip=ip,
                oid=_stringify(var_bind[0]),
                value=_stringify(var_bind[1]),
            )
            return {
                "ok": True,
                "ip": ip,
                "oid": _stringify(var_bind[0]),
                "value": _stringify(var_bind[1]),
            }

        # Caminho assíncrono (pysnmp novo): executa a coroutine e retorna no mesmo formato.
        result = _run_async(
            _snmp_get_async(
                ip=ip,
                oid=oid,
                community=community_str,
                timeout=timeout,
                retries=retries,
            )
        )
        if result.get("ok"):
            append_backend_trace(
                "snmp_get_ok",
                ip=ip,
                oid=result.get("oid"),
                value=result.get("value"),
            )
        else:
            append_backend_trace(
                "snmp_get_error",
                ip=ip,
                oid=oid,
                error=result.get("error"),
            )
        return result
    except Exception as exc:
        logging.error(f"[snmp_get] Falha em {ip} oid={oid}: {exc}")
        append_backend_trace("snmp_get_error", ip=ip, oid=oid, error=_stringify(exc))
        return {"ok": False, "ip": ip, "oid": oid, "error": _stringify(exc)}


def snmp_walk(
    ip: str,
    oid_base: str,
    community_str: str = "public",
    timeout: float = 2,
    retries: int = 1,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    try:
        # O trace também guarda o "comando equivalente" para facilitar debug manual com snmpwalk.
        append_backend_trace(
            "snmp_walk_start",
            ip=ip,
            oid_base=oid_base,
            community=community_str,
            timeout=timeout,
            retries=retries,
            command_equivalent=f"snmpwalk -v2c -c {community_str} {ip} {oid_base}",
        )
        if _USING_LEGACY_HLAPI:
            # Em legado percorremos manualmente e limitamos o volume para evitar loops longos.
            rows: List[Dict[str, Any]] = []
            for error_indication, error_status, _, var_binds in _legacy_next_cmd(
                _LegacySnmpEngine(),
                _LegacyCommunityData(community_str, mpModel=1),
                _LegacyUdpTransportTarget((ip, 161), timeout=timeout, retries=retries),
                _LegacyContextData(),
                _LegacyObjectType(_LegacyObjectIdentity(oid_base)),
                lexicographicMode=False,
            ):
                if error_indication or error_status:
                    break
                for var_bind in var_binds:
                    oid = _stringify(var_bind[0])
                    if oid != oid_base and not oid.startswith(f"{oid_base}."):
                        continue
                    rows.append(
                        {
                            "ok": True,
                            "ip": ip,
                            "oid": oid,
                            "value": _stringify(var_bind[1]),
                        }
                    )
                    if len(rows) >= limit:
                        append_backend_trace(
                            "snmp_walk_ok",
                            ip=ip,
                            oid_base=oid_base,
                            rows=len(rows),
                        )
                        return rows
            append_backend_trace(
                "snmp_walk_ok",
                ip=ip,
                oid_base=oid_base,
                rows=len(rows),
            )
            return rows

        rows = _run_async(
            _snmp_walk_async(
                ip=ip,
                oid_base=oid_base,
                community=community_str,
                timeout=timeout,
                retries=retries,
                limit=limit,
            )
        )
        append_backend_trace(
            "snmp_walk_ok",
            ip=ip,
            oid_base=oid_base,
            rows=len(rows),
        )
        return rows
    except Exception as exc:
        logging.error(f"[snmp_walk] Falha em {ip} base={oid_base}: {exc}")
        append_backend_trace("snmp_walk_error", ip=ip, oid_base=oid_base, error=_stringify(exc))
        return []


def snmp_get_value(
    oid: str,
    ip: str,
    community_str: str = "public",
    timeout: float = 2,
    retries: int = 1,
):
    result = snmp_get(
        oid=oid,
        ip=ip,
        community_str=community_str,
        timeout=timeout,
        retries=retries,
    )
    if not result.get("ok"):
        return None
    return result.get("value")

