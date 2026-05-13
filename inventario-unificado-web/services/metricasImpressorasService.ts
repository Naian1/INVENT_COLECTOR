/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\metricasImpressorasService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ResultadoServico } from "@/services/impressorasService";
import type { MetricasImpressora } from "@/types/impressora";

/**
 * [DOC-FUNC] buscarMetricasImpressoraPorPeriodo
 * O que faz: Consulta dados de 'buscar metricas impressora por periodo' na fonte principal (API, banco ou cache).
 * Entradas: Recebe filtros/chaves de busca quando informados e valida o formato basico.
 * Processamento: Executa a consulta, trata cenarios de erro e normaliza o resultado.
 * Retorno/Efeitos: Retorna os dados consolidados; em falha, propaga excecao/erro controlado.
 */
export async function buscarMetricasImpressoraPorPeriodo(
  impressoraId: string,
  de: string,
  ate: string
): Promise<ResultadoServico<MetricasImpressora>> {
  const supabase = getSupabaseServerClient();

  const { data: leiturasValidas, error: leiturasError } = await supabase
    .from("leituras_paginas_impressoras")
    .select("contador_total_paginas,reset_detectado,coletado_em")
    .eq("impressora_id", impressoraId)
    .eq("valido", true)
    .gte("coletado_em", de)
    .lte("coletado_em", ate)
    .order("coletado_em", { ascending: true });

  if (leiturasError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao buscar leituras da impressora."
    };
  }

  const { count: resetCount, error: resetCountError } = await supabase
    .from("leituras_paginas_impressoras")
    .select("*", { count: "exact", head: true })
    .eq("impressora_id", impressoraId)
    .eq("reset_detectado", true)
    .gte("coletado_em", de)
    .lte("coletado_em", ate);

  if (resetCountError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao verificar reset_detectado no periodo."
    };
  }

  const quantidadeLeituras = leiturasValidas?.length ?? 0;
  const dadosInsuficientes = quantidadeLeituras < 2;

  let totalPaginasImpressas = 0;
  if (!dadosInsuficientes && leiturasValidas) {
    const totais = leiturasValidas
      .map((item) => Number(item.contador_total_paginas))
      .filter((value) => Number.isFinite(value));

    if (totais.length >= 2) {
      totalPaginasImpressas = Math.max(...totais) - Math.min(...totais);
      if (totalPaginasImpressas < 0) totalPaginasImpressas = 0;
    }
  }

  return {
    success: true,
    data: {
      impressora_id: impressoraId,
      de,
      ate,
      total_paginas_impressas: totalPaginasImpressas,
      quantidade_leituras: quantidadeLeituras,
      reset_detectado: (resetCount ?? 0) > 0,
      dados_insuficientes: dadosInsuficientes
    }
  };
}

