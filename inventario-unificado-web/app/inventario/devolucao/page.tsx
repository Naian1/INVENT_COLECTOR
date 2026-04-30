'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BasicPageShell } from '@/components/BasicPageShell';
import { StatusFeedback } from '@/components/StatusFeedback';
import { supabase } from '@/lib/supabase/client';

type DevolucaoItem = {
  nr_inventario: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  nr_ip: string | null;
  setor_atual: string | null;
  setor_descricao: string | null;
  equipamento_modelo: string | null;
  empresa: string | null;
  cd_cgc: string | null;
  nr_chamado: string | null;
  ds_observacao_movimentacao: string | null;
  dt_movimentacao: string | null;
  dt_atualizacao: string | null;
  ie_situacao: string | null;
  tp_status: string | null;
};

function normalizarTexto(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatarDataHora(value: string | null): string {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(dt);
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const normalized = raw.replace(/\r?\n/g, ' ').trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}

async function invokeInventoryCore<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('inventory-core', {
    body: { action, payload: payload ?? {} },
  });

  if (!error && data?.ok) {
    return data.data as T;
  }

  const reason = error?.message || data?.error || 'inventory-core indisponivel';
  throw new Error(`Falha ao executar inventory-core: ${reason}`);
}

export default function InventarioDevolucaoPage() {
  const [items, setItems] = useState<DevolucaoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const data = await invokeInventoryCore<DevolucaoItem[]>('list_devolucao');
      const lista = Array.isArray(data) ? data : [];
      setItems(lista);
      setSuccessMessage(`Itens em devolução carregados: ${lista.length}.`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Falha ao carregar devolução.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const empresas = useMemo(() => {
    const bag = new Set<string>();
    for (const item of items) {
      const nome = String(item.empresa || 'Sem empresa').trim();
      if (nome) bag.add(nome);
    }
    return Array.from(bag).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtrados = useMemo(() => {
    const empresaNorm = normalizarTexto(empresaFiltro);
    const buscaNorm = normalizarTexto(busca.trim());

    return items.filter((item) => {
      const empresaNome = item.empresa || 'Sem empresa';
      if (empresaNorm && normalizarTexto(empresaNome) !== empresaNorm) return false;

      if (!buscaNorm) return true;

      const bag = normalizarTexto([
        item.nr_inventario,
        item.nr_patrimonio,
        item.nr_serie,
        item.nr_ip,
        item.setor_atual,
        item.equipamento_modelo,
        item.empresa,
        item.nr_chamado,
        item.ds_observacao_movimentacao,
      ].join(' '));

      return bag.includes(buscaNorm);
    });
  }, [busca, empresaFiltro, items]);

  const gruposEmpresa = useMemo(() => {
    const grouped = new Map<string, DevolucaoItem[]>();
    for (const item of filtrados) {
      const key = String(item.empresa || 'Sem empresa').trim() || 'Sem empresa';
      const current = grouped.get(key) || [];
      current.push(item);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([empresa, lista]) => ({
        empresa,
        itens: [...lista].sort((x, y) => {
          const p1 = String(x.nr_patrimonio || '');
          const p2 = String(y.nr_patrimonio || '');
          return p1.localeCompare(p2) || x.nr_inventario - y.nr_inventario;
        }),
      }));
  }, [filtrados]);

  const totalComChamado = useMemo(
    () => filtrados.filter((item) => String(item.nr_chamado || '').trim().length > 0).length,
    [filtrados],
  );

  const exportarPlanilha = async () => {
    if (!filtrados.length) {
      setErrorMessage('Não há itens para exportar.');
      return;
    }

    try {
      const xlsx = await import('xlsx');
      const rows = filtrados.map((item) => ({
        empresa: item.empresa || 'Sem empresa',
        patrimonio: item.nr_patrimonio || '',
        modelo: item.equipamento_modelo || '',
        setor_atual: item.setor_atual || '',
        numero_chamado: item.nr_chamado || '',
        serie: item.nr_serie || '',
        ip: item.nr_ip || '',
        ultima_movimentacao: formatarDataHora(item.dt_movimentacao),
        observacao_movimentacao: item.ds_observacao_movimentacao || '',
        status: item.tp_status || '',
        situacao: item.ie_situacao || '',
      }));

      const ws = xlsx.utils.json_to_sheet(rows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Devolucao');

      const stamp = new Date().toISOString().slice(0, 10);
      xlsx.writeFile(wb, `devolucao-por-empresa-${stamp}.xlsx`);
      setSuccessMessage('Planilha exportada com sucesso.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Falha ao exportar planilha.');
    }
  };

  const exportarCsv = () => {
    if (!filtrados.length) {
      setErrorMessage('Não há itens para exportar.');
      return;
    }

    try {
      const cabecalho = [
        'empresa',
        'patrimonio',
        'modelo',
        'setor_atual',
        'numero_chamado',
        'serie',
        'ip',
        'ultima_movimentacao',
        'observacao_movimentacao',
        'status',
        'situacao',
      ];

      const linhas = filtrados.map((item) => [
        item.empresa || 'Sem empresa',
        item.nr_patrimonio || '',
        item.equipamento_modelo || '',
        item.setor_atual || '',
        item.nr_chamado || '',
        item.nr_serie || '',
        item.nr_ip || '',
        formatarDataHora(item.dt_movimentacao),
        item.ds_observacao_movimentacao || '',
        item.tp_status || '',
        item.ie_situacao || '',
      ]);

      const csv = [
        cabecalho.map(escapeCsvCell).join(';'),
        ...linhas.map((linha) => linha.map(escapeCsvCell).join(';')),
      ].join('\r\n');

      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devolucao-por-empresa-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage('CSV exportado com sucesso.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Falha ao exportar CSV.');
    }
  };

  const exportarPdf = async () => {
    if (!gruposEmpresa.length) {
      setErrorMessage('Não há itens para exportar.');
      return;
    }

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = (autoTableModule as any).default;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const margemX = 36;
      let cursorY = 36;

      doc.setFontSize(16);
      doc.text('Inventário em devolução por empresa', margemX, cursorY);
      cursorY += 16;
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margemX, cursorY);
      doc.setTextColor(15, 23, 42);
      cursorY += 18;

      for (const grupo of gruposEmpresa) {
        if (cursorY > 520) {
          doc.addPage();
          cursorY = 36;
        }

        doc.setFontSize(12);
        doc.text(`${grupo.empresa} (${grupo.itens.length})`, margemX, cursorY);

        autoTable(doc, {
          startY: cursorY + 8,
          margin: { left: margemX, right: margemX },
          head: [[
            'ID',
            'Patrimônio',
            'Modelo',
            'Setor atual',
            'Chamado',
            'Série',
            'IP',
            'Última movimentação',
          ]],
          body: grupo.itens.map((item) => [
            item.nr_inventario,
            item.nr_patrimonio || '-',
            item.equipamento_modelo || '-',
            item.setor_atual || '-',
            item.nr_chamado || '-',
            item.nr_serie || '-',
            item.nr_ip || '-',
            formatarDataHora(item.dt_movimentacao),
          ]),
          styles: {
            fontSize: 8,
            cellPadding: 4,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
          },
          theme: 'grid',
          tableWidth: 'auto',
          didDrawPage: () => {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(
              `Página ${doc.getNumberOfPages()}`,
              doc.internal.pageSize.getWidth() - 70,
              doc.internal.pageSize.getHeight() - 12,
            );
            doc.setTextColor(15, 23, 42);
          },
        });

        cursorY = ((doc as any).lastAutoTable?.finalY || cursorY + 120) + 18;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`devolucao-por-empresa-${stamp}.pdf`);
      setSuccessMessage('PDF exportado com sucesso.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Falha ao exportar PDF.');
    }
  };

  return (
    <BasicPageShell
      title="Inventário - Devolução"
      subtitle="Itens em devolução agrupados por empresa, com número de chamado e exportação."
      actions={
        <div className="ui-row">
          <button type="button" className="ui-btn" onClick={() => void carregar()}>
            Atualizar
          </button>
          <button type="button" className="ui-btn" onClick={exportarCsv}>
            Exportar CSV
          </button>
          <button type="button" className="ui-btn" onClick={() => void exportarPdf()}>
            Exportar PDF
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => void exportarPlanilha()}>
            Exportar planilha
          </button>
        </div>
      }
    >
      <StatusFeedback loading={loading} error={errorMessage} success={successMessage} />

      <section className="ui-card" style={{ display: 'grid', gap: 12 }}>
        <div className="ui-grid-3">
          <label>
            <span className="ui-kv">Empresa</span>
            <select
              className="ui-select"
              value={empresaFiltro}
              onChange={(event) => setEmpresaFiltro(event.target.value)}
            >
              <option value="">Todas</option>
              {empresas.map((empresa) => (
                <option key={empresa} value={empresa}>
                  {empresa}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="ui-kv">Busca</span>
            <input
              className="ui-field"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Patrimônio, modelo, setor, chamado..."
            />
          </label>

          <div className="ui-row" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="ui-btn"
              onClick={() => {
                setEmpresaFiltro('');
                setBusca('');
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="ui-row">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Total: {filtrados.length}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">Empresas: {gruposEmpresa.length}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Com chamado: {totalComChamado}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Sem chamado: {Math.max(0, filtrados.length - totalComChamado)}</span>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 16 }}>
        {!gruposEmpresa.length ? (
          <div className="ui-card">Nenhum item de devolução encontrado para os filtros atuais.</div>
        ) : null}

        {gruposEmpresa.map((grupo) => (
          <div key={grupo.empresa} className="ui-card" style={{ overflowX: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>{grupo.empresa}</h2>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patrimônio</th>
                  <th>Modelo</th>
                  <th>Setor atual</th>
                  <th>Chamado</th>
                  <th>Série</th>
                  <th>IP</th>
                  <th>Última movimentação</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {grupo.itens.map((item) => (
                  <tr key={item.nr_inventario}>
                    <td>{item.nr_inventario}</td>
                    <td>{item.nr_patrimonio || '-'}</td>
                    <td>{item.equipamento_modelo || '-'}</td>
                    <td>{item.setor_atual || '-'}</td>
                    <td>{item.nr_chamado || '-'}</td>
                    <td>{item.nr_serie || '-'}</td>
                    <td>{item.nr_ip || '-'}</td>
                    <td>{formatarDataHora(item.dt_movimentacao)}</td>
                    <td>{item.ds_observacao_movimentacao || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </BasicPageShell>
  );
}
