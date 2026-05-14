/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\metricasImpressorasService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ResultadoServico } from "@/services/impressorasService";
import type { MetricasImpressora } from "@/types/impressora";

/**
 * [DOC-FUNC] buscarMetricasImpressoraPorPeriodo
 * O que faz: A funcao 'buscarMetricasImpressoraPorPeriodo' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

