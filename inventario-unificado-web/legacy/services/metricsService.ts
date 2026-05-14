/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\legacy\services\metricsService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceResult } from "@/legacy/services/printerService";

export type PrinterMetrics = {
  printer_id: string;
  from: string;
  to: string;
  total_pages_printed: number;
  reads_count: number;
  has_reset_detected: boolean;
  has_insufficient_data: boolean;
};

/**
 * [DOC-FUNC] getPrinterMetricsByRange
 * O que faz: A funcao 'getPrinterMetricsByRange' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 * Processamento: Executa a consulta, trata cenarios de erro e normaliza o resultado.
 * Retorno/Efeitos: Retorna os dados consolidados; em falha, propaga excecao/erro controlado.
 */
export async function getPrinterMetricsByRange(
  printerId: string,
  from: string,
  to: string
): Promise<ServiceResult<PrinterMetrics>> {
  const supabase = getSupabaseServerClient();

  const { data: validReads, error: validReadsError } = await supabase
    .from("printer_page_reads")
    .select("total_pages,reset_detected,collected_at")
    .eq("printer_id", printerId)
    .eq("is_valid", true)
    .gte("collected_at", from)
    .lte("collected_at", to)
    .order("collected_at", { ascending: true });

  if (validReadsError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao buscar leituras da impressora."
    };
  }

  const { count: resetCount, error: resetCountError } = await supabase
    .from("printer_page_reads")
    .select("*", { count: "exact", head: true })
    .eq("printer_id", printerId)
    .eq("reset_detected", true)
    .gte("collected_at", from)
    .lte("collected_at", to);

  if (resetCountError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao verificar reset_detected no período."
    };
  }

  const readsCount = validReads?.length ?? 0;
  const hasInsufficientData = readsCount < 2;

  let totalPagesPrinted = 0;

  if (!hasInsufficientData && validReads) {
    const totals = validReads
      .map((read) => Number(read.total_pages))
      .filter((value) => Number.isFinite(value));

    if (totals.length >= 2) {
      totalPagesPrinted = Math.max(...totals) - Math.min(...totals);
      if (totalPagesPrinted < 0) totalPagesPrinted = 0;
    }
  }

  return {
    success: true,
    data: {
      printer_id: printerId,
      from,
      to,
      total_pages_printed: totalPagesPrinted,
      reads_count: readsCount,
      has_reset_detected: (resetCount ?? 0) > 0,
      has_insufficient_data: hasInsufficientData
    }
  };
}

