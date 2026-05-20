/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\supabase\functions\collector-telemetria\index.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

type EventoNormalizado = {
  ingestao_id: string;
  coletado_em: string;
  status: string;
  tempo_resposta_ms: number | null;
  payload_bruto: JsonRecord;
  contador_total_paginas: number | null;
  impressora: {
    ip: string | null;
    patrimonio: string | null;
    numero_serie: string | null;
    setor: string | null;
    localizacao: string | null;
    modelo: string | null;
    fabricante: string | null;
    hostname: string | null;
    endereco_mac: string | null;
    ativo: boolean;
  };
  suprimentos: Array<{
    chave_suprimento: string;
    nome_suprimento: string;
    nivel_percentual: number | null;
    status_suprimento: string;
    paginas_restantes: number | null;
    payload_bruto: JsonRecord;
  }>;
};

type LoteNormalizado = {
  coletor_id: string;
  coletado_em: string;
  eventos: EventoNormalizado[];
};

type Capacidades = {
  impressoras: boolean;
  telemetria_impressoras: boolean;
  leituras_paginas_impressoras: boolean;
  suprimentos_impressoras: boolean;
  inventario: boolean;
  telemetria_pagecount: boolean;
  suprimentos: boolean;
  telemetria_substituicao_pendente: boolean;
  telemetria_substituicao_evento_retido: boolean;
};

type InventarioIpSlot = {
  nr_inventario: number;
  cd_setor: number | null;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  nm_mac: string | null;
  nr_ip: string | null;
  tp_status: string | null;
  ie_situacao: string | null;
};

type AlertaSubstituicaoDetectado = {
  nr_inventario_referencia: number;
  nr_inventario_substituto: number | null;
  cd_setor_referencia: number | null;
  nr_ip_detectado: string;
  nr_patrimonio_esperado: string | null;
  nr_patrimonio_detectado: string | null;
  nr_serie_esperada: string | null;
  nr_serie_detectada: string | null;
  nr_mac_esperado: string | null;
  nr_mac_detectado: string | null;
  ds_motivo: string;
};

type InventarioIdentidadeDetectada = {
  nr_inventario: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  nm_mac: string | null;
  ie_situacao: string | null;
  tp_status: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


/**
 * [DOC-FUNC] jsonResponse
 * O que faz: A funcao 'jsonResponse' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: body, status. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * [DOC-FUNC] getAdminClient
 * O que faz: A funcao 'getAdminClient' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * [DOC-FUNC] normalizeIp
 * O que faz: A funcao 'normalizeIp' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: ip. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeIp(ip: unknown): string | null {
  if (typeof ip !== "string") return null;
  const clean = ip.trim();
  if (!clean) return null;
  return clean.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] cleanText
 * O que faz: A funcao 'cleanText' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * [DOC-FUNC] normalizeComparableText
 * O que faz: Padroniza identificadores textuais (patrimonio/serie) para comparacao segura entre fontes diferentes.
 * Entradas: value.
 * Como executa: remove espacos extras e converte para maiusculas.
 * Retorno/Efeitos: devolve string normalizada ou null.
 */
function normalizeComparableText(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  return text.toUpperCase();
}

/**
 * [DOC-FUNC] normalizeMac
 * O que faz: Padroniza MAC para comparacao, removendo separadores e mantendo apenas hexadecimal.
 * Entradas: value.
 * Como executa: limpa caracteres nao hexadecimais e valida tamanho de 12 digitos.
 * Retorno/Efeitos: MAC no formato AABBCCDDEEFF ou null.
 */
function normalizeMac(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const hex = text.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12) return null;
  return hex;
}

