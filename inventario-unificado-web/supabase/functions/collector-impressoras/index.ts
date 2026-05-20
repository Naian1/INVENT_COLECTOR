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
 * [DOC-FUNC] isMissingTableErrorMessage
 * O que faz: A funcao 'isMissingTableErrorMessage' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: message. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isMissingTableErrorMessage(message: string): boolean {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
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
  const message = String((error as { message?: string }).message ?? "");
  if (/relation .* does not exist/i.test(message) || /Could not find the table/i.test(message)) {
    return false;
  }
  throw new Error(`Failed to check table '${table}': ${message}`);
}

/**
 * [DOC-FUNC] listarViaTabelaImpressoras
 * O que faz: A funcao 'listarViaTabelaImpressoras' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: supabase. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'listarViaInventario' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: supabase. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
async function listarViaInventario(supabase: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabase
    .from("inventario")
    .select(
      "nr_inventario,nr_ip,nr_patrimonio,nr_serie,ie_situacao,equipamento:cd_equipamento(nm_modelo,nm_marca,nm_equipamento),setor:cd_setor(nm_setor)"
    )
    // O coletor varre somente itens ativos e com IP.
    // Backup/devolucao normalmente ficam com ie_situacao = I, entao aparecem no inventario geral,
    // mas nao entram na coleta SNMP nem no total operacional.
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
