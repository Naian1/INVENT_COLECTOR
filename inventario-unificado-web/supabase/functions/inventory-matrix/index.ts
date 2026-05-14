/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\supabase\functions\inventory-matrix\index.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Action = "start" | "append" | "finish";

type MatrixRow = {
  nr_linha: number;
  cd_cliente?: string | null;
  nm_cliente?: string | null;
  nr_projeto?: string | null;
  nr_obra?: string | null;
  nr_id_equipamento?: string | null;
  nr_patrimonio?: string | null;
  nm_tipo?: string | null;
  ds_produto?: string | null;
  nr_nf_faturamento?: string | null;
  dt_faturamento?: string | null;
  nr_serie?: string | null;
  ds_observacao_linha?: string | null;
  nm_hostname?: string | null;
  nm_local?: string | null;
  tp_status?: "ATIVO" | "MANUTENCAO" | "BACKUP" | "DEVOLUCAO" | null;
  dados_json?: Record<string, unknown> | null;
};

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
 * [DOC-FUNC] normalizeStatus
 * O que faz: A funcao 'normalizeStatus' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeStatus(value: unknown): "ATIVO" | "MANUTENCAO" | "BACKUP" | "DEVOLUCAO" | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (["ATIVO", "MANUTENCAO", "BACKUP", "DEVOLUCAO"].includes(raw)) {
    return raw as "ATIVO" | "MANUTENCAO" | "BACKUP" | "DEVOLUCAO";
  }
  return null;
}

/**
 * [DOC-FUNC] sanitizeRow
 * O que faz: A funcao 'sanitizeRow' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: row, nrCarga. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function sanitizeRow(row: MatrixRow, nrCarga: number) {
  return {
    nr_carga: nrCarga,
    nr_linha: Number(row.nr_linha),
    cd_cliente: row.cd_cliente ?? null,
    nm_cliente: row.nm_cliente ?? null,
    nr_projeto: row.nr_projeto ?? null,
    nr_obra: row.nr_obra ?? null,
    nr_id_equipamento: row.nr_id_equipamento ?? null,
    nr_patrimonio: row.nr_patrimonio ?? null,
    nm_tipo: row.nm_tipo ?? null,
    ds_produto: row.ds_produto ?? null,
    nr_nf_faturamento: row.nr_nf_faturamento ?? null,
    dt_faturamento: row.dt_faturamento ?? null,
    nr_serie: row.nr_serie ?? null,
    ds_observacao_linha: row.ds_observacao_linha ?? null,
    nm_hostname: row.nm_hostname ?? null,
    nm_local: row.nm_local ?? null,
    tp_status: normalizeStatus(row.tp_status),
    dados_json: row.dados_json ?? {},
  };
}

/**
 * [DOC-FUNC] badRequest
 * O que faz: A funcao 'badRequest' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Recebe os parametros: message. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
function badRequest(message: string) {
  return jsonResponse({ ok: false, error: message }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "") as Action;
    const supabase = getAdminClient();

    if (action === "start") {
      const competencia = String(body?.competencia || "").trim();
      const arquivoNome = String(body?.arquivo_nome || "matrix.xlsx").trim();
      const totalLinhas = Number(body?.total_linhas || 0);
      const cdCgc = String(body?.cd_cgc || "").trim();

      if (!/^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia)) {
        return badRequest("Competencia invalida. Use MM/AAAA");
      }

      if (!cdCgc) {
        return badRequest("Informe a empresa (cd_cgc) da carga Matrix.");
      }

      const { data: empresa, error: empresaError } = await supabase
        .from("empresa")
        .select("cd_cgc, nm_empresa")
        .eq("cd_cgc", cdCgc)
        .eq("ie_situacao", "A")
        .maybeSingle();

      if (empresaError) throw new Error(empresaError.message);
      if (!empresa?.cd_cgc) {
        return badRequest("Empresa informada nao encontrada ou inativa.");
      }

      const { data: existente, error: findError } = await supabase
        .from("inventario_consolidado_carga")
        .select("nr_carga")
        .eq("nr_competencia", competencia)
        .eq("cd_cgc", cdCgc)
        .maybeSingle();

      if (findError) throw new Error(findError.message);

      if (existente?.nr_carga) {
        const { error: delError } = await supabase
          .from("inventario_consolidado_carga")
          .delete()
          .eq("nr_carga", Number(existente.nr_carga));

        if (delError) throw new Error(delError.message);
      }

      const { data: carga, error: cargaError } = await supabase
        .from("inventario_consolidado_carga")
        .insert([
          {
            nr_competencia: competencia,
            cd_cgc: String(empresa.cd_cgc),
            nm_empresa: String(empresa.nm_empresa || ""),
            nm_arquivo: arquivoNome,
            nr_total_linhas: totalLinhas,
            ds_observacao: "Carga mensal da Matrix via Edge Function por empresa",
          },
        ])
        .select("nr_carga, cd_cgc, nm_empresa")
        .single();

      if (cargaError || !carga) {
        throw new Error(cargaError?.message || "Falha ao criar carga");
      }

      return jsonResponse({
        ok: true,
        data: {
          nr_carga: Number(carga.nr_carga),
          cd_cgc: String(carga.cd_cgc || empresa.cd_cgc),
          nm_empresa: String(carga.nm_empresa || empresa.nm_empresa || ""),
        },
      });
    }

    if (action === "append") {
      const nrCarga = Number(body?.nr_carga);
      const rows = Array.isArray(body?.rows) ? (body.rows as MatrixRow[]) : [];

      if (!Number.isFinite(nrCarga) || nrCarga <= 0) {
        return badRequest("nr_carga invalido");
      }

      if (!rows.length) {
        return badRequest("rows vazio");
      }

      const payload = rows
        .filter((row) => Number.isFinite(Number(row?.nr_linha)))
        .map((row) => sanitizeRow(row, nrCarga));

      if (!payload.length) {
        return badRequest("Nenhuma linha valida para inserir");
      }

      const { error } = await supabase
        .from("inventario_consolidado_linha")
        .insert(payload);

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data: { inserted: payload.length } });
    }

    if (action === "finish") {
      const nrCarga = Number(body?.nr_carga);
      if (!Number.isFinite(nrCarga) || nrCarga <= 0) {
        return badRequest("nr_carga invalido");
      }

      const { count, error } = await supabase
        .from("inventario_consolidado_linha")
        .select("nr_linha", { count: "exact", head: true })
        .eq("nr_carga", nrCarga);

      if (error) throw new Error(error.message);

      return jsonResponse({ ok: true, data: { nr_carga: nrCarga, total_linhas_inseridas: count ?? 0 } });
    }

    return badRequest("Action not supported");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});