/**
 * [DOC-FUNC] cleanStatus
 * O que faz: A funcao 'cleanStatus' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function cleanStatus(value: unknown): string {
  const status = String(value ?? "").trim().toLowerCase();
  if (["online", "offline", "warning", "error", "unknown"].includes(status)) return status;
  return "unknown";
}

/**
 * [DOC-FUNC] cleanSupplyStatus
 * O que faz: A funcao 'cleanSupplyStatus' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value, level. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function cleanSupplyStatus(value: unknown, level: number | null): string {
  const status = String(value ?? "").trim().toLowerCase();
  if (["ok", "low", "critical", "empty", "unknown", "offline"].includes(status)) return status;
  if (level === null) return "unknown";
  if (level <= 0) return "empty";
  if (level <= 5) return "critical";
  if (level <= 15) return "low";
  return "ok";
}

/**
 * [DOC-FUNC] toNumberOrNull
 * O que faz: A funcao 'toNumberOrNull' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * [DOC-FUNC] toIntegerOrNull
 * O que faz: A funcao 'toIntegerOrNull' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function toIntegerOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return Math.trunc(n);
}

/**
 * [DOC-FUNC] ensureIso
 * O que faz: A funcao 'ensureIso' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: value, fallbackIso. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function ensureIso(value: unknown, fallbackIso: string): string {
  const text = cleanText(value);
  if (!text) return fallbackIso;
  const ts = Date.parse(text);
  if (Number.isNaN(ts)) return fallbackIso;
  return new Date(ts).toISOString();
}

/**
 * [DOC-FUNC] tokenFromAuthHeader
 * O que faz: A funcao 'tokenFromAuthHeader' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: header. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function tokenFromAuthHeader(header: string | null): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

/**
 * [DOC-FUNC] validateCollectorAuth
 * O que faz: A funcao 'validateCollectorAuth' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: req. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function validateCollectorAuth(req: Request): string | null {
  const expectedToken = cleanText(Deno.env.get("COLLECTOR_API_TOKEN"));
  if (!expectedToken) return "COLLECTOR_API_TOKEN not configured in Edge Function";

  const receivedToken = tokenFromAuthHeader(req.headers.get("authorization"));
  if (!receivedToken) return "Authorization header must be Bearer <token>";

  if (receivedToken !== expectedToken) return "Invalid collector token";
  return null;
}

/**
 * [DOC-FUNC] normalizePayload
 * O que faz: A funcao 'normalizePayload' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: body. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizePayload(body: unknown): { data?: LoteNormalizado; error?: string } {
  const nowIso = new Date().toISOString();
  if (!body || typeof body !== "object") {
    return { error: "Invalid payload. Expected JSON object." };
  }

  const record = body as Record<string, unknown>;
  const coletorId = cleanText(record.coletor_id);
  if (!coletorId) {
    return { error: "coletor_id is required" };
  }

  const loteColetadoEm = ensureIso(record.coletado_em, nowIso);

  const toEvento = (item: Record<string, unknown>): EventoNormalizado => {
    const ingestaoId = cleanText(item.ingestao_id) ?? `evt-${crypto.randomUUID()}`;
    const coletadoEm = ensureIso(item.coletado_em, loteColetadoEm);
    const status = cleanStatus(item.status);
    const tempoResposta = toIntegerOrNull(item.tempo_resposta_ms);
    const payloadBruto =
      item.payload_bruto && typeof item.payload_bruto === "object"
        ? (item.payload_bruto as JsonRecord)
        : {};

    const impressoraRaw =
      item.impressora && typeof item.impressora === "object"
        ? (item.impressora as Record<string, unknown>)
        : {};

    const contadorTotalPaginas = toIntegerOrNull(
      item.contador_total_paginas ??
        (
          item.leitura_paginas &&
          typeof item.leitura_paginas === "object" &&
          (item.leitura_paginas as Record<string, unknown>).contador_total_paginas
        )
    );

    const suprimentosRaw = Array.isArray(item.suprimentos) ? item.suprimentos : [];
    const suprimentos = suprimentosRaw
      .filter((s) => s && typeof s === "object")
      .map((s) => {
        const sup = s as Record<string, unknown>;
        const nome = cleanText(sup.nome_suprimento) ?? "Suprimento";
        const chaveNormalizada = nome
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        const chave = cleanText(sup.chave_suprimento) ?? (chaveNormalizada || "suprimento");

        const nivel = toNumberOrNull(sup.nivel_percentual);
        const payload =
          sup.payload_bruto && typeof sup.payload_bruto === "object"
            ? (sup.payload_bruto as JsonRecord)
            : {};

        return {
          chave_suprimento: chave,
          nome_suprimento: nome,
          nivel_percentual: nivel,
          status_suprimento: cleanSupplyStatus(sup.status_suprimento, nivel),
          paginas_restantes: toIntegerOrNull(sup.paginas_restantes),
          payload_bruto: payload,
        };
      });

    return {
      ingestao_id: ingestaoId,
      coletado_em: coletadoEm,
      status,
      tempo_resposta_ms: tempoResposta,
      payload_bruto: payloadBruto,
      contador_total_paginas: contadorTotalPaginas,
      impressora: {
        ip: normalizeIp(impressoraRaw.ip),
        patrimonio: cleanText(impressoraRaw.patrimonio),
        numero_serie: cleanText(impressoraRaw.numero_serie),
        setor: cleanText(impressoraRaw.setor),
        localizacao: cleanText(impressoraRaw.localizacao),
        modelo: cleanText(impressoraRaw.modelo),
        fabricante: cleanText(impressoraRaw.fabricante),
        hostname: cleanText(impressoraRaw.hostname),
        endereco_mac: cleanText(impressoraRaw.endereco_mac),
        ativo: impressoraRaw.ativo !== false,
      },
      suprimentos,
    };
  };

  if (Array.isArray(record.eventos)) {
    if (!record.eventos.length) return { error: "eventos must have at least one item" };
    const eventos = record.eventos
      .filter((evt) => evt && typeof evt === "object")
      .map((evt) => toEvento(evt as Record<string, unknown>));

    if (!eventos.length) return { error: "eventos does not contain valid objects" };

    return {
      data: {
        coletor_id: coletorId,
        coletado_em: loteColetadoEm,
        eventos,
      },
    };
  }

  const eventoUnico = toEvento(record);
  return {
    data: {
      coletor_id: coletorId,
      coletado_em: loteColetadoEm,
      eventos: [eventoUnico],
    },
  };
}

/**
 * [DOC-FUNC] tableExists
 * O que faz: A funcao 'tableExists' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: supabase, table. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function tableExists(supabase: ReturnType<typeof getAdminClient>, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  const pgCode = String((error as { code?: string }).code ?? "").trim();
  const message = String((error as { message?: string }).message ?? "");
  if (
    pgCode === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /Could not find the table/i.test(message)
  ) {
    return false;
  }
  throw new Error(`Failed to check table '${table}': ${message}`);
}

/**
 * [DOC-FUNC] carregarCapacidades
 * O que faz: A funcao 'carregarCapacidades' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: supabase. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function carregarCapacidades(supabase: ReturnType<typeof getAdminClient>): Promise<Capacidades> {
  return {
    impressoras: await tableExists(supabase, "impressoras"),
    telemetria_impressoras: await tableExists(supabase, "telemetria_impressoras"),
    leituras_paginas_impressoras: await tableExists(supabase, "leituras_paginas_impressoras"),
    suprimentos_impressoras: await tableExists(supabase, "suprimentos_impressoras"),
    inventario: await tableExists(supabase, "inventario"),
    telemetria_pagecount: await tableExists(supabase, "telemetria_pagecount"),
    suprimentos: await tableExists(supabase, "suprimentos"),
    telemetria_substituicao_pendente: await tableExists(supabase, "telemetria_substituicao_pendente"),
    telemetria_substituicao_evento_retido: await tableExists(supabase, "telemetria_substituicao_evento_retido"),
  };
}

/**
 * [DOC-FUNC] buscarInventarioAtivoPorIp
 * O que faz: Encontra o item ativo do inventario vinculado ao IP coletado para servir como referencia da "vaga" de rede.
 * Entradas: supabase, ip.
 * Como executa: consulta inventario por `nr_ip`, filtra registros ativos e ignora status BACKUP/DEVOLUCAO.
 * Retorno/Efeitos: retorna a referencia do slot de inventario ou null.
 */
