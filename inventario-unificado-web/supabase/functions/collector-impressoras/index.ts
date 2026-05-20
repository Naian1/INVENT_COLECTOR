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
 * O que faz: cria uma resposta HTTP em JSON no padrão usado pelas Edge Functions do projeto.
 * Entradas: recebe `body`, que é o objeto a ser serializado, e `status`, que é o código HTTP de retorno.
 * Como executa: converte o corpo para JSON, aplica cabeçalhos CORS para permitir chamada pelo coletor e pelo ambiente web, e define `Content-Type: application/json`.
 * Retorno/Efeitos: devolve um `Response` pronto para o Supabase Edge Runtime enviar ao cliente chamador.
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
 * O que faz: cria o cliente Supabase administrativo usado pela Edge para consultar `public.inventario`.
 * Entradas: não recebe parâmetros diretos; lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` das variáveis de ambiente da função.
 * Como executa: valida se as variáveis existem e cria um cliente sem sessão persistente, porque Edge Function roda por requisição e não precisa guardar login de usuário.
 * Retorno/Efeitos: retorna um client Supabase com permissão de service role; se faltar configuração, interrompe a requisição com erro claro.
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
 * O que faz: transforma qualquer valor simples em texto limpo ou `null`.
 * Entradas: recebe `value`, que pode vir do banco, de variável de ambiente ou de algum campo opcional.
 * Como executa: trata `null`/`undefined`, converte o valor para string, remove espaços nas pontas e descarta string vazia.
 * Retorno/Efeitos: devolve texto consistente para comparação, resposta JSON e montagem da lista de impressoras.
 */
function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * [DOC-FUNC] normalizeIp
 * O que faz: padroniza o IP vindo do inventário antes de entregar ao coletor.
 * Entradas: recebe `ip`, normalmente vindo de `public.inventario.nr_ip`.
 * Como executa: aceita apenas string, remove espaços, descarta valor vazio e remove sufixo `/32` quando o IP foi cadastrado em formato CIDR.
 * Retorno/Efeitos: devolve o IP pronto para o coletor SNMP usar ou `null` quando o valor não é coletável.
 */
function normalizeIp(ip: unknown): string | null {
  if (typeof ip !== "string") return null;
  const clean = ip.trim();
  if (!clean) return null;
  return clean.replace(/\/32$/, "");
}

/**
 * [DOC-FUNC] tokenFromAuthHeader
 * O que faz: extrai o token do cabeçalho HTTP `Authorization`.
 * Entradas: recebe o valor bruto do header, por exemplo `Bearer abc123`.
 * Como executa: verifica se existe header e se começa com `Bearer `; depois remove esse prefixo e limpa espaços.
 * Retorno/Efeitos: devolve somente o token para comparação com `COLLECTOR_API_TOKEN`; se o formato estiver errado, devolve `null`.
 */
function tokenFromAuthHeader(header: string | null): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

/**
 * [DOC-FUNC] validateCollectorAuth
 * O que faz: protege a lista de impressoras para que somente o coletor autorizado consiga baixá-la.
 * Entradas: recebe a requisição HTTP completa para ler o header `Authorization`.
 * Como executa: lê o token esperado em `COLLECTOR_API_TOKEN`, extrai o token recebido e compara os dois valores.
 * Retorno/Efeitos: retorna `null` quando está autorizado; caso contrário retorna uma mensagem de erro usada para responder HTTP 401.
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
 * [DOC-FUNC] listarViaInventario
 * O que faz: monta a lista oficial de impressoras que o coletor Python deve varrer na rede.
 * Entradas: recebe o cliente Supabase com service role, já autenticado pela Edge Function.
 * Como executa: consulta exclusivamente `public.inventario`, junta modelo/marca em `equipamento` e setor em `setor`, filtra somente itens ativos (`ie_situacao = A`) e com `nr_ip` preenchido, normaliza IP/textos e adiciona a comunidade SNMP padrão.
 * Retorno/Efeitos: devolve uma lista enxuta com id do inventário, IP, patrimônio, série, modelo, fabricante, setor, localização e comunidade SNMP; essa lista é a base oficial do ciclo de coleta.
 */
async function listarViaInventario(supabase: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabase
    .from("inventario")
    .select(
      "nr_inventario,nr_ip,nr_patrimonio,nr_serie,ie_situacao,equipamento:cd_equipamento(nm_modelo,nm_marca,nm_equipamento),setor:cd_setor(nm_setor)"
    )
    // O coletor varre somente itens ativos e com IP.
    // Backup/devolução normalmente ficam com ie_situacao = I, então aparecem no inventário geral,
    // mas não entram na coleta SNMP nem no total operacional.
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
    const impressoras = await listarViaInventario(supabase);

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
