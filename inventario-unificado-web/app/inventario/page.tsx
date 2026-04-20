'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BasicPageShell } from '@/components/BasicPageShell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusFeedback } from '@/components/StatusFeedback';
import { supabase } from '@/lib/supabase/client';
import { Inventario } from '@/types/inventario';
import { Setor } from '@/types/setor';
import { Equipamento } from '@/types/equipamento';
import { TipoEquipamento } from '@/types/tipoEquipamento';
import { Piso } from '@/types/piso';

interface InventarioComDetalhes extends Inventario {
  equipamento?: Equipamento;
  setor?: Setor;
  tipoEquipamento?: TipoEquipamento;
  itemSuperior?: InventarioComDetalhes | null;
  filhosCount: number;
}

type RelacaoFiltro = 'todos' | 'raizes' | 'filhos';
type StatusFiltro = 'todos' | 'ATIVO' | 'MANUTENCAO' | 'BACKUP' | 'DEVOLUCAO';
type TpStatus = 'ATIVO' | 'MANUTENCAO' | 'BACKUP' | 'DEVOLUCAO';
type TpHierarquia = 'RAIZ' | 'FILHO' | 'AMBOS';
type TipoResolucao = 'RESOLVIDO' | 'SEM_RESOLUCAO';
type DestinoResolucao = 'ORIGEM' | 'NOVO_SETOR' | 'ESTOQUE';
type AcaoFilhoMovimentacao = 'ACOMPANHAR_DESTINO' | 'MOVER_ESTOQUE';
type AcaoFilhoSubstituicao = 'ACOMPANHAR_NOVO_PAI' | 'PERMANECER_ANTIGO_PENDENTE' | 'MOVER_ESTOQUE';

type BarcodeDetectorResult = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (input: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

type ConsolidadoLookupItem = {
  nr_patrimonio?: string | null;
  nr_serie?: string | null;
  nm_tipo?: string | null;
  ds_produto?: string | null;
  nr_id_equipamento?: string | null;
  nm_cliente?: string | null;
  nm_local?: string | null;
  tp_status?: string | null;
};

type EmpresaResumo = {
  cd_cgc: string;
  nm_empresa: string;
};

type FormInventarioState = {
  nr_patrimonio: string;
  cd_equipamento: string;
  cd_setor: string;
  nr_serie: string;
  nr_ip: string;
  nm_hostname: string;
  nr_invent_sup: string;
  tp_status: TpStatus;
  nr_chamado: string;
};

const INITIAL_FORM: FormInventarioState = {
  nr_patrimonio: '',
  cd_equipamento: '',
  cd_setor: '',
  nr_serie: '',
  nr_ip: '',
  nm_hostname: '',
  nr_invent_sup: '',
  tp_status: 'ATIVO',
  nr_chamado: '',
};

type ResolucaoFormState = {
  tipo_resolucao: TipoResolucao;
  destino_resolucao: DestinoResolucao;
  cd_setor_destino: string;
  nr_chamado: string;
  observacao: string;
};

const INITIAL_RESOLUCAO_FORM: ResolucaoFormState = {
  tipo_resolucao: 'RESOLVIDO',
  destino_resolucao: 'ORIGEM',
  cd_setor_destino: '',
  nr_chamado: '',
  observacao: '',
};

type MovimentacaoFormState = {
  cd_setor_destino: string;
  nr_chamado: string;
  observacao: string;
};

const INITIAL_MOVIMENTACAO_FORM: MovimentacaoFormState = {
  cd_setor_destino: '',
  nr_chamado: '',
  observacao: '',
};

type SubstituicaoFormState = {
  nr_inventario_substituto: string;
  cd_setor_destino: string;
  nr_chamado: string;
  observacao: string;
};

const INITIAL_SUBSTITUICAO_FORM: SubstituicaoFormState = {
  nr_inventario_substituto: '',
  cd_setor_destino: '',
  nr_chamado: '',
  observacao: '',
};

const SEM_LOCALIZACAO_VALUE = '__SEM_LOCALIZACAO__';

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarIpSemMascara(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const normalizado = ip.trim();
  if (!normalizado) return null;
  return normalizado.replace(/\/32$/, '').toLowerCase();
}

function labelInventario(item: InventarioComDetalhes): string {
  const patrimonio = item.nr_patrimonio || `ID ${item.nr_inventario}`;
  const modelo = item.equipamento?.nm_modelo || 'Sem modelo';
  return `${patrimonio} - ${modelo}`;
}

function formatSetorLabel(setor?: Pick<Setor, 'nm_piso' | 'nm_setor' | 'nm_localizacao'> | null): string {
  if (!setor) return '-';
  return [setor.nm_piso || '', setor.nm_setor || '', setor.nm_localizacao || '']
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' > ');
}

function statusFromLegacy(situacao?: string | null): TpStatus {
  if (situacao === 'M') return 'MANUTENCAO';
  if (situacao === 'I') return 'BACKUP';
  return 'ATIVO';
}

function getLabelTpStatus(tpStatus: TpStatus): string {
  if (tpStatus === 'MANUTENCAO') return 'Manutencao';
  if (tpStatus === 'BACKUP') return 'Backup';
  if (tpStatus === 'DEVOLUCAO') return 'Devolucao';
  return 'Ativo';
}

function getClassTpStatus(tpStatus: TpStatus): string {
  if (tpStatus === 'MANUTENCAO') return 'bg-amber-100 text-amber-800';
  if (tpStatus === 'BACKUP') return 'bg-slate-100 text-slate-700';
  if (tpStatus === 'DEVOLUCAO') return 'bg-red-100 text-red-800';
  return 'bg-green-100 text-green-800';
}

function FieldDbHint({ text }: { text: string }) {
  return <span className="inv-db-hint">Banco: {text}</span>;
}

async function invokeInventoryCore<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('inventory-core', {
    body: { action, payload: payload ?? {} },
  });

  if (!error && data?.ok) {
    return data.data as T;
  }

  let reason = data?.error || error?.message || 'inventory-core indisponivel';

  // Supabase invoke wraps non-2xx errors in a generic message; try to read response payload for real cause.
  const responseContext = (error as any)?.context;
  if (responseContext && typeof responseContext.text === 'function') {
    try {
      const rawText = await responseContext.text();
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed?.error) {
          reason = String(parsed.error);
        }
      }
    } catch {
      // Keep fallback reason when context cannot be parsed.
    }
  }

  throw new Error(`Falha ao executar inventory-core: ${reason}`);
}