async function buscarInventarioAtivoPorIp(
  supabase: ReturnType<typeof getAdminClient>,
  ip: string | null,
): Promise<InventarioIpSlot | null> {
  const ipNormalizado = normalizeIp(ip);
  if (!ipNormalizado) return null;

  let data: any[] | null = null;
  let error: any = null;

  const tentativaComMac = await supabase
    .from("inventario")
    .select("nr_inventario,cd_setor,nr_patrimonio,nr_serie,nm_mac,nr_ip,tp_status,ie_situacao")
    .eq("nr_ip", ipNormalizado)
    .eq("ie_situacao", "A")
    .limit(20);

  if (!tentativaComMac.error) {
    data = tentativaComMac.data as any[] | null;
  } else {
    const mensagemErro = String(tentativaComMac.error.message || "");
    // Compatibilidade: ambientes antigos podem não ter inventario.nm_mac.
    if (!isMissingColumnError(mensagemErro)) {
      throw new Error(`inventario (ip-slot): ${mensagemErro}`);
    }

    const tentativaSemMac = await supabase
      .from("inventario")
      .select("nr_inventario,cd_setor,nr_patrimonio,nr_serie,nr_ip,tp_status,ie_situacao")
      .eq("nr_ip", ipNormalizado)
      .eq("ie_situacao", "A")
      .limit(20);

    data = tentativaSemMac.data as any[] | null;
    error = tentativaSemMac.error;
  }

  if (error) throw new Error(`inventario (ip-slot): ${error.message}`);

  const candidatos = (data || []).filter((item: any) => {
    const tpStatus = String(item?.tp_status || "").toUpperCase();
    if (tpStatus === "BACKUP" || tpStatus === "DEVOLUCAO") return false;
    return true;
  });

  if (!candidatos.length) return null;
  const escolhido = candidatos[0];
  return {
    nr_inventario: Number(escolhido.nr_inventario),
    cd_setor: Number.isFinite(Number(escolhido.cd_setor)) ? Number(escolhido.cd_setor) : null,
    nr_patrimonio: cleanText(escolhido.nr_patrimonio),
    nr_serie: cleanText(escolhido.nr_serie),
    nm_mac: cleanText(escolhido.nm_mac),
    nr_ip: cleanText(escolhido.nr_ip),
    tp_status: cleanText(escolhido.tp_status),
    ie_situacao: cleanText(escolhido.ie_situacao),
  };
}

/**
 * [DOC-FUNC] buscarImpressoraLegadaPorIp
 * O que faz: Consulta a tabela legada `impressoras` para obter MAC/serie/patrimonio esperados no mesmo IP.
 * Entradas: supabase, ip.
 * Como executa: busca por IP exato e retorna um registro unico quando existir.
 * Retorno/Efeitos: dados legados da impressora esperada no IP ou null.
 */
async function buscarImpressoraLegadaPorIp(
  supabase: ReturnType<typeof getAdminClient>,
  ip: string | null,
): Promise<{ patrimonio: string | null; numero_serie: string | null; endereco_mac: string | null } | null> {
  const ipNormalizado = normalizeIp(ip);
  if (!ipNormalizado) return null;

  const { data, error } = await supabase
    .from("impressoras")
    .select("patrimonio,numero_serie,endereco_mac")
    .eq("ip", ipNormalizado)
    .maybeSingle();

  if (error) {
    if (isMissingTableErrorMessage(String(error.message || ""))) return null;
    throw new Error(`impressoras (ip-slot): ${error.message}`);
  }

  if (!data) return null;
  return {
    patrimonio: cleanText((data as any).patrimonio),
    numero_serie: cleanText((data as any).numero_serie),
    endereco_mac: cleanText((data as any).endereco_mac),
  };
}

/**
 * [DOC-FUNC] detectarAlertaSubstituicao
 * O que faz: Compara o equipamento coletado no IP com os identificadores esperados da vaga no inventario.
 * Entradas: slotInventario, esperadoLegado, evento.
 * Como executa: compara patrimonio/serie/mac normalizados e monta lista de motivos em caso de divergencia.
 * Retorno/Efeitos: retorna o alerta pronto para persistir ou null quando nao houver indicio de troca.
 */
function detectarAlertaSubstituicao(
  slotInventario: InventarioIpSlot,
  esperadoLegado: { patrimonio: string | null; numero_serie: string | null; endereco_mac: string | null } | null,
  evento: EventoNormalizado,
): AlertaSubstituicaoDetectado | null {
  const ipDetectado = normalizeIp(evento.impressora.ip);
  if (!ipDetectado) return null;

  const patrimonioEsperado = normalizeComparableText(slotInventario.nr_patrimonio ?? esperadoLegado?.patrimonio);
  const serieEsperada = normalizeComparableText(slotInventario.nr_serie ?? esperadoLegado?.numero_serie);
  const macEsperado = normalizeMac(slotInventario.nm_mac ?? esperadoLegado?.endereco_mac);

  const patrimonioDetectado = normalizeComparableText(evento.impressora.patrimonio);
  const serieDetectada = normalizeComparableText(evento.impressora.numero_serie);
  const macDetectado = normalizeMac(evento.impressora.endereco_mac);

  const motivos: string[] = [];

  if (patrimonioEsperado && patrimonioDetectado && patrimonioEsperado !== patrimonioDetectado) {
    motivos.push("Patrimonio detectado diferente do patrimonio esperado para o IP");
  }

  if (serieEsperada && serieDetectada && serieEsperada !== serieDetectada) {
    motivos.push("Numero de serie detectado diferente do numero de serie esperado para o IP");
  }

  if (macEsperado && macDetectado && macEsperado !== macDetectado) {
    motivos.push("Endereco MAC detectado diferente do MAC esperado para o IP");
  }

  if (!motivos.length) return null;

  return {
    nr_inventario_referencia: slotInventario.nr_inventario,
    nr_inventario_substituto: null,
    cd_setor_referencia: slotInventario.cd_setor,
    nr_ip_detectado: ipDetectado,
    nr_patrimonio_esperado: patrimonioEsperado,
    nr_patrimonio_detectado: patrimonioDetectado,
    nr_serie_esperada: serieEsperada,
    nr_serie_detectada: serieDetectada,
    nr_mac_esperado: macEsperado,
    nr_mac_detectado: macDetectado,
    ds_motivo: motivos.join(" | "),
  };
}

/**
 * [DOC-FUNC] buscarInventarioPorIdentidadeDetectada
 * O que faz: Tenta descobrir qual item do inventario corresponde a identidade real detectada (serie/MAC) durante uma troca.
 * Entradas: supabase, nrInventarioReferencia, serieDetectada, macDetectado.
 * Como executa: consulta candidatos por serie e por MAC, deduplica por inventario e ranqueia priorizando item diferente do slot de IP.
 * Retorno/Efeitos: retorna o candidato mais provavel para enriquecer a pendencia com patrimonio real detectado.
 */
