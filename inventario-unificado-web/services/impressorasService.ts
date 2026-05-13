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
 * O que faz: Normaliza valores na funcao 'normalizarTexto', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
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
 * O que faz: Orquestra a etapa 'calcularNivelPercentual' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (quantidade) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
 */
function calcularNivelPercentual(quantidade: number | null): number | null {
  if (quantidade === null || quantidade === undefined) return null;
  const num = Number(quantidade);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, num));
}

/**
 * [DOC-FUNC] transformarSuprimentoResumo
 * O que faz: Consulta informacoes na funcao 'transformarSuprimentoResumo' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sup) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Orquestra a etapa 'transformarImpressoraComSuprimentos' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (dados) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia iteracao/transformacao de colecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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
 * O que faz: Consulta informacoes na funcao 'listarImpressoras' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'buscarImpressoraPorId' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (id) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Orquestra a etapa 'criarImpressora' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (input) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia sequencia de validacao e processamento interno, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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
 * O que faz: Atualiza dados na funcao 'atualizarImpressora', mantendo consistencia entre o estado atual e as novas informacoes.
 * Entradas: Recebe identificador e campos para alteracao (id, input), com validacao de formato e regra de negocio.
 * Como executa: Localiza o alvo, aplica apenas mudancas permitidas e executa update com tratamento de conflito/falha.
 * Retorno/Efeitos: Devolve o estado final atualizado ou erro contextualizado para facilitar diagnostico.
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

