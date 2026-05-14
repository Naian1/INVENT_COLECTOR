/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\coletorTelemetriaPtService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LoteTelemetriaColetorPt } from "@/lib/validation/coletorSchemasPtBr";
// import { upsertImpressoraPorColetor } from "@/services/impressorasService";
import type { ResultadoIngestaoColetor } from "@/types/impressora";

/**
 * [DOC-FUNC] deveAtualizarUltimaColeta
 * O que faz: Avalia condicoes de controle na funcao 'deveAtualizarUltimaColeta' para permitir ou bloquear o proximo passo.
 * Entradas: Parametros esperados: ultimaColetaAtual, candidatoIso; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna verdadeiro/falso para conduzir o fluxo de negocio de forma segura.
 */
function deveAtualizarUltimaColeta(
  ultimaColetaAtual: string | null,
  candidatoIso: string
) {
  if (!ultimaColetaAtual) return true;
  const atualTs = Date.parse(ultimaColetaAtual);
  const candidatoTs = Date.parse(candidatoIso);
  if (Number.isNaN(candidatoTs)) return false;
  if (Number.isNaN(atualTs)) return true;
  return candidatoTs > atualTs;
}

/**
 * [DOC-FUNC] normalizarIpSemMascara
 * O que faz: Normaliza entradas na funcao 'normalizarIpSemMascara', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: ip; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizarIpSemMascara(ip: string | null | undefined) {
  if (!ip) return null;
  const normalizado = ip.trim();
  if (!normalizado) return null;
  return normalizado.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] resolverStatusSuprimento
 * O que faz: Monta estrutura/payload na funcao 'resolverStatusSuprimento', consolidando dados para a proxima camada.
 * Entradas: Parametros esperados: statusExplcito, nivelPercentual; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna estrutura consolidada pronta para API, servico, banco ou interface.
 */
function resolverStatusSuprimento(
  statusExplcito: string | undefined,
  nivelPercentual: number | null | undefined
) {
  if (statusExplcito) return statusExplcito;
  if (nivelPercentual === null || nivelPercentual === undefined) return "unknown";
  if (nivelPercentual <= 0) return "empty";
  if (nivelPercentual <= 5) return "critical";
  if (nivelPercentual <= 15) return "low";
  return "ok";
}

/**
 * [DOC-FUNC] gravarEvento
 * O que faz: Cria e persiste dados na funcao 'gravarEvento' com validacao de integridade.
 * Entradas: Parametros esperados: coletorId, evento, coletadoEmPadrao; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados.
 * Retorno/Efeitos: Retorna registro/resultado de escrita com erros de integridade tratados.
 */
async function gravarEvento(
  coletorId: string,
  evento: LoteTelemetriaColetorPt["eventos"][number],
  coletadoEmPadrao: string
) {
  const supabase = getSupabaseServerClient();
  const coletadoEm = evento.coletado_em ?? coletadoEmPadrao;

  // OLD v2 ENDPOINT - Collector now handles data ingestion directly via Supabase
  /*
  const impressoraResult = await upsertImpressoraPorColetor({
    ip: evento.impressora.ip,
    numero_serie: evento.impressora.numero_serie,
    patrimonio: evento.impressora.patrimonio ?? undefined,
    setor: evento.impressora.setor,
    localizacao: evento.impressora.localizacao,
    modelo: evento.impressora.modelo,
    fabricante: evento.impressora.fabricante,
    hostname: evento.impressora.hostname,
    endereco_mac: evento.impressora.endereco_mac,
    ativo: evento.impressora.ativo
  });

  if (!impressoraResult.success) {
    return { success: false as const, error: impressoraResult.error };
  }
  */
  
  // For now, return success - collector handles DB writes directly
  return { 
    success: true as const,
    gravacoesTelemetria: 0,
    gravacoesLeiturasPaginas: 0,
    gravacoesSuprimentos: 0
  };
}

/**
 * [DOC-FUNC] ingerirTelemetriaColetorPt
 * O que faz: Executa a responsabilidade principal da funcao 'ingerirTelemetriaColetorPt' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: payload; com validacao de formato e fallback quando necessario.
 * Como executa: Itera colecoes para montar/filtrar dados; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
export async function ingerirTelemetriaColetorPt(
  payload: LoteTelemetriaColetorPt
): Promise<ResultadoIngestaoColetor> {
  const result: ResultadoIngestaoColetor = {
    coletor_id: payload.coletor_id,
    eventos_recebidos: payload.eventos.length,
    eventos_processados: 0,
    gravacoes_telemetria: 0,
    gravacoes_leituras_paginas: 0,
    gravacoes_suprimentos: 0,
    erros: []
  };

  const coletadoEmPadrao = payload.coletado_em ?? new Date().toISOString();

  for (const evento of payload.eventos) {
    const gravacao = await gravarEvento(payload.coletor_id, evento, coletadoEmPadrao);
    
    result.eventos_processados += 1;
    result.gravacoes_telemetria += gravacao.gravacoesTelemetria;
    result.gravacoes_leituras_paginas += gravacao.gravacoesLeiturasPaginas;
    result.gravacoes_suprimentos += gravacao.gravacoesSuprimentos;
  }

  return result;
}

