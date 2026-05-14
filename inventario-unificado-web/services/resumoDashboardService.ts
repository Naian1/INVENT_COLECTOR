/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\resumoDashboardService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listarVisaoGeralImpressoras } from "@/services/visaoGeralImpressorasService";
import type { ResumoDashboard } from "@/types/impressora";

/**
 * [DOC-FUNC] getInicioDoMesUtc
 * O que faz: Consulta e organiza informacoes na funcao 'getInicioDoMesUtc' para retorno confiavel.
 * Entradas: Parametros esperados: now; com validacao de formato e fallback quando necessario.
 * Como executa: Padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
 */
function getInicioDoMesUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * [DOC-FUNC] calcularPaginasMesAtual
 * O que faz: Executa a responsabilidade principal da funcao 'calcularPaginasMesAtual' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: agoraIso; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; consulta dados em fonte interna/externa; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
async function calcularPaginasMesAtual(agoraIso: string) {
  const supabase = getSupabaseServerClient();
  const inicioMesIso = getInicioDoMesUtc(new Date(agoraIso));

  const { data, error } = await supabase
    .from("leituras_paginas_impressoras")
    .select("impressora_id,contador_total_paginas")
    .eq("valido", true)
    .gte("coletado_em", inicioMesIso)
    .lte("coletado_em", agoraIso);

  if (error || !data) return 0;

  const tracker = new Map<string, { min: number; max: number }>();
  for (const row of data) {
    const paginas = Number(row.contador_total_paginas);
    if (!Number.isFinite(paginas)) continue;

    const current = tracker.get(row.impressora_id);
    if (!current) {
      tracker.set(row.impressora_id, { min: paginas, max: paginas });
      continue;
    }
    if (paginas < current.min) current.min = paginas;
    if (paginas > current.max) current.max = paginas;
  }

  let totalImpresso = 0;
  for (const item of tracker.values()) {
    totalImpresso += Math.max(0, item.max - item.min);
  }
  return totalImpresso;
}

/**
 * [DOC-FUNC] calcularContadoresOperacionais
 * O que faz: Executa a responsabilidade principal da funcao 'calcularContadoresOperacionais' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
async function calcularContadoresOperacionais() {
  const visaoGeral = await listarVisaoGeralImpressoras();
  if (!visaoGeral.success) {
    return { online: 0, offline: 0, baixoOuCritico: 0 };
  }

  let online = 0;
  let offline = 0;
  let baixoOuCritico = 0;

  for (const impressora of visaoGeral.data) {
    if (impressora.status_atual === "online") online += 1;
    if (impressora.status_atual === "offline") offline += 1;

    const baixoPorNivel =
      impressora.menor_nivel_suprimento !== null &&
      Number.isFinite(impressora.menor_nivel_suprimento) &&
      impressora.menor_nivel_suprimento <= 15;

    const baixoPorStatus = impressora.resumo_suprimentos.some((item) =>
      ["low", "critical", "empty"].includes((item.status_suprimento ?? "").toLowerCase())
    );

    if (baixoPorNivel || baixoPorStatus) baixoOuCritico += 1;
  }

  return { online, offline, baixoOuCritico };
}

/**
 * [DOC-FUNC] buscarResumoDashboard
 * O que faz: Consulta e organiza informacoes na funcao 'buscarResumoDashboard' para retorno confiavel.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Consulta dados em fonte interna/externa; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
 */
export async function buscarResumoDashboard(): Promise<ResumoDashboard> {
  const supabase = getSupabaseServerClient();
  const agoraIso = new Date().toISOString();

  const [{ count: totalImpressoras }, { count: impressorasAtivas }, operacionais, paginasMes] =
    await Promise.all([
      supabase.from("impressoras").select("*", { count: "exact", head: true }),
      supabase.from("impressoras").select("*", { count: "exact", head: true }).eq("ativo", true),
      calcularContadoresOperacionais(),
      calcularPaginasMesAtual(agoraIso)
    ]);

  return {
    gerado_em: agoraIso,
    total_impressoras: totalImpressoras ?? 0,
    impressoras_ativas: impressorasAtivas ?? 0,
    impressoras_online: operacionais.online,
    impressoras_offline: operacionais.offline,
    suprimentos_baixos_ou_criticos: operacionais.baixoOuCritico,
    paginas_impressas_mes_atual: paginasMes
  };
}