async function buscarInventarioPorIdentidadeDetectada(
  supabase: ReturnType<typeof getAdminClient>,
  nrInventarioReferencia: number,
  serieDetectada: string | null,
  macDetectado: string | null,
): Promise<InventarioIdentidadeDetectada | null> {
  const candidatos: InventarioIdentidadeDetectada[] = [];
  const serieNormalizada = normalizeComparableText(serieDetectada);
  const macNormalizado = normalizeMac(macDetectado);

  if (serieNormalizada) {
    const tentativaComMac = await supabase
      .from("inventario")
      .select("nr_inventario,nr_patrimonio,nr_serie,nm_mac,ie_situacao,tp_status")
      .ilike("nr_serie", serieNormalizada)
      .limit(20);

    if (!tentativaComMac.error) {
      for (const item of (tentativaComMac.data as any[]) || []) {
        candidatos.push({
          nr_inventario: Number(item.nr_inventario),
          nr_patrimonio: cleanText(item.nr_patrimonio),
          nr_serie: cleanText(item.nr_serie),
          nm_mac: cleanText(item.nm_mac),
          ie_situacao: cleanText(item.ie_situacao),
          tp_status: cleanText(item.tp_status),
        });
      }
    } else {
      const msg = String(tentativaComMac.error.message || "");
      if (!isMissingColumnError(msg)) {
        throw new Error(`inventario (identidade-serie): ${msg}`);
      }
      const tentativaSemMac = await supabase
        .from("inventario")
        .select("nr_inventario,nr_patrimonio,nr_serie,ie_situacao,tp_status")
        .ilike("nr_serie", serieNormalizada)
        .limit(20);
      if (tentativaSemMac.error) {
        throw new Error(`inventario (identidade-serie): ${tentativaSemMac.error.message}`);
      }
      for (const item of (tentativaSemMac.data as any[]) || []) {
        candidatos.push({
          nr_inventario: Number(item.nr_inventario),
          nr_patrimonio: cleanText(item.nr_patrimonio),
          nr_serie: cleanText(item.nr_serie),
          nm_mac: null,
          ie_situacao: cleanText(item.ie_situacao),
          tp_status: cleanText(item.tp_status),
        });
      }
    }
  }

  if (macNormalizado) {
    const tentativaMac = await supabase
      .from("inventario")
      .select("nr_inventario,nr_patrimonio,nr_serie,nm_mac,ie_situacao,tp_status")
      .eq("nm_mac", macNormalizado)
      .limit(20);

    if (!tentativaMac.error) {
      for (const item of (tentativaMac.data as any[]) || []) {
        candidatos.push({
          nr_inventario: Number(item.nr_inventario),
          nr_patrimonio: cleanText(item.nr_patrimonio),
          nr_serie: cleanText(item.nr_serie),
          nm_mac: cleanText(item.nm_mac),
          ie_situacao: cleanText(item.ie_situacao),
          tp_status: cleanText(item.tp_status),
        });
      }
    } else {
      const msg = String(tentativaMac.error.message || "");
      if (!isMissingColumnError(msg)) {
        throw new Error(`inventario (identidade-mac): ${msg}`);
      }
    }
  }

  if (!candidatos.length) return null;

  const unicos = new Map<number, InventarioIdentidadeDetectada>();
  for (const candidato of candidatos) {
    if (!Number.isFinite(candidato.nr_inventario)) continue;
    if (!unicos.has(candidato.nr_inventario)) {
      unicos.set(candidato.nr_inventario, candidato);
    }
  }

  const ranqueados = Array.from(unicos.values()).map((candidato) => {
    const serieCand = normalizeComparableText(candidato.nr_serie);
    const macCand = normalizeMac(candidato.nm_mac);
    let score = 0;
    if (candidato.nr_inventario !== nrInventarioReferencia) score += 100;
    if (serieNormalizada && serieCand === serieNormalizada) score += 40;
    if (macNormalizado && macCand === macNormalizado) score += 40;
    if ((candidato.ie_situacao || "").toUpperCase() === "A") score += 5;
    return { candidato, score };
  });

  ranqueados.sort((a, b) => b.score - a.score);
  return ranqueados[0]?.candidato || null;
}

/**
 * [DOC-FUNC] enriquecerAlertaSubstituicaoComInventario
 * O que faz: Ajusta os dados detectados da pendencia para refletir o patrimonio real da impressora identificada por serie/MAC.
 * Entradas: supabase, alerta.
 * Como executa: busca candidato no inventario por identidade detectada e sobrescreve patrimonio detectado quando encontrar match confiavel.
 * Retorno/Efeitos: melhora rastreabilidade da troca no painel, evitando mostrar patrimonio herdado do slot de IP.
 */
async function enriquecerAlertaSubstituicaoComInventario(
  supabase: ReturnType<typeof getAdminClient>,
  alerta: AlertaSubstituicaoDetectado,
): Promise<AlertaSubstituicaoDetectado> {
  const candidato = await buscarInventarioPorIdentidadeDetectada(
    supabase,
    alerta.nr_inventario_referencia,
    alerta.nr_serie_detectada,
    alerta.nr_mac_detectado,
  );
  if (!candidato) return alerta;

  const patrimonioDetectadoReal = normalizeComparableText(candidato.nr_patrimonio);
  if (!patrimonioDetectadoReal) return alerta;

  return {
    ...alerta,
    nr_inventario_substituto: candidato.nr_inventario,
    nr_patrimonio_detectado: patrimonioDetectadoReal,
  };
}

/**
 * [DOC-FUNC] registrarPendenciaSubstituicao
 * O que faz: Cria/atualiza pendencia assistida de substituicao para revisao manual no painel.
 * Entradas: supabase, coletorId, evento, alerta.
 * Como executa: procura pendencia aberta por (inventario_referencia + ip) e atualiza ocorrencias; se nao existir, insere.
 * Retorno/Efeitos: mantém trilha de auditoria sem alterar automaticamente o inventario.
 */
