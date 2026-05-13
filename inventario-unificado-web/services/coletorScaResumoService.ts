/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\coletorScaResumoService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ScaResumoItem = {
  chave: string;
  patrimonio: string | null;
  tipo_equipamento: string;
  ip: string | null;
  status: string;
  coletado_em: string;
  detalhes: Record<string, unknown>;
};

type ResultadoServico<T> =
  | { success: true; data: T }
  | { success: false; status?: number; error: string };

type TelemetriaRow = {
  id: string;
  coletado_em: string;
  patrimonio: string | null;
  ip: string | null;
  status: string | null;
  payload_bruto: Record<string, unknown> | null;
};

/**
 * [DOC-FUNC] normalizarTexto
 * O que faz: Normaliza valores na funcao 'normalizarTexto', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function normalizarTexto(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * [DOC-FUNC] normalizarIp
 * O que faz: Normaliza valores na funcao 'normalizarIp', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function normalizarIp(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/\/32$/, "").trim() || null;
}

/**
 * [DOC-FUNC] extrairTipoEquipamento
 * O que faz: Orquestra a etapa 'extrairTipoEquipamento' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (payload, unknown> | null) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, iteracao/transformacao de colecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
 */
function extrairTipoEquipamento(payload: Record<string, unknown> | null) {
  if (!payload) return "impressora";

  const candidatos = [
    payload.tipo_equipamento,
    payload.tipo,
    payload.tipo_dispositivo,
    payload.equipment_type,
    payload.device_type,
    payload.categoria
  ];

  for (const value of candidatos) {
    const normalizado = normalizarTexto(value);
    if (normalizado) return normalizado;
  }

  return "impressora";
}

/**
 * [DOC-FUNC] montarChave
 * O que faz: Monta/comp?e estruturas na funcao 'montarChave', consolidando campos dispersos em um objeto util para o fluxo.
 * Entradas: Recebe parametros de origem (row) com dados parciais e metadados para composicao final.
 * Como executa: Seleciona campos relevantes, aplica regras de prioridade/fallback e organiza o resultado no formato esperado.
 * Retorno/Efeitos: Entrega payload consolidado para a proxima camada (API, servico, persistencia ou interface).
 */
function montarChave(row: TelemetriaRow) {
  const patrimonio = normalizarTexto(row.patrimonio);
  const ip = normalizarIp(row.ip);
  return patrimonio ?? ip ?? row.id;
}

/**
 * [DOC-FUNC] listarResumoSca
 * O que faz: Consulta informacoes na funcao 'listarResumoSca' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (limit) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
export async function listarResumoSca(limit = 1800): Promise<ResultadoServico<ScaResumoItem[]>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("telemetria_impressoras")
    .select("id,coletado_em,patrimonio,ip,status,payload_bruto")
    .order("coletado_em", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      success: false,
      status: 500,
      error: "Erro ao carregar eventos SCA."
    };
  }

  const rows = (data ?? []) as TelemetriaRow[];
  const latestByKey = new Map<string, ScaResumoItem>();

  for (const row of rows) {
    const chave = montarChave(row);
    if (latestByKey.has(chave)) continue;

    const patrimonio = normalizarTexto(row.patrimonio);
    const ip = normalizarIp(row.ip);
    const status = normalizarTexto(row.status) ?? "unknown";

    latestByKey.set(chave, {
      chave,
      patrimonio,
      tipo_equipamento: extrairTipoEquipamento(row.payload_bruto),
      ip,
      status,
      coletado_em: row.coletado_em,
      detalhes: {
        patrimonio,
        ip,
        status,
        coletado_em: row.coletado_em,
        payload_bruto: row.payload_bruto ?? {}
      }
    });
  }

  const itens = Array.from(latestByKey.values()).sort((a, b) => {
    const pa = (a.patrimonio ?? a.ip ?? a.chave).toLowerCase();
    const pb = (b.patrimonio ?? b.ip ?? b.chave).toLowerCase();
    return pa.localeCompare(pb, "pt-BR");
  });

  return { success: true, data: itens };
}

