"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";

type TelemetriaResumoPayload = {
  periodo: {
    dias: number;
    de: string;
    ate: string;
    timezone: string;
    fonte: "consolidado_diario" | "legado_agregado";
  };
  totais: {
    inventarios_monitorados: number;
    inventarios_com_coleta_hoje: number;
    inventarios_sem_coleta_hoje: number;
    paginas_hoje: number;
    paginas_periodo: number;
    ultima_leitura_geral: string | null;
  };
  serie_paginas_dia: Array<{
    data_ref: string;
    paginas: number;
  }>;
  top_impressoras_hoje: Array<{
    nr_inventario: number;
    patrimonio: string;
    ip: string;
    setor: string;
    modelo: string;
    paginas_dia: number;
    contador_atual: number;
    status: string;
    dt_ultima_leitura: string | null;
  }>;
};

const PERIODOS = [
  { value: 7, label: "Ultimos 7 dias" },
  { value: 15, label: "Ultimos 15 dias" },
  { value: 30, label: "Ultimos 30 dias" },
  { value: 60, label: "Ultimos 60 dias" },
];

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatNumber(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return numberFormatter.format(Math.max(0, Math.round(n)));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return "-";
  return dateTimeFormatter.format(dt);
}

function formatStatus(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "online") return "online";
  if (normalized === "offline") return "offline";
  if (normalized === "warning") return "warning";
  if (normalized === "error") return "error";
  return "unknown";
}

function statusVisual(status: string) {
  const normalized = formatStatus(status);
  if (normalized === "online") return { bg: "rgba(34,197,94,.15)", color: "#15803d" };
  if (normalized === "warning") return { bg: "rgba(245,158,11,.16)", color: "#b45309" };
  if (normalized === "error") return { bg: "rgba(239,68,68,.15)", color: "#b91c1c" };
  if (normalized === "offline") return { bg: "rgba(71,85,105,.18)", color: "#334155" };
  return { bg: "rgba(59,130,246,.14)", color: "#1d4ed8" };
}

export function ResumoTelemetriaDiaria() {
  const [dias, setDias] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<TelemetriaResumoPayload | null>(null);

  const carregar = useCallback(
    async (diasSelecionado: number) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setError("Sessao invalida. Faca login novamente.");
          setPayload(null);
          return;
        }

        const response = await fetch(`/api/telemetria/resumo-diario?dias=${diasSelecionado}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json();

        if (!response.ok || !body?.sucesso) {
          throw new Error(String(body?.erro || "Falha ao carregar resumo da telemetria."));
        }

        setPayload(body.dados as TelemetriaResumoPayload);
      } catch (err) {
        setPayload(null);
        setError(err instanceof Error ? err.message : "Falha ao carregar resumo da telemetria.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void carregar(dias);
  }, [carregar, dias]);

  const maxSerie = useMemo(() => {
    const values = (payload?.serie_paginas_dia || []).map((item) => Number(item.paginas) || 0);
    return Math.max(1, ...values);
  }, [payload]);

  return (
    <section className="ui-card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Telemetria diaria por patrimonio</h2>
          <p className="ui-kv" style={{ margin: "6px 0 0" }}>
            Consolidacao por dia (00:00-23:59, America/Sao_Paulo) com vinculo em inventario/patrimonio.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="ui-select" value={dias} onChange={(event) => setDias(Number(event.target.value))}>
            {PERIODOS.map((periodo) => (
              <option key={periodo.value} value={periodo.value}>
                {periodo.label}
              </option>
            ))}
          </select>
          <button className="ui-btn ui-btn-primary" type="button" onClick={() => void carregar(dias)} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.08)",
            color: "#b91c1c",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="ui-grid-4">
        <article className="ui-card">
          <p className="ui-kv" style={{ margin: 0 }}>Monitoradas no periodo</p>
          <strong style={{ fontSize: 32 }}>{formatNumber(payload?.totais.inventarios_monitorados)}</strong>
        </article>
        <article className="ui-card">
          <p className="ui-kv" style={{ margin: 0 }}>Com coleta hoje</p>
          <strong style={{ fontSize: 32 }}>{formatNumber(payload?.totais.inventarios_com_coleta_hoje)}</strong>
        </article>
        <article className="ui-card">
          <p className="ui-kv" style={{ margin: 0 }}>Sem coleta hoje</p>
          <strong style={{ fontSize: 32 }}>{formatNumber(payload?.totais.inventarios_sem_coleta_hoje)}</strong>
        </article>
        <article className="ui-card">
          <p className="ui-kv" style={{ margin: 0 }}>Paginas hoje</p>
          <strong style={{ fontSize: 32 }}>{formatNumber(payload?.totais.paginas_hoje)}</strong>
        </article>
      </div>

      <div className="ui-grid-2">
        <article className="ui-card" style={{ display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Volume no periodo</h3>
          <p className="ui-kv" style={{ margin: 0 }}>
            Paginas no periodo: <strong>{formatNumber(payload?.totais.paginas_periodo)}</strong>
          </p>
          <p className="ui-kv" style={{ margin: 0 }}>
            Ultima leitura: <strong>{formatDateTime(payload?.totais.ultima_leitura_geral)}</strong>
          </p>
          <p className="ui-kv" style={{ margin: 0 }}>
            Fonte: <strong>{payload?.periodo.fonte === "consolidado_diario" ? "consolidado diario" : "legado agregado"}</strong>
          </p>
        </article>

        <article className="ui-card" style={{ display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Paginas por dia</h3>
          {!payload?.serie_paginas_dia?.length ? (
            <p className="ui-kv" style={{ margin: 0 }}>Sem dados no periodo.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {payload.serie_paginas_dia.map((item) => (
                <div key={item.data_ref} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{item.data_ref}</span>
                    <strong>{formatNumber(item.paginas)}</strong>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 8,
                      borderRadius: 999,
                      background: "var(--ui-border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(2, Math.round((item.paginas / maxSerie) * 100))}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #1d4ed8, #22c55e)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="ui-card">
        <h3 style={{ marginTop: 0 }}>Top impressoras hoje (por patrimonio)</h3>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Patrimonio</th>
                <th>IP</th>
                <th>Setor</th>
                <th>Modelo</th>
                <th>Paginas dia</th>
                <th>Contador atual</th>
                <th>Status</th>
                <th>Ultima leitura</th>
              </tr>
            </thead>
            <tbody>
              {payload?.top_impressoras_hoje?.length ? (
                payload.top_impressoras_hoje.map((item) => (
                  <tr key={`${item.nr_inventario}-${item.patrimonio}`}>
                    <td>{item.patrimonio}</td>
                    <td>{item.ip}</td>
                    <td>{item.setor}</td>
                    <td>{item.modelo}</td>
                    <td>{formatNumber(item.paginas_dia)}</td>
                    <td>{formatNumber(item.contador_atual)}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 76,
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: "lowercase",
                          background: statusVisual(item.status).bg,
                          color: statusVisual(item.status).color,
                        }}
                      >
                        {formatStatus(item.status)}
                      </span>
                    </td>
                    <td>{formatDateTime(item.dt_ultima_leitura)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>Sem leituras para hoje.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
