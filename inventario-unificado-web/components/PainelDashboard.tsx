"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusFeedback } from "@/components/StatusFeedback";
import { supabase } from "@/lib/supabase/client";

type DashboardData = {
  gerado_em: string;
  filtros: {
    dias: number;
    agrupamento: "dia" | "mes";
    setor: string;
    localizacao: string;
  };
  setores_disponiveis: string[];
  localizacoes_disponiveis: string[];
  resumo: {
    total_impressoras: number;
    online: number;
    offline: number;
    suprimentos_criticos: number;
    suprimentos_baixos: number;
    paginas_acumuladas_total_filtro: number;
    paginas_periodo_total: number;
    paginas_acumuladas_total_geral: number;
  };
  faixa_historica_global: {
    primeira_coleta: string | null;
    ultima_coleta: string | null;
  };
  paginas_por_periodo: Array<{
    periodo: string;
    total_paginas: number;
  }>;
  ranking_setores: Array<{
    setor: string;
    total_paginas: number;
    impressoras_ativas: number;
  }>;
  ranking_localizacoes: Array<{
    localizacao: string;
    total_paginas: number;
    impressoras_ativas: number;
  }>;
  suprimentos_delicados: Array<{
    patrimonio: string;
    modelo: string;
    setor: string;
    localizacao: string;
    nome_suprimento: string;
    nivel_percentual: number | null;
    status_suprimento: string;
  }>;
  historico_truncado: boolean;
};

async function invokePrintFunction<T>(action: string, payload?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("inventory-print", {
    body: { action, payload: payload ?? {} },
  });

  if (!error && data?.ok) {
    return data.data as T;
  }

  const reason = error?.message || data?.error || `Falha ao executar ${action}.`;
  throw new Error(reason);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("pt-BR");
}

