'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BasicPageShell } from '@/components/BasicPageShell';
import { supabase } from '@/lib/supabase/client';

type CargaConsolidado = {
  nr_carga: number;
  nr_competencia: string;
  nm_arquivo: string;
  nr_total_linhas: number;
  dt_importacao: string;
};

type LinhaConsolidado = {
  nr_linha: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  nr_id_equipamento: string | null;
  nm_tipo: string | null;
  ds_produto: string | null;
  nm_cliente: string | null;
  nm_local: string | null;
  tp_status: string | null;
  nr_nf_faturamento: string | null;
  dt_faturamento: string | null;
};

type ConsolidadoResponse = {
  cargas: CargaConsolidado[];
  cargaSelecionada: CargaConsolidado | null;
  filtros: {
    competencia: string | null;
    patrimonio: string | null;
    serie: string | null;
  };
  linhas: LinhaConsolidado[];
  paginacao?: {
    pagina: number;
    tamanhoPagina: number;
    total: number;
    totalPaginas: number;
    temAnterior: boolean;
    temProxima: boolean;
  };
};

async function invokeInventoryCore<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('inventory-core', {
    body: { action, payload: payload ?? {} },
  });

  if (!error && data?.ok) {
    return data.data as T;
  }

  const reason = error?.message || data?.error || 'inventory-core indisponivel';
  throw new Error(reason);
}

function formatarData(dataIso: string | null): string {
  if (!dataIso) return '-';
  const date = new Date(dataIso);
  if (Number.isNaN(date.getTime())) return dataIso;
  return date.toLocaleDateString('pt-BR');
}

export default function InventarioConsolidadoPage() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<ConsolidadoResponse | null>(null);

  const [competencia, setCompetencia] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [serie, setSerie] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(500);

  const carregar = async (filtros?: {
    competencia?: string;
    patrimonio?: string;
    serie?: string;
    pagina?: number;
    tamanhoPagina?: number;
  }) => {
    setCarregando(true);
    setErro(null);

    try {
      const parsed = await invokeInventoryCore<ConsolidadoResponse>('matrix_lines', {
        competencia: filtros?.competencia || null,
        patrimonio: filtros?.patrimonio || null,
        serie: filtros?.serie || null,
        pagina: filtros?.pagina ?? 1,
        tamanhoPagina: filtros?.tamanhoPagina ?? tamanhoPagina,
      });
      setDados(parsed);

      setCompetencia(parsed.filtros.competencia || '');
      setPatrimonio(parsed.filtros.patrimonio || '');
      setSerie(parsed.filtros.serie || '');
      setPagina(parsed.paginacao?.pagina || 1);
      setTamanhoPagina(parsed.paginacao?.tamanhoPagina || tamanhoPagina);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha de conexao ao consultar Matrix.';
      setErro(message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const resumo = useMemo(() => {
    const total = dados?.paginacao?.total || 0;
    const exibidas = dados?.linhas.length || 0;
    const comPatrimonio = (dados?.linhas || []).filter((item) => item.nr_patrimonio).length;
    const comSerie = (dados?.linhas || []).filter((item) => item.nr_serie).length;

    return {
      total,
      exibidas,
      comPatrimonio,
      comSerie,
    };
  }, [dados]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void carregar({ competencia, patrimonio, serie, pagina: 1, tamanhoPagina });
  };

  const irParaPagina = (novaPagina: number) => {
    void carregar({ competencia, patrimonio, serie, pagina: novaPagina, tamanhoPagina });
  };

  return (
    <BasicPageShell
      title="Matrix Mensal"
      subtitle="Base externa Matrix para apoio de preenchimento; o inventario oficial fica na tela de inventario"
      actions={
        <div className="flex items-center gap-2">
          <a
            href="/inventario/importacoes"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Voltar para importacoes
          </a>
          <a
            href="/inventario/conciliacao"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ir para conciliacao
          </a>
        </div>
      }
    >
      <div className="space-y-4">
        {erro ? <div className="rounded bg-red-100 p-3 text-red-800">{erro}</div> : null}

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded border bg-white p-4 md:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Competencia</span>
            <select
              value={competencia}
              onChange={(event) => setCompetencia(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2"
            >
              {(dados?.cargas || []).map((carga) => (
                <option key={carga.nr_carga} value={carga.nr_competencia}>
                  {carga.nr_competencia}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Patrimonio</span>
            <input
              value={patrimonio}
              onChange={(event) => setPatrimonio(event.target.value)}
              placeholder="Ex: 123456"
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Serie</span>
            <input
              value={serie}
              onChange={(event) => setSerie(event.target.value)}
              placeholder="Ex: SN123"
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
            >
              {carregando ? 'Filtrando...' : 'Filtrar'}
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Linhas por pagina</span>
            <select
              value={tamanhoPagina}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTamanhoPagina(next);
                void carregar({ competencia, patrimonio, serie, pagina: 1, tamanhoPagina: next });
              }}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </label>
        </form>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Total Matrix: {resumo.total}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">Exibidas na pagina: {resumo.exibidas}</span>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">Com patrimonio (pagina): {resumo.comPatrimonio}</span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">Com serie (pagina): {resumo.comSerie}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
            Arquivo: {dados?.cargaSelecionada?.nm_arquivo || '-'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm">
          <span>
            Pagina {dados?.paginacao?.pagina || 1} de {dados?.paginacao?.totalPaginas || 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => irParaPagina((dados?.paginacao?.pagina || 1) - 1)}
              disabled={!dados?.paginacao?.temAnterior || carregando}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => irParaPagina((dados?.paginacao?.pagina || 1) + 1)}
              disabled={!dados?.paginacao?.temProxima || carregando}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Linha</th>
                <th className="p-2 text-left">Patrimonio</th>
                <th className="p-2 text-left">Serie</th>
                <th className="p-2 text-left">ID Equip.</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Descricao</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Local</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">NF</th>
                <th className="p-2 text-left">Data Fat.</th>
              </tr>
            </thead>
            <tbody>
              {(dados?.linhas || []).map((linha) => (
                <tr key={`${linha.nr_linha}-${linha.nr_id_equipamento || 'x'}`} className="border-t">
                  <td className="p-2">{linha.nr_linha}</td>
                  <td className="p-2 font-mono">{linha.nr_patrimonio || '-'}</td>
                  <td className="p-2">{linha.nr_serie || '-'}</td>
                  <td className="p-2">{linha.nr_id_equipamento || '-'}</td>
                  <td className="p-2">{linha.nm_tipo || '-'}</td>
                  <td className="p-2">{linha.ds_produto || '-'}</td>
                  <td className="p-2">{linha.nm_cliente || '-'}</td>
                  <td className="p-2">{linha.nm_local || '-'}</td>
                  <td className="p-2">{linha.tp_status || '-'}</td>
                  <td className="p-2">{linha.nr_nf_faturamento || '-'}</td>
                  <td className="p-2">{formatarData(linha.dt_faturamento)}</td>
                </tr>
              ))}

              {!carregando && (dados?.linhas || []).length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-slate-500">
                    Nenhuma linha encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </BasicPageShell>
  );
}
