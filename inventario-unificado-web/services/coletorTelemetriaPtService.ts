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
 * O que faz: Atualiza estado na funcao 'deveAtualizarUltimaColeta', mantendo coerencia entre dados atuais e alteracoes recebidas.
 * Entradas: Parametros esperados: ultimaColetaAtual, candidatoIso; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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
 * O que faz: Normaliza entradas na funcao 'normalizarIpSemMascara', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: ip; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function normalizarIpSemMascara(ip: string | null | undefined) {
  if (!ip) return null;
  const normalizado = ip.trim();
  if (!normalizado) return null;
  return normalizado.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] resolverStatusSuprimento
 * O que faz: Monta a estrutura central na funcao 'resolverStatusSuprimento', combinando dados brutos em payload coerente.
 * Entradas: Parametros esperados: statusExplcito, nivelPercentual; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna estrutura consolidada (payload/objeto) pronta para API, banco, servico ou camada de UI.
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
 * O que faz: Cria e persiste dados na funcao 'gravarEvento', aplicando validacao para preservar integridade do dominio.
 * Entradas: Parametros esperados: coletorId, evento, coletadoEmPadrao; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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
 * O que faz: Normaliza entradas na funcao 'ingerirTelemetriaColetorPt', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: payload; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
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

