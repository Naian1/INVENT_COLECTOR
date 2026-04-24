'use client';

import { useEffect, useMemo, useState } from 'react';
import { BasicPageShell } from '@/components/BasicPageShell';
import { supabase } from '@/lib/supabase/client';

type EmpresaOption = {
  cd_cgc: string;
  nm_empresa: string;
};

type LinhaImportacao = {
  cd_cgc?: string;
  nm_empresa?: string;
  nm_tipo_equipamento?: string;
  nm_equipamento?: string;
  ds_equipamento?: string;
  nm_marca?: string;
  nm_modelo?: string;
  nm_setor?: string;
  ds_setor?: string;
  nr_patrimonio?: string;
  nr_serie?: string;
};

function normalizarHeader(header: unknown) {
  return String(header ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CABECALHOS_MATRIX_SUPORTADOS = new Set([
  'observacao',
  'descricao ctr',
  'projeto',
  'contrato',
  'obra',
  'termo',
  'equipamento',
  'patrimonio',
  'nr patrimonio',
  'codigo cliente',
  'codigo do cliente',
  'nome do cliente',
  'id equipamento',
  'sku',
  'item',
  'tipo',
  'descricao do produto',
  'descricao',
  'descricao_1',
  'nf de faturamento',
  'data de faturamento',
  'serie do equipamento',
  'n.serie',
  'n serie',
  'serie',
  'nr_serie',
  'numero_serie',
  'hostname',
  'host name',
  'nm hostname',
  'local',
  'localizacao',
  'setor',
  'nm_setor',
  'status',
  'tp status',
  'tp_status',
  'status item',
  'situacao',
  'situacao do item',
]);

const CAMPOS_CHAVE_MATRIX: Array<{ campo: string; aliases: string[] }> = [
  { campo: 'cliente', aliases: ['codigo cliente', 'codigo do cliente'] },
  { campo: 'nome_cliente', aliases: ['nome do cliente'] },
  { campo: 'patrimonio', aliases: ['equipamento', 'patrimonio', 'nr patrimonio'] },
  {
    campo: 'serie',
    aliases: ['serie do equipamento', 'n.serie', 'n serie', 'serie', 'nr_serie', 'numero_serie'],
  },
  { campo: 'tipo', aliases: ['tipo'] },
  { campo: 'descricao', aliases: ['descricao do produto', 'descricao', 'descricao_1'] },
];

function analisarCabecalhosMatrix(headersOriginais: string[]) {
  const headersNormalizados = headersOriginais
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({ original: item, normalizado: normalizarHeader(item) }));

  const headerSet = new Set(headersNormalizados.map((item) => item.normalizado));

  const faltandoCampos = CAMPOS_CHAVE_MATRIX
    .filter(({ aliases }) => aliases.every((alias) => !headerSet.has(alias)))
    .map(({ campo }) => campo);

  const cabecalhosNaoMapeados = headersNormalizados
    .filter((item) => !CABECALHOS_MATRIX_SUPORTADOS.has(item.normalizado))
    .map((item) => item.original);

  return {
    faltandoCampos,
    cabecalhosNaoMapeados,
  };
}

function mapearLinha(raw: Record<string, unknown>): LinhaImportacao {
  const entries = Object.entries(raw).map(([k, v]) => [normalizarHeader(k), v] as const);
  const map = new Map(entries);

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = map.get(key);
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return undefined;
  };

  return {
    cd_cgc: pick('cd_cgc', 'cgc', 'cnpj', 'cnpj do cliente', 'cnpj de remessa'),
    nm_empresa: pick('nome do cliente', 'empresa', 'nm_empresa', 'fornecedor'),
    nm_tipo_equipamento: pick('tipo', 'tipo_equipamento', 'nm_tipo_equipamento'),
    nm_equipamento: pick(
      'descricao do produto',
      'descricao',
      'descricao_1',
      'equipamento',
      'nm_equipamento',
      'descricao_equipamento',
      'descricao ctr',
    ),
    ds_equipamento: pick('descricao do produto', 'descricao', 'descricao_1', 'ds_equipamento', 'descricao ctr'),
    nm_marca: pick('marca', 'nm_marca', 'fabricante'),
    nm_modelo: pick('descricao do produto', 'descricao', 'descricao_1', 'modelo', 'nm_modelo'),
    nm_setor: pick('setor', 'nm_setor', 'obra', 'termo', 'projeto', 'contrato', 'andar', 'local'),
    ds_setor: pick('ds_setor', 'descricao_setor'),
    nr_patrimonio: pick('equipamento', 'patrimonio', 'nr_patrimonio', 'nr patrimonio', 'id equipamento', 'codigo_barra'),
    nr_serie: pick('serie do equipamento', 'n.serie', 'n serie', 'serie', 'nr_serie', 'numero_serie'),
  };
}

