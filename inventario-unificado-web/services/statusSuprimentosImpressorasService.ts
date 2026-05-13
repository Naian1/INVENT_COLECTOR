/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\statusSuprimentosImpressorasService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buscarImpressoraPorId,
  type ResultadoServico
} from "@/services/impressorasService";
import type {
  LeituraPaginasImpressora,
  StatusSuprimentosImpressora,
  SuprimentoImpressora,
  TelemetriaImpressora
} from "@/types/impressora";

/**
 * [DOC-FUNC] toFiniteNumber
 * O que faz: Orquestra a etapa 'toFiniteNumber' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (value) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
 */
function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * [DOC-FUNC] isEmptyValue
 * O que faz: Avalia uma condicao booleana na funcao 'isEmptyValue' para decidir o caminho de execucao do modulo.
 * Entradas: Analisa parametros/contexto (value) e possiveis variaveis de ambiente/estado atual.
 * Como executa: Aplica comparacoes diretas e regras simples de validacao para classificar o estado como verdadeiro ou falso.
 * Retorno/Efeitos: Retorna um indicador de controle que habilita, bloqueia ou redireciona as proximas etapas do fluxo.
 */
function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

/**
 * [DOC-FUNC] isAlertaAberto
 * O que faz: Avalia uma condicao booleana na funcao 'isAlertaAberto' para decidir o caminho de execucao do modulo.
 * Entradas: Analisa parametros/contexto (alerta, unknown>) e possiveis variaveis de ambiente/estado atual.
 * Como executa: Aplica comparacoes diretas e regras simples de validacao para classificar o estado como verdadeiro ou falso.
 * Retorno/Efeitos: Retorna um indicador de controle que habilita, bloqueia ou redireciona as proximas etapas do fluxo.
 */
function isAlertaAberto(alerta: Record<string, unknown>) {
  const status =
    typeof alerta.status_alerta === "string" ? alerta.status_alerta.toLowerCase() : "";
  if (["fechado", "resolvido"].includes(status)) return false;

  if (!isEmptyValue(alerta.fechado_em)) return false;
  if (!isEmptyValue(alerta.resolvido_em)) return false;

  return true;
}

/**
 * [DOC-FUNC] buscarStatusSuprimentosImpressora
 * O que faz: Consulta informacoes na funcao 'buscarStatusSuprimentosImpressora' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (impressoraId) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
export async function buscarStatusSuprimentosImpressora(
  impressoraId: string
): Promise<ResultadoServico<StatusSuprimentosImpressora>> {
  const impressoraResult = await buscarImpressoraPorId(impressoraId);
  if (!impressoraResult.success) {
    return impressoraResult;
  }

  const supabase = getSupabaseServerClient();

  const [
    { data: telemetriaRows, error: telemetriaError },
    { data: leituraRows, error: leituraError },
    { data: suprimentoRows, error: suprimentoError },
    { data: alertaRows, error: alertaError }
  ] = await Promise.all([
    supabase
      .from("telemetria_impressoras")
      .select("ingestao_id,coletor_id,status,tempo_resposta_ms,coletado_em,payload_bruto")
      .eq("impressora_id", impressoraId)
      .order("coletado_em", { ascending: false })
      .limit(1),
    supabase
      .from("leituras_paginas_impressoras")
      .select("ingestao_id,coletado_em,contador_total_paginas,valido,motivo_invalido,reset_detectado")
      .eq("impressora_id", impressoraId)
      .eq("valido", true)
      .order("coletado_em", { ascending: false })
      .limit(1),
    supabase
      .from("suprimentos_impressoras")
      .select("ingestao_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,paginas_restantes,status_suprimento")
      .eq("impressora_id", impressoraId)
      .eq("valido", true)
      .order("nome_suprimento", { ascending: true })
      .range(0, 200),
    supabase
      .from("alertas_impressoras")
      .select("*")
      .eq("impressora_id", impressoraId)
      .range(0, 200)
  ]);

  if (telemetriaError || leituraError || suprimentoError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao buscar status e suprimentos da impressora."
    };
  }

  const ultimaTelemetriaRow = telemetriaRows?.[0] as
    | {
        ingestao_id: string;
        coletor_id: string;
        status: string;
        tempo_resposta_ms: number | null;
        coletado_em: string;
        payload_bruto: Record<string, unknown>;
      }
    | undefined;

  const ultimaLeituraRow = leituraRows?.[0] as
    | {
        ingestao_id: string;
        coletado_em: string;
        contador_total_paginas: number;
        valido: boolean;
        motivo_invalido: string | null;
        reset_detectado: boolean;
      }
    | undefined;

  const ultimosSuprimentos: SuprimentoImpressora[] = (suprimentoRows ?? []).map((row) => ({
    ingestao_id: row.ingestao_id,
    coletado_em: row.coletado_em,
    chave_suprimento: row.chave_suprimento,
    nome_suprimento: row.nome_suprimento,
    nivel_percentual: toFiniteNumber(row.nivel_percentual),
    paginas_restantes: toFiniteNumber(row.paginas_restantes),
    status_suprimento: row.status_suprimento
  }));

  let alertasAbertos: Record<string, unknown>[] = [];
  if (!alertaError && Array.isArray(alertaRows)) {
    alertasAbertos = alertaRows
      .filter((row) => row && typeof row === "object")
      .map((row) => row as Record<string, unknown>)
      .filter(isAlertaAberto);
  }

  const ultimaTelemetria: TelemetriaImpressora | null = ultimaTelemetriaRow
    ? {
        ingestao_id: ultimaTelemetriaRow.ingestao_id,
        coletor_id: ultimaTelemetriaRow.coletor_id,
        status: ultimaTelemetriaRow.status,
        tempo_resposta_ms: ultimaTelemetriaRow.tempo_resposta_ms,
        coletado_em: ultimaTelemetriaRow.coletado_em,
        payload_bruto: ultimaTelemetriaRow.payload_bruto ?? {}
      }
    : null;

  const ultimaLeitura: LeituraPaginasImpressora | null = ultimaLeituraRow
    ? {
        ingestao_id: ultimaLeituraRow.ingestao_id,
        coletado_em: ultimaLeituraRow.coletado_em,
        contador_total_paginas: Number(ultimaLeituraRow.contador_total_paginas),
        valido: ultimaLeituraRow.valido,
        motivo_invalido: ultimaLeituraRow.motivo_invalido,
        reset_detectado: ultimaLeituraRow.reset_detectado
      }
    : null;

  return {
    success: true,
    data: {
      impressora: impressoraResult.data,
      status_atual: ultimaTelemetria?.status ?? "unknown",
      ultima_telemetria: ultimaTelemetria,
      ultimo_contador_total_paginas: ultimaLeitura
        ? Number(ultimaLeitura.contador_total_paginas)
        : null,
      ultima_leitura_paginas: ultimaLeitura,
      ultimos_suprimentos: ultimosSuprimentos,
      alertas_abertos: alertasAbertos
    }
  };
}