export function PainelDashboard() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const [dias, setDias] = useState(30);
  const [agrupamento, setAgrupamento] = useState<"dia" | "mes">("dia");
  const [setor, setSetor] = useState("todos");
  const [localizacao, setLocalizacao] = useState("todos");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setSucesso(null);

    try {
      const dados = await invokePrintFunction<DashboardData>("dashboard_analitico", {
        dias,
        agrupamento,
        setor: setor !== "todos" ? setor : null,
        localizacao: localizacao !== "todos" ? localizacao : null,
      });

      setData(dados);
      setSucesso(`Dashboard atualizado em ${new Date(dados.gerado_em).toLocaleString("pt-BR")}.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agrupamento, dias, setor, localizacao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const maxPaginasSerie = useMemo(() => {
    if (!data?.paginas_por_periodo?.length) return 0;
    return Math.max(...data.paginas_por_periodo.map((item) => item.total_paginas));
  }, [data]);

  const maxSetorPaginas = useMemo(() => {
    if (!data?.ranking_setores?.length) return 0;
    return Math.max(...data.ranking_setores.map((item) => item.total_paginas));
  }, [data]);
  const maxLocalizacaoPaginas = useMemo(() => {
    if (!data?.ranking_localizacoes?.length) return 0;
    return Math.max(...data.ranking_localizacoes.map((item) => item.total_paginas));
  }, [data]);

  return (
    <>
      <section className="ui-card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Dashboard de Impressoras</h2>
        <p className="ui-kv" style={{ marginTop: 0 }}>
          Visao analitica por periodo com foco em suprimentos delicados e volume de paginas.
        </p>

        <div className="ui-grid-4">
          <label>
            <span className="ui-kv">Periodo</span>
            <select className="ui-select" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              <option value={7}>Ultimos 7 dias</option>
              <option value={30}>Ultimos 30 dias</option>
              <option value={90}>Ultimos 90 dias</option>
            </select>
          </label>

          <label>
            <span className="ui-kv">Agrupamento</span>
            <select
              className="ui-select"
              value={agrupamento}
              onChange={(e) => setAgrupamento(e.target.value === "mes" ? "mes" : "dia")}
            >
              <option value="dia">Por dia</option>
              <option value="mes">Por mes</option>
            </select>
          </label>

          <label>
            <span className="ui-kv">Setor</span>
            <select className="ui-select" value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="todos">Todos</option>
              {(data?.setores_disponiveis ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="ui-kv">Localizacao</span>
            <select
              className="ui-select"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
            >
              <option value="todos">Todas</option>
              {(data?.localizacoes_disponiveis ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="ui-btn ui-btn-primary" onClick={() => void carregar()}>
              Atualizar dashboard
            </button>
          </div>
        </div>
      </section>

      <StatusFeedback loading={loading} error={erro} success={sucesso} />

      {data ? (
        <>
          <section className="ui-dashboard-grid" style={{ marginBottom: 12 }}>
            <article className="ui-card ui-dash-card">
              <h3>Impressoras (filtro)</h3>
              <p className="big">{formatNumber(data.resumo.total_impressoras)}</p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Online / Offline</h3>
              <p className="big">
                {formatNumber(data.resumo.online)} / {formatNumber(data.resumo.offline)}
              </p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Paginas no periodo</h3>
              <p className="big">{formatNumber(data.resumo.paginas_periodo_total)}</p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Total acumulado (filtro)</h3>
              <p className="big">{formatNumber(data.resumo.paginas_acumuladas_total_filtro)}</p>
            </article>
            <article className="ui-card ui-dash-card">
              <h3>Total acumulado (geral)</h3>
              <p className="big">{formatNumber(data.resumo.paginas_acumuladas_total_geral)}</p>
            </article>
          </section>

          <section className="ui-card" style={{ marginBottom: 12 }}>
            <p className="ui-kv" style={{ margin: 0 }}>
              Base historica valida de paginas:{" "}
              <strong>{formatDateTime(data.faixa_historica_global.primeira_coleta)}</strong>
              {" "}ate{" "}
              <strong>{formatDateTime(data.faixa_historica_global.ultima_coleta)}</strong>.
            </p>
          </section>

          <section className="ui-insight-grid" style={{ marginBottom: 12 }}>
            <article className="ui-card">
              <h3 style={{ marginTop: 0 }}>Paginas por {agrupamento === "dia" ? "dia" : "mes"}</h3>
              <div className="ui-mini-bars">
                {data.paginas_por_periodo.map((item) => {
                  const width =
                    maxPaginasSerie > 0
                      ? Math.max(4, Math.round((item.total_paginas / maxPaginasSerie) * 100))
                      : 0;
                  return (
                    <div key={item.periodo} className="ui-mini-bar-row">
                      <span className="ui-kv" style={{ margin: 0 }}>
                        {item.periodo}
                      </span>
                      <div className="ui-mini-bar-track">
                        <span className="ui-mini-bar-fill" style={{ width: `${width}%` }} />
                      </div>
                      <strong>{formatNumber(item.total_paginas)}</strong>
                    </div>
                  );
                })}
                {!data.paginas_por_periodo.length ? (
                  <span className="ui-kv" style={{ margin: 0 }}>
                    Sem dados no periodo selecionado.
                  </span>
                ) : null}
              </div>
            </article>

            <article className="ui-card">
              <h3 style={{ marginTop: 0 }}>Setores que mais imprimem</h3>
              <div className="ui-mini-bars">
                {data.ranking_setores.map((item) => {
                  const width =
                    maxSetorPaginas > 0
                      ? Math.max(4, Math.round((item.total_paginas / maxSetorPaginas) * 100))
                      : 0;
                  return (
                    <div key={item.setor} className="ui-mini-bar-row">
                      <span className="ui-kv" style={{ margin: 0 }}>
                        {item.setor}
                      </span>
                      <div className="ui-mini-bar-track">
                        <span className="ui-mini-bar-fill" style={{ width: `${width}%` }} />
                      </div>
                      <strong>
                        {formatNumber(item.total_paginas)} ({item.impressoras_ativas})
                      </strong>
                    </div>
                  );
                })}
                {!data.ranking_setores.length ? (
                  <span className="ui-kv" style={{ margin: 0 }}>
                    Sem dados de paginas para ranking de setores.
                  </span>
                ) : null}
              </div>
            </article>

            <article className="ui-card">
              <h3 style={{ marginTop: 0 }}>Localizacoes que mais imprimem</h3>
              <div className="ui-mini-bars">
                {data.ranking_localizacoes.map((item) => {
                  const width =
                    maxLocalizacaoPaginas > 0
                      ? Math.max(4, Math.round((item.total_paginas / maxLocalizacaoPaginas) * 100))
                      : 0;
                  return (
                    <div key={item.localizacao} className="ui-mini-bar-row">
                      <span className="ui-kv" style={{ margin: 0 }}>
                        {item.localizacao}
                      </span>
                      <div className="ui-mini-bar-track">
                        <span className="ui-mini-bar-fill" style={{ width: `${width}%` }} />
                      </div>
                      <strong>
                        {formatNumber(item.total_paginas)} ({item.impressoras_ativas})
                      </strong>
                    </div>
                  );
                })}
                {!data.ranking_localizacoes.length ? (
                  <span className="ui-kv" style={{ margin: 0 }}>
                    Sem dados de paginas para ranking de localizacoes.
                  </span>
                ) : null}
              </div>
            </article>

            <article className="ui-card">
              <h3 style={{ marginTop: 0 }}>Suprimentos mais delicados</h3>
              <div className="ui-table-wrap" style={{ border: "none", padding: 0 }}>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Patrimonio</th>
                      <th>Setor</th>
                      <th>Localizacao</th>
                      <th>Suprimento</th>
                      <th>Nivel</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suprimentos_delicados.map((item) => (
                      <tr key={`${item.patrimonio}-${item.nome_suprimento}`}>
                        <td>{item.patrimonio}</td>
                        <td>{item.setor}</td>
                        <td>{item.localizacao}</td>
                        <td>{item.nome_suprimento}</td>
                        <td>{formatNivel(item.nivel_percentual)}</td>
                        <td>
                          <span
                            className={`ui-pill ${
                              item.nivel_percentual !== null && item.nivel_percentual <= 10
                                ? "danger"
                                : "warn"
                            }`}
                          >
                            {item.status_suprimento}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!data.suprimentos_delicados.length ? (
                      <tr>
                        <td colSpan={6}>Nenhum suprimento baixo/critico no filtro atual.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          {data.historico_truncado ? (
            <section className="ui-card" style={{ marginBottom: 12 }}>
              <p className="ui-kv" style={{ margin: 0 }}>
                Historico muito grande para uma unica consulta. O resultado foi truncado para manter a
                tela rapida.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
