/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\impressorasService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
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

/**
 * [DOC-FUNC] normalizarTexto
 * O que faz: Normaliza entradas na funcao 'normalizarTexto', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function normalizarTexto(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalizado = value.trim();
  if (!normalizado) return undefined;
  if (VALORES_DESCONHECIDOS.has(normalizado.toLowerCase())) return undefined;
  return normalizado;
}

/**
 * [DOC-FUNC] calcularNivelPercentual
 * O que faz: Normaliza entradas na funcao 'calcularNivelPercentual', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: quantidade; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function calcularNivelPercentual(quantidade: number | null): number | null {
  if (quantidade === null || quantidade === undefined) return null;
  const num = Number(quantidade);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, num));
}

/**
 * [DOC-FUNC] transformarSuprimentoResumo
 * O que faz: Consulta e organiza informacoes na funcao 'transformarSuprimentoResumo', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: sup; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
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

/**
 * [DOC-FUNC] transformarImpressoraComSuprimentos
 * O que faz: Normaliza entradas na funcao 'transformarImpressoraComSuprimentos', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: dados; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
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
/**
 * [DOC-FUNC] listarImpressoras
 * O que faz: Consulta e organiza informacoes na funcao 'listarImpressoras', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
/**
 * [DOC-FUNC] buscarImpressoraPorId
 * O que faz: Consulta e organiza informacoes na funcao 'buscarImpressoraPorId', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: id; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
/**
 * [DOC-FUNC] criarImpressora
 * O que faz: Executa a responsabilidade central da funcao 'criarImpressora', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
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
/**
 * [DOC-FUNC] atualizarImpressora
 * O que faz: Atualiza estado na funcao 'atualizarImpressora', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: id, input; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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