export default function InventarioPage() {
  const [items, setItems] = useState<InventarioComDetalhes[]>([]);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [tiposEquipamento, setTiposEquipamento] = useState<TipoEquipamento[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventarioComDetalhes | null>(null);
  const [resolucaoModalOpen, setResolucaoModalOpen] = useState(false);
  const [resolvendoItem, setResolvendoItem] = useState<InventarioComDetalhes | null>(null);
  const [resolucaoLoading, setResolucaoLoading] = useState(false);
  const [resolucaoForm, setResolucaoForm] = useState<ResolucaoFormState>(INITIAL_RESOLUCAO_FORM);
  const [movimentacaoModalOpen, setMovimentacaoModalOpen] = useState(false);
  const [movimentandoItem, setMovimentandoItem] = useState<InventarioComDetalhes | null>(null);
  const [movimentacaoLoading, setMovimentacaoLoading] = useState(false);
  const [movimentacaoForm, setMovimentacaoForm] = useState<MovimentacaoFormState>(INITIAL_MOVIMENTACAO_FORM);
  const [movimentacaoFilhosAcoes, setMovimentacaoFilhosAcoes] = useState<Record<number, AcaoFilhoMovimentacao>>({});
  const [substituicaoModalOpen, setSubstituicaoModalOpen] = useState(false);
  const [substituindoItem, setSubstituindoItem] = useState<InventarioComDetalhes | null>(null);
  const [substituicaoLoading, setSubstituicaoLoading] = useState(false);
  const [substituicaoForm, setSubstituicaoForm] = useState<SubstituicaoFormState>(INITIAL_SUBSTITUICAO_FORM);
  const [substituicaoFilhosAcoes, setSubstituicaoFilhosAcoes] = useState<Record<number, AcaoFilhoSubstituicao>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedPiso, setSelectedPiso] = useState<number | null>(null);
  const [selectedSetor, setSelectedSetor] = useState<number | null>(null);
  const [selectedLocalizacao, setSelectedLocalizacao] = useState<string>('');
  const [selectedTipo, setSelectedTipo] = useState<number | null>(null);
  const [selectedRelacao, setSelectedRelacao] = useState<RelacaoFiltro>('todos');
  const [selectedStatus, setSelectedStatus] = useState<StatusFiltro>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [formTipoEquipamento, setFormTipoEquipamento] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormInventarioState>(INITIAL_FORM);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scannerTimerRef = useRef<number | null>(null);
  const scannerBusyRef = useRef(false);
  const [autoFillCompetencia, setAutoFillCompetencia] = useState('');
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillItem, setAutoFillItem] = useState<ConsolidadoLookupItem | null>(null);
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await invokeInventoryCore<{
        inventarios: Inventario[];
        pisos: Piso[];
        setores: Setor[];
        equipamentos: Equipamento[];
        tipos: TipoEquipamento[];
        empresas?: EmpresaResumo[];
      }>('list_context');

      const inventarios = Array.isArray(response.inventarios) ? response.inventarios : [];
      const pisosList = Array.isArray(response.pisos) ? response.pisos : [];
      const sectorList = Array.isArray(response.setores) ? response.setores : [];
      const equipmentList = Array.isArray(response.equipamentos) ? response.equipamentos : [];
      const tipoList = Array.isArray(response.tipos) ? response.tipos : [];
      const empresasList = Array.isArray(response.empresas) ? response.empresas : [];

      const equipamentosById = new Map<number, Equipamento>(
        (equipmentList || []).map((equipamento) => [equipamento.cd_equipamento, equipamento]),
      );
      const setoresById = new Map<number, Setor>(
        (sectorList || []).map((setor) => [setor.cd_setor, setor]),
      );
      const tiposById = new Map<number, TipoEquipamento>(
        (tipoList || []).map((tipo) => [tipo.cd_tipo_equipamento, tipo]),
      );

      const filhosCountByParent = new Map<number, number>();
      (inventarios || []).forEach((item) => {
        if (item.nr_invent_sup) {
          const atual = filhosCountByParent.get(item.nr_invent_sup) || 0;
          filhosCountByParent.set(item.nr_invent_sup, atual + 1);
        }
      });

      const baseItems: InventarioComDetalhes[] = (inventarios || []).map((inv) => {
        const equipamento = equipamentosById.get(inv.cd_equipamento);
        const tipoEquipamento = equipamento
          ? tiposById.get(equipamento.cd_tipo_equipamento)
          : undefined;
        const tpStatus = (inv.tp_status || statusFromLegacy(inv.ie_situacao)) as TpStatus;

        return {
          ...inv,
          tp_status: tpStatus,
          equipamento,
          setor: setoresById.get(inv.cd_setor),
          tipoEquipamento,
          filhosCount: filhosCountByParent.get(inv.nr_inventario) || 0,
          itemSuperior: null,
        };
      });

      const itemsById = new Map<number, InventarioComDetalhes>(
        baseItems.map((item) => [item.nr_inventario, item]),
      );

      const itemsComDetalhes = baseItems.map((item) => ({
        ...item,
        itemSuperior: item.nr_invent_sup
          ? itemsById.get(item.nr_invent_sup) || null
          : null,
      }));

      setPisos(pisosList || []);
      setTiposEquipamento(tipoList || []);
      setEquipamentos(equipmentList || []);
      setSetores(sectorList || []);
      setEmpresas(empresasList || []);
      setItems(itemsComDetalhes);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setErrorMessage('Nao foi possivel carregar inventario, setores e equipamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const equipamentosFiltradosNoFormulario = useMemo(() => {
    if (!formTipoEquipamento) return equipamentos;
    return equipamentos.filter((item) => item.cd_tipo_equipamento === formTipoEquipamento);
  }, [equipamentos, formTipoEquipamento]);

  const equipamentoSelecionadoFormulario = useMemo(
    () => equipamentos.find((item) => item.cd_equipamento === Number(formData.cd_equipamento)) || null,
    [equipamentos, formData.cd_equipamento],
  );

  const tpHierarquiaFormulario = (equipamentoSelecionadoFormulario?.tp_hierarquia || 'AMBOS') as TpHierarquia;

  const empresasByCgc = useMemo(
    () => new Map(empresas.map((empresa) => [empresa.cd_cgc, empresa.nm_empresa])),
    [empresas],
  );

  const itensRaiz = useMemo(() => items.filter((item) => !item.nr_invent_sup), [items]);

  const filhosByParentAll = useMemo(() => {
    const grouped = new Map<number, InventarioComDetalhes[]>();
    items.forEach((item) => {
      if (!item.nr_invent_sup) return;
      const current = grouped.get(item.nr_invent_sup) || [];
      current.push(item);
      grouped.set(item.nr_invent_sup, current);
    });
    return grouped;
  }, [items]);

  const setoresFiltradosPorPiso = useMemo(() => {
    if (selectedPiso === null) return setores;
    return setores.filter((setor) => setor.cd_piso === selectedPiso);
  }, [setores, selectedPiso]);

  const localizacoesFiltradas = useMemo(() => {
    const base = selectedSetor !== null
      ? setores.filter((setor) => setor.cd_setor === selectedSetor)
      : setoresFiltradosPorPiso;

    const values = Array.from(
      new Set(
        base.map((setor) => (setor.nm_localizacao || '').trim()),
      ),
    );

    return values
      .filter((value) => value.length > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [setores, setoresFiltradosPorPiso, selectedSetor]);

  useEffect(() => {
    if (selectedSetor === null) return;
    const stillExists = setoresFiltradosPorPiso.some((setor) => setor.cd_setor === selectedSetor);
    if (!stillExists) {
      setSelectedSetor(null);
    }
  }, [setoresFiltradosPorPiso, selectedSetor]);

  useEffect(() => {
    if (!selectedLocalizacao) return;
    if (selectedLocalizacao === SEM_LOCALIZACAO_VALUE) {
      return;
    }

    const stillExists = localizacoesFiltradas.some((local) => local === selectedLocalizacao);
    if (!stillExists) {
      setSelectedLocalizacao('');
    }
  }, [localizacoesFiltradas, selectedLocalizacao]);

  const paintedItems = useMemo(() => {
    const termoBusca = normalizarTexto(searchTerm.trim());

    return items.filter((item) => {
      if (selectedPiso !== null && item.setor?.cd_piso !== selectedPiso) return false;
      if (selectedSetor !== null && item.cd_setor !== selectedSetor) return false;

      if (selectedLocalizacao) {
        const localizacao = (item.setor?.nm_localizacao || '').trim();
        if (selectedLocalizacao === SEM_LOCALIZACAO_VALUE) {
          if (localizacao) return false;
        } else if (normalizarTexto(localizacao) !== normalizarTexto(selectedLocalizacao)) {
          return false;
        }
      }

      if (
        selectedTipo !== null
        && item.tipoEquipamento?.cd_tipo_equipamento !== selectedTipo
      ) {
        return false;
      }

      if (selectedRelacao === 'raizes' && item.nr_invent_sup) return false;
      if (selectedRelacao === 'filhos' && !item.nr_invent_sup) return false;
      if (selectedStatus !== 'todos' && item.tp_status !== selectedStatus) return false;

      if (!termoBusca) return true;

      const conteudoBusca = normalizarTexto(
        [
          item.nr_patrimonio || '',
          item.nr_serie || '',
          item.nr_ip || '',
          item.nm_hostname || '',
          item.equipamento?.nm_modelo || '',
          item.equipamento?.nm_equipamento || '',
          item.equipamento?.tp_hierarquia || '',
          item.tipoEquipamento?.nm_tipo_equipamento || '',
          formatSetorLabel(item.setor),
          item.itemSuperior?.nr_patrimonio || '',
          item.tp_status || '',
        ].join(' '),
      );

      return conteudoBusca.includes(termoBusca);
    });
  }, [items, searchTerm, selectedPiso, selectedRelacao, selectedSetor, selectedLocalizacao, selectedStatus, selectedTipo]);

  const itensRaizDaVisao = useMemo(
    () => paintedItems.filter((item) => !item.nr_invent_sup && (selectedSetor === null || item.cd_setor === selectedSetor)),
    [paintedItems, selectedSetor],
  );

  const paintedItemsIds = useMemo(
    () => new Set(paintedItems.map((item) => item.nr_inventario)),
    [paintedItems],
  );

  const filhosByParent = useMemo(() => {
    const grouped = new Map<number, InventarioComDetalhes[]>();
    paintedItems.forEach((item) => {
      if (!item.nr_invent_sup) return;
      if (!paintedItemsIds.has(item.nr_invent_sup)) return;
      const current = grouped.get(item.nr_invent_sup) || [];
      current.push(item);
      grouped.set(item.nr_invent_sup, current);
    });
    return grouped;
  }, [paintedItems, paintedItemsIds]);

  const groupedBySetor = useMemo(() => {
    const grouped = new Map<number, InventarioComDetalhes[]>();
    paintedItems.forEach((item) => {
      const current = grouped.get(item.cd_setor) || [];
      current.push(item);
      grouped.set(item.cd_setor, current);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => {
        const setorA = formatSetorLabel(setores.find((setor) => setor.cd_setor === a[0]));
        const setorB = formatSetorLabel(setores.find((setor) => setor.cd_setor === b[0]));
        return setorA.localeCompare(setorB);
      })
      .map(([setorId, inventarios]) => ({
        setorId,
        inventarios: [...inventarios].sort((a, b) => {
          const patrimonioA = a.nr_patrimonio || '';
          const patrimonioB = b.nr_patrimonio || '';
          if (patrimonioA === patrimonioB) return a.nr_inventario - b.nr_inventario;
          return patrimonioA.localeCompare(patrimonioB);
        }),
      }));
  }, [paintedItems, setores]);

  const handleChangeForm = (campo: keyof FormInventarioState, valor: string) => {
    if (campo === 'nr_patrimonio') {
      setAutoFillItem(null);
      setAutoFillMessage(null);
    }
    setFormData((previous) => ({ ...previous, [campo]: valor }));
  };

  const encontrarTipoPorNome = (nmTipo: string | null | undefined): TipoEquipamento | null => {
    if (!nmTipo) return null;
    const alvo = normalizarTexto(nmTipo);
    return (
      tiposEquipamento.find((tipo) => {
        const candidato = normalizarTexto(tipo.nm_tipo_equipamento || '');
        return candidato === alvo || candidato.includes(alvo) || alvo.includes(candidato);
      }) || null
    );
  };

  const encontrarEquipamentoPorDescricao = (
    descricaoProduto: string | null | undefined,
    tipoEncontrado: TipoEquipamento | null,
  ): Equipamento | null => {
    if (!descricaoProduto) return null;

    const alvo = normalizarTexto(descricaoProduto);
    const candidatos = tipoEncontrado
      ? equipamentos.filter((equipamento) => equipamento.cd_tipo_equipamento === tipoEncontrado.cd_tipo_equipamento)
      : equipamentos;

    return (
      candidatos.find((equipamento) => {
        const modelo = normalizarTexto(equipamento.nm_modelo || '');
        const nome = normalizarTexto(equipamento.nm_equipamento || '');
        const descricao = normalizarTexto(equipamento.ds_equipamento || '');

        return (
          modelo.includes(alvo)
          || alvo.includes(modelo)
          || nome.includes(alvo)
          || alvo.includes(nome)
          || descricao.includes(alvo)
          || alvo.includes(descricao)
        );
      }) || null
    );
  };

  const autoPreencherPorPatrimonio = async () => {
    const patrimonio = formData.nr_patrimonio.trim();

    if (!patrimonio) {
      setAutoFillMessage('Informe o patrimonio para auto preencher a partir da Matrix.');
      return;
    }

    setAutoFillLoading(true);
    setAutoFillMessage(null);

    try {
      const body = await invokeInventoryCore<{
        encontrado: boolean;
        competencia?: string;
        motivo?: string;
        item?: ConsolidadoLookupItem;
      }>('matrix_lookup', {
        patrimonio,
        competencia: autoFillCompetencia.trim() || null,
      });

      if (!body.encontrado || !body.item) {
        setAutoFillItem(null);
        setAutoFillMessage(body.motivo || 'Patrimonio nao encontrado na Matrix.');
        return;
      }

      const item = body.item as ConsolidadoLookupItem;
      const tipoEncontrado = encontrarTipoPorNome(item.nm_tipo);
      const equipamentoEncontrado = encontrarEquipamentoPorDescricao(item.ds_produto, tipoEncontrado);
      const tpStatusEncontrado = ['ATIVO', 'MANUTENCAO', 'BACKUP', 'DEVOLUCAO'].includes(item.tp_status || '')
        ? (item.tp_status as TpStatus)
        : null;

      setAutoFillItem(item);

      if (tipoEncontrado) {
        setFormTipoEquipamento(tipoEncontrado.cd_tipo_equipamento);
      }

      setFormData((previous) => ({
        ...previous,
        nr_serie: previous.nr_serie || item.nr_serie || '',
        tp_status: tpStatusEncontrado || previous.tp_status,
        cd_equipamento: equipamentoEncontrado
          ? String(equipamentoEncontrado.cd_equipamento)
          : previous.cd_equipamento,
        nr_invent_sup:
          equipamentoEncontrado?.tp_hierarquia === 'RAIZ'
            ? ''
            : previous.nr_invent_sup,
      }));

      setAutoFillMessage(
        `Matrix ${body.competencia}: serie, tipo e descricao localizados para patrimonio ${patrimonio}.`,
      );
    } catch (error: any) {
      setAutoFillItem(null);
      setAutoFillMessage(error.message || 'Falha ao auto preencher por patrimonio.');
    } finally {
      setAutoFillLoading(false);
    }
  };

  const handleSelectTipoFormulario = (value: string) => {
    const tipoId = value ? Number(value) : null;
    setFormTipoEquipamento(tipoId);

    setFormData((previous) => {
      if (!tipoId || !previous.cd_equipamento) return previous;

      const equipamentoSelecionado = equipamentos.find(
        (item) => item.cd_equipamento === Number(previous.cd_equipamento),
      );

      if (!equipamentoSelecionado || equipamentoSelecionado.cd_tipo_equipamento !== tipoId) {
        return { ...previous, cd_equipamento: '' };
      }

      return previous;
    });
  };

  const handleSelectEquipamento = (value: string) => {
    const equipamento = equipamentos.find((item) => item.cd_equipamento === Number(value));
    setFormData((previous) => ({
      ...previous,
      cd_equipamento: value,
      nr_invent_sup: equipamento?.tp_hierarquia === 'RAIZ' ? '' : previous.nr_invent_sup,
      nm_hostname: equipamento?.tp_hierarquia === 'FILHO' ? '' : previous.nm_hostname,
    }));
    setFormTipoEquipamento(equipamento?.cd_tipo_equipamento || null);
  };

  const handleSelectItemSuperior = (value: string) => {
    const itemSuperior = items.find((item) => item.nr_inventario === Number(value));
    setFormData((previous) => ({
      ...previous,
      nr_invent_sup: value,
      cd_setor: itemSuperior ? String(itemSuperior.cd_setor) : previous.cd_setor,
    }));
  };

  const stopScanner = () => {
    if (scannerTimerRef.current !== null) {
      window.clearInterval(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    scannerBusyRef.current = false;
  };

  const applyScannedCode = (codigo: string) => {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) return;

    setFormData((previous) => ({
      ...previous,
      nr_patrimonio: codigoLimpo,
    }));
    setScannerStatus(`Codigo lido: ${codigoLimpo}`);
    setScannerError(null);
    setScannerOpen(false);
    stopScanner();
  };

  const iniciarScanner = async () => {
    setScannerError(null);
    setScannerStatus('Solicitando acesso a camera...');

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScannerError('Camera nao disponivel neste navegador/dispositivo.');
      return;
    }

    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: BarcodeDetectorConstructor;
    }).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setScannerError('Leitor de codigo nao suportado neste navegador. Use Chrome/Edge atualizado.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      mediaStreamRef.current = stream;

      if (!videoRef.current) {
        setScannerError('Falha ao iniciar visualizacao da camera.');
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScannerStatus('Aponte para o codigo de barras do patrimonio.');

      const detector = new BarcodeDetectorCtor({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'],
      });

      scannerTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || scannerBusyRef.current) return;

        scannerBusyRef.current = true;
        try {
          const resultados = await detector.detect(videoRef.current);
          if (Array.isArray(resultados) && resultados.length > 0) {
            const rawValue = String(resultados[0]?.rawValue || '').trim();
            if (rawValue) {
              applyScannedCode(rawValue);
            }
          }
        } catch {
          // Mantem loop de deteccao ativo sem quebrar a experiencia por frame invalido.
        } finally {
          scannerBusyRef.current = false;
        }
      }, 350);
    } catch {
      setScannerError('Nao foi possivel acessar a camera. Verifique a permissao do navegador.');
      stopScanner();
    }
  };

  useEffect(() => {
    if (scannerOpen) {
      void iniciarScanner();
      return;
    }

    stopScanner();
  }, [scannerOpen]);

  useEffect(() => () => {
    stopScanner();
  }, []);

  const resetModalForm = () => {
    setEditingItem(null);
    setFormData(INITIAL_FORM);
    setFormTipoEquipamento(null);
    setScannerOpen(false);
    setScannerStatus(null);
    setScannerError(null);
    stopScanner();
    setAutoFillCompetencia('');
    setAutoFillItem(null);
    setAutoFillLoading(false);
    setAutoFillMessage(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openEditModal = (item: InventarioComDetalhes) => {
    setEditingItem(item);
    setFormTipoEquipamento(item.tipoEquipamento?.cd_tipo_equipamento || null);
    setFormData({
      nr_patrimonio: item.nr_patrimonio || '',
      cd_equipamento: String(item.cd_equipamento || ''),
      cd_setor: String(item.cd_setor || ''),
      nr_serie: item.nr_serie || '',
      nr_ip: item.nr_ip || '',
      nm_hostname: item.equipamento?.tp_hierarquia === 'FILHO' ? '' : (item.nm_hostname || ''),
      nr_invent_sup: item.nr_invent_sup ? String(item.nr_invent_sup) : '',
      tp_status: (item.tp_status as TpStatus) || 'ATIVO',
      nr_chamado: '',
    });
    setAutoFillCompetencia('');
    setAutoFillItem(null);
    setAutoFillMessage(null);
    setScannerOpen(false);
    setScannerStatus(null);
    setScannerError(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setModalOpen(true);
  };

  const resetResolucaoModal = () => {
    setResolvendoItem(null);
    setResolucaoForm(INITIAL_RESOLUCAO_FORM);
    setResolucaoLoading(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openResolucaoModal = (item: InventarioComDetalhes) => {
    setResolvendoItem(item);
    setResolucaoForm(INITIAL_RESOLUCAO_FORM);
    setResolucaoLoading(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setResolucaoModalOpen(true);
  };

  const resetMovimentacaoModal = () => {
    setMovimentandoItem(null);
    setMovimentacaoForm(INITIAL_MOVIMENTACAO_FORM);
    setMovimentacaoFilhosAcoes({});
    setMovimentacaoLoading(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openMovimentacaoModal = (item: InventarioComDetalhes) => {
    const filhosDiretos = filhosByParentAll.get(item.nr_inventario) || [];
    const acoesIniciais: Record<number, AcaoFilhoMovimentacao> = {};
    filhosDiretos.forEach((filho) => {
      acoesIniciais[filho.nr_inventario] = 'ACOMPANHAR_DESTINO';
    });

    setMovimentandoItem(item);
    setMovimentacaoForm({
      cd_setor_destino: '',
      nr_chamado: '',
      observacao: '',
    });
    setMovimentacaoFilhosAcoes(acoesIniciais);
    setMovimentacaoLoading(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setMovimentacaoModalOpen(true);
  };

  const resetSubstituicaoModal = () => {
    setSubstituindoItem(null);
    setSubstituicaoForm(INITIAL_SUBSTITUICAO_FORM);
    setSubstituicaoFilhosAcoes({});
    setSubstituicaoLoading(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openSubstituicaoModal = (item: InventarioComDetalhes) => {
    const filhosDiretos = filhosByParentAll.get(item.nr_inventario) || [];
    const acoesIniciais: Record<number, AcaoFilhoSubstituicao> = {};
    filhosDiretos.forEach((filho) => {
      acoesIniciais[filho.nr_inventario] = 'ACOMPANHAR_NOVO_PAI';
    });

    setSubstituindoItem(item);
    setSubstituicaoForm(INITIAL_SUBSTITUICAO_FORM);
    setSubstituicaoFilhosAcoes(acoesIniciais);
    setSubstituicaoLoading(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubstituicaoModalOpen(true);
  };

  const handleChangeMovimentacao = <K extends keyof MovimentacaoFormState>(
    campo: K,
    valor: MovimentacaoFormState[K],
  ) => {
    setMovimentacaoForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleChangeAcaoFilhoMovimentacao = (nrInventarioFilho: number, acao: AcaoFilhoMovimentacao) => {
    setMovimentacaoFilhosAcoes((prev) => ({ ...prev, [nrInventarioFilho]: acao }));
  };

  const handleChangeSubstituicao = <K extends keyof SubstituicaoFormState>(
    campo: K,
    valor: SubstituicaoFormState[K],
  ) => {
    setSubstituicaoForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleChangeAcaoFilhoSubstituicao = (nrInventarioFilho: number, acao: AcaoFilhoSubstituicao) => {
    setSubstituicaoFilhosAcoes((prev) => ({ ...prev, [nrInventarioFilho]: acao }));
  };

  const handleSubmitMovimentacao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!movimentandoItem) {
      setErrorMessage('Nenhum equipamento selecionado para movimentacao.');
      return;
    }

    const setorDestino = Number(movimentacaoForm.cd_setor_destino);
    if (!Number.isFinite(setorDestino) || setorDestino <= 0) {
      setErrorMessage('Selecione um setor de destino valido.');
      return;
    }

    if (setorDestino === movimentandoItem.cd_setor) {
      setErrorMessage('O setor de destino precisa ser diferente do setor atual.');
      return;
    }

    const filhosDiretos = filhosByParentAll.get(movimentandoItem.nr_inventario) || [];
    const filhosAcoesPayload = filhosDiretos.map((filho) => ({
      nr_inventario_filho: filho.nr_inventario,
      acao: movimentacaoFilhosAcoes[filho.nr_inventario] || 'ACOMPANHAR_DESTINO',
    }));

    setMovimentacaoLoading(true);
    try {
      await invokeInventoryCore('move_inventario', {
        nr_inventario: movimentandoItem.nr_inventario,
        cd_setor_destino: setorDestino,
        nr_chamado: movimentacaoForm.nr_chamado.trim() || undefined,
        observacao: movimentacaoForm.observacao.trim() || null,
        filhos_acoes: filhosAcoesPayload,
      });

      setSuccessMessage('Movimentacao registrada com sucesso.');
      await loadData();
      setMovimentacaoModalOpen(false);
      resetMovimentacaoModal();
    } catch (error: any) {
      setErrorMessage(error.message || 'Falha ao movimentar equipamento.');
    } finally {
      setMovimentacaoLoading(false);
    }
  };

  const handleSubmitSubstituicao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!substituindoItem) {
      setErrorMessage('Nenhum equipamento em manutencao selecionado para substituicao.');
      return;
    }

    const substituto = Number(substituicaoForm.nr_inventario_substituto);
    if (!Number.isFinite(substituto) || substituto <= 0) {
      setErrorMessage('Selecione o patrimonio que vai substituir o equipamento em manutencao.');
      return;
    }

    const filhosDiretos = filhosByParentAll.get(substituindoItem.nr_inventario) || [];
    const filhosAcoesPayload = filhosDiretos.map((filho) => ({
      nr_inventario_filho: filho.nr_inventario,
      acao: substituicaoFilhosAcoes[filho.nr_inventario] || 'PERMANECER_ANTIGO_PENDENTE',
    }));

    setSubstituicaoLoading(true);
    try {
      await invokeInventoryCore('substituir_manutencao', {
        nr_inventario_manutencao: substituindoItem.nr_inventario,
        nr_inventario_substituto: substituto,
        cd_setor_destino: substituicaoForm.cd_setor_destino ? Number(substituicaoForm.cd_setor_destino) : undefined,
        nr_chamado: substituicaoForm.nr_chamado.trim() || undefined,
        observacao: substituicaoForm.observacao.trim() || null,
        filhos_acoes: filhosAcoesPayload,
      });

      setSuccessMessage('Substituicao aplicada com sucesso. O pai original permanece em manutencao ate resolucao.');
      await loadData();
      setSubstituicaoModalOpen(false);
      resetSubstituicaoModal();
    } catch (error: any) {
      setErrorMessage(error.message || 'Falha ao substituir equipamento em manutencao.');
    } finally {
      setSubstituicaoLoading(false);
    }
  };

  const handleChangeResolucao = <K extends keyof ResolucaoFormState>(campo: K, valor: ResolucaoFormState[K]) => {
    setResolucaoForm((prev) => {
      const next = { ...prev, [campo]: valor };
      if (campo === 'tipo_resolucao' && valor === 'SEM_RESOLUCAO') {
        next.destino_resolucao = 'ORIGEM';
        next.cd_setor_destino = '';
      }
      if (campo === 'destino_resolucao' && valor !== 'NOVO_SETOR') {
        next.cd_setor_destino = '';
      }
      return next;
    });
  };

  const handleSubmitResolucao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resolvendoItem) {
      setErrorMessage('Nenhum equipamento selecionado para resolucao.');
      return;
    }

    if (
      resolucaoForm.tipo_resolucao === 'RESOLVIDO'
      && resolucaoForm.destino_resolucao === 'NOVO_SETOR'
      && !resolucaoForm.cd_setor_destino
    ) {
      setErrorMessage('Selecione o setor de destino para concluir a resolucao.');
      return;
    }

    setResolucaoLoading(true);
    try {
      const payload: Record<string, unknown> = {
        nr_inventario: resolvendoItem.nr_inventario,
        tipo_resolucao: resolucaoForm.tipo_resolucao,
        destino_resolucao: resolucaoForm.tipo_resolucao === 'RESOLVIDO' ? resolucaoForm.destino_resolucao : undefined,
        cd_setor_destino: resolucaoForm.cd_setor_destino ? Number(resolucaoForm.cd_setor_destino) : undefined,
        nr_chamado:
          resolucaoForm.tipo_resolucao === 'SEM_RESOLUCAO'
            ? resolucaoForm.nr_chamado.trim() || undefined
            : undefined,
        observacao: resolucaoForm.observacao.trim() || null,
      };

      await invokeInventoryCore('resolver_manutencao', payload);
      setSuccessMessage('Resolucao aplicada com sucesso.');
      await loadData();
      setResolucaoModalOpen(false);
      resetResolucaoModal();
    } catch (error: any) {
      setErrorMessage(error.message || 'Falha ao aplicar resolucao de manutencao.');
    } finally {
      setResolucaoLoading(false);
    }
  };

  const handleCreateInventario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!formData.cd_equipamento || !formData.cd_setor) {
      setErrorMessage('Preencha equipamento e setor para cadastrar o item.');
      return;
    }

    const equipamentoSelecionado = equipamentos.find(
      (item) => item.cd_equipamento === Number(formData.cd_equipamento),
    );
    const tpHierarquia = (equipamentoSelecionado?.tp_hierarquia || 'AMBOS') as TpHierarquia;

    if (tpHierarquia === 'RAIZ' && formData.nr_invent_sup) {
      setErrorMessage('Equipamento configurado como RAIZ nao pode ter item superior.');
      return;
    }

    if (tpHierarquia === 'FILHO' && formData.tp_status === 'ATIVO' && !formData.nr_invent_sup) {
      setErrorMessage('Equipamento FILHO em status ATIVO precisa de item superior.');
      return;
    }

    if (tpHierarquia !== 'FILHO' && !formData.nm_hostname.trim()) {
      setErrorMessage('Hostname e obrigatorio para equipamentos RAIZ/AMBOS.');
      return;
    }

    const patrimonioDigitado = formData.nr_patrimonio.trim();
    if (patrimonioDigitado) {
      const patrimonioExistente = items.find((item) => {
        if (editingItem && item.nr_inventario === editingItem.nr_inventario) return false;
        return String(item.nr_patrimonio || '').trim().toLowerCase() === patrimonioDigitado.toLowerCase();
      });

      if (patrimonioExistente) {
        setErrorMessage(
          `Patrimonio ${patrimonioDigitado} ja existe no inventario (ID ${patrimonioExistente.nr_inventario}).`,
        );
        return;
      }
    }

    const ipDigitadoNormalizado = normalizarIpSemMascara(formData.nr_ip);
    if (ipDigitadoNormalizado) {
      const ipExistente = items.find((item) => {
        if (editingItem && item.nr_inventario === editingItem.nr_inventario) return false;
        const itemIp = normalizarIpSemMascara(item.nr_ip);
        return itemIp === ipDigitadoNormalizado;
      });

      if (ipExistente) {
        setErrorMessage(
          `IP ${ipDigitadoNormalizado} ja existe no inventario (ID ${ipExistente.nr_inventario}).`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...(editingItem ? { nr_inventario: editingItem.nr_inventario } : {}),
        cd_equipamento: Number(formData.cd_equipamento),
        cd_setor: Number(formData.cd_setor),
        nr_patrimonio: formData.nr_patrimonio.trim() || null,
        nr_serie: formData.nr_serie.trim() || null,
        nr_ip: formData.nr_ip.trim() || null,
        nm_hostname: tpHierarquia === 'FILHO' ? null : formData.nm_hostname.trim() || null,
        nr_invent_sup: formData.nr_invent_sup ? Number(formData.nr_invent_sup) : null,
        tp_status: formData.tp_status,
        nr_chamado: formData.nr_chamado.trim() || null,
        ie_situacao: 'A',
      };

      await invokeInventoryCore(editingItem ? 'update_inventario' : 'create_inventario', payload);

      setSuccessMessage(editingItem ? 'Equipamento atualizado com sucesso.' : 'Equipamento cadastrado com sucesso.');
      await loadData();
      resetModalForm();
      setModalOpen(false);
    } catch (error: any) {
      setErrorMessage(error.message || (editingItem ? 'Erro ao atualizar item de inventario.' : 'Erro ao cadastrar item de inventario.'));
    } finally {
      setSaving(false);
    }
  };

  const totalRaizes = items.filter((item) => !item.nr_invent_sup).length;
  const totalFilhos = items.filter((item) => Boolean(item.nr_invent_sup)).length;
  const totalAtivos = items.filter((item) => item.tp_status === 'ATIVO').length;
  const totalManutencao = items.filter((item) => item.tp_status === 'MANUTENCAO').length;
  const totalBackup = items.filter((item) => item.tp_status === 'BACKUP').length;
  const totalDevolucao = items.filter((item) => item.tp_status === 'DEVOLUCAO').length;
  const filhosDiretosMovimentacao = movimentandoItem ? (filhosByParentAll.get(movimentandoItem.nr_inventario) || []) : [];
  const filhosDiretosSubstituicao = substituindoItem ? (filhosByParentAll.get(substituindoItem.nr_inventario) || []) : [];
  const substitutosDisponiveis = items
    .filter((item) => item.tp_status === 'BACKUP' && !item.nr_invent_sup)
    .sort((a, b) => (a.nr_patrimonio || String(a.nr_inventario)).localeCompare(b.nr_patrimonio || String(b.nr_inventario)));

  return (
    <BasicPageShell
      title="Inventario Unificado"
      subtitle="Gerenciamento oficial do inventario interno com hierarquia, status e leitura por codigo de barras"
      actions={
        <div className="ui-row">
          <a
            href="/inventario/importacoes"
            className="ui-btn"
          >
            Importacoes
          </a>
          <a
            href="/inventario/consolidado"
            className="ui-btn"
          >
            Matrix
          </a>
          <a
            href="/inventario/conciliacao"
            className="ui-btn"
          >
            Conciliacao
          </a>
          <a
            href="/inventario/devolucao"
            className="ui-btn"
          >
            Devolucao
          </a>
          <button
            type="button"
            onClick={() => {
              resetModalForm();
              setModalOpen(true);
            }}
            className="ui-btn ui-btn-primary"
          >
            Adicionar equipamento
          </button>
        </div>
      }
    >
      <StatusFeedback loading={loading || saving || resolucaoLoading || movimentacaoLoading || substituicaoLoading} error={errorMessage} success={successMessage} />

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            resetModalForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar equipamento no inventario' : 'Adicionar equipamento no inventario'}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? `Atualize os dados do item ${editingItem.nr_inventario}.`
                : 'Cadastre item raiz (CPU) ou item vinculado com leitura de codigo por camera.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInventario} className="inv-modal-form">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="inventario.nr_patrimonio" />
                <span className="font-medium text-slate-700">Patrimonio</span>
                <input
                  value={formData.nr_patrimonio}
                  onChange={(event) => handleChangeForm('nr_patrimonio', event.target.value)}
                  onBlur={() => {
                    if (formData.nr_patrimonio.trim()) {
                      void autoPreencherPorPatrimonio();
                    }
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ex: 1050"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="nao salva em tabela; filtro de busca na Matrix" />
                <span className="font-medium text-slate-700">Competencia Matrix (opcional)</span>
                <input
                  value={autoFillCompetencia}
                  onChange={(event) => setAutoFillCompetencia(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ex: 02/2026"
                />
              </label>

              <div className="flex flex-col justify-end gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => void autoPreencherPorPatrimonio()}
                  disabled={autoFillLoading}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {autoFillLoading ? 'Buscando Matrix...' : 'Auto preencher por patrimonio'}
                </button>
                <span className="text-xs text-slate-500">
                  Busca serie (AI), tipo e descricao do produto pela planilha Matrix.
                </span>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="inventario.nr_serie (auto preenchido pela Matrix coluna AI)" />
                <span className="font-medium text-slate-700">Serie</span>
                <input
                  value={formData.nr_serie}
                  onChange={(event) => handleChangeForm('nr_serie', event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ex: SN-12345"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="inventario.nr_ip" />
                <span className="font-medium text-slate-700">IP</span>
                <input
                  value={formData.nr_ip}
                  onChange={(event) => handleChangeForm('nr_ip', event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ex: 10.0.0.15"
                />
              </label>

              {tpHierarquiaFormulario !== 'FILHO' ? (
                <label className="flex flex-col gap-1 text-sm">
                  <FieldDbHint text="inventario.nm_hostname" />
                  <span className="font-medium text-slate-700">Hostname</span>
                  <input
                    value={formData.nm_hostname}
                    onChange={(event) => handleChangeForm('nm_hostname', event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Ex: CPU-ADM-012"
                    required
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="inventario.cd_setor -> setor.cd_setor" />
                <span className="font-medium text-slate-700">Setor</span>
                <select
                  value={formData.cd_setor}
                  onChange={(event) => handleChangeForm('cd_setor', event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  required
                >
                  <option value="">Selecione o setor</option>
                  {setores.map((setor) => (
                    <option key={setor.cd_setor} value={setor.cd_setor}>
                      {formatSetorLabel(setor)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="nao salva em inventario; apenas filtra modelos por tipo" />
                <span className="font-medium text-slate-700">Tipo do equipamento</span>
                <select
                  value={formTipoEquipamento || ''}
                  onChange={(event) => handleSelectTipoFormulario(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="">Selecione o tipo</option>
                  {tiposEquipamento.map((tipo) => (
                    <option key={tipo.cd_tipo_equipamento} value={tipo.cd_tipo_equipamento}>
                      {tipo.nm_tipo_equipamento}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="inventario.cd_equipamento -> equipamento.cd_equipamento" />
                <span className="font-medium text-slate-700">Modelo</span>
                <select
                  value={formData.cd_equipamento}
                  onChange={(event) => handleSelectEquipamento(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  required
                >
                  <option value="">Selecione o modelo</option>
                  {equipamentosFiltradosNoFormulario.map((equipamento) => (
                    <option key={equipamento.cd_equipamento} value={equipamento.cd_equipamento}>
                      {equipamento.nm_modelo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <FieldDbHint text="inventario.tp_status (ATIVO/MANUTENCAO/BACKUP/DEVOLUCAO)" />
                <span className="font-medium text-slate-700">Status operacional</span>
                <select
                  value={formData.tp_status}
                  onChange={(event) => handleChangeForm('tp_status', event.target.value as TpStatus)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="MANUTENCAO">Manutencao</option>
                  <option value="BACKUP">Backup</option>
                  <option value="DEVOLUCAO">Devolucao</option>
                </select>
              </label>

              {(formData.tp_status === 'MANUTENCAO' || formData.tp_status === 'DEVOLUCAO') ? (
                <label className="flex flex-col gap-1 text-sm">
                  <FieldDbHint text="movimentacao.ds_observacao (chamado opcional para manutencao/devolucao)" />
                  <span className="font-medium text-slate-700">Numero do chamado (opcional)</span>
                  <input
                    value={formData.nr_chamado}
                    onChange={(event) => handleChangeForm('nr_chamado', event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Ex: GLPI-123456"
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1 text-sm md:col-span-2 lg:col-span-3">
                <FieldDbHint text="inventario.nr_invent_sup -> inventario.nr_inventario (auto relacionamento)" />
                <span className="font-medium text-slate-700">Item superior (opcional)</span>
                <select
                  value={formData.nr_invent_sup}
                  onChange={(event) => handleSelectItemSuperior(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  disabled={tpHierarquiaFormulario === 'RAIZ'}
                >
                  <option value="">Sem vinculo (item raiz)</option>
                  {itensRaiz.map((item) => (
                    <option key={item.nr_inventario} value={item.nr_inventario}>
                      {labelInventario(item)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-600">
                  Uma CPU raiz pode ter varios filhos vinculados ao mesmo tempo (ex: 2 monitores + 1 nobreak).
                </span>
              </label>

              {tpHierarquiaFormulario === 'RAIZ' ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 md:col-span-2 lg:col-span-3">
                  Modelo RAIZ selecionado: este item nao pode ter item superior.
                </div>
              ) : null}

              <div className="flex flex-col gap-2 text-sm md:col-span-2 lg:col-span-3">
                <FieldDbHint text="nao salva em tabela; camera somente para leitura temporaria de codigo" />
                <span className="font-medium text-slate-700">Leitor por camera (codigo de barras)</span>
                <div className="ui-row">
                  <button
                    type="button"
                    onClick={() => setScannerOpen((previous) => !previous)}
                    className="ui-btn"
                  >
                    {scannerOpen ? 'Fechar camera' : 'Abrir camera para ler codigo'}
                  </button>
                  {scannerStatus ? <span className="text-xs text-slate-600">{scannerStatus}</span> : null}
                </div>

                {scannerOpen ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded-md border border-slate-300"
                      style={{ maxHeight: 260, background: '#0f172a' }}
                    />
                    <p className="text-xs text-slate-600">
                      Aponte para o codigo de barras do patrimonio. A leitura preenche o campo de patrimonio e nao
                      armazena imagem no sistema.
                    </p>
                  </div>
                ) : null}

                {scannerError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {scannerError}
                  </div>
                ) : null}
              </div>
            </div>

            {formData.nr_invent_sup ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                O setor pode ser herdado do item superior para manter consistencia da estacao.
              </div>
            ) : null}

            {formData.cd_equipamento ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Hierarquia esperada para este modelo:{' '}
                <strong>
                  {
                    tpHierarquiaFormulario
                  }
                </strong>
              </div>
            ) : null}

            {autoFillMessage ? (
              <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                {autoFillMessage}
              </div>
            ) : null}

            {autoFillItem ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p>
                  <strong>Referencia Matrix:</strong> tipo {autoFillItem.nm_tipo || '-'} | descricao{' '}
                  {autoFillItem.ds_produto || '-'}
                </p>
                <p>
                  serie {autoFillItem.nr_serie || '-'} | id equipamento {autoFillItem.nr_id_equipamento || '-'}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="ui-btn ui-btn-primary"
              >
                {saving ? 'Salvando...' : editingItem ? 'Salvar alteracoes' : 'Salvar equipamento'}
              </button>
              {editingItem ? (
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    openMovimentacaoModal(editingItem);
                  }}
                  className="ui-btn"
                >
                  Movimentacao
                </button>
              ) : null}
              {editingItem?.tp_status === 'MANUTENCAO' ? (
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    openSubstituicaoModal(editingItem);
                  }}
                  className="ui-btn"
                >
                  Substituir
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  resetModalForm();
                  setModalOpen(false);
                }}
                className="ui-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resolucaoModalOpen}
        onOpenChange={(open) => {
          setResolucaoModalOpen(open);
          if (!open) {
            resetResolucaoModal();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolucao de manutencao</DialogTitle>
            <DialogDescription>
              {resolvendoItem
                ? `Patrimonio ${resolvendoItem.nr_patrimonio || resolvendoItem.nr_inventario}: finalize com destino adequado.`
                : 'Defina o destino apos manutencao.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitResolucao} className="inv-modal-form space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Resultado da manutencao</span>
              <select
                value={resolucaoForm.tipo_resolucao}
                onChange={(event) => handleChangeResolucao('tipo_resolucao', event.target.value as TipoResolucao)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="RESOLVIDO">Resolvido</option>
                <option value="SEM_RESOLUCAO">Sem resolucao (vai para devolucao)</option>
              </select>
            </label>

            {resolucaoForm.tipo_resolucao === 'RESOLVIDO' ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Destino apos resolucao</span>
                <select
                  value={resolucaoForm.destino_resolucao}
                  onChange={(event) => handleChangeResolucao('destino_resolucao', event.target.value as DestinoResolucao)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="ORIGEM">Voltar para setor de origem</option>
                  <option value="NOVO_SETOR">Enviar para novo setor</option>
                  <option value="ESTOQUE">Enviar para estoque (backup)</option>
                </select>
              </label>
            ) : null}

            {resolucaoForm.tipo_resolucao === 'RESOLVIDO' && resolucaoForm.destino_resolucao === 'NOVO_SETOR' ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Setor de destino</span>
                <select
                  value={resolucaoForm.cd_setor_destino}
                  onChange={(event) => handleChangeResolucao('cd_setor_destino', event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {setores.map((setor) => (
                    <option key={setor.cd_setor} value={setor.cd_setor}>
                      {formatSetorLabel(setor)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {resolucaoForm.tipo_resolucao === 'SEM_RESOLUCAO' ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Numero do chamado (opcional)</span>
                <input
                  value={resolucaoForm.nr_chamado}
                  onChange={(event) => handleChangeResolucao('nr_chamado', event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ex: GLPI-123456"
                />
                <span className="text-xs text-slate-500">Se vazio, o sistema tenta reutilizar o ultimo chamado desta manutencao.</span>
              </label>
            ) : null}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Observacao (opcional)</span>
              <textarea
                value={resolucaoForm.observacao}
                onChange={(event) => handleChangeResolucao('observacao', event.target.value)}
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ex: placa substituida, retorno ao setor administrativo"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={resolucaoLoading} className="ui-btn ui-btn-primary">
                {resolucaoLoading ? 'Aplicando...' : 'Confirmar resolucao'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResolucaoModalOpen(false);
                  resetResolucaoModal();
                }}
                className="ui-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={substituicaoModalOpen}
        onOpenChange={(open) => {
          setSubstituicaoModalOpen(open);
          if (!open) {
            resetSubstituicaoModal();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substituicao durante manutencao</DialogTitle>
            <DialogDescription>
              {substituindoItem
                ? `Patrimonio ${substituindoItem.nr_patrimonio || substituindoItem.nr_inventario}: selecione o backup que assumira o posto.`
                : 'Defina o item backup e as acoes dos filhos.'}
            </DialogDescription>
          </DialogHeader>

          {substituindoItem ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 space-y-1">
              <p>
                <strong>Item em manutencao:</strong> {labelInventario(substituindoItem)}
              </p>
              <p>
                <strong>Setor atual:</strong> {formatSetorLabel(substituindoItem.setor)}
              </p>
              <p>
                <strong>Regra:</strong> este item permanece em manutencao ate a resolucao.
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSubmitSubstituicao} className="inv-modal-form space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Patrimonio substituto (deve estar em backup)</span>
              <select
                value={substituicaoForm.nr_inventario_substituto}
                onChange={(event) => handleChangeSubstituicao('nr_inventario_substituto', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              >
                <option value="">Selecione</option>
                {substitutosDisponiveis.map((item) => (
                  <option key={item.nr_inventario} value={item.nr_inventario}>
                    {labelInventario(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Setor de destino (opcional)</span>
              <select
                value={substituicaoForm.cd_setor_destino}
                onChange={(event) => handleChangeSubstituicao('cd_setor_destino', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Automatico (setor de origem da manutencao)</option>
                {setores.map((setor) => (
                  <option key={setor.cd_setor} value={setor.cd_setor}>
                    {formatSetorLabel(setor)}
                  </option>
                ))}
              </select>
            </label>

            {filhosDiretosSubstituicao.length > 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p className="font-medium text-slate-700">Decisao por filho</p>
                <p className="text-xs text-slate-600">
                  Escolha o destino de cada filho do equipamento em manutencao.
                </p>
                <div className="space-y-2">
                  {filhosDiretosSubstituicao.map((filho) => (
                    <label key={filho.nr_inventario} className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-2">
                      <span className="text-xs font-medium text-slate-700">{labelInventario(filho)}</span>
                      <select
                        value={substituicaoFilhosAcoes[filho.nr_inventario] || 'ACOMPANHAR_NOVO_PAI'}
                        onChange={(event) => handleChangeAcaoFilhoSubstituicao(filho.nr_inventario, event.target.value as AcaoFilhoSubstituicao)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="ACOMPANHAR_NOVO_PAI">Acompanhar novo pai</option>
                        <option value="PERMANECER_ANTIGO_PENDENTE">Permanecer no antigo (pendente)</option>
                        <option value="MOVER_ESTOQUE">Mover para estoque</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Numero do chamado GLPI (opcional)</span>
              <input
                value={substituicaoForm.nr_chamado}
                onChange={(event) => handleChangeSubstituicao('nr_chamado', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ex: GLPI-123456"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Observacao (opcional)</span>
              <textarea
                value={substituicaoForm.observacao}
                onChange={(event) => handleChangeSubstituicao('observacao', event.target.value)}
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ex: backup enviado para manter operacao da area"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={substituicaoLoading} className="ui-btn ui-btn-primary">
                {substituicaoLoading ? 'Aplicando...' : 'Confirmar substituicao'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubstituicaoModalOpen(false);
                  resetSubstituicaoModal();
                }}
                className="ui-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={movimentacaoModalOpen}
        onOpenChange={(open) => {
          setMovimentacaoModalOpen(open);
          if (!open) {
            resetMovimentacaoModal();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentacao de equipamento</DialogTitle>
            <DialogDescription>
              {movimentandoItem
                ? `Patrimonio ${movimentandoItem.nr_patrimonio || movimentandoItem.nr_inventario}: informe o setor de destino.`
                : 'Defina o setor de destino para movimentacao.'}
            </DialogDescription>
          </DialogHeader>

          {movimentandoItem ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p>
                <strong>Empresa:</strong>{' '}
                {empresasByCgc.get(String(movimentandoItem.equipamento?.cd_cgc || '')) || 'Nao identificada'}
              </p>
              <p>
                <strong>Setor atual:</strong> {formatSetorLabel(movimentandoItem.setor)}
              </p>
              <p>
                <strong>Modelo:</strong> {movimentandoItem.equipamento?.nm_modelo || '-'}
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSubmitMovimentacao} className="inv-modal-form space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Setor de destino</span>
              <select
                value={movimentacaoForm.cd_setor_destino}
                onChange={(event) => handleChangeMovimentacao('cd_setor_destino', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              >
                <option value="">Selecione</option>
                {setores.map((setor) => (
                  <option key={setor.cd_setor} value={setor.cd_setor}>
                    {formatSetorLabel(setor)}
                  </option>
                ))}
              </select>
            </label>

            {filhosDiretosMovimentacao.length > 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p className="font-medium text-slate-700">Filhos vinculados</p>
                <p className="text-xs text-slate-600">
                  Escolha se cada filho acompanha o destino ou volta para estoque.
                </p>
                <div className="space-y-2">
                  {filhosDiretosMovimentacao.map((filho) => (
                    <label key={filho.nr_inventario} className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-2">
                      <span className="text-xs font-medium text-slate-700">{labelInventario(filho)}</span>
                      <select
                        value={movimentacaoFilhosAcoes[filho.nr_inventario] || 'ACOMPANHAR_DESTINO'}
                        onChange={(event) => handleChangeAcaoFilhoMovimentacao(filho.nr_inventario, event.target.value as AcaoFilhoMovimentacao)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="ACOMPANHAR_DESTINO">Acompanhar destino</option>
                        <option value="MOVER_ESTOQUE">Mover para estoque</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Numero do chamado GLPI (opcional)</span>
              <input
                value={movimentacaoForm.nr_chamado}
                onChange={(event) => handleChangeMovimentacao('nr_chamado', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ex: GLPI-123456"
              />
              <span className="text-xs text-slate-500">Se ficar vazio, o sistema tenta reutilizar o ultimo chamado da movimentacao.</span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Observacao (opcional)</span>
              <textarea
                value={movimentacaoForm.observacao}
                onChange={(event) => handleChangeMovimentacao('observacao', event.target.value)}
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                placeholder="Ex: envio para sala de reuniao"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={movimentacaoLoading} className="ui-btn ui-btn-primary">
                {movimentacaoLoading ? 'Movendo...' : 'Confirmar movimentacao'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovimentacaoModalOpen(false);
                  resetMovimentacaoModal();
                }}
                className="ui-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="inv-page space-y-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
            <p className="text-sm text-slate-600">
              Combine setor, tipo, relacionamento e status para encontrar qualquer item rapido.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-7">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Buscar</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Patrimonio, IP, serie, setor..."
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Piso</span>
              <select
                value={selectedPiso || ''}
                onChange={(event) => {
                  setSelectedPiso(event.target.value ? Number(event.target.value) : null);
                  setSelectedSetor(null);
                  setSelectedLocalizacao('');
                }}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Todos</option>
                {pisos.map((piso) => (
                  <option key={piso.cd_piso} value={piso.cd_piso}>
                    {piso.nm_piso}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Setor</span>
              <select
                value={selectedSetor || ''}
                onChange={(event) => {
                  setSelectedSetor(event.target.value ? Number(event.target.value) : null);
                  setSelectedLocalizacao('');
                }}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Todos</option>
                {setoresFiltradosPorPiso.map((setor) => (
                  <option key={setor.cd_setor} value={setor.cd_setor}>
                    {formatSetorLabel(setor)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Localizacao</span>
              <select
                value={selectedLocalizacao}
                onChange={(event) => setSelectedLocalizacao(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Todas</option>
                <option value={SEM_LOCALIZACAO_VALUE}>Sem localizacao</option>
                {localizacoesFiltradas.map((localizacao) => (
                  <option key={localizacao} value={localizacao}>
                    {localizacao}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Tipo</span>
              <select
                value={selectedTipo || ''}
                onChange={(event) => setSelectedTipo(event.target.value ? Number(event.target.value) : null)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Todos</option>
                {tiposEquipamento.map((tipo) => (
                  <option key={tipo.cd_tipo_equipamento} value={tipo.cd_tipo_equipamento}>
                    {tipo.nm_tipo_equipamento}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Relacionamento</span>
              <select
                value={selectedRelacao}
                onChange={(event) => setSelectedRelacao(event.target.value as RelacaoFiltro)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="todos">Todos</option>
                <option value="raizes">Apenas raizes</option>
                <option value="filhos">Apenas vinculados</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as StatusFiltro)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="todos">Todos</option>
                <option value="ATIVO">Ativo</option>
                <option value="MANUTENCAO">Manutencao</option>
                <option value="BACKUP">Backup</option>
                <option value="DEVOLUCAO">Devolucao</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Total: {items.length}</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">Raizes: {totalRaizes}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Vinculados: {totalFilhos}</span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">Ativo: {totalAtivos}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Manutencao: {totalManutencao}</span>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">Backup: {totalBackup}</span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Devolucao: {totalDevolucao}</span>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">Exibindo: {paintedItems.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-6 text-center text-slate-600">Carregando...</div>
        ) : (
          <div className="space-y-8">
            {groupedBySetor.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-center text-slate-600">
                Nenhum item encontrado com os filtros selecionados.
              </div>
            ) : null}

            {groupedBySetor.map(({ setorId, inventarios }) => {
              const setor = setores.find((s) => s.cd_setor === setorId);
              return (
                <div key={setorId} className="overflow-x-auto rounded-lg border bg-white">
                  <div className="border-b bg-gray-100 px-4 py-3">
                    <h2 className="text-lg font-bold">{formatSetorLabel(setor)}</h2>
                    <p className="text-sm text-gray-600">{setor?.ds_setor}</p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-4 py-2 text-left font-semibold">Acoes</th>
                        <th className="px-4 py-2 text-left font-semibold">ID</th>
                        <th className="px-4 py-2 text-left font-semibold">Patrimonio</th>
                        <th className="px-4 py-2 text-left font-semibold">Tipo</th>
                        <th className="px-4 py-2 text-left font-semibold">Modelo</th>
                        <th className="px-4 py-2 text-left font-semibold">Hierarquia</th>
                        <th className="px-4 py-2 text-left font-semibold">Item superior</th>
                        <th className="px-4 py-2 text-left font-semibold">Filhos</th>
                        <th className="px-4 py-2 text-left font-semibold">Hostname</th>
                        <th className="px-4 py-2 text-left font-semibold">IP</th>
                        <th className="px-4 py-2 text-left font-semibold">Serie</th>
                        <th className="px-4 py-2 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventarios.map((item) => (
                        <tr key={item.nr_inventario} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              {item.tp_status === 'MANUTENCAO' ? (
                                <button
                                  type="button"
                                  onClick={() => openSubstituicaoModal(item)}
                                  className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                                >
                                  Substituir
                                </button>
                              ) : null}
                              {item.tp_status === 'MANUTENCAO' ? (
                                <button
                                  type="button"
                                  onClick={() => openResolucaoModal(item)}
                                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
                                >
                                  Resolucao
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-600">{item.nr_inventario}</td>
                          <td className="px-4 py-2 font-mono text-sm">{item.nr_patrimonio || '-'}</td>
                          <td className="px-4 py-2 text-sm">{item.tipoEquipamento?.nm_tipo_equipamento || '-'}</td>
                          <td className="px-4 py-2">{item.equipamento?.nm_modelo || '-'}</td>
                          <td className="px-4 py-2 text-sm">{item.equipamento?.tp_hierarquia || 'AMBOS'}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">
                            {item.itemSuperior ? labelInventario(item.itemSuperior) : 'Raiz'}
                          </td>
                          <td className="px-4 py-2 text-sm">{item.filhosCount}</td>
                          <td className="px-4 py-2 font-mono text-sm">{item.nm_hostname || '-'}</td>
                          <td className="px-4 py-2 font-mono text-sm">{item.nr_ip || '-'}</td>
                          <td className="px-4 py-2 text-sm">{item.nr_serie || '-'}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-block rounded px-2 py-1 text-sm ${getClassTpStatus(item.tp_status as TpStatus)}`}
                            >
                              {getLabelTpStatus(item.tp_status as TpStatus)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Composicao das estacoes</h2>
                <p className="text-sm text-slate-600">Visualizacao rapida de itens raiz e equipamentos vinculados.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {itensRaizDaVisao.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma estacao para os filtros atuais.</p>
                ) : null}

                {itensRaizDaVisao.map((raiz) => {
                  const filhos = filhosByParent.get(raiz.nr_inventario) || [];
                  return (
                    <div key={raiz.nr_inventario} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-semibold text-slate-900">{labelInventario(raiz)}</p>
                      <p className="text-xs text-slate-500">{formatSetorLabel(raiz.setor)}</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {filhos.length === 0 ? (
                          <p className="text-slate-500">Sem itens vinculados</p>
                        ) : (
                          filhos.map((filho) => (
                            <p key={filho.nr_inventario}>- {labelInventario(filho)}</p>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </BasicPageShell>
  );
}
