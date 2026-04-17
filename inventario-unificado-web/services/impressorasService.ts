import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AtualizarImpressoraInput,
  CriarImpressoraInput,
  ImpressoraVisaoGeral,
  SuprimentoResumo
} from "@/types/impressora";
import type { Inventario } from "@/types/inventario";
import type { Suprimentos } from "@/types/suprimentos";

export type ResultadoServico<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

const VALORES_DESCONHECIDOS = new Set([
  "",
  "desconhecido",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "-",
  "sem setor"
]);

type ImpressoraComSuprimentos = {
  inventario: Inventario & { setor_nome?: string };
  equipamento: any;
  suprimentos: Suprimentos[];
};

function normalizarTexto(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalizado = value.trim();
  if (!normalizado) return undefined;
  if (VALORES_DESCONHECIDOS.has(normalizado.toLowerCase())) return undefined;
  return normalizado;
}

function calcularNivelPercentual(quantidade: number | null): number | null {
  if (quantidade === null || quantidade === undefined) return null;
  const num = Number(quantidade);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, num));
}

function transformarSuprimentoResumo(sup: Suprimentos): SuprimentoResumo {
  // cd_tipo_suprimento vem como descricao (ex: "Toner Negro")
  const tipo = sup.cd_tipo_suprimento || "Desconhecido";
  const chave = tipo.toLowerCase().replace(/\s+/g, "_");
  
  return {
    chave_suprimento: chave,
    nome_suprimento: tipo,
    nivel_percentual: calcularNivelPercentual(sup.nr_quantidade),
    status_suprimento: sup.ds_status_suprimento || "Normal"
  };
}

function transformarImpressoraComSuprimentos(dados: ImpressoraComSuprimentos): ImpressoraVisaoGeral {
  const inv = dados.inventario;
  const eq = dados.equipamento;
  const sups = dados.suprimentos || [];
  const setorNome = (inv as any)?.setor?.nm_setor || dados.inventario.setor_nome || "Desconhecido";
  
  // Calcular menor nivel de suprimento
  const niveis = sups
    .map(s => calcularNivelPercentual(s.nr_quantidade))
    .filter(n => n !== null) as number[];
  const menorNivel = niveis.length > 0 ? Math.min(...niveis) : null;
  
  return {
    id: `print_${inv.nr_inventario}`,
    patrimonio: inv.nr_patrimonio || `SEM-PATRIMONIO-${inv.nr_inventario}`,
    ip: inv.nr_ip || "N/A",
    setor: setorNome,
    localizacao: inv.ds_observacoes || null,
    modelo: eq?.nm_modelo || "Desconhecido",
    fabricante: eq?.nm_marca || eq?.nm_fabricante || null,
    numero_serie: inv.nr_serie || null,
    hostname: inv.nm_hostname || null,
    ativo: inv.ie_situacao === 'A',
    ultima_coleta_em: inv.dt_atualizacao ? new Date(inv.dt_atualizacao).toISOString() : null,
    status_atual: sups.length > 0 ? "Online" : "Offline",
    contador_paginas_atual: null, // Virá de telemetria_pagecount
    menor_nivel_suprimento: menorNivel,
    resumo_suprimentos: sups.map(transformarSuprimentoResumo),
    operacional: inv.ie_situacao === 'A',
    origem_linha_id: null,
    display_name_legacy: null
  };
}

/**
 * Lista todas as impressoras (equipamentos tipo "Impressora") com seus suprimentos
 */