async function registrarPendenciaSubstituicao(
  supabase: ReturnType<typeof getAdminClient>,
  coletorId: string,
  evento: EventoNormalizado,
  alerta: AlertaSubstituicaoDetectado,
): Promise<number | null> {
  const { data: existente, error: erroExistente } = await supabase
    .from("telemetria_substituicao_pendente")
    .select("id,nr_ocorrencias")
    .eq("nr_inventario_referencia", alerta.nr_inventario_referencia)
    .eq("nr_ip_detectado", alerta.nr_ip_detectado)
    .maybeSingle();

  if (erroExistente) {
    const msg = String(erroExistente.message || "");
    if (isMissingTableErrorMessage(msg) || isMissingColumnError(msg)) return null;
    throw new Error(`telemetria_substituicao_pendente (select): ${msg}`);
  }

  if (existente?.id) {
    const novoTotalOcorrencias = Math.max(1, Number(existente.nr_ocorrencias || 0) + 1);
    const { data: atualizado, error: erroUpdate } = await supabase
      .from("telemetria_substituicao_pendente")
      .update({
        dt_ultima_detecao: evento.coletado_em,
        ie_status: "PENDENTE",
        nr_ocorrencias: novoTotalOcorrencias,
        nr_inventario_substituto: alerta.nr_inventario_substituto,
        nr_patrimonio_esperado: alerta.nr_patrimonio_esperado,
        nr_patrimonio_detectado: alerta.nr_patrimonio_detectado,
        nr_serie_esperada: alerta.nr_serie_esperada,
        nr_serie_detectada: alerta.nr_serie_detectada,
        nr_mac_esperado: alerta.nr_mac_esperado,
        nr_mac_detectado: alerta.nr_mac_detectado,
        ds_motivo: alerta.ds_motivo,
        coletor_id: coletorId,
        payload_evento: evento as unknown as JsonRecord,
        cd_usuario_resolucao: null,
        nm_usuario_resolucao: null,
        ds_resolucao: null,
        dt_resolucao: null,
      })
      .eq("id", Number(existente.id))
      .select("id")
      .single();

    if (erroUpdate) {
      throw new Error(`telemetria_substituicao_pendente (update): ${erroUpdate.message}`);
    }
    return Number(atualizado?.id || existente.id);
  }

  const { data: inserido, error: erroInsert } = await supabase
    .from("telemetria_substituicao_pendente")
    .insert([
      {
        dt_detectado: evento.coletado_em,
        dt_ultima_detecao: evento.coletado_em,
        ie_status: "PENDENTE",
        nr_ocorrencias: 1,
        nr_inventario_referencia: alerta.nr_inventario_referencia,
        nr_inventario_substituto: alerta.nr_inventario_substituto,
        cd_setor_referencia: alerta.cd_setor_referencia,
        nr_ip_detectado: alerta.nr_ip_detectado,
        nr_patrimonio_esperado: alerta.nr_patrimonio_esperado,
        nr_patrimonio_detectado: alerta.nr_patrimonio_detectado,
        nr_serie_esperada: alerta.nr_serie_esperada,
        nr_serie_detectada: alerta.nr_serie_detectada,
        nr_mac_esperado: alerta.nr_mac_esperado,
        nr_mac_detectado: alerta.nr_mac_detectado,
        ds_motivo: alerta.ds_motivo,
        coletor_id: coletorId,
        payload_evento: evento as unknown as JsonRecord,
      },
    ])
    .select("id")
    .single();

  if (erroInsert) {
    throw new Error(`telemetria_substituicao_pendente (insert): ${erroInsert.message}`);
  }

  return Number(inserido?.id || 0) || null;
}

/**
 * [DOC-FUNC] dateKeySaoPauloFromIso
 * O que faz: Converte a data/hora da coleta para a data operacional usada no consolidado diario.
 * Entradas: data ISO/string parseavel.
 * Como executa: usa timezone `America/Sao_Paulo` para montar `YYYY-MM-DD`, igual ao SQL de pagecount diario.
 * Retorno/Efeitos: permite compactar varias coletas bloqueadas em uma unica linha por pendencia/dia.
 */
