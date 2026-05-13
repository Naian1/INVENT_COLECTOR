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
 * O que faz: Executa a rotina principal de 'deve atualizar ultima coleta' no contexto deste modulo.
 * Entradas: Parametros esperados: ultimaColetaAtual, candidatoIso.
 * Como executa: Valida precondicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * O que faz: Padroniza dados de 'normalizar ip sem mascara' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: ip.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizarIpSemMascara(ip: string | null | undefined) {
  if (!ip) return null;
  const normalizado = ip.trim();
  if (!normalizado) return null;
  return normalizado.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] resolverStatusSuprimento
 * O que faz: Monta estrutura de 'resolver status suprimento' a partir de dados intermediarios do modulo.
 * Entradas: Parametros esperados: statusExplcito, nivelPercentual.
 * Como executa: Combina campos, aplica prioridade de regras e prepara payload final.
 * Retorno/Efeitos: Retorna estrutura consolidada para a proxima etapa do processo.
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
 * O que faz: Executa a rotina principal de 'gravar evento' no contexto deste modulo.
 * Entradas: Parametros esperados: coletorId, evento, coletadoEmPadrao.
 * Como executa: Valida precondicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * O que faz: Executa a rotina principal de 'ingerir telemetria coletor pt' no contexto deste modulo.
 * Entradas: Parametros esperados: payload.
 * Como executa: Valida precondicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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