export async function listarImpressoras(): Promise<ResultadoServico<ImpressoraVisaoGeral[]>> {
  try {
    const supabase = getSupabaseServerClient();

    // Buscar tipo "Impressora"
    const { data: tipos, error: erroTipos } = await supabase
      .from('tipo_equipamento')
      .select('cd_tipo_equipamento')
      .eq('nm_tipo_equipamento', 'Impressora')
      .eq('ie_situacao', 'A')
      .limit(1)
      .single();

    if (erroTipos || !tipos) {
      return {
        success: true,
        data: [] // Nenhuma impressora ainda ou tipo não configurado
      };
    }

    const tipoPrinterId = tipos.cd_tipo_equipamento;

    // Buscar inventario com equipamento, setor
    const { data: inventarios, error: erroInv } = await supabase
      .from('inventario')
      .select(`
        *,
        equipamento(cd_tipo_equipamento, nm_modelo, nm_marca),
        setor(nm_setor)
      `)
      .eq('ie_situacao', 'A');

    if (erroInv) {
      return {
        success: false,
        error: `Erro ao buscar inventario: ${erroInv.message}`,
        status: 500
      };
    }

    // Filtrar apenas impressoras
    const inventariosImpressoras = (inventarios || []).filter(inv => {
      const eq = (inv.equipamento as any);
      return eq && eq.cd_tipo_equipamento === tipoPrinterId;
    });

    // Buscar suprimentos
    const { data: suprimentos, error: erroSup } = await supabase
      .from('suprimentos')
      .select('*');

    if (erroSup) {
      return {
        success: false,
        error: `Erro ao buscar suprimentos: ${erroSup.message}`,
        status: 500
      };
    }

    // Agrupar suprimentos por nr_inventario
    const suprimentosPorInventario: Record<number, Suprimentos[]> = {};
    (suprimentos || []).forEach(sup => {
      const inv = sup.nr_inventario;
      if (!suprimentosPorInventario[inv]) {
        suprimentosPorInventario[inv] = [];
      }
      suprimentosPorInventario[inv].push(sup as Suprimentos);
    });

    // Transformar para ImpressoraVisaoGeral
    const impressoras = inventariosImpressoras.map(inv =>
      transformarImpressoraComSuprimentos({
        inventario: inv as any,
        equipamento: inv.equipamento,
        suprimentos: suprimentosPorInventario[inv.nr_inventario] || []
      })
    );

    return { success: true, data: impressoras };
  } catch (error) {
    return {
      success: false,
      error: `Erro ao listar impressoras: ${error instanceof Error ? error.message : String(error)}`,
      status: 500
    };
  }
}

/**
 * Busca uma impressora específica por ID (nr_inventario)
 */
export async function buscarImpressoraPorId(id: string): Promise<ResultadoServico<ImpressoraVisaoGeral>> {
  try {
    const supabase = getSupabaseServerClient();
    const invId = parseInt(id.replace(/\D/g, ''), 10);

    if (!Number.isFinite(invId)) {
      return { success: false, error: 'ID invalido', status: 400 };
    }

    // Buscar inventario
    const { data: inventario, error: erroInv } = await supabase
      .from('inventario')
      .select(`
        *,
        equipamento(cd_tipo_equipamento, nm_modelo, nm_marca),
        setor(nm_setor)
      `)
      .eq('nr_inventario', invId)
      .single();

    if (erroInv || !inventario) {
      return { success: false, error: 'Impressora nao encontrada', status: 404 };
    }

    // Buscar suprimentos
    const { data: suprimentos, error: erroSup } = await supabase
      .from('suprimentos')
      .select('*')
      .eq('nr_inventario', invId);

    if (erroSup) {
      return { success: false, error: `Erro ao buscar suprimentos: ${erroSup.message}`, status: 500 };
    }

    const resultado = transformarImpressoraComSuprimentos({
      inventario: inventario as any,
      equipamento: inventario.equipamento,
      suprimentos: (suprimentos || []) as Suprimentos[]
    });

    return { success: true, data: resultado };
  } catch (error) {
    return {
      success: false,
      error: `Erro ao buscar impressora: ${error instanceof Error ? error.message : String(error)}`,
      status: 500
    };
  }
}

/**
 * Cria uma nova impressora (deprecated - usar equipamento + inventario)
 */
export async function criarImpressora(input: CriarImpressoraInput): Promise<ResultadoServico<any>> {
  // Placeholder para compatibilidade com API
  // No novo sistema, impressoras são criadas através de equipamento + inventario
  return {
    success: false as const,
    error: "Use equipamentoService e inventarioService para criar impressoras",
    status: 422
  };
}

/**
 * Atualiza uma impressora (deprecated - usar equipamento + inventario)
 */
export async function atualizarImpressora(id: string, input: any): Promise<ResultadoServico<any>> {
  return {
    success: false as const,
    error: "Use equipamentoService e inventarioService para atualizar impressoras",
    status: 422
  };
}

/**
 * Upsert via collector (deprecated)
 */
/*
export async function upsertImpressoraPorColetor(input: any): Promise<ResultadoServico<any>> {
  return {
    success: false as const,
    error: "Coletor deve usar API endpoints diretamente",
    status: 422
  };
}
*/