function dateKeySaoPauloFromIso(value: string): string | null {
  const data = new Date(value);
  if (!Number.isFinite(data.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/**
 * [DOC-FUNC] buscarUltimoContadorPagecount
 * O que faz: Busca o ultimo contador oficial conhecido de uma impressora ja cadastrada no inventario.
 * Entradas: supabase e nrInventario.
 * Como executa: consulta `telemetria_pagecount` ordenando pela leitura mais recente e valida se o total e numerico.
 * Retorno/Efeitos: devolve um contador-base seguro para a primeira leitura retida de uma troca, reduzindo perda entre a troca fisica e a primeira coleta divergente.
 */
async function buscarUltimoContadorPagecount(
  supabase: ReturnType<typeof getAdminClient>,
  nrInventario: number | null | undefined,
): Promise<number | null> {
  const id = Number(nrInventario);
  if (!Number.isFinite(id) || id <= 0) return null;

  const { data, error } = await supabase
    .from("telemetria_pagecount")
    .select("nr_paginas_total,dt_leitura")
    .eq("nr_inventario", id)
    .order("dt_leitura", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || "");
    if (isMissingTableErrorMessage(msg) || isMissingColumnError(msg)) return null;
    throw new Error(`telemetria_pagecount (baseline-substituto): ${msg}`);
  }

  const contador = Number(data?.nr_paginas_total);
  return Number.isFinite(contador) && contador >= 0 ? Math.trunc(contador) : null;
}

/**
 * [DOC-FUNC] registrarEventoRetidoSubstituicao
 * O que faz: Compacta as leituras SNMP bloqueadas por divergencia em um resumo diario para reaplicar depois da decisao humana.
 * Entradas: supabase, idPendencia, coletorId, evento e alerta ja calculado.
 * Como executa: busca a linha do dia da pendencia, calcula delta seguro entre contador anterior e atual e faz insert/update por `id_pendencia + dt_referencia`. Na primeira linha, quando a impressora real ja existe no inventario, usa o ultimo pagecount dela como base para nao perder a impressao feita antes da primeira coleta divergente.
 * Retorno/Efeitos: preserva paginas em quarentena sem criar uma linha por ciclo de coleta.
 */
async function registrarEventoRetidoSubstituicao(
  supabase: ReturnType<typeof getAdminClient>,
  idPendencia: number | null,
  coletorId: string,
  evento: EventoNormalizado,
  alerta: AlertaSubstituicaoDetectado,
): Promise<void> {
  if (!idPendencia || !Number.isFinite(idPendencia) || idPendencia <= 0) return;
  if (evento.contador_total_paginas === null) return;

  const dtReferencia = dateKeySaoPauloFromIso(evento.coletado_em);
  if (!dtReferencia) return;
  const contador = Math.max(0, Math.trunc(Number(evento.contador_total_paginas)));

  const { data: existente, error: erroExistente } = await supabase
    .from("telemetria_substituicao_evento_retido")
    .select("id,nr_paginas_inicio_dia,nr_paginas_fim_dia,nr_paginas_dia,nr_ciclos_coleta,dt_primeira_leitura,dt_ultima_leitura")
    .eq("id_pendencia", idPendencia)
    .eq("dt_referencia", dtReferencia)
    .maybeSingle();

  if (erroExistente) {
    const msg = String(erroExistente.message || "");
    if (isMissingTableErrorMessage(msg) || isMissingColumnError(msg)) return;
    throw new Error(`telemetria_substituicao_evento_retido (select): ${msg}`);
  }

  if (!existente?.id) {
    let inicioDia = contador;
    let paginasDiaInicial = 0;
    const idSubstituto = Number(alerta.nr_inventario_substituto || 0);
    if (Number.isFinite(idSubstituto) && idSubstituto > 0 && idSubstituto !== alerta.nr_inventario_referencia) {
      const contadorBaseSubstituto = await buscarUltimoContadorPagecount(supabase, idSubstituto);
      if (contadorBaseSubstituto !== null) {
        const deltaInicial = contador - contadorBaseSubstituto;
        if (deltaInicial >= 0 && deltaInicial <= 10000) {
          inicioDia = contadorBaseSubstituto;
          paginasDiaInicial = deltaInicial;
        }
      }
    }
    // Sem contador-base confiavel, a primeira leitura vira baseline do dia.
    // Ex.: impressora reserva nunca coletada chega com contador fisico 50000;
    // guardamos inicio=50000, fim=50000, paginas_dia=0 para nao inventar 50000 paginas no setor.

    const { error: erroInsert } = await supabase.from("telemetria_substituicao_evento_retido").insert([
      {
        id_pendencia: idPendencia,
        coletor_id: coletorId,
        nr_inventario_referencia: alerta.nr_inventario_referencia,
        nr_ip_detectado: alerta.nr_ip_detectado,
        dt_referencia: dtReferencia,
        nr_paginas_inicio_dia: inicioDia,
        nr_paginas_fim_dia: contador,
        nr_paginas_dia: paginasDiaInicial,
        nr_ciclos_coleta: 1,
        dt_primeira_leitura: evento.coletado_em,
        dt_ultima_leitura: evento.coletado_em,
        ds_status_ultima: evento.status,
        payload_ultimo_evento: evento as unknown as JsonRecord,
      },
    ]);
    if (erroInsert) {
      const msg = String(erroInsert.message || "");
      if (isMissingTableErrorMessage(msg) || isMissingColumnError(msg)) return;
      throw new Error(`telemetria_substituicao_evento_retido (insert): ${msg}`);
    }
    return;
  }

  const ultimaMs = new Date(String(existente.dt_ultima_leitura || "")).getTime();
  const leituraMs = new Date(evento.coletado_em).getTime();
  if (Number.isFinite(ultimaMs) && Number.isFinite(leituraMs) && leituraMs < ultimaMs) return;

  const fimAtual = Math.max(0, Number(existente.nr_paginas_fim_dia || 0));
  const delta = contador - fimAtual;
  const paginasDiaAtual = Math.max(0, Number(existente.nr_paginas_dia || 0));
  // Se o contador voltou ou saltou demais, a leitura entra como "ultimo payload",
  // mas nao soma paginas. Mantemos o fim anterior para nao quebrar o resumo diario.
  const deltaSeguro = delta >= 0 && delta <= 10000;
  const novoFim = deltaSeguro ? Math.max(fimAtual, contador) : fimAtual;
  const novoDia = deltaSeguro ? paginasDiaAtual + Math.max(delta, 0) : paginasDiaAtual;

  const { error } = await supabase
    .from("telemetria_substituicao_evento_retido")
    .update({
      coletor_id: coletorId,
      nr_paginas_fim_dia: novoFim,
      nr_paginas_dia: novoDia,
      nr_ciclos_coleta: Math.max(0, Number(existente.nr_ciclos_coleta || 0)) + 1,
      dt_ultima_leitura: evento.coletado_em,
      ds_status_ultima: evento.status,
      payload_ultimo_evento: evento as unknown as JsonRecord,
      dt_atualizacao: new Date().toISOString(),
      dt_replay: null,
      nr_inventario_destino: null,
      ds_resultado: null,
    })
    .eq("id", Number(existente.id));

  if (!error) return;

  const msg = String(error.message || "");
  if (isMissingTableErrorMessage(msg) || isMissingColumnError(msg)) return;
  throw new Error(`telemetria_substituicao_evento_retido: ${msg}`);
}

/**
 * [DOC-FUNC] encontrarImpressoraPorIdentificador
 * O que faz: A funcao 'encontrarImpressoraPorIdentificador' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function encontrarImpressoraPorIdentificador(
  supabase: ReturnType<typeof getAdminClient>,
  impressora: EventoNormalizado["impressora"],
) {
  if (impressora.patrimonio) {
    const { data } = await supabase
      .from("impressoras")
      .select("id,ultima_coleta_em")
      .ilike("patrimonio", impressora.patrimonio)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (impressora.numero_serie) {
    const { data } = await supabase
      .from("impressoras")
      .select("id,ultima_coleta_em")
      .ilike("numero_serie", impressora.numero_serie)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (impressora.ip) {
    const { data } = await supabase
      .from("impressoras")
      .select("id,ultima_coleta_em")
      .eq("ip", impressora.ip)
      .maybeSingle();
    if (data?.id) return data;
  }

  return null;
}

/**
 * [DOC-FUNC] resolveImpressoraIdLegacy
 * O que faz: A funcao 'resolveImpressoraIdLegacy' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function resolveImpressoraIdLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
): Promise<string> {
  const impressora = evento.impressora;
  const existente = await encontrarImpressoraPorIdentificador(supabase, impressora);

  const payloadComum = {
    ip: impressora.ip,
    patrimonio: impressora.patrimonio,
    setor: impressora.setor ?? "Desconhecido",
    localizacao: impressora.localizacao,
    modelo: impressora.modelo ?? "Desconhecido",
    fabricante: impressora.fabricante,
    numero_serie: impressora.numero_serie,
    hostname: impressora.hostname,
    endereco_mac: impressora.endereco_mac,
    ativo: impressora.ativo,
    ultima_coleta_em: evento.coletado_em,
  };

  if (existente?.id) {
    await supabase.from("impressoras").update(payloadComum).eq("id", existente.id);
    return String(existente.id);
  }

  const patrimonioAuto =
    impressora.patrimonio ??
    `AUTO-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const insertPayload = {
    ...payloadComum,
    ip: impressora.ip ?? "0.0.0.0",
    patrimonio: patrimonioAuto,
  };

  const { data, error } = await supabase
    .from("impressoras")
    .insert([insertPayload])
    .select("id")
    .single();

  if (!error && data?.id) {
    return String(data.id);
  }

  const retry = await encontrarImpressoraPorIdentificador(supabase, {
    ...impressora,
    patrimonio: patrimonioAuto,
  });

  if (retry?.id) return String(retry.id);

  throw new Error(`Could not resolve printer in table impressoras: ${String(error?.message ?? "unknown")}`);
}

/**
 * [DOC-FUNC] resolveInventarioId
 * O que faz: A funcao 'resolveInventarioId' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function resolveInventarioId(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
): Promise<number | null> {
  const p = evento.impressora;

  if (p.patrimonio) {
    const { data } = await supabase
      .from("inventario")
      .select("nr_inventario")
      .ilike("nr_patrimonio", p.patrimonio)
      .eq("ie_situacao", "A")
      .maybeSingle();
    if (data?.nr_inventario) return Number(data.nr_inventario);
  }

  if (p.numero_serie) {
    const { data } = await supabase
      .from("inventario")
      .select("nr_inventario")
      .ilike("nr_serie", p.numero_serie)
      .eq("ie_situacao", "A")
      .maybeSingle();
    if (data?.nr_inventario) return Number(data.nr_inventario);
  }

  if (p.ip) {
    const { data } = await supabase
      .from("inventario")
      .select("nr_inventario")
      .eq("nr_ip", p.ip)
      .eq("ie_situacao", "A")
      .maybeSingle();
    if (data?.nr_inventario) return Number(data.nr_inventario);
  }

  return null;
}

/**
 * [DOC-FUNC] gravarTelemetriaLegacy
 * O que faz: A funcao 'gravarTelemetriaLegacy' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function gravarTelemetriaLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  coletorId: string,
  impressoraId: string,
) {
  const payload = {
    impressora_id: impressoraId,
    patrimonio: evento.impressora.patrimonio,
    ip: evento.impressora.ip,
    coletor_id: coletorId,
    ingestao_id: evento.ingestao_id,
    coletado_em: evento.coletado_em,
    status: evento.status,
    tempo_resposta_ms: evento.tempo_resposta_ms,
    payload_bruto: evento.payload_bruto,
  };

  const { error } = await supabase
    .from("telemetria_impressoras")
    .upsert([payload], { onConflict: "coletor_id,ingestao_id", ignoreDuplicates: false });

  if (error) throw new Error(`telemetria_impressoras: ${error.message}`);
}

/**
 * [DOC-FUNC] gravarLeituraLegacy
 * O que faz: A funcao 'gravarLeituraLegacy' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function gravarLeituraLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  coletorId: string,
  impressoraId: string,
) {
  if (evento.contador_total_paginas === null) return;

  const payload = {
    impressora_id: impressoraId,
    patrimonio: evento.impressora.patrimonio,
    ip: evento.impressora.ip,
    coletor_id: coletorId,
    ingestao_id: evento.ingestao_id,
    coletado_em: evento.coletado_em,
    contador_total_paginas: Math.max(0, evento.contador_total_paginas),
    valido: true,
    motivo_invalido: null,
    reset_detectado: false,
    payload_bruto: evento.payload_bruto,
  };

  const { error } = await supabase
    .from("leituras_paginas_impressoras")
    .upsert([payload], { onConflict: "coletor_id,ingestao_id", ignoreDuplicates: false });

  if (error) throw new Error(`leituras_paginas_impressoras: ${error.message}`);
}

/**
 * [DOC-FUNC] gravarSuprimentosLegacy
 * O que faz: A funcao 'gravarSuprimentosLegacy' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function gravarSuprimentosLegacy(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  coletorId: string,
  impressoraId: string,
) {
  if (!evento.suprimentos.length) return;

  const rows = evento.suprimentos.map((sup) => ({
    impressora_id: impressoraId,
    patrimonio: evento.impressora.patrimonio,
    ip: evento.impressora.ip,
    coletor_id: coletorId,
    ingestao_id: evento.ingestao_id,
    coletado_em: evento.coletado_em,
    chave_suprimento: sup.chave_suprimento,
    nome_suprimento: sup.nome_suprimento,
    nivel_percentual: sup.nivel_percentual,
    paginas_restantes: sup.paginas_restantes,
    status_suprimento: sup.status_suprimento,
    valido: true,
    payload_bruto: sup.payload_bruto,
  }));

  const { error } = await supabase
    .from("suprimentos_impressoras")
    .upsert(rows, { onConflict: "impressora_id,chave_suprimento", ignoreDuplicates: false });

  if (error) throw new Error(`suprimentos_impressoras: ${error.message}`);
}

/**
 * [DOC-FUNC] gravarTelemetriaPagecount
 * O que faz: A funcao 'gravarTelemetriaPagecount' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function gravarTelemetriaPagecount(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  inventarioId: number,
) {
  if (evento.contador_total_paginas === null) return;

  const payloadAtual = {
    nr_inventario: inventarioId,
    nr_paginas_total: Math.max(0, evento.contador_total_paginas),
    dt_leitura: evento.coletado_em,
    ds_status_impressora: evento.status,
    ds_observacao: null,
  };

  const tentativaUpsert = await supabase
    .from("telemetria_pagecount")
    .upsert([payloadAtual], { onConflict: "nr_inventario", ignoreDuplicates: false });

  if (!tentativaUpsert.error) return;

  const mensagem = String(tentativaUpsert.error.message || "");
  const conflitoSemConstraint =
    /no unique or exclusion constraint matching the ON CONFLICT specification/i.test(mensagem) ||
    /there is no unique or exclusion constraint/i.test(mensagem);

  if (!conflitoSemConstraint) {
    throw new Error(`telemetria_pagecount: ${mensagem}`);
  }

  // Fallback para ambiente antigo sem UNIQUE(nr_inventario).
  const { error: insertError } = await supabase.from("telemetria_pagecount").insert([payloadAtual]);
  if (insertError) throw new Error(`telemetria_pagecount: ${insertError.message}`);
}

/**
 * [DOC-FUNC] isMissingColumnError
 * O que faz: A funcao 'isMissingColumnError' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: message. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isMissingColumnError(message: string): boolean {
  return /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message);
}

/**
 * [DOC-FUNC] isMissingTableErrorMessage
 * O que faz: A funcao 'isMissingTableErrorMessage' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: message. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isMissingTableErrorMessage(message: string): boolean {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

async function gravarSuprimentosNovoOuLegado(
  supabase: ReturnType<typeof getAdminClient>,
  evento: EventoNormalizado,
  inventarioId: number,
) {
  if (!evento.suprimentos.length) return;

  // Cada suprimento é tratado isoladamente para não perder o lote inteiro por falha em um único item.
  for (const sup of evento.suprimentos) {
    const nivel = sup.nivel_percentual === null ? 0 : Math.max(0, Math.round(sup.nivel_percentual));

    // Primeiro tentamos o payload no formato legado (colunas antigas).
    const payloadLegado = {
      nr_inventario: inventarioId,
      cd_tipo_suprimento: sup.nome_suprimento,
      nr_quantidade: nivel,
      ds_status_suprimento: sup.status_suprimento,
      ds_status_impressora: evento.status,
      dt_coleta: evento.coletado_em,
    };

    const attemptLegacy = await supabase
      .from("suprimentos")
      .upsert([payloadLegado], { onConflict: "nr_inventario,cd_tipo_suprimento", ignoreDuplicates: false });

    if (!attemptLegacy.error) continue;

    const legacyMsg = String(attemptLegacy.error.message || "");
    if (!isMissingColumnError(legacyMsg)) {
      // Se não for erro de esquema legado, paramos aqui porque é falha real de persistência.
      throw new Error(`suprimentos (legacy): ${legacyMsg}`);
    }

    // Fallback para esquema novo: mesmos dados, mas nomes de colunas atualizados.
    const payloadNovo = {
      nr_inventario: inventarioId,
      tp_suprimento: sup.nome_suprimento,
      nr_quantidade: nivel,
      ds_suprimento: sup.status_suprimento,
      ie_situacao: "A",
    };

    const attemptNovo = await supabase
      .from("suprimentos")
      .upsert([payloadNovo], { onConflict: "nr_inventario,tp_suprimento", ignoreDuplicates: false });

    if (attemptNovo.error) {
      throw new Error(`suprimentos (novo): ${attemptNovo.error.message}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ sucesso: false, erro: "Method not allowed" }, 405);
  }

  const authError = validateCollectorAuth(req);
  if (authError) {
    return jsonResponse({ sucesso: false, erro: authError }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ sucesso: false, erro: "Invalid JSON body" }, 400);
  }

  const normalized = normalizePayload(body);
  if (normalized.error || !normalized.data) {
    return jsonResponse({ sucesso: false, erro: normalized.error ?? "Invalid payload" }, 400);
  }

  const lote = normalized.data;

  try {
    const supabase = getAdminClient();
    const caps = await carregarCapacidades(supabase);

    // O resumo final serve para auditoria da ingestão e depuração de ambiente.
    const result = {
      coletor_id: lote.coletor_id,
      eventos_recebidos: lote.eventos.length,
      eventos_processados: 0,
      gravacoes_telemetria: 0,
      gravacoes_leituras_paginas: 0,
      gravacoes_pagecount_bloqueadas_substituicao: 0,
      gravacoes_suprimentos: 0,
      alertas_substituicao_detectados: 0,
      erros: [] as Array<{ ingestao_id: string; erro: string }>,
      modo_gravacao: caps,
    };

    for (const evento of lote.eventos) {
      try {
        let impressoraIdLegacy: string | null = null;
        let inventarioId: number | null = null;
        let bloquearPagecountPorSubstituicao = false;

        // 1) Resolver IDs-alvo nas estruturas disponíveis no banco atual.
        if (caps.impressoras) {
          try {
            impressoraIdLegacy = await resolveImpressoraIdLegacy(supabase, evento);
          } catch (legacyError) {
            const message = legacyError instanceof Error ? legacyError.message : String(legacyError);
            if (!isMissingTableErrorMessage(message)) {
              throw legacyError;
            }
            impressoraIdLegacy = null;
          }
        }

        if (caps.inventario) {
          inventarioId = await resolveInventarioId(supabase, evento);
        }

        // 1.1) Deteccao assistida de substituicao: compara identidade da impressora que respondeu no IP.
        if (caps.telemetria_substituicao_pendente && caps.inventario) {
          const slotInventario = await buscarInventarioAtivoPorIp(supabase, evento.impressora.ip);
          if (slotInventario) {
            const esperadoLegado = caps.impressoras
              ? await buscarImpressoraLegadaPorIp(supabase, evento.impressora.ip)
              : null;
            const alertaBase = detectarAlertaSubstituicao(slotInventario, esperadoLegado, evento);
            if (alertaBase) {
              const alerta = await enriquecerAlertaSubstituicaoComInventario(supabase, alertaBase);
              const idPendencia = await registrarPendenciaSubstituicao(supabase, lote.coletor_id, evento, alerta);
              if (caps.telemetria_substituicao_evento_retido) {
                await registrarEventoRetidoSubstituicao(supabase, idPendencia, lote.coletor_id, evento, alerta);
              }
              result.alertas_substituicao_detectados += 1;
              // A leitura fica retida para replay posterior; neste momento, gravar pagecount poluiria o inventario errado.
              bloquearPagecountPorSubstituicao = true;
            }
          }
        }

        // 2) Gravar nos destinos legados quando as tabelas existirem.
        if (caps.telemetria_impressoras && impressoraIdLegacy) {
          await gravarTelemetriaLegacy(supabase, evento, lote.coletor_id, impressoraIdLegacy);
          result.gravacoes_telemetria += 1;
        }

        if (caps.leituras_paginas_impressoras && impressoraIdLegacy && evento.contador_total_paginas !== null) {
          await gravarLeituraLegacy(supabase, evento, lote.coletor_id, impressoraIdLegacy);
          result.gravacoes_leituras_paginas += 1;
        }

        if (caps.suprimentos_impressoras && impressoraIdLegacy && evento.suprimentos.length) {
          await gravarSuprimentosLegacy(supabase, evento, lote.coletor_id, impressoraIdLegacy);
          result.gravacoes_suprimentos += evento.suprimentos.length;
        }

        // 3) Gravar nos destinos novos (inventário + pagecount + suprimentos novos).
        if (caps.telemetria_pagecount && inventarioId !== null && evento.contador_total_paginas !== null) {
          if (bloquearPagecountPorSubstituicao) {
            result.gravacoes_pagecount_bloqueadas_substituicao += 1;
          } else {
            await gravarTelemetriaPagecount(supabase, evento, inventarioId);
            result.gravacoes_leituras_paginas += 1;
          }
        }

        if (caps.suprimentos && inventarioId !== null && evento.suprimentos.length) {
          await gravarSuprimentosNovoOuLegado(supabase, evento, inventarioId);
          result.gravacoes_suprimentos += evento.suprimentos.length;
        }

        if (!caps.telemetria_impressoras && !caps.telemetria_pagecount) {
          throw new Error("No telemetry table available (telemetria_impressoras or telemetria_pagecount)");
        }

        result.eventos_processados += 1;
      } catch (eventError) {
        // Erro por evento é acumulado no relatório, sem abortar processamento do lote inteiro.
        const message = eventError instanceof Error ? eventError.message : String(eventError);
        result.erros.push({ ingestao_id: evento.ingestao_id, erro: message });
      }
    }

    if (result.eventos_processados === 0) {
      return jsonResponse({ sucesso: false, erro: "No events processed", dados: result }, 422);
    }

    if (result.erros.length > 0) {
      return jsonResponse({ sucesso: false, erro: "Partial processing failure", dados: result }, 207);
    }

    return jsonResponse({ sucesso: true, dados: result }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ sucesso: false, erro: message }, 500);
  }
});
