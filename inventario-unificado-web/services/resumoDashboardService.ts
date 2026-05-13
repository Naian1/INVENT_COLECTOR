/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\resumoDashboardService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listarVisaoGeralImpressoras } from "@/services/visaoGeralImpressorasService";
import type { ResumoDashboard } from "@/types/impressora";

/**
 * [DOC-FUNC] getInicioDoMesUtc
 * O que faz: Consulta e organiza informacoes na funcao 'getInicioDoMesUtc', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: now; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
function getInicioDoMesUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * [DOC-FUNC] calcularPaginasMesAtual
 * O que faz: Consulta e organiza informacoes na funcao 'calcularPaginasMesAtual', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: agoraIso; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Normaliza entradas na funcao 'calcularContadoresOperacionais', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
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
 * O que faz: Consulta e organiza informacoes na funcao 'buscarResumoDashboard', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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

