/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\coletorScaResumoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ScaResumoItem = {
  chave: string;
  patrimonio: string | null;
  tipo_equipamento: string;
  ip: string | null;
  status: string;
  coletado_em: string;
  detalhes: Record<string, unknown>;
};

type ResultadoServico<T> =
  | { success: true; data: T }
  | { success: false; status?: number; error: string };

type TelemetriaRow = {
  id: string;
  coletado_em: string;
  patrimonio: string | null;
  ip: string | null;
  status: string | null;
  payload_bruto: Record<string, unknown> | null;
};

/**
 * [DOC-FUNC] normalizarTexto
 * O que faz: Normaliza entradas na funcao 'normalizarTexto', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizarTexto(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * [DOC-FUNC] normalizarIp
 * O que faz: Normaliza entradas na funcao 'normalizarIp', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizarIp(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/\/32$/, "").trim() || null;
}

/**
 * [DOC-FUNC] extrairTipoEquipamento
 * O que faz: Executa a responsabilidade principal da funcao 'extrairTipoEquipamento' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: payload, unknown> | null; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function extrairTipoEquipamento(payload: Record<string, unknown> | null) {
  if (!payload) return "impressora";

  const candidatos = [
    payload.tipo_equipamento,
    payload.tipo,
    payload.tipo_dispositivo,
    payload.equipment_type,
    payload.device_type,
    payload.categoria
  ];

  for (const value of candidatos) {
    const normalizado = normalizarTexto(value);
    if (normalizado) return normalizado;
  }

  return "impressora";
}

/**
 * [DOC-FUNC] montarChave
 * O que faz: Monta estrutura/payload na funcao 'montarChave', consolidando dados para a proxima camada.
 * Entradas: Parametros esperados: row; com validacao de formato e fallback quando necessario.
 * Como executa: Executa processamento local em sequencia previsivel.
 * Retorno/Efeitos: Retorna estrutura consolidada pronta para API, servico, banco ou interface.
 */
function montarChave(row: TelemetriaRow) {
  const patrimonio = normalizarTexto(row.patrimonio);
  const ip = normalizarIp(row.ip);
  return patrimonio ?? ip ?? row.id;
}

/**
 * [DOC-FUNC] listarResumoSca
 * O que faz: Consulta e organiza informacoes na funcao 'listarResumoSca' para retorno confiavel.
 * Entradas: Parametros esperados: limit; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; consulta dados em fonte interna/externa; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
 */
export async function listarResumoSca(limit = 1800): Promise<ResultadoServico<ScaResumoItem[]>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("telemetria_impressoras")
    .select("id,coletado_em,patrimonio,ip,status,payload_bruto")
    .order("coletado_em", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      success: false,
      status: 500,
      error: "Erro ao carregar eventos SCA."
    };
  }

  const rows = (data ?? []) as TelemetriaRow[];
  const latestByKey = new Map<string, ScaResumoItem>();

  for (const row of rows) {
    const chave = montarChave(row);
    if (latestByKey.has(chave)) continue;

    const patrimonio = normalizarTexto(row.patrimonio);
    const ip = normalizarIp(row.ip);
    const status = normalizarTexto(row.status) ?? "unknown";

    latestByKey.set(chave, {
      chave,
      patrimonio,
      tipo_equipamento: extrairTipoEquipamento(row.payload_bruto),
      ip,
      status,
      coletado_em: row.coletado_em,
      detalhes: {
        patrimonio,
        ip,
        status,
        coletado_em: row.coletado_em,
        payload_bruto: row.payload_bruto ?? {}
      }
    });
  }

  const itens = Array.from(latestByKey.values()).sort((a, b) => {
    const pa = (a.patrimonio ?? a.ip ?? a.chave).toLowerCase();
    const pb = (b.patrimonio ?? b.ip ?? b.chave).toLowerCase();
    return pa.localeCompare(pb, "pt-BR");
  });

  return { success: true, data: itens };
}

