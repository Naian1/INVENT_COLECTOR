import asyncio
import logging
from typing import Any, Dict, List


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
        if _USING_LEGACY_HLAPI:
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
                return {
                    "ok": False,
                    "ip": ip,
                    "oid": oid,
                    "error": _stringify(error_indication or error_status),
                }

            var_bind = var_binds[0]
            return {
                "ok": True,
                "ip": ip,
                "oid": _stringify(var_bind[0]),
                "value": _stringify(var_bind[1]),
            }

        return _run_async(
            _snmp_get_async(
                ip=ip,
                oid=oid,
                community=community_str,
                timeout=timeout,
                retries=retries,
            )
        )
    except Exception as exc:
        logging.error(f"[snmp_get] Falha em {ip} oid={oid}: {exc}")
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
        if _USING_LEGACY_HLAPI:
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
                        return rows
            return rows

        return _run_async(
            _snmp_walk_async(
                ip=ip,
                oid_base=oid_base,
                community=community_str,
                timeout=timeout,
                retries=retries,
                limit=limit,
            )
        )
    except Exception as exc:
        logging.error(f"[snmp_walk] Falha em {ip} base={oid_base}: {exc}")
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