function competenciaAtual() {
  const now = new Date();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const ano = String(now.getFullYear());
  return `${mes}/${ano}`;
}

function validarCompetencia(valor: string) {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(valor.trim());
}

function normalizarStatus(value: unknown): 'ATIVO' | 'MANUTENCAO' | 'BACKUP' | 'DEVOLUCAO' | null {
  const raw = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (raw === 'ATIVO') return 'ATIVO';
  if (raw === 'MANUTENCAO') return 'MANUTENCAO';
  if (raw === 'BACKUP') return 'BACKUP';
  if (raw === 'DEVOLUCAO') return 'DEVOLUCAO';
  return null;
}

function normalizarTimestamp(value: unknown): string | null {
  const texto = String(value ?? '').trim();
  if (!texto) return null;

  const iso = new Date(texto);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString();

  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!br) return null;

  const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = br;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapearLinhaMatrixParaBanco(raw: Record<string, unknown>) {
  const entries = Object.entries(raw).map(([k, v]) => [normalizarHeader(k), v] as const);
  const map = new Map(entries);

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = map.get(key);
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return null;
  };

  const observacao = pick('observacao', 'descricao ctr');
  const projeto = pick('projeto', 'contrato');
  const obra = pick('obra', 'termo');
  const localComposto = [
    projeto ? `Projeto ${projeto}` : null,
    obra ? `Obra ${obra}` : null,
  ].filter(Boolean).join(' / ');

  let tp_status = normalizarStatus(
    pick('status', 'tp status', 'tp_status', 'status item', 'situacao', 'situacao do item'),
  );

  if (!tp_status && observacao) {
    const obs = normalizarHeader(observacao);
    if (obs.includes('devolucao')) tp_status = 'DEVOLUCAO';
    else if (obs.includes('manutencao')) tp_status = 'MANUTENCAO';
    else if (obs.includes('backup')) tp_status = 'BACKUP';
  }

  const nr_patrimonio = pick('equipamento', 'patrimonio', 'nr patrimonio');

  return {
    cd_cliente: pick('codigo cliente', 'codigo do cliente'),
    nm_cliente: pick('nome do cliente'),
    nr_projeto: projeto,
    nr_obra: obra,
    nr_id_equipamento: pick('id equipamento', 'sku', 'item'),
    nr_patrimonio,
    nm_tipo: pick('tipo'),
    ds_produto: pick('descricao do produto', 'descricao', 'descricao_1'),
    nr_nf_faturamento: pick('nf de faturamento'),
    dt_faturamento: normalizarTimestamp(pick('data de faturamento')),
    nr_serie: pick('serie do equipamento', 'n.serie', 'n serie', 'serie', 'nr_serie', 'numero_serie'),
    ds_observacao_linha: observacao,
    nm_hostname: pick('hostname', 'host name', 'nm hostname'),
    nm_local: localComposto || pick('local', 'localizacao', 'setor', 'nm_setor'),
    tp_status,
    dados_json: {
      cd_cliente: pick('codigo cliente'),
      nm_cliente: pick('nome do cliente'),
      nr_id_equipamento: pick('id equipamento'),
      nr_patrimonio,
      nm_tipo: pick('tipo'),
      ds_produto: pick('descricao do produto'),
      nr_serie: pick('serie do equipamento'),
    },
  };
}

