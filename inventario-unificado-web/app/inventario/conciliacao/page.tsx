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

type InventarioItem = {
  nr_inventario: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  tp_status: string | null;
  cd_equipamento: number;
  cd_setor: number;
};

type ConsolidadoItem = {
  nr_linha: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  nr_id_equipamento: string | null;
  nm_tipo: string | null;
  ds_produto: string | null;
};

type DuplicidadeInventario = {
  patrimonio_normalizado: string;
  quantidade: number;
  itens: InventarioItem[];
};

type DuplicidadeConsolidado = {
  patrimonio_normalizado: string;
  quantidade: number;
  itens: ConsolidadoItem[];
};

type ConciliacaoResponse = {
  filtros: {
    competencia: string | null;
    patrimonio: string | null;
    limite: number;
  };
  cargas: CargaConsolidado[];
  cargaSelecionada: CargaConsolidado | null;
  resumo: {
    totalInventario: number;
    totalConsolidado: number;
    inventarioSemPatrimonio: number;
    consolidadoSemPatrimonio: number;
    duplicidadesInventario: number;
    duplicidadesConsolidado: number;
    consolidadoNaoNoInventario: number;
    inventarioNaoNoConsolidado: number;
  };
  duplicidades: {
    inventario: DuplicidadeInventario[];
    consolidado: DuplicidadeConsolidado[];
  };
  divergencias: {
    consolidadoNaoNoInventario: ConsolidadoItem[];
    inventarioNaoNoConsolidado: InventarioItem[];
  };
  amostras: {
    inventarioSemPatrimonio: InventarioItem[];
    consolidadoSemPatrimonio: ConsolidadoItem[];
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

export default function InventarioConciliacaoPage() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<ConciliacaoResponse | null>(null);

  const [competencia, setCompetencia] = useState('');
  const [patrimonio, setPatrimonio] = useState('');

  const carregar = async (filtros?: { competencia?: string; patrimonio?: string }) => {
    setCarregando(true);
    setErro(null);

    try {
      const parsed = await invokeInventoryCore<ConciliacaoResponse>('matrix_conciliacao', {
        competencia: filtros?.competencia || null,
        patrimonio: filtros?.patrimonio || null,
      });
      setDados(parsed);
      setCompetencia(parsed.filtros.competencia || '');
      setPatrimonio(parsed.filtros.patrimonio || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha de conexão ao executar conciliação.';
      setErro(message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const resumo = useMemo(
    () =>
      dados?.resumo || {
        totalInventario: 0,
        totalConsolidado: 0,
        inventarioSemPatrimonio: 0,
        consolidadoSemPatrimonio: 0,
        duplicidadesInventario: 0,
        duplicidadesConsolidado: 0,
        consolidadoNaoNoInventario: 0,
        inventarioNaoNoConsolidado: 0,
      },
    [dados],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void carregar({ competencia, patrimonio });
  };

  return (
    <BasicPageShell
      title="Conciliação Inventário x Matrix"
      subtitle="Tela separada para detectar duplicidades e divergências entre as duas bases"
      actions={
        <div className="flex items-center gap-2">
          <a
            href="/inventario"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Voltar para inventário
          </a>
          <a
            href="/inventario/consolidado"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver Matrix
          </a>
        </div>
      }
    >
      <div className="space-y-4">
        {erro ? <div className="rounded bg-red-100 p-3 text-red-800">{erro}</div> : null}

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded border bg-white p-4 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Competência</span>
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

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Patrimônio (filtro opcional)</span>
            <input
              value={patrimonio}
              onChange={(event) => setPatrimonio(event.target.value)}
              placeholder="Ex: 123456"
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
            >
              {carregando ? 'Processando...' : 'Atualizar conciliação'}
            </button>
          </div>
        </form>

        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Inventário oficial: esta tela não altera dados, apenas compara o inventário interno com a Matrix da competência selecionada.
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">Inventário: {resumo.totalInventario}</span>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">Matrix: {resumo.totalConsolidado}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Inventário sem patrimônio: {resumo.inventarioSemPatrimonio}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Matrix sem patrimônio: {resumo.consolidadoSemPatrimonio}
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">Dup. Inventário: {resumo.duplicidadesInventario}</span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">Dup Matrix: {resumo.duplicidadesConsolidado}</span>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">
            Matrix sem inventário: {resumo.consolidadoNaoNoInventario}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
            Inventário sem Matrix: {resumo.inventarioNaoNoConsolidado}
          </span>
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          As tabelas abaixo exibem até {dados?.filtros.limite || 0} linhas por bloco para manter performance. Os contadores acima representam os totais reais.
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="overflow-auto rounded border bg-white">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
              Duplicidades no inventário (mesmo patrimônio)
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Patrimônio</th>
                  <th className="p-2 text-left">Qtd</th>
                  <th className="p-2 text-left">IDs inventario</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.duplicidades.inventario || []).map((group) => (
                  <tr key={group.patrimonio_normalizado} className="border-t">
                    <td className="p-2 font-mono">{group.patrimonio_normalizado}</td>
                    <td className="p-2">{group.quantidade}</td>
                    <td className="p-2">{group.itens.map((item) => item.nr_inventario).join(', ')}</td>
                  </tr>
                ))}
                {!carregando && (dados?.duplicidades.inventario || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-3 text-center text-slate-500">Sem duplicidades no inventário.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="overflow-auto rounded border bg-white">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
              Duplicidades na Matrix (mesmo patrimônio)
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Patrimônio</th>
                  <th className="p-2 text-left">Qtd</th>
                  <th className="p-2 text-left">Linhas</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.duplicidades.consolidado || []).map((group) => (
                  <tr key={group.patrimonio_normalizado} className="border-t">
                    <td className="p-2 font-mono">{group.patrimonio_normalizado}</td>
                    <td className="p-2">{group.quantidade}</td>
                    <td className="p-2">{group.itens.map((item) => item.nr_linha).join(', ')}</td>
                  </tr>
                ))}
                {!carregando && (dados?.duplicidades.consolidado || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-3 text-center text-slate-500">Sem duplicidades no consolidado.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="overflow-auto rounded border bg-white">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
              Matrix que não existe no inventário
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Linha</th>
                  <th className="p-2 text-left">Patrimônio</th>
                  <th className="p-2 text-left">Série</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.divergencias.consolidadoNaoNoInventario || []).map((item) => (
                  <tr key={`${item.nr_linha}-${item.nr_patrimonio || 'x'}`} className="border-t">
                    <td className="p-2">{item.nr_linha}</td>
                    <td className="p-2 font-mono">{item.nr_patrimonio || '-'}</td>
                    <td className="p-2">{item.nr_serie || '-'}</td>
                    <td className="p-2">{item.nm_tipo || '-'}</td>
                    <td className="p-2">{item.ds_produto || '-'}</td>
                  </tr>
                ))}
                {!carregando && (dados?.divergencias.consolidadoNaoNoInventario || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-500">Sem divergencias neste bloco.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="overflow-auto rounded border bg-white">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
              Inventário que não existe no consolidado
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">ID Inventário</th>
                  <th className="p-2 text-left">Patrimônio</th>
                  <th className="p-2 text-left">Série</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Setor</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.divergencias.inventarioNaoNoConsolidado || []).map((item) => (
                  <tr key={item.nr_inventario} className="border-t">
                    <td className="p-2">{item.nr_inventario}</td>
                    <td className="p-2 font-mono">{item.nr_patrimonio || '-'}</td>
                    <td className="p-2">{item.nr_serie || '-'}</td>
                    <td className="p-2">{item.tp_status || '-'}</td>
                    <td className="p-2">{item.cd_setor}</td>
                  </tr>
                ))}
                {!carregando && (dados?.divergencias.inventarioNaoNoConsolidado || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-500">Sem divergencias neste bloco.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="overflow-auto rounded border bg-white">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
              Inventário sem patrimônio
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">ID</th>
                  <th className="p-2 text-left">Série</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.amostras.inventarioSemPatrimonio || []).map((item) => (
                  <tr key={item.nr_inventario} className="border-t">
                    <td className="p-2">{item.nr_inventario}</td>
                    <td className="p-2">{item.nr_serie || '-'}</td>
                    <td className="p-2">{item.tp_status || '-'}</td>
                  </tr>
                ))}
                {!carregando && (dados?.amostras.inventarioSemPatrimonio || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-3 text-center text-slate-500">Nenhum item sem patrimônio.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="overflow-auto rounded border bg-white">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
              Consolidado sem patrimônio
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Linha</th>
                  <th className="p-2 text-left">Série</th>
                  <th className="p-2 text-left">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.amostras.consolidadoSemPatrimonio || []).map((item) => (
                  <tr key={`sem-${item.nr_linha}`} className="border-t">
                    <td className="p-2">{item.nr_linha}</td>
                    <td className="p-2">{item.nr_serie || '-'}</td>
                    <td className="p-2">{item.nm_tipo || '-'}</td>
                  </tr>
                ))}
                {!carregando && (dados?.amostras.consolidadoSemPatrimonio || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-3 text-center text-slate-500">Nenhuma linha sem patrimônio.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </BasicPageShell>
  );
}
