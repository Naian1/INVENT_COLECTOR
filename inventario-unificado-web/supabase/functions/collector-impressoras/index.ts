// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

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

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeIp(ip: unknown): string | null {
  if (typeof ip !== "string") return null;
  const clean = ip.trim();
  if (!clean) return null;
  return clean.replace(/\/32$/, "");
}

function tokenFromAuthHeader(header: string | null): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function validateCollectorAuth(req: Request): string | null {
  const expectedToken = cleanText(Deno.env.get("COLLECTOR_API_TOKEN"));
  if (!expectedToken) return "COLLECTOR_API_TOKEN not configured in Edge Function";

  const receivedToken = tokenFromAuthHeader(req.headers.get("authorization"));
  if (!receivedToken) return "Authorization header must be Bearer <token>";

  if (receivedToken !== expectedToken) return "Invalid collector token";
  return null;
}

function isMissingTableErrorMessage(message: string): boolean {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

async function tableExists(supabase: ReturnType<typeof getAdminClient>, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  const message = String((error as { message?: string }).message ?? "");
  if (/relation .* does not exist/i.test(message) || /Could not find the table/i.test(message)) {
    return false;
  }
  throw new Error(`Failed to check table '${table}': ${message}`);
}

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
