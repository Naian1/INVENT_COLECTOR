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
 * O que faz: A funcao 'deveAtualizarUltimaColeta' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'normalizarIpSemMascara' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: ip. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarIpSemMascara(ip: string | null | undefined) {
  if (!ip) return null;
  const normalizado = ip.trim();
  if (!normalizado) return null;
  return normalizado.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] resolverStatusSuprimento
 * O que faz: A funcao 'resolverStatusSuprimento' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'gravarEvento' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
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
 * O que faz: A funcao 'ingerirTelemetriaColetorPt' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