export default function ImportacoesInventarioPage() {
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState('');
  const [arquivoNome, setArquivoNome] = useState('');
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);
  const [linhasBrutas, setLinhasBrutas] = useState<Array<Record<string, unknown>>>([]);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [loadingConsolidado, setLoadingConsolidado] = useState(false);
  const [progressoConsolidado, setProgressoConsolidado] = useState<number>(0);
  const [faltandoCabecalhos, setFaltandoCabecalhos] = useState<string[]>([]);
  const [cabecalhosNaoMapeados, setCabecalhosNaoMapeados] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const preview = useMemo(() => linhas.slice(0, 10), [linhas]);

  useEffect(() => {
    const carregarEmpresas = async () => {
      try {
        const response = await fetch(`/api/empresas?ts=${Date.now()}`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error || 'Falha ao carregar empresas.');
        }

        const lista = (Array.isArray(body) ? body : [])
          .map((item) => ({
            cd_cgc: String(item?.cd_cgc || ''),
            nm_empresa: String(item?.nm_empresa || ''),
          }))
          .filter((item) => item.cd_cgc && item.nm_empresa);

        setEmpresas(lista);
        setEmpresaSelecionada((current) => current || lista[0]?.cd_cgc || '');
      } catch (error: any) {
        setErro(error?.message || 'Falha ao carregar empresas para importacao.');
      }
    };

    void carregarEmpresas();
  }, []);

  async function onArquivoSelecionado(file: File) {
    setErro(null);
    setOk(null);
    setFaltandoCabecalhos([]);
    setCabecalhosNaoMapeados([]);
    setArquivoNome(file.name);

    const xlsx = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'array' });

    const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === 'faturamento')
      || workbook.SheetNames[0];

    if (!sheetName) {
      setErro('Arquivo sem abas.');
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const grid = xlsx.utils.sheet_to_json<Array<unknown>>(sheet, {
      defval: '',
      raw: false,
      header: 1,
    });
    const headersOriginais = (grid[0] || []).map((item) => String(item ?? '').trim()).filter(Boolean);
    const diagnosticoCabecalhos = analisarCabecalhosMatrix(headersOriginais);

    const json = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    const mapped = json.map(mapearLinha);
    setLinhasBrutas(json);
    setLinhas(mapped);
    setFaltandoCabecalhos(diagnosticoCabecalhos.faltandoCampos);
    setCabecalhosNaoMapeados(diagnosticoCabecalhos.cabecalhosNaoMapeados);
    setOk(`Arquivo lido com sucesso. ${mapped.length} linha(s) detectadas.`);
  }

  async function importarConsolidadoMensal() {
    if (!linhasBrutas.length) {
      setErro('Nenhuma linha para importar na Matrix.');
      return;
    }

    if (!validarCompetencia(competencia)) {
      setErro('Competencia invalida. Use MM/AAAA, por exemplo 04/2026.');
      return;
    }

    if (!empresaSelecionada) {
      setErro('Selecione a empresa responsavel pela carga Matrix.');
      return;
    }

    const empresaEscolhida = empresas.find((item) => item.cd_cgc === empresaSelecionada);
    if (!empresaEscolhida) {
      setErro('Empresa selecionada nao encontrada. Recarregue a pagina e tente novamente.');
      return;
    }

    setErro(null);
    setOk(null);
    setLoadingConsolidado(true);
    setProgressoConsolidado(0);

    try {
      const competenciaTrim = competencia.trim();

      const { data: startData, error: startError } = await supabase.functions.invoke('inventory-matrix', {
        body: {
          action: 'start',
          competencia: competenciaTrim,
          cd_cgc: empresaEscolhida.cd_cgc,
          arquivo_nome: arquivoNome || 'consolidado.xlsx',
          total_linhas: linhasBrutas.length,
        },
      });

      if (startError) {
        throw new Error(`Falha ao iniciar carga Matrix via Edge Function: ${startError.message}`);
      }

      if (!startData?.ok || !startData?.data?.nr_carga) {
        throw new Error(startData?.error || 'Edge Function nao retornou nr_carga.');
      }

      const nrCarga = Number(startData.data.nr_carga);
      const payload = linhasBrutas.map((row, index) => ({
        nr_linha: index + 2,
        ...mapearLinhaMatrixParaBanco(row),
      }));

      const chunkSize = 150;
      for (let start = 0; start < payload.length; start += chunkSize) {
        const chunk = payload.slice(start, start + chunkSize);
        const { data: appendData, error: appendError } = await supabase.functions.invoke('inventory-matrix', {
          body: {
            action: 'append',
            nr_carga: nrCarga,
            rows: chunk,
          },
        });

        if (appendError) {
          throw new Error(`Erro no lote ${start + 1}-${start + chunk.length}: ${appendError.message}`);
        }

        if (!appendData?.ok) {
          throw new Error(appendData?.error || `Erro no lote ${start + 1}-${start + chunk.length}`);
        }

        const pct = Math.round(((start + chunk.length) / payload.length) * 100);
        setProgressoConsolidado(Math.min(100, pct));
      }

      const { data: finishData, error: finishError } = await supabase.functions.invoke('inventory-matrix', {
        body: {
          action: 'finish',
          nr_carga: nrCarga,
        },
      });

      if (finishError || !finishData?.ok) {
        throw new Error(finishData?.error || finishError?.message || 'Falha ao finalizar carga Matrix.');
      }

      setOk(
        `Matrix ${competenciaTrim} (${empresaEscolhida.nm_empresa}) salva com sucesso pela Edge Function. Linhas: ${linhasBrutas.length}.`,
      );
    } catch (error: any) {
      setErro(error?.message || 'Falha ao salvar Matrix mensal via Edge Function.');
    } finally {
      setProgressoConsolidado(0);
      setLoadingConsolidado(false);
    }
  }

  return (
    <BasicPageShell
      title="Importacoes"
      subtitle="Importe XLSX/CSV para a Matrix mensal (base de apoio do inventario oficial)"
      actions={
        <div className="flex flex-wrap gap-2">
          <a
            href="/inventario/consolidado"
            className="rounded border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50"
          >
            Visualizar Matrix
          </a>
          <button
            onClick={importarConsolidadoMensal}
            disabled={loadingConsolidado || linhasBrutas.length === 0}
            className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
          >
            {loadingConsolidado ? 'Salvando Matrix...' : 'Salvar Matrix mensal'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {erro ? <div className="rounded bg-red-100 p-3 text-red-800">{erro}</div> : null}
        {ok ? <div className="rounded bg-green-100 p-3 text-green-800">{ok}</div> : null}

        {faltandoCabecalhos.length > 0 ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="font-medium">Atencao: colunas-chave nao reconhecidas</div>
            <div className="text-sm">
              Campos faltando no mapeamento atual: <strong>{faltandoCabecalhos.join(', ')}</strong>.
            </div>
          </div>
        ) : null}

        {cabecalhosNaoMapeados.length > 0 ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-slate-800">
            <div className="font-medium">Colunas ignoradas nesta importacao</div>
            <div className="text-sm">
              {cabecalhosNaoMapeados.length} coluna(s) nao sao usadas no mapeamento da Matrix.
            </div>
            <div className="mt-2 text-xs text-slate-700">
              {cabecalhosNaoMapeados.join(' | ')}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 rounded border bg-white p-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Empresa da carga</span>
            <select
              value={empresaSelecionada}
              onChange={(event) => setEmpresaSelecionada(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Selecione a empresa</option>
              {empresas.map((empresa) => (
                <option key={empresa.cd_cgc} value={empresa.cd_cgc}>
                  {empresa.nm_empresa} ({empresa.cd_cgc})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Competencia da Matrix (MM/AAAA)</span>
            <input
              value={competencia}
              onChange={(event) => setCompetencia(event.target.value)}
              placeholder="02/2026"
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="text-xs text-slate-600">
            A carga da Matrix substitui somente os dados da mesma competencia para a empresa selecionada.
            Isso evita conflito entre empresas diferentes no mesmo mes.
          </div>
        </div>

        <label className="block cursor-pointer rounded border border-dashed p-4 hover:bg-gray-50">
          <div className="font-medium">Selecionar planilha (XLSX/CSV)</div>
          <div className="text-sm text-gray-600">
            Planilha Matrix/consolidada: Codigo Cliente, Nome do Cliente, ID Equipamento, Equipamento,
            TIPO, Descricao do Produto e Serie do Equipamento. Campo de IP nao e exigido aqui.
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onArquivoSelecionado(file);
            }}
          />
        </label>

        {arquivoNome ? (
          <div className="text-sm">
            Arquivo: <strong>{arquivoNome}</strong>
          </div>
        ) : null}

        <div className="text-sm">
          Linhas preparadas: <strong>{linhas.length}</strong>
        </div>

        {loadingConsolidado ? (
          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Salvando Matrix via Edge Function em lotes ({progressoConsolidado}%). Aguarde.
          </div>
        ) : null}

        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Fluxo oficial ativo: esta tela salva apenas a Matrix mensal (base de apoio). O inventario oficial deve ser
          cadastrado manualmente na tela de inventario.
        </div>

        {preview.length > 0 ? (
          <div className="overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Empresa</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Equipamento</th>
                  <th className="p-2 text-left">Modelo</th>
                  <th className="p-2 text-left">Setor/Local</th>
                  <th className="p-2 text-left">Patrimonio</th>
                  <th className="p-2 text-left">Serie</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{row.nm_empresa ?? '-'}</td>
                    <td className="p-2">{row.nm_tipo_equipamento ?? '-'}</td>
                    <td className="p-2">{row.nm_equipamento ?? '-'}</td>
                    <td className="p-2">{row.nm_modelo ?? '-'}</td>
                    <td className="p-2">{row.nm_setor ?? '-'}</td>
                    <td className="p-2">{row.nr_patrimonio ?? '-'}</td>
                    <td className="p-2">{row.nr_serie ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </BasicPageShell>
  );
}
