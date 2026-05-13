/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\supabase\functions\collector-impressoras\index.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/**
 * [DOC-FUNC] jsonResponse
 * O que faz: Executa a rotina principal de 'json response' no contexto deste modulo.
 * Entradas: Parametros esperados: body, status.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * O que faz: Consulta dados de 'get admin client' na fonte principal (API, banco ou cache).
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * [DOC-FUNC] cleanText
 * O que faz: Executa a rotina principal de 'clean text' no contexto deste modulo.
 * Entradas: Parametros esperados: value.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * [DOC-FUNC] normalizeIp
 * O que faz: Padroniza dados de 'normalize ip' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: ip.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizeIp(ip: unknown): string | null {
  if (typeof ip !== "string") return null;
  const clean = ip.trim();
  if (!clean) return null;
  return clean.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] tokenFromAuthHeader
 * O que faz: Executa a rotina principal de 'token from auth header' no contexto deste modulo.
 * Entradas: Parametros esperados: header.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function tokenFromAuthHeader(header: string | null): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

/**
 * [DOC-FUNC] validateCollectorAuth
 * O que faz: Executa a rotina principal de 'validate collector auth' no contexto deste modulo.
 * Entradas: Parametros esperados: req.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * [DOC-FUNC] isMissingTableErrorMessage
 * O que faz: Executa a rotina principal de 'is missing table error message' no contexto deste modulo.
 * Entradas: Parametros esperados: message.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function isMissingTableErrorMessage(message: string): boolean {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

/**
 * [DOC-FUNC] tableExists
 * O que faz: Executa a rotina principal de 'table exists' no contexto deste modulo.
 * Entradas: Parametros esperados: supabase, table.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
async function tableExists(supabase: ReturnType<typeof getAdminClient>, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  const message = String((error as { message?: string }).message ?? "");
  if (/relation .* does not exist/i.test(message) || /Could not find the table/i.test(message)) {
    return false;
  }
  throw new Error(`Failed to check table '${table}': ${message}`);
}

/**
 * [DOC-FUNC] listarViaTabelaImpressoras
 * O que faz: Consulta dados de 'listar via tabela impressoras' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: supabase.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
async function listarViaTabelaImpressoras(supabase: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabase
    .from("impressoras")
    .select("id,ip,patrimonio,modelo,fabricante,numero_serie,hostname,setor,localizacao,ativo")
    .eq("ativo", true)
    .order("setor", { ascending: true });

  if (error) throw new Error(error.message);

  const community = cleanText(Deno.env.get("COLLECTOR_DEFAULT_SNMP_COMMUNITY")) ?? "public";

  const impressoras = (data || [])
    .map((item) => ({
      id: String(item.id),
      ip: normalizeIp(item.ip),
      patrimonio: cleanText(item.patrimonio),
      modelo: cleanText(item.modelo) ?? "Desconhecido",
      fabricante: cleanText(item.fabricante),
      numero_serie: cleanText(item.numero_serie),
      hostname: cleanText(item.hostname),
      setor: cleanText(item.setor) ?? "Desconhecido",
      localizacao: cleanText(item.localizacao),
      ativa: Boolean(item.ativo),
      comunidade: community,
    }))
    .filter((item) => item.ip);

  return impressoras;
}

/**
 * [DOC-FUNC] listarViaInventario
 * O que faz: Consulta dados de 'listar via inventario' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: supabase.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
async function listarViaInventario(supabase: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabase
    .from("inventario")
    .select(
      "nr_inventario,nr_ip,nr_patrimonio,nr_serie,ie_situacao,equipamento:cd_equipamento(nm_modelo,nm_marca,nm_equipamento),setor:cd_setor(nm_setor)"
    )
    .eq("ie_situacao", "A")
    .not("nr_ip", "is", null);

  if (error) throw new Error(error.message);

  const community = cleanText(Deno.env.get("COLLECTOR_DEFAULT_SNMP_COMMUNITY")) ?? "public";

  const impressoras = (data || [])
    .map((item) => {
      const equipamento = (item as Record<string, unknown>).equipamento as Record<string, unknown> | null;
      const setorObj = (item as Record<string, unknown>).setor as Record<string, unknown> | null;
      return {
        id: String((item as Record<string, unknown>).nr_inventario ?? ""),
        ip: normalizeIp((item as Record<string, unknown>).nr_ip),
        patrimonio: cleanText((item as Record<string, unknown>).nr_patrimonio),
        modelo: cleanText(equipamento?.nm_modelo ?? equipamento?.nm_equipamento) ?? "Desconhecido",
        fabricante: cleanText(equipamento?.nm_marca),
        numero_serie: cleanText((item as Record<string, unknown>).nr_serie),
        hostname: null,
        setor: cleanText(setorObj?.nm_setor) ?? "Desconhecido",
        localizacao: cleanText(setorObj?.nm_setor),
        ativa: String((item as Record<string, unknown>).ie_situacao ?? "").toUpperCase() === "A",
        comunidade: community,
      };
    })
    .filter((item) => item.ip);

  return impressoras;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ sucesso: false, erro: "Method not allowed" }, 405);
  }

  const authError = validateCollectorAuth(req);
  if (authError) {
    return jsonResponse({ sucesso: false, erro: authError }, 401);
  }

  try {
    const supabase = getAdminClient();

    let impressoras: Array<Record<string, unknown>> = [];
    let carregouFonte = false;

    try {
      if (await tableExists(supabase, "impressoras")) {
        impressoras = await listarViaTabelaImpressoras(supabase);
        carregouFonte = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isMissingTableErrorMessage(message)) {
        throw error;
      }
    }

    if (!carregouFonte) {
      if (await tableExists(supabase, "inventario")) {
        impressoras = await listarViaInventario(supabase);
        carregouFonte = true;
      }
    }

    if (!carregouFonte) {
      return jsonResponse(
        {
          sucesso: false,
          erro: "No source table available (impressoras or inventario)",
        },
        422,
      );
    }

    return jsonResponse(
      {
        sucesso: true,
        dados: {
          total: impressoras.length,
          impressoras,
        },
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ sucesso: false, erro: message }, 500);
  }
});

