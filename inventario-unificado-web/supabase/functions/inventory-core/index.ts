// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Action =
  | "list_context"
  | "list_devolucao"
  | "create_inventario"
  | "update_inventario"
  | "move_inventario"
  | "substituir_manutencao"
  | "resolver_manutencao"
  | "matrix_lookup"
  | "matrix_lines"
  | "matrix_conciliacao";

type TpStatus = "ATIVO" | "MANUTENCAO" | "BACKUP" | "DEVOLUCAO";
type TpHierarquia = "RAIZ" | "FILHO" | "AMBOS";

type MatrixLookupItem = {
  nr_linha: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  nm_tipo: string | null;
  ds_produto: string | null;
  nr_id_equipamento: string | null;
  nm_cliente: string | null;
  nm_local: string | null;
  tp_status: string | null;
  cd_cgc?: string | null;
  nm_empresa?: string | null;
};

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

function getUserClient(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveAuthActor(req: Request, supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return {
      errorResponse: jsonResponse({ ok: false, error: "Token ausente." }, 401),
      cd_usuario: null,
      nm_usuario: null,
      auth_user_id: null,
    };
  }

  const userClient = getUserClient(authHeader);
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user?.id) {
    return {
      errorResponse: jsonResponse({ ok: false, error: "Token invalido." }, 401),
      cd_usuario: null,
      nm_usuario: null,
      auth_user_id: null,
    };
  }

  const usuario = await supabaseAdmin
    .from("usuario")
    .select("cd_usuario, nm_usuario, ie_situacao")
    .eq("auth_user_id", authData.user.id)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (usuario.error) {
    return {
      errorResponse: jsonResponse({ ok: false, error: `Falha ao validar usuario: ${usuario.error.message}` }, 500),
      cd_usuario: null,
      nm_usuario: null,
      auth_user_id: null,
    };
  }

  if (!usuario.data?.cd_usuario) {
    return {
      errorResponse: jsonResponse({ ok: false, error: "Usuario inativo ou inexistente." }, 401),
      cd_usuario: null,
      nm_usuario: null,
      auth_user_id: null,
    };
  }

  return {
    errorResponse: null,
    cd_usuario: Number(usuario.data.cd_usuario),
    nm_usuario: limparTexto(usuario.data.nm_usuario),
    auth_user_id: authData.user.id,
  };
}

async function fetchAllPaginated<T>(
  fetchChunk: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  batchSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await fetchChunk(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const chunk = data || [];
    rows.push(...chunk);

    if (chunk.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return rows;
}

function badRequest(message: string) {
  return jsonResponse({ ok: false, error: message }, 400);
}

function validarCompetencia(competencia: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia);
}

function limparTexto(value: unknown): string | null {
  const texto = String(value ?? "").trim();
  return texto || null;
}

function extrairChamadoDaObservacao(value: unknown): string | null {
  const observacao = String(value ?? "");
  if (!observacao) return null;
  const match = observacao.match(/CHAMADO\s*:\s*([^|\n\r]+)/i);
  return limparTexto(match?.[1] ?? null);
}

async function buscarEmpresaResponsavelPorEquipamento(params: {
  supabase: ReturnType<typeof getAdminClient>;
  cd_equipamento: number;
}): Promise<string | null> {
  if (!Number.isFinite(params.cd_equipamento) || params.cd_equipamento <= 0) {
    return null;
  }

  const { data: equipamento, error: erroEquipamento } = await params.supabase
    .from("equipamento")
    .select("cd_cgc")
    .eq("cd_equipamento", params.cd_equipamento)
    .maybeSingle();

  if (erroEquipamento) {
    throw new Error(`Erro ao buscar empresa responsavel do equipamento: ${erroEquipamento.message}`);
  }

  const cdCgc = limparTexto(equipamento?.cd_cgc);
  if (!cdCgc) {
    return null;
  }

  const { data: empresa, error: erroEmpresa } = await params.supabase
    .from("empresa")
    .select("nm_empresa")
    .eq("cd_cgc", cdCgc)
    .maybeSingle();

  if (erroEmpresa) {
    throw new Error(`Erro ao buscar empresa responsavel: ${erroEmpresa.message}`);
  }

  return limparTexto(empresa?.nm_empresa);
}

async function buscarDescricaoConsolidadoPorPatrimonio(params: {
  supabase: ReturnType<typeof getAdminClient>;
  nr_patrimonio: string | null;
}): Promise<string | null> {
  const patrimonio = limparTexto(params.nr_patrimonio);
  if (!patrimonio) {
    return null;
  }

  const hasConsolidadoLinha = await tableExists(params.supabase, "inventario_consolidado_linha");
  if (!hasConsolidadoLinha) {
    return null;
  }

  const { data, error } = await params.supabase
    .from("inventario_consolidado_linha")
    .select("ds_produto")
    .eq("nr_patrimonio", patrimonio)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar descricao no consolidado: ${error.message}`);
  }

  return limparTexto(data?.ds_produto);
}

async function montarObservacaoMovimentacaoStatus(params: {
  supabase: ReturnType<typeof getAdminClient>;
  tp_status: TpStatus;
  nr_chamado: string;
  nr_patrimonio: string | null;
  cd_equipamento: number;
  observacao_livre?: string | null;
}): Promise<string | null> {
  if (params.tp_status !== "MANUTENCAO" && params.tp_status !== "DEVOLUCAO") {
    return null;
  }

  const partes: string[] = [];
  const chamado = limparTexto(params.nr_chamado);
  const patrimonio = limparTexto(params.nr_patrimonio);
  const observacaoLivre = limparTexto(params.observacao_livre);

  const empresaResponsavel = await buscarEmpresaResponsavelPorEquipamento({
    supabase: params.supabase,
    cd_equipamento: params.cd_equipamento,
  });

  if (params.tp_status === "MANUTENCAO") {
    partes.push("ITEM EM MANUTENCAO");
    if (chamado) partes.push(`CHAMADO: ${chamado}`);
    if (empresaResponsavel) partes.push(`EMPRESA RESPONSAVEL: ${empresaResponsavel}`);
    if (observacaoLivre) partes.push(`OBS: ${observacaoLivre}`);
    return partes.join(" | ");
  }

  const descricaoConsolidado = await buscarDescricaoConsolidadoPorPatrimonio({
    supabase: params.supabase,
    nr_patrimonio: patrimonio,
  });

  partes.push("ESCOPO DEVOLUCAO");
  if (chamado) partes.push(`CHAMADO: ${chamado}`);
  if (patrimonio) partes.push(`PATRIMONIO: ${patrimonio}`);
  if (descricaoConsolidado) partes.push(`DESCRICAO: ${descricaoConsolidado}`);
  if (empresaResponsavel) partes.push(`EMPRESA RESPONSAVEL: ${empresaResponsavel}`);
  if (observacaoLivre) partes.push(`OBS: ${observacaoLivre}`);
  return partes.join(" | ");
}

function normalizarPatrimonio(value: string | null): string | null {
  const text = limparTexto(value);
  if (!text) return null;
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || null;
}

function contemFiltro(value: string | null, filtroNormalizado: string | null): boolean {
  if (!filtroNormalizado) return true;
  const normalized = normalizarPatrimonio(value);
  return normalized ? normalized.includes(filtroNormalizado) : false;
}

function situacaoParaTpStatus(ieSituacao?: string | null): TpStatus {
  if (ieSituacao === "M") return "MANUTENCAO";
  if (ieSituacao === "I") return "BACKUP";
  return "ATIVO";
}

function tpStatusParaSituacao(tpStatus: TpStatus): "A" | "M" | "I" {
  if (tpStatus === "MANUTENCAO") return "M";
  if (tpStatus === "BACKUP" || tpStatus === "DEVOLUCAO") return "I";
  return "A";
}

function parseTpStatus(value: unknown): TpStatus {
  const raw = String(value ?? "ATIVO").trim().toUpperCase();
  if (["ATIVO", "MANUTENCAO", "BACKUP", "DEVOLUCAO"].includes(raw)) {
    return raw as TpStatus;
  }
  return "ATIVO";
}

function normalizarIp(value: string | null): string | null {
  const text = limparTexto(value);
  if (!text) return null;
  return text.replace(/\/32$/, "").toLowerCase();
}

function normalizarMac(value: string | null): string | null {
  const text = limparTexto(value);
  if (!text) return null;
  const hex = text.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length === 12) {
    // Schema atual usa varchar(12) para nm_mac.
    // Persistimos sem separadores para evitar overflow.
    return hex;
  }
  return null;
}

function mapearErroDuplicidadeInventario(message: string): string {
  const raw = String(message || "");
  const normalizado = raw.toLowerCase();

  if (normalizado.includes("uq_inventario_patrimonio") || normalizado.includes("nr_patrimonio")) {
    return "Patrimonio ja cadastrado no inventario. Verifique o item existente antes de salvar.";
  }

  if (normalizado.includes("uq_inventario_ip") || normalizado.includes("nr_ip")) {
    return "IP ja cadastrado no inventario. Informe outro IP ou atualize o equipamento existente.";
  }

  return raw;
}

async function validarDuplicidadeInventario(params: {
  supabase: ReturnType<typeof getAdminClient>;
  nr_inventario_atual?: number | null;
  nr_patrimonio: string | null;
  nr_ip: string | null;
}) {
  const patrimonio = limparTexto(params.nr_patrimonio);
  const ipNormalizado = normalizarIp(params.nr_ip);
  const inventarioAtual =
    Number.isFinite(Number(params.nr_inventario_atual)) && Number(params.nr_inventario_atual) > 0
      ? Number(params.nr_inventario_atual)
      : null;

  if (patrimonio) {
    let query = params.supabase
      .from("inventario")
      .select("nr_inventario, nr_patrimonio")
      .ilike("nr_patrimonio", patrimonio)
      .limit(1);

    if (inventarioAtual) {
      query = query.neq("nr_inventario", inventarioAtual);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Erro ao validar duplicidade de patrimonio: ${error.message}`);
    }

    if (data?.nr_inventario) {
      throw new Error(
        `Patrimonio ${patrimonio} ja cadastrado no inventario (ID ${Number(data.nr_inventario)}).`,
      );
    }
  }

  if (ipNormalizado) {
    let query = params.supabase
      .from("inventario")
      .select("nr_inventario, nr_ip, tp_status, ie_situacao")
      .ilike("nr_ip", ipNormalizado)
      .limit(50);

    if (inventarioAtual) {
      query = query.neq("nr_inventario", inventarioAtual);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao validar duplicidade de IP: ${error.message}`);
    }

    const conflitoAtivo = (data || []).find((item: any) => {
      const tpStatusItem = parseTpStatus(item?.tp_status || situacaoParaTpStatus(item?.ie_situacao));
      const inativoPorSituacao = String(item?.ie_situacao || "").toUpperCase() === "I";
      if (inativoPorSituacao) return false;
      return tpStatusItem !== "BACKUP" && tpStatusItem !== "DEVOLUCAO";
    });

    if (conflitoAtivo?.nr_inventario) {
      throw new Error(
        `IP ${ipNormalizado} ja cadastrado no inventario (ID ${Number(conflitoAtivo.nr_inventario)}).`,
      );
    }
  }
}

function isMissingTableError(error: unknown): boolean {
  const message = String((error as any)?.message ?? "");
  return (
    /relation .* does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /does not exist/i.test(message)
  );
}

function isMissingColumnError(error: unknown): boolean {
  const message = String((error as any)?.message ?? "");
  return /column .* does not exist/i.test(message) || /Could not find the '.*' column/i.test(message);
}

async function tableExists(supabase: ReturnType<typeof getAdminClient>, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);

  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw new Error(error.message || `Falha ao verificar tabela ${table}`);
}

async function columnExists(
  supabase: ReturnType<typeof getAdminClient>,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);

  if (!error) return true;
  if (isMissingColumnError(error)) return false;
  if (isMissingTableError(error)) return false;
  throw new Error(error.message || `Falha ao verificar coluna ${table}.${column}`);
}

async function buscarUltimoChamadoMovimentacao(params: {
  supabase: ReturnType<typeof getAdminClient>;
  nr_inventario: number;
}): Promise<string | null> {
  if (!Number.isFinite(params.nr_inventario) || params.nr_inventario <= 0) {
    return null;
  }

  const hasMovimentacao = await tableExists(params.supabase, "movimentacao");
  if (!hasMovimentacao) return null;

  const { data, error } = await params.supabase
    .from("movimentacao")
    .select("ds_observacao, dt_movimentacao")
    .eq("nr_inventario", params.nr_inventario)
    .not("ds_observacao", "is", null)
    .order("dt_movimentacao", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(`Erro ao buscar chamado da movimentacao: ${error.message}`);
  }

  for (const row of data || []) {
    const chamado = extrairChamadoDaObservacao(row.ds_observacao);
    if (chamado) {
      return chamado;
    }
  }

  return null;
}

function normalizarTexto(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarLabelSetor(setor: any): string {
  return [
    String(setor?.nm_piso || "").trim(),
    String(setor?.nm_setor || "").trim(),
    String(setor?.nm_localizacao || "").trim(),
  ]
    .filter(Boolean)
    .join(" > ");
}

function enrichSetoresComPiso(setores: any[]): any[] {
  return [...(setores || [])]
    .sort((a, b) => formatarLabelSetor(a).localeCompare(formatarLabelSetor(b)));
}

function palavraChaveSetorPorStatus(tpStatus: TpStatus): string | null {
  if (tpStatus === "MANUTENCAO") return "manutencao";
  if (tpStatus === "DEVOLUCAO") return "devolucao";
  return null;
}

async function resolverCdPisoNaoInformado(supabase: ReturnType<typeof getAdminClient>): Promise<number> {
  const { data: existente, error: buscaError } = await supabase
    .from("piso")
    .select("cd_piso")
    .eq("ie_situacao", "A")
    .ilike("nm_piso", "NAO INFORMADO")
    .maybeSingle();

  if (buscaError) {
    throw new Error(`Erro ao buscar piso padrao: ${buscaError.message}`);
  }

  if (existente?.cd_piso) {
    return Number(existente.cd_piso);
  }

  const { data: criado, error: createError } = await supabase
    .from("piso")
    .insert([
      {
        nm_piso: "NAO INFORMADO",
        ds_piso: "Piso padrao para setores automaticos.",
        ie_situacao: "A",
      },
    ])
    .select("cd_piso")
    .single();

  if (createError || !criado?.cd_piso) {
    throw new Error(`Erro ao criar piso padrao: ${createError?.message || "sem cd_piso"}`);
  }

  return Number(criado.cd_piso);
}

async function resolverSetorPorPalavraChave(params: {
  supabase: ReturnType<typeof getAdminClient>;
  palavraChave: string;
  nomeSetor: string;
  descricaoSetor: string;
}): Promise<number | null> {
  const { data, error } = await params.supabase
    .from("setor")
    .select("cd_setor,nm_setor,ds_setor")
    .eq("ie_situacao", "A")
    .order("nm_setor", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar setor ${params.nomeSetor}: ${error.message}`);
  }

  const setor = (data || []).find((item) => {
    const nome = normalizarTexto(item.nm_setor);
    const descricao = normalizarTexto(item.ds_setor);
    return nome.includes(params.palavraChave) || descricao.includes(params.palavraChave);
  });

  if (setor?.cd_setor) return Number(setor.cd_setor);

  const { data: criado, error: createError } = await params.supabase
    .from("setor")
    .insert([
      {
        cd_piso: await resolverCdPisoNaoInformado(params.supabase),
        nm_setor: params.nomeSetor,
        nm_localizacao: null,
        ds_setor: params.descricaoSetor,
        ie_situacao: "A",
      },
    ])
    .select("cd_setor")
    .single();

  if (!createError && criado?.cd_setor) {
    return Number(criado.cd_setor);
  }

  // If concurrent creation happened, attempt one final lookup before failing.
  const { data: retryRows, error: retryError } = await params.supabase
    .from("setor")
    .select("cd_setor,nm_setor,ds_setor")
    .eq("ie_situacao", "A")
    .order("nm_setor", { ascending: true });

  if (retryError) {
    throw new Error(`Erro ao buscar setor ${params.nomeSetor}: ${retryError.message}`);
  }

  const retryMatch = (retryRows || []).find((item) => {
    const nome = normalizarTexto(item.nm_setor);
    const descricao = normalizarTexto(item.ds_setor);
    return nome.includes(params.palavraChave) || descricao.includes(params.palavraChave);
  });

  return retryMatch?.cd_setor ? Number(retryMatch.cd_setor) : null;
}

async function resolverSetorAutomaticoPorStatus(
  supabase: ReturnType<typeof getAdminClient>,
  tpStatus: TpStatus,
): Promise<number | null> {
  const palavraChave = palavraChaveSetorPorStatus(tpStatus);
  if (!palavraChave) return null;

  const nomeSetor = tpStatus === "MANUTENCAO" ? "Manutencao" : "Devolucao";
  return await resolverSetorPorPalavraChave({
    supabase,
    palavraChave,
    nomeSetor,
    descricaoSetor: `Setor criado automaticamente para status ${nomeSetor}.`,
  });
}

async function resolverSetorEstoque(
  supabase: ReturnType<typeof getAdminClient>,
): Promise<number | null> {
  return await resolverSetorPorPalavraChave({
    supabase,
    palavraChave: "estoque",
    nomeSetor: "Estoque",
    descricaoSetor: "Setor criado automaticamente para itens de estoque/backup.",
  });
}

async function buscarSetorOrigemDaUltimaManutencao(params: {
  supabase: ReturnType<typeof getAdminClient>;
  nr_inventario: number;
  cd_setor_manutencao: number;
}): Promise<number | null> {
  const hasMovimentacao = await tableExists(params.supabase, "movimentacao");
  if (!hasMovimentacao) return null;

  const { data: entradasManutencao, error: erroUltimaEntrada } = await params.supabase
    .from("movimentacao")
    .select("cd_setor_origem, cd_setor_destino, dt_movimentacao")
    .eq("nr_inventario", params.nr_inventario)
    .eq("cd_setor_destino", params.cd_setor_manutencao)
    .order("dt_movimentacao", { ascending: false })
    .limit(30);

  if (erroUltimaEntrada) {
    throw new Error(`Erro ao buscar setor de origem na movimentacao: ${erroUltimaEntrada.message}`);
  }

  for (const entrada of entradasManutencao || []) {
    if (entrada?.cd_setor_origem && Number(entrada.cd_setor_origem) > 0) {
      return Number(entrada.cd_setor_origem);
    }
  }

  const { data: historicoMovimentacao, error: erroUltimaMov } = await params.supabase
    .from("movimentacao")
    .select("cd_setor_origem, cd_setor_destino, dt_movimentacao")
    .eq("nr_inventario", params.nr_inventario)
    .order("dt_movimentacao", { ascending: false })
    .limit(30);

  if (erroUltimaMov) {
    throw new Error(`Erro ao buscar ultima movimentacao: ${erroUltimaMov.message}`);
  }

  for (const mov of historicoMovimentacao || []) {
    if (mov?.cd_setor_origem && Number(mov.cd_setor_origem) > 0) {
      const origem = Number(mov.cd_setor_origem);
      if (origem !== Number(params.cd_setor_manutencao)) {
        return origem;
      }
    }

    if (mov?.cd_setor_destino && Number(mov.cd_setor_destino) > 0) {
      const destino = Number(mov.cd_setor_destino);
      if (destino !== Number(params.cd_setor_manutencao)) {
        return destino;
      }
    }
  }

  return null;
}

async function listarDescendentesInventario(params: {
  supabase: ReturnType<typeof getAdminClient>;
  nr_inventario: number;
}): Promise<Array<{ nr_inventario: number; cd_setor: number | null }>> {
  const descendentes: Array<{ nr_inventario: number; cd_setor: number | null }> = [];
  const visitados = new Set<number>([params.nr_inventario]);
  let nivelAtual: number[] = [params.nr_inventario];

  while (nivelAtual.length) {
    const { data, error } = await params.supabase
      .from("inventario")
      .select("nr_inventario, cd_setor")
      .in("nr_invent_sup", nivelAtual);

    if (error) {
      throw new Error(`Erro ao buscar itens vinculados para movimentacao: ${error.message}`);
    }

    const proximos: number[] = [];
    for (const row of data || []) {
      const id = Number(row.nr_inventario);
      if (!Number.isFinite(id) || id <= 0 || visitados.has(id)) continue;

      visitados.add(id);
      descendentes.push({
        nr_inventario: id,
        cd_setor: Number.isFinite(Number(row.cd_setor)) ? Number(row.cd_setor) : null,
      });
      proximos.push(id);
    }

    nivelAtual = proximos;
  }

  return descendentes;
}

async function registrarMovimentacaoSeNecessario(params: {
  supabase: ReturnType<typeof getAdminClient>;
  nr_inventario: number;
  cd_setor_origem: number | null;
  cd_setor_destino: number;
  cd_usuario?: number | null;
  nm_usuario?: string | null;
  ds_observacao?: string | null;
}): Promise<void> {
  if (!Number.isFinite(params.nr_inventario) || params.nr_inventario <= 0) return;
  if (!Number.isFinite(params.cd_setor_destino) || params.cd_setor_destino <= 0) return;
  if (
    params.cd_setor_origem !== null &&
    Number.isFinite(params.cd_setor_origem) &&
    Number(params.cd_setor_origem) === Number(params.cd_setor_destino)
  ) {
    return;
  }

  const hasMovimentacao = await tableExists(params.supabase, "movimentacao");
  if (!hasMovimentacao) return;

  const { data: ultima, error: erroUltima } = await params.supabase
    .from("movimentacao")
    .select("cd_setor_origem, cd_setor_destino, dt_movimentacao")
    .eq("nr_inventario", params.nr_inventario)
    .order("dt_movimentacao", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroUltima) {
    throw new Error(`Erro ao consultar ultima movimentacao: ${erroUltima.message}`);
  }

  if (ultima) {
    const mesmaOrigem = Number(ultima.cd_setor_origem || 0) === Number(params.cd_setor_origem || 0);
    const mesmoDestino = Number(ultima.cd_setor_destino || 0) === Number(params.cd_setor_destino || 0);
    const dtUltima = Date.parse(String(ultima.dt_movimentacao || ""));
    const recente = Number.isFinite(dtUltima) ? Date.now() - dtUltima < 2 * 60 * 1000 : false;

    if (mesmaOrigem && mesmoDestino && recente) {
      return;
    }
  }

  const hasCdUsuario = await columnExists(params.supabase, "movimentacao", "cd_usuario");
  const payloadInsert: Record<string, unknown> = {
    nr_inventario: params.nr_inventario,
    cd_setor_origem: params.cd_setor_origem,
    cd_setor_destino: params.cd_setor_destino,
    nm_usuario: limparTexto(params.nm_usuario) || "inventory-core",
    ds_observacao: limparTexto(params.ds_observacao),
  };

  if (hasCdUsuario && Number.isFinite(Number(params.cd_usuario))) {
    payloadInsert.cd_usuario = Number(params.cd_usuario);
  }

  const { error: insertError } = await params.supabase.from("movimentacao").insert([
    payloadInsert,
  ]);

  if (insertError) {
    throw new Error(`Erro ao registrar movimentacao: ${insertError.message}`);
  }
}

async function aplicarRegrasStatusInventario(params: {
  supabase: ReturnType<typeof getAdminClient>;
  tp_status: TpStatus;
  cd_setor: number;
  nr_invent_sup: number | null;
}) {
  if (params.tp_status !== "MANUTENCAO" && params.tp_status !== "DEVOLUCAO") {
    return {
      cd_setor: params.cd_setor,
      nr_invent_sup: params.nr_invent_sup,
    };
  }

  const setorAutomatico = await resolverSetorAutomaticoPorStatus(params.supabase, params.tp_status);
  if (!setorAutomatico) {
    const label = params.tp_status === "MANUTENCAO" ? "Manutencao" : "Devolucao";
    throw new Error(
      `Nao foi encontrado setor ativo para status ${label}. Crie um setor com esse nome para habilitar a movimentacao automatica.`,
    );
  }

  return {
    cd_setor: setorAutomatico,
    nr_invent_sup: null,
  };
}

async function getTpHierarquiaEquipamento(supabase: ReturnType<typeof getAdminClient>, cdEquipamento: number): Promise<TpHierarquia> {
  const { data, error } = await supabase
    .from("equipamento")
    .select("tp_hierarquia")
    .eq("cd_equipamento", cdEquipamento)
    .single();

  if (error) {
    throw new Error(`Erro ao validar tipo de hierarquia do equipamento: ${error.message}`);
  }

  return (data?.tp_hierarquia || "AMBOS") as TpHierarquia;
}

async function validarHierarquiaInventario(params: {
  supabase: ReturnType<typeof getAdminClient>;
  cd_equipamento: number;
  cd_setor: number;
  nr_invent_sup?: number | null;
  tp_status: TpStatus;
}): Promise<void> {
  const tpHierarquia = await getTpHierarquiaEquipamento(params.supabase, params.cd_equipamento);

  if (tpHierarquia === "RAIZ" && params.nr_invent_sup) {
    throw new Error("Equipamento do tipo RAIZ nao pode ter item superior vinculado.");
  }

  if (tpHierarquia === "FILHO" && params.tp_status === "ATIVO" && !params.nr_invent_sup) {
    throw new Error("Equipamento do tipo FILHO em status ATIVO precisa de item superior (nr_invent_sup).");
  }

  if (!params.nr_invent_sup) {
    return;
  }

  const { data: parent, error: parentError } = await params.supabase
    .from("inventario")
    .select("nr_inventario, cd_setor, ie_situacao, tp_status")
    .eq("nr_inventario", params.nr_invent_sup)
    .single();

  if (parentError || !parent) {
    throw new Error("Item superior informado nao foi encontrado no inventario.");
  }

  if (parent.ie_situacao === "I" || parent.tp_status === "BACKUP" || parent.tp_status === "DEVOLUCAO") {
    throw new Error("Nao e permitido vincular item superior inativo.");
  }

  if (Number(parent.cd_setor) !== params.cd_setor) {
    throw new Error("Item superior e item filho devem estar no mesmo setor.");
  }
}

async function matrixLookup(
  supabase: ReturnType<typeof getAdminClient>,
  patrimonio: string,
  competencia: string | null,
  cdCgc: string | null,
) {
  let cargaSelecionada: {
    nr_carga: number;
    nr_competencia: string;
    cd_cgc: string | null;
    nm_empresa: string | null;
  } | null = null;

  if (competencia) {
    let query = supabase
      .from("inventario_consolidado_carga")
      .select("nr_carga, nr_competencia, cd_cgc, nm_empresa")
      .eq("nr_competencia", competencia)
      .order("dt_importacao", { ascending: false })
      .limit(1);

    if (cdCgc) {
      query = query.eq("cd_cgc", cdCgc);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw new Error(error.message);

    if (data?.nr_carga) {
      cargaSelecionada = {
        nr_carga: Number(data.nr_carga),
        nr_competencia: String(data.nr_competencia),
        cd_cgc: limparTexto(data.cd_cgc),
        nm_empresa: limparTexto(data.nm_empresa),
      };
    }
  } else {
    let query = supabase
      .from("inventario_consolidado_carga")
      .select("nr_carga, nr_competencia, cd_cgc, nm_empresa")
      .order("dt_importacao", { ascending: false })
      .limit(1);

    if (cdCgc) {
      query = query.eq("cd_cgc", cdCgc);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw new Error(error.message);

    if (data?.nr_carga) {
      cargaSelecionada = {
        nr_carga: Number(data.nr_carga),
        nr_competencia: String(data.nr_competencia),
        cd_cgc: limparTexto(data.cd_cgc),
        nm_empresa: limparTexto(data.nm_empresa),
      };
    }
  }

  if (!cargaSelecionada) {
    return { encontrado: false, motivo: "Sem Matrix cadastrada." };
  }

  const { data: linhas, error: linhasError } = await supabase
    .from("inventario_consolidado_linha")
    .select("nr_linha, nr_patrimonio, nr_serie, nm_tipo, ds_produto, nr_id_equipamento, nm_cliente, nm_local, tp_status")
    .eq("nr_carga", cargaSelecionada.nr_carga)
    .ilike("nr_patrimonio", `%${patrimonio}%`)
    .order("nr_linha", { ascending: true })
    .limit(10);

  if (linhasError) throw new Error(linhasError.message);

  if (!linhas || linhas.length === 0) {
    return {
      encontrado: false,
      competencia: cargaSelecionada.nr_competencia,
      cd_cgc: cargaSelecionada.cd_cgc,
      nm_empresa: cargaSelecionada.nm_empresa,
      motivo: "Patrimonio nao encontrado na competencia selecionada.",
    };
  }

  const correspondenciaExata =
    linhas.find(
      (item) => String(item.nr_patrimonio || "").trim().toUpperCase() === patrimonio.toUpperCase(),
    ) || linhas[0];

  return {
    encontrado: true,
    competencia: cargaSelecionada.nr_competencia,
    cd_cgc: cargaSelecionada.cd_cgc,
    nm_empresa: cargaSelecionada.nm_empresa,
    item: correspondenciaExata as MatrixLookupItem,
    candidatos: (linhas || []).map((item) => ({
      ...(item as MatrixLookupItem),
      cd_cgc: cargaSelecionada?.cd_cgc || null,
      nm_empresa: cargaSelecionada?.nm_empresa || null,
    })) as MatrixLookupItem[],
  };
}

async function matrixLinhas(
  supabase: ReturnType<typeof getAdminClient>,
  competencia: string | null,
  cdCgc: string | null,
  patrimonio: string | null,
  serie: string | null,
  tipo: string | null,
  modelo: string | null,
  pagina: number,
  tamanhoPagina: number,
) {
  let cargaQuery = supabase
    .from("inventario_consolidado_carga")
    .select("nr_carga, nr_competencia, cd_cgc, nm_empresa, nm_arquivo, nr_total_linhas, dt_importacao")
    .order("dt_importacao", { ascending: false })
    .limit(24);

  if (cdCgc) {
    cargaQuery = cargaQuery.eq("cd_cgc", cdCgc);
  }

  const { data: cargas, error: cargasError } = await cargaQuery;

  if (cargasError) throw new Error(cargasError.message);

  const listaCargas = (cargas || []).map((carga) => ({
    nr_carga: Number(carga.nr_carga),
    nr_competencia: String(carga.nr_competencia),
    cd_cgc: limparTexto(carga.cd_cgc),
    nm_empresa: limparTexto(carga.nm_empresa),
    nm_arquivo: String(carga.nm_arquivo || ""),
    nr_total_linhas: Number(carga.nr_total_linhas || 0),
    dt_importacao: String(carga.dt_importacao || ""),
  }));

  if (listaCargas.length === 0) {
    return {
      cargas: [],
      cargaSelecionada: null,
      filtros: { competencia, cd_cgc: cdCgc, nm_empresa: null, patrimonio, serie, tipo, modelo },
      linhas: [],
      resumoGlobal: {
        total: 0,
        comPatrimonio: 0,
        comSerie: 0,
      },
    };
  }

  const competenciaSelecionada = competencia || listaCargas[0].nr_competencia;
  const cargasSelecionadas = listaCargas.filter((item) => item.nr_competencia === competenciaSelecionada);
  const cargaSelecionada = cargasSelecionadas[0] || null;

  if (!cargaSelecionada) {
    return {
      cargas: listaCargas,
      cargaSelecionada: null,
      filtros: { competencia: competenciaSelecionada, cd_cgc: cdCgc, nm_empresa: null, patrimonio, serie, tipo, modelo },
      linhas: [],
      resumoGlobal: {
        total: 0,
        comPatrimonio: 0,
        comSerie: 0,
      },
    };
  }

  const cargaIds = cargasSelecionadas.map((item) => item.nr_carga);
  const cargaById = new Map<number, (typeof cargasSelecionadas)[number]>(
    cargasSelecionadas.map((item) => [item.nr_carga, item]),
  );
  const cargaSelecionadaResumo = !cdCgc && cargasSelecionadas.length > 1
    ? {
      ...cargaSelecionada,
      nm_arquivo: `MULTIPLOS ARQUIVOS (${cargasSelecionadas.length})`,
    }
    : cargaSelecionada;

  const tamanhoSeguro = Math.max(50, Math.min(1000, Number.isFinite(tamanhoPagina) ? tamanhoPagina : 500));
  const paginaSolicitada = Math.max(1, Number.isFinite(pagina) ? pagina : 1);

  let countQuery = supabase
    .from("inventario_consolidado_linha")
    .select("nr_linha", { count: "exact", head: true })
    .in("nr_carga", cargaIds);

  if (patrimonio) {
    countQuery = countQuery.ilike("nr_patrimonio", `%${patrimonio}%`);
  }

  if (serie) {
    countQuery = countQuery.ilike("nr_serie", `%${serie}%`);
  }

  if (tipo) {
    countQuery = countQuery.ilike("nm_tipo", `%${tipo}%`);
  }

  if (modelo) {
    countQuery = countQuery.ilike("ds_produto", `%${modelo}%`);
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(countError.message);

  let countPatrimonioQuery = supabase
    .from("inventario_consolidado_linha")
    .select("nr_linha", { count: "exact", head: true })
    .in("nr_carga", cargaIds)
    .not("nr_patrimonio", "is", null)
    .neq("nr_patrimonio", "");

  if (patrimonio) {
    countPatrimonioQuery = countPatrimonioQuery.ilike("nr_patrimonio", `%${patrimonio}%`);
  }

  if (serie) {
    countPatrimonioQuery = countPatrimonioQuery.ilike("nr_serie", `%${serie}%`);
  }

  if (tipo) {
    countPatrimonioQuery = countPatrimonioQuery.ilike("nm_tipo", `%${tipo}%`);
  }

  if (modelo) {
    countPatrimonioQuery = countPatrimonioQuery.ilike("ds_produto", `%${modelo}%`);
  }

  let countSerieQuery = supabase
    .from("inventario_consolidado_linha")
    .select("nr_linha", { count: "exact", head: true })
    .in("nr_carga", cargaIds)
    .not("nr_serie", "is", null)
    .neq("nr_serie", "");

  if (patrimonio) {
    countSerieQuery = countSerieQuery.ilike("nr_patrimonio", `%${patrimonio}%`);
  }

  if (serie) {
    countSerieQuery = countSerieQuery.ilike("nr_serie", `%${serie}%`);
  }

  if (tipo) {
    countSerieQuery = countSerieQuery.ilike("nm_tipo", `%${tipo}%`);
  }

  if (modelo) {
    countSerieQuery = countSerieQuery.ilike("ds_produto", `%${modelo}%`);
  }

  const [countPatrimonioResult, countSerieResult] = await Promise.all([
    countPatrimonioQuery,
    countSerieQuery,
  ]);

  if (countPatrimonioResult.error) throw new Error(countPatrimonioResult.error.message);
  if (countSerieResult.error) throw new Error(countSerieResult.error.message);

  const total = Number(count || 0);
  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoSeguro));
  const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
  const from = (paginaAtual - 1) * tamanhoSeguro;
  const to = from + tamanhoSeguro - 1;

  let query = supabase
    .from("inventario_consolidado_linha")
    .select("nr_carga, nr_linha, nr_patrimonio, nr_serie, nr_id_equipamento, nm_tipo, ds_produto, nm_cliente, nm_local, tp_status, nr_nf_faturamento, dt_faturamento")
    .in("nr_carga", cargaIds)
    .order("nr_carga", { ascending: true })
    .order("nr_linha", { ascending: true })
    .range(from, to);

  if (patrimonio) {
    query = query.ilike("nr_patrimonio", `%${patrimonio}%`);
  }

  if (serie) {
    query = query.ilike("nr_serie", `%${serie}%`);
  }

  if (tipo) {
    query = query.ilike("nm_tipo", `%${tipo}%`);
  }

  if (modelo) {
    query = query.ilike("ds_produto", `%${modelo}%`);
  }

  const { data: linhas, error: linhasError } = await query;
  if (linhasError) throw new Error(linhasError.message);

  const linhasComEmpresa = (linhas || []).map((linha: any) => {
    const cargaLinha = cargaById.get(Number(linha.nr_carga));
    return {
      nr_linha: Number(linha.nr_linha),
      nr_patrimonio: linha.nr_patrimonio ?? null,
      nr_serie: linha.nr_serie ?? null,
      nr_id_equipamento: linha.nr_id_equipamento ?? null,
      nm_tipo: linha.nm_tipo ?? null,
      ds_produto: linha.ds_produto ?? null,
      nm_cliente: linha.nm_cliente ?? null,
      nm_local: linha.nm_local ?? null,
      tp_status: linha.tp_status ?? null,
      nr_nf_faturamento: linha.nr_nf_faturamento ?? null,
      dt_faturamento: linha.dt_faturamento ?? null,
      cd_cgc: cargaLinha?.cd_cgc || null,
      nm_empresa: cargaLinha?.nm_empresa || null,
    };
  });

  return {
    cargas: listaCargas,
    cargaSelecionada: cargaSelecionadaResumo,
    filtros: {
      competencia: competenciaSelecionada,
      cd_cgc: cdCgc || null,
      nm_empresa: cdCgc ? (cargaSelecionada.nm_empresa || null) : null,
      patrimonio,
      serie,
      tipo,
      modelo,
    },
    resumoGlobal: {
      total,
      comPatrimonio: Number(countPatrimonioResult.count || 0),
      comSerie: Number(countSerieResult.count || 0),
    },
    linhas: linhasComEmpresa,
    paginacao: {
      pagina: paginaAtual,
      tamanhoPagina: tamanhoSeguro,
      total,
      totalPaginas,
      temAnterior: paginaAtual > 1,
      temProxima: paginaAtual < totalPaginas,
    },
  };
}

async function matrixConciliacao(
  supabase: ReturnType<typeof getAdminClient>,
  competenciaParam: string | null,
  patrimonioParam: string | null,
  limite: number,
) {
  const limiteSeguro = Math.max(50, Math.min(2000, Number.isFinite(limite) ? limite : 500));
  const filtroPatrimonioNormalizado = normalizarPatrimonio(patrimonioParam);

  const { data: cargasData, error: cargasError } = await supabase
    .from("inventario_consolidado_carga")
    .select("nr_carga, nr_competencia, nm_arquivo, nr_total_linhas, dt_importacao")
    .order("dt_importacao", { ascending: false })
    .limit(24);

  if (cargasError) throw new Error(cargasError.message);

  const cargas = (cargasData || []).map((carga) => ({
    nr_carga: Number(carga.nr_carga),
    nr_competencia: String(carga.nr_competencia),
    nm_arquivo: String(carga.nm_arquivo || ""),
    nr_total_linhas: Number(carga.nr_total_linhas || 0),
    dt_importacao: String(carga.dt_importacao || ""),
  }));

  const cargaSelecionada = competenciaParam
    ? cargas.find((item) => item.nr_competencia === competenciaParam) || null
    : (cargas[0] || null);

  const inventarioData = await fetchAllPaginated(async (from, to) =>
    await supabase
      .from("inventario")
      .select("nr_inventario, nr_patrimonio, nr_serie, tp_status, cd_equipamento, cd_setor")
      .order("nr_inventario", { ascending: true })
      .range(from, to)
  );

  const inventarioItems = (inventarioData || []).map((item) => ({
    nr_inventario: Number(item.nr_inventario),
    nr_patrimonio: item.nr_patrimonio ? String(item.nr_patrimonio) : null,
    nr_serie: item.nr_serie ? String(item.nr_serie) : null,
    tp_status: item.tp_status ? String(item.tp_status) : null,
    cd_equipamento: Number(item.cd_equipamento),
    cd_setor: Number(item.cd_setor),
  }));

  let consolidadoItems: Array<{
    nr_linha: number;
    nr_patrimonio: string | null;
    nr_serie: string | null;
    nr_id_equipamento: string | null;
    nm_tipo: string | null;
    ds_produto: string | null;
  }> = [];

  if (cargaSelecionada) {
    const consolidadoData = await fetchAllPaginated(async (from, to) =>
      await supabase
        .from("inventario_consolidado_linha")
        .select("nr_linha, nr_patrimonio, nr_serie, nr_id_equipamento, nm_tipo, ds_produto")
        .eq("nr_carga", cargaSelecionada.nr_carga)
        .order("nr_linha", { ascending: true })
        .range(from, to)
    );

    consolidadoItems = (consolidadoData || []).map((item) => ({
      nr_linha: Number(item.nr_linha),
      nr_patrimonio: item.nr_patrimonio ? String(item.nr_patrimonio) : null,
      nr_serie: item.nr_serie ? String(item.nr_serie) : null,
      nr_id_equipamento: item.nr_id_equipamento ? String(item.nr_id_equipamento) : null,
      nm_tipo: item.nm_tipo ? String(item.nm_tipo) : null,
      ds_produto: item.ds_produto ? String(item.ds_produto) : null,
    }));
  }

  const inventarioSemPatrimonio = inventarioItems.filter((item) => !normalizarPatrimonio(item.nr_patrimonio));
  const consolidadoSemPatrimonio = consolidadoItems.filter((item) => !normalizarPatrimonio(item.nr_patrimonio));

  const invPorPatrimonio = new Map<string, typeof inventarioItems>();
  for (const item of inventarioItems) {
    const key = normalizarPatrimonio(item.nr_patrimonio);
    if (!key) continue;
    const current = invPorPatrimonio.get(key) || [];
    current.push(item);
    invPorPatrimonio.set(key, current);
  }

  const consPorPatrimonio = new Map<string, typeof consolidadoItems>();
  for (const item of consolidadoItems) {
    const key = normalizarPatrimonio(item.nr_patrimonio);
    if (!key) continue;
    const current = consPorPatrimonio.get(key) || [];
    current.push(item);
    consPorPatrimonio.set(key, current);
  }

  const duplicidadesInventarioAll = Array.from(invPorPatrimonio.entries())
    .filter(([key, list]) => list.length > 1 && (!filtroPatrimonioNormalizado || key.includes(filtroPatrimonioNormalizado)))
    .map(([key, list]) => ({
      patrimonio_normalizado: key,
      quantidade: list.length,
      itens: list,
    }));
  const duplicidadesInventario = duplicidadesInventarioAll.slice(0, limiteSeguro);

  const duplicidadesConsolidadoAll = Array.from(consPorPatrimonio.entries())
    .filter(([key, list]) => list.length > 1 && (!filtroPatrimonioNormalizado || key.includes(filtroPatrimonioNormalizado)))
    .map(([key, list]) => ({
      patrimonio_normalizado: key,
      quantidade: list.length,
      itens: list,
    }));
  const duplicidadesConsolidado = duplicidadesConsolidadoAll.slice(0, limiteSeguro);

  const consolidadoNaoNoInventarioAll = consolidadoItems
    .filter((item) => {
      const key = normalizarPatrimonio(item.nr_patrimonio);
      if (!key) {
        return !filtroPatrimonioNormalizado;
      }
      if (!contemFiltro(item.nr_patrimonio, filtroPatrimonioNormalizado)) return false;
      return !invPorPatrimonio.has(key);
    });
  const consolidadoNaoNoInventario = consolidadoNaoNoInventarioAll.slice(0, limiteSeguro);

  const inventarioNaoNoConsolidadoAll = inventarioItems
    .filter((item) => {
      const key = normalizarPatrimonio(item.nr_patrimonio);
      if (!key) {
        return !filtroPatrimonioNormalizado;
      }
      if (!contemFiltro(item.nr_patrimonio, filtroPatrimonioNormalizado)) return false;
      return !consPorPatrimonio.has(key);
    });
  const inventarioNaoNoConsolidado = inventarioNaoNoConsolidadoAll.slice(0, limiteSeguro);

  return {
    filtros: {
      competencia: cargaSelecionada?.nr_competencia || competenciaParam,
      patrimonio: patrimonioParam,
      limite: limiteSeguro,
    },
    cargas,
    cargaSelecionada,
    resumo: {
      totalInventario: inventarioItems.length,
      totalConsolidado: consolidadoItems.length,
      inventarioSemPatrimonio: inventarioSemPatrimonio.length,
      consolidadoSemPatrimonio: consolidadoSemPatrimonio.length,
      duplicidadesInventario: duplicidadesInventarioAll.length,
      duplicidadesConsolidado: duplicidadesConsolidadoAll.length,
      consolidadoNaoNoInventario: consolidadoNaoNoInventarioAll.length,
      inventarioNaoNoConsolidado: inventarioNaoNoConsolidadoAll.length,
    },
    duplicidades: {
      inventario: duplicidadesInventario,
      consolidado: duplicidadesConsolidado,
    },
    divergencias: {
      consolidadoNaoNoInventario,
      inventarioNaoNoConsolidado,
    },
    amostras: {
      inventarioSemPatrimonio: inventarioSemPatrimonio.slice(0, limiteSeguro),
      consolidadoSemPatrimonio: consolidadoSemPatrimonio.slice(0, limiteSeguro),
    },
  };
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
    const payload = body?.payload ?? {};

    if (!action) {
      return badRequest("Action is required");
    }

    const supabase = getAdminClient();
    const actor = await resolveAuthActor(req, supabase);
    if (actor.errorResponse) {
      return actor.errorResponse;
    }
    const nmUsuario = actor.nm_usuario;
    const cdUsuario = actor.cd_usuario;

    if (action === "list_context") {
      const hasEmpresa = await tableExists(supabase, "empresa");

      const [inventarios, pisRes, setRes, eqRes, tipRes, empRes] = await Promise.all([
        fetchAllPaginated(async (from, to) =>
          await supabase.from("inventario").select("*").order("nr_patrimonio").range(from, to)
        ),
        supabase.from("piso").select("*").eq("ie_situacao", "A").order("nm_piso"),
        supabase
          .from("vw_setor")
          .select("*")
          .eq("ie_situacao", "A")
          .order("nm_setor")
          .order("nm_localizacao"),
        supabase.from("equipamento").select("*").eq("ie_situacao", "A").order("nm_modelo"),
        supabase.from("tipo_equipamento").select("*").eq("ie_situacao", "A").order("nm_tipo_equipamento"),
        hasEmpresa
          ? supabase.from("empresa").select("cd_cgc,nm_empresa").eq("ie_situacao", "A").order("nm_empresa")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (pisRes.error) throw new Error(`piso: ${pisRes.error.message}`);
      if (setRes.error) throw new Error(`setor: ${setRes.error.message}`);
      if (eqRes.error) throw new Error(`equipamento: ${eqRes.error.message}`);
      if (tipRes.error) throw new Error(`tipo_equipamento: ${tipRes.error.message}`);
      if (empRes.error) throw new Error(`empresa: ${empRes.error.message}`);

      const setoresComPiso = enrichSetoresComPiso(setRes.data || []);

      return jsonResponse({
        ok: true,
        data: {
          inventarios: inventarios || [],
          pisos: pisRes.data || [],
          setores: setoresComPiso,
          equipamentos: eqRes.data || [],
          tipos: tipRes.data || [],
          empresas: empRes.data || [],
        },
      });
    }

    if (action === "list_devolucao") {
      let inventariosDevolucao: any[] = [];
      try {
        inventariosDevolucao = await fetchAllPaginated<any>(async (from, to) =>
          await supabase
            .from("inventario")
            .select("nr_inventario,nr_patrimonio,nr_serie,nr_ip,cd_setor,cd_equipamento,tp_status,ie_situacao,dt_atualizacao")
            .eq("tp_status", "DEVOLUCAO")
            .order("nr_inventario", { ascending: true })
            .range(from, to)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/column\s+inventario\.dt_atualizacao\s+does not exist/i.test(message)) {
          throw error;
        }

        inventariosDevolucao = await fetchAllPaginated<any>(async (from, to) =>
          await supabase
            .from("inventario")
            .select("nr_inventario,nr_patrimonio,nr_serie,nr_ip,cd_setor,cd_equipamento,tp_status,ie_situacao")
            .eq("tp_status", "DEVOLUCAO")
            .order("nr_inventario", { ascending: true })
            .range(from, to)
        );
      }

      if (!inventariosDevolucao.length) {
        return jsonResponse({ ok: true, data: [] });
      }

      const inventarioIds = inventariosDevolucao
        .map((item) => Number(item.nr_inventario))
        .filter((id) => Number.isFinite(id) && id > 0);

      const setorIds = Array.from(new Set(
        inventariosDevolucao
          .map((item) => Number(item.cd_setor))
          .filter((id) => Number.isFinite(id) && id > 0),
      ));

      const equipamentoIds = Array.from(new Set(
        inventariosDevolucao
          .map((item) => Number(item.cd_equipamento))
          .filter((id) => Number.isFinite(id) && id > 0),
      ));

      const [setoresRes, equipamentosRes] = await Promise.all([
        setorIds.length
          ? supabase.from("vw_setor").select("cd_setor,cd_piso,nm_piso,nm_setor,nm_localizacao,ds_setor").in("cd_setor", setorIds)
          : Promise.resolve({ data: [], error: null }),
        equipamentoIds.length
          ? supabase.from("equipamento").select("cd_equipamento,cd_cgc,nm_modelo,nm_equipamento").in("cd_equipamento", equipamentoIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (setoresRes.error) throw new Error(`setor: ${setoresRes.error.message}`);
      if (equipamentosRes.error) throw new Error(`equipamento: ${equipamentosRes.error.message}`);

      const equipamentos = equipamentosRes.data || [];
      const cgcList = Array.from(new Set(
        equipamentos
          .map((equipamento: any) => limparTexto(equipamento.cd_cgc))
          .filter((value): value is string => Boolean(value)),
      ));

      const empresasRes = cgcList.length
        ? await supabase.from("empresa").select("cd_cgc,nm_empresa").in("cd_cgc", cgcList)
        : { data: [], error: null };

      if (empresasRes.error) throw new Error(`empresa: ${empresasRes.error.message}`);

      const latestMovByInventario = new Map<number, { ds_observacao: string | null; dt_movimentacao: string | null }>();
      const hasMovimentacao = await tableExists(supabase, "movimentacao");
      if (hasMovimentacao && inventarioIds.length) {
        const movimentacoes = await fetchAllPaginated<any>(async (from, to) =>
          await supabase
            .from("movimentacao")
            .select("nr_inventario,ds_observacao,dt_movimentacao")
            .in("nr_inventario", inventarioIds)
            .order("dt_movimentacao", { ascending: false })
            .range(from, to)
        , 500);

        for (const mov of movimentacoes) {
          const invId = Number(mov.nr_inventario);
          if (!Number.isFinite(invId) || latestMovByInventario.has(invId)) continue;
          latestMovByInventario.set(invId, {
            ds_observacao: limparTexto(mov.ds_observacao),
            dt_movimentacao: limparTexto(mov.dt_movimentacao),
          });
        }
      }

      const setorById = new Map(
        (setoresRes.data || []).map((setor: any) => [Number(setor.cd_setor), setor]),
      );
      const equipamentoById = new Map(
        equipamentos.map((equipamento: any) => [Number(equipamento.cd_equipamento), equipamento]),
      );
      const empresaByCgc = new Map(
        (empresasRes.data || []).map((empresa: any) => [String(empresa.cd_cgc), String(empresa.nm_empresa || "")]),
      );

      const itens = inventariosDevolucao.map((item) => {
        const invId = Number(item.nr_inventario);
        const setor = setorById.get(Number(item.cd_setor));
        const equipamento = equipamentoById.get(Number(item.cd_equipamento));
        const cgc = limparTexto(equipamento?.cd_cgc);
        const mov = latestMovByInventario.get(invId);
        const chamado = extrairChamadoDaObservacao(mov?.ds_observacao);

        return {
          nr_inventario: invId,
          nr_patrimonio: limparTexto(item.nr_patrimonio),
          nr_serie: limparTexto(item.nr_serie),
          nr_ip: limparTexto(item.nr_ip),
          setor_atual: limparTexto(formatarLabelSetor(setor)),
          setor_descricao: limparTexto(setor?.ds_setor),
          cd_setor: Number(item.cd_setor),
          equipamento_modelo: limparTexto(equipamento?.nm_modelo || equipamento?.nm_equipamento),
          empresa: cgc ? limparTexto(empresaByCgc.get(cgc)) : null,
          cd_cgc: cgc,
          nr_chamado: chamado,
          ds_observacao_movimentacao: mov?.ds_observacao || null,
          dt_movimentacao: mov?.dt_movimentacao || null,
          dt_atualizacao: limparTexto(item.dt_atualizacao),
          ie_situacao: limparTexto(item.ie_situacao),
          tp_status: limparTexto(item.tp_status),
        };
      });

      return jsonResponse({ ok: true, data: itens });
    }

    if (action === "create_inventario") {
      const cd_equipamento = Number(payload?.cd_equipamento);
      const cd_setor = Number(payload?.cd_setor);
      const nr_invent_sup = payload?.nr_invent_sup !== null && payload?.nr_invent_sup !== undefined && payload?.nr_invent_sup !== ""
        ? Number(payload.nr_invent_sup)
        : null;
      const tp_status = parseTpStatus(payload?.tp_status);
      const nr_chamado = limparTexto(payload?.nr_chamado);
      const nm_mac = normalizarMac(limparTexto(payload?.nm_mac));

      if (!Number.isFinite(cd_equipamento) || cd_equipamento <= 0 || !Number.isFinite(cd_setor) || cd_setor <= 0) {
        return badRequest("cd_equipamento e cd_setor sao obrigatorios");
      }

      const tp_hierarquia = await getTpHierarquiaEquipamento(supabase, cd_equipamento);
      const nm_hostname = tp_hierarquia === "FILHO" ? null : limparTexto(payload?.nm_hostname);
      const hasNmMac = await columnExists(supabase, "inventario", "nm_mac");

      const regrasStatus = await aplicarRegrasStatusInventario({
        supabase,
        tp_status,
        cd_setor,
        nr_invent_sup,
      });

      await validarHierarquiaInventario({
        supabase,
        cd_equipamento,
        cd_setor: regrasStatus.cd_setor,
        nr_invent_sup: regrasStatus.nr_invent_sup,
        tp_status,
      });

      const payloadInsert = {
        cd_equipamento,
        cd_setor: regrasStatus.cd_setor,
        nr_patrimonio: limparTexto(payload?.nr_patrimonio),
        nr_serie: limparTexto(payload?.nr_serie),
        nr_ip: normalizarIp(limparTexto(payload?.nr_ip)),
        ...(hasNmMac ? { nm_mac } : {}),
        nm_hostname,
        nr_invent_sup: regrasStatus.nr_invent_sup,
        tp_status,
        ie_situacao: tpStatusParaSituacao(tp_status),
      };

      await validarDuplicidadeInventario({
        supabase,
        nr_inventario_atual: null,
        nr_patrimonio: payloadInsert.nr_patrimonio,
        nr_ip: payloadInsert.nr_ip,
      });

      const observacaoMovimentacao = await montarObservacaoMovimentacaoStatus({
        supabase,
        tp_status,
        nr_chamado: nr_chamado || "",
        nr_patrimonio: payloadInsert.nr_patrimonio,
        cd_equipamento,
      });

      const { data, error } = await supabase
        .from("inventario")
        .insert([payloadInsert])
        .select("*")
        .single();

      if (error) throw new Error(mapearErroDuplicidadeInventario(error.message));

      await registrarMovimentacaoSeNecessario({
        supabase,
        nm_usuario: nmUsuario,
        cd_usuario: cdUsuario,
        nr_inventario: Number(data.nr_inventario),
        cd_setor_origem: null,
        cd_setor_destino: Number(payloadInsert.cd_setor),
        ds_observacao: observacaoMovimentacao || "Criacao de item no inventario",
      });

      return jsonResponse({ ok: true, data });
    }

    if (action === "update_inventario") {
      const nr_inventario = Number(payload?.nr_inventario);
      const cd_equipamento = Number(payload?.cd_equipamento);
      const cd_setor = Number(payload?.cd_setor);
      const nr_invent_sup = payload?.nr_invent_sup !== null && payload?.nr_invent_sup !== undefined && payload?.nr_invent_sup !== ""
        ? Number(payload.nr_invent_sup)
        : null;
      const tp_status = parseTpStatus(payload?.tp_status);
      const nr_chamado = limparTexto(payload?.nr_chamado);
      const nm_mac = normalizarMac(limparTexto(payload?.nm_mac));

      if (!Number.isFinite(nr_inventario) || nr_inventario <= 0) {
        return badRequest("nr_inventario e obrigatorio");
      }

      if (!Number.isFinite(cd_equipamento) || cd_equipamento <= 0 || !Number.isFinite(cd_setor) || cd_setor <= 0) {
        return badRequest("cd_equipamento e cd_setor sao obrigatorios");
      }

      const tp_hierarquia = await getTpHierarquiaEquipamento(supabase, cd_equipamento);
      const nm_hostname = tp_hierarquia === "FILHO" ? null : limparTexto(payload?.nm_hostname);
      const hasNmMac = await columnExists(supabase, "inventario", "nm_mac");

      const { data: existente, error: existeError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_setor")
        .eq("nr_inventario", nr_inventario)
        .maybeSingle();

      if (existeError) throw new Error(existeError.message);
      if (!existente) {
        return badRequest("Item de inventario nao encontrado");
      }

      const regrasStatus = await aplicarRegrasStatusInventario({
        supabase,
        tp_status,
        cd_setor,
        nr_invent_sup,
      });

      if (regrasStatus.nr_invent_sup !== null && regrasStatus.nr_invent_sup === nr_inventario) {
        return badRequest("nr_invent_sup nao pode ser igual ao proprio nr_inventario");
      }

      await validarHierarquiaInventario({
        supabase,
        cd_equipamento,
        cd_setor: regrasStatus.cd_setor,
        nr_invent_sup: regrasStatus.nr_invent_sup,
        tp_status,
      });

      const payloadUpdate = {
        cd_equipamento,
        cd_setor: regrasStatus.cd_setor,
        nr_patrimonio: limparTexto(payload?.nr_patrimonio),
        nr_serie: limparTexto(payload?.nr_serie),
        nr_ip: normalizarIp(limparTexto(payload?.nr_ip)),
        ...(hasNmMac ? { nm_mac } : {}),
        nm_hostname,
        nr_invent_sup: regrasStatus.nr_invent_sup,
        tp_status,
        ie_situacao: tpStatusParaSituacao(tp_status),
      };

      await validarDuplicidadeInventario({
        supabase,
        nr_inventario_atual: nr_inventario,
        nr_patrimonio: payloadUpdate.nr_patrimonio,
        nr_ip: payloadUpdate.nr_ip,
      });

      const observacaoMovimentacao = await montarObservacaoMovimentacaoStatus({
        supabase,
        tp_status,
        nr_chamado: nr_chamado || "",
        nr_patrimonio: payloadUpdate.nr_patrimonio,
        cd_equipamento,
      });

      const { data, error } = await supabase
        .from("inventario")
        .update(payloadUpdate)
        .eq("nr_inventario", nr_inventario)
        .select("*")
        .single();

      if (error) throw new Error(mapearErroDuplicidadeInventario(error.message));

      await registrarMovimentacaoSeNecessario({
        supabase,
        nm_usuario: nmUsuario,
        cd_usuario: cdUsuario,
        nr_inventario,
        cd_setor_origem: Number(existente.cd_setor || 0) || null,
        cd_setor_destino: Number(payloadUpdate.cd_setor),
        ds_observacao: observacaoMovimentacao || "Atualizacao de item no inventario",
      });

      return jsonResponse({ ok: true, data });
    }

    if (action === "move_inventario") {
      const nr_inventario = Number(payload?.nr_inventario);
      const cd_setor_destino = Number(payload?.cd_setor_destino);
      const observacao = limparTexto(payload?.observacao);
      const nrChamadoInformado = limparTexto(payload?.nr_chamado);
      const filhosAcoesPayload = Array.isArray(payload?.filhos_acoes) ? payload.filhos_acoes : [];
      const acoesFilhos = new Map<number, "ACOMPANHAR_DESTINO" | "MOVER_ESTOQUE">();

      for (const entrada of filhosAcoesPayload) {
        const filhoId = Number((entrada as any)?.nr_inventario_filho);
        const acaoRaw = String((entrada as any)?.acao || "").trim().toUpperCase();
        if (!Number.isFinite(filhoId) || filhoId <= 0) continue;
        if (acaoRaw === "ACOMPANHAR_DESTINO" || acaoRaw === "MOVER_ESTOQUE") {
          acoesFilhos.set(filhoId, acaoRaw);
        }
      }

      if (!Number.isFinite(nr_inventario) || nr_inventario <= 0) {
        return badRequest("nr_inventario e obrigatorio para movimentacao.");
      }

      if (!Number.isFinite(cd_setor_destino) || cd_setor_destino <= 0) {
        return badRequest("cd_setor_destino e obrigatorio para movimentacao.");
      }

      const { data: existente, error: existenteError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_equipamento, cd_setor, nr_invent_sup, tp_status")
        .eq("nr_inventario", nr_inventario)
        .maybeSingle();

      if (existenteError) throw new Error(existenteError.message);
      if (!existente) {
        return badRequest("Item de inventario nao encontrado.");
      }

      const setorOrigem = Number(existente.cd_setor);
      if (!Number.isFinite(setorOrigem) || setorOrigem <= 0) {
        return badRequest("Item sem setor atual valido para movimentacao.");
      }

      if (setorOrigem === cd_setor_destino) {
        return badRequest("Setor de destino igual ao setor atual.");
      }

      const tpStatusAtual = parseTpStatus(existente.tp_status);
      const nrInventSupAtual =
        Number.isFinite(Number(existente.nr_invent_sup)) && Number(existente.nr_invent_sup) > 0
          ? Number(existente.nr_invent_sup)
          : null;

      await validarHierarquiaInventario({
        supabase,
        cd_equipamento: Number(existente.cd_equipamento),
        cd_setor: cd_setor_destino,
        nr_invent_sup: nrInventSupAtual,
        tp_status: tpStatusAtual,
      });

      const nrChamado = nrChamadoInformado;

      const { data: filhosDiretos, error: filhosError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_setor")
        .eq("nr_invent_sup", nr_inventario);

      if (filhosError) {
        throw new Error(`Erro ao buscar filhos vinculados para movimentacao: ${filhosError.message}`);
      }

      const partesObs: string[] = [];
      if (nrChamado) partesObs.push(`CHAMADO: ${nrChamado}`);
      if (observacao) partesObs.push(`OBS: ${observacao}`);
      const observacaoMov =
        partesObs.join(" | ") || `Movimentacao manual de setor ${setorOrigem} para ${cd_setor_destino}`;

      const { data: atualizado, error: updateError } = await supabase
        .from("inventario")
        .update({ cd_setor: cd_setor_destino })
        .eq("nr_inventario", nr_inventario)
        .select("*")
        .single();

      if (updateError) throw new Error(updateError.message);

      await registrarMovimentacaoSeNecessario({
        supabase,
        nm_usuario: nmUsuario,
        cd_usuario: cdUsuario,
        nr_inventario,
        cd_setor_origem: setorOrigem,
        cd_setor_destino,
        ds_observacao: observacaoMov,
      });

      let filhosAcompanhando = 0;
      let filhosParaEstoque = 0;
      let setorEstoque: number | null = null;

      for (const filho of filhosDiretos || []) {
        const filhoId = Number(filho.nr_inventario);
        if (!Number.isFinite(filhoId) || filhoId <= 0) continue;

        const acao = acoesFilhos.get(filhoId) || "MOVER_ESTOQUE";
        const setorFilhoOrigem = Number.isFinite(Number(filho.cd_setor)) ? Number(filho.cd_setor) : null;

        if (acao === "ACOMPANHAR_DESTINO") {
          const { error: updateFilhoError } = await supabase
            .from("inventario")
            .update({
              cd_setor: cd_setor_destino,
              nr_invent_sup: nr_inventario,
            })
            .eq("nr_inventario", filhoId);

          if (updateFilhoError) {
            throw new Error(`Erro ao mover filho ${filhoId} junto com o pai: ${updateFilhoError.message}`);
          }

          await registrarMovimentacaoSeNecessario({
            supabase,
            nm_usuario: nmUsuario,
            cd_usuario: cdUsuario,
            nr_inventario: filhoId,
            cd_setor_origem: setorFilhoOrigem,
            cd_setor_destino,
            ds_observacao: `${observacaoMov} | Filho acompanhou movimentacao do pai ${nr_inventario}`,
          });
          filhosAcompanhando += 1;
          continue;
        }

        if (!setorEstoque) {
          setorEstoque = await resolverSetorEstoque(supabase);
        }

        if (!setorEstoque) {
          throw new Error("Nao foi possivel resolver o setor de estoque para movimentar filhos remanescentes.");
        }

        const { error: updateFilhoError } = await supabase
          .from("inventario")
          .update({
            cd_setor: setorEstoque,
            nr_invent_sup: null,
            tp_status: "BACKUP",
            ie_situacao: "I",
          })
          .eq("nr_inventario", filhoId);

        if (updateFilhoError) {
          throw new Error(`Erro ao mover filho ${filhoId} para estoque: ${updateFilhoError.message}`);
        }

        await registrarMovimentacaoSeNecessario({
          supabase,
          nm_usuario: nmUsuario,
          cd_usuario: cdUsuario,
          nr_inventario: filhoId,
          cd_setor_origem: setorFilhoOrigem,
          cd_setor_destino: setorEstoque,
          ds_observacao: `${observacaoMov} | Filho remanescente movido para estoque`,
        });
        filhosParaEstoque += 1;
      }

      return jsonResponse({
        ok: true,
        data: {
          item: atualizado,
          resumo: {
            nr_inventario,
            cd_setor_origem: setorOrigem,
            cd_setor_destino,
            nr_chamado: nrChamado,
            filhos_acompanharam_destino: filhosAcompanhando,
            filhos_movidos_estoque: filhosParaEstoque,
          },
        },
      });
    }

    if (action === "substituir_manutencao") {
      const nrInventarioManutencao = Number(payload?.nr_inventario_manutencao);
      const nrInventarioSubstituto = Number(payload?.nr_inventario_substituto);
      const cdSetorDestinoPayload = payload?.cd_setor_destino;
      const cdSetorDestinoInformado =
        cdSetorDestinoPayload !== null && cdSetorDestinoPayload !== undefined && String(cdSetorDestinoPayload).trim() !== ""
          ? Number(cdSetorDestinoPayload)
          : null;
      const observacao = limparTexto(payload?.observacao);
      const nrChamadoInformado = limparTexto(payload?.nr_chamado);
      const filhosAcoesPayload = Array.isArray(payload?.filhos_acoes) ? payload.filhos_acoes : [];
      const acoesFilhos = new Map<
        number,
        "ACOMPANHAR_NOVO_PAI" | "PERMANECER_ANTIGO_PENDENTE" | "MOVER_ESTOQUE"
      >();

      for (const entrada of filhosAcoesPayload) {
        const filhoId = Number((entrada as any)?.nr_inventario_filho);
        const acaoRaw = String((entrada as any)?.acao || "").trim().toUpperCase();
        if (!Number.isFinite(filhoId) || filhoId <= 0) continue;
        if (["ACOMPANHAR_NOVO_PAI", "PERMANECER_ANTIGO_PENDENTE", "MOVER_ESTOQUE"].includes(acaoRaw)) {
          acoesFilhos.set(filhoId, acaoRaw as "ACOMPANHAR_NOVO_PAI" | "PERMANECER_ANTIGO_PENDENTE" | "MOVER_ESTOQUE");
        }
      }

      if (!Number.isFinite(nrInventarioManutencao) || nrInventarioManutencao <= 0) {
        return badRequest("nr_inventario_manutencao e obrigatorio.");
      }

      if (!Number.isFinite(nrInventarioSubstituto) || nrInventarioSubstituto <= 0) {
        return badRequest("nr_inventario_substituto e obrigatorio.");
      }

      if (nrInventarioManutencao === nrInventarioSubstituto) {
        return badRequest("O item substituto deve ser diferente do item em manutencao.");
      }

      const { data: itemManutencao, error: itemManutencaoError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_equipamento, cd_setor, tp_status, nr_patrimonio")
        .eq("nr_inventario", nrInventarioManutencao)
        .maybeSingle();

      if (itemManutencaoError) throw new Error(itemManutencaoError.message);
      if (!itemManutencao) {
        return badRequest("Item em manutencao nao encontrado.");
      }

      if (parseTpStatus(itemManutencao.tp_status) !== "MANUTENCAO") {
        return badRequest("A substituicao exige um item atualmente em MANUTENCAO.");
      }

      const { data: itemSubstituto, error: itemSubstitutoError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_equipamento, cd_setor, nr_invent_sup, tp_status, nr_patrimonio")
        .eq("nr_inventario", nrInventarioSubstituto)
        .maybeSingle();

      if (itemSubstitutoError) throw new Error(itemSubstitutoError.message);
      if (!itemSubstituto) {
        return badRequest("Item substituto nao encontrado.");
      }

      if (parseTpStatus(itemSubstituto.tp_status) !== "BACKUP") {
        return badRequest("O item substituto deve estar em BACKUP/ESTOQUE.");
      }

      if (Number.isFinite(Number(itemSubstituto.nr_invent_sup)) && Number(itemSubstituto.nr_invent_sup) > 0) {
        return badRequest("O item substituto nao pode estar vinculado como filho de outro equipamento.");
      }

      let cdSetorDestino = Number.isFinite(cdSetorDestinoInformado) && Number(cdSetorDestinoInformado) > 0
        ? Number(cdSetorDestinoInformado)
        : null;

      if (!cdSetorDestino) {
        cdSetorDestino = await buscarSetorOrigemDaUltimaManutencao({
          supabase,
          nr_inventario: nrInventarioManutencao,
          cd_setor_manutencao: Number(itemManutencao.cd_setor || 0),
        });
      }

      if (!cdSetorDestino) {
        return badRequest("Nao foi possivel identificar setor de destino. Informe cd_setor_destino.");
      }

      await validarHierarquiaInventario({
        supabase,
        cd_equipamento: Number(itemSubstituto.cd_equipamento),
        cd_setor: cdSetorDestino,
        nr_invent_sup: null,
        tp_status: "ATIVO",
      });

      const { data: filhosDiretos, error: filhosError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_setor")
        .eq("nr_invent_sup", nrInventarioManutencao);

      if (filhosError) {
        throw new Error(`Erro ao listar filhos do item em manutencao: ${filhosError.message}`);
      }

      const nrChamado = nrChamadoInformado;

      const partesObs: string[] = [
        `SUBSTITUICAO: ${itemManutencao.nr_patrimonio || nrInventarioManutencao} -> ${itemSubstituto.nr_patrimonio || nrInventarioSubstituto}`,
      ];
      if (nrChamado) partesObs.push(`CHAMADO: ${nrChamado}`);
      if (observacao) partesObs.push(`OBS: ${observacao}`);
      const observacaoSubstituicao = partesObs.join(" | ");

      const cdSetorSubstitutoOrigem = Number.isFinite(Number(itemSubstituto.cd_setor))
        ? Number(itemSubstituto.cd_setor)
        : null;

      const { data: substitutoAtualizado, error: substitutoUpdateError } = await supabase
        .from("inventario")
        .update({
          cd_setor: cdSetorDestino,
          nr_invent_sup: null,
          tp_status: "ATIVO",
          ie_situacao: "A",
        })
        .eq("nr_inventario", nrInventarioSubstituto)
        .select("*")
        .single();

      if (substitutoUpdateError) throw new Error(substitutoUpdateError.message);

      await registrarMovimentacaoSeNecessario({
        supabase,
        nm_usuario: nmUsuario,
        cd_usuario: cdUsuario,
        nr_inventario: nrInventarioSubstituto,
        cd_setor_origem: cdSetorSubstitutoOrigem,
        cd_setor_destino: cdSetorDestino,
        ds_observacao: observacaoSubstituicao,
      });

      let filhosAcompanharam = 0;
      let filhosPendentes = 0;
      let filhosEstoque = 0;
      let setorEstoque: number | null = null;

      for (const filho of filhosDiretos || []) {
        const filhoId = Number(filho.nr_inventario);
        if (!Number.isFinite(filhoId) || filhoId <= 0) continue;

        const acao = acoesFilhos.get(filhoId) || "PERMANECER_ANTIGO_PENDENTE";
        const setorFilhoOrigem = Number.isFinite(Number(filho.cd_setor)) ? Number(filho.cd_setor) : null;

        if (acao === "ACOMPANHAR_NOVO_PAI") {
          const { error: filhoUpdateError } = await supabase
            .from("inventario")
            .update({
              nr_invent_sup: nrInventarioSubstituto,
              cd_setor: cdSetorDestino,
              tp_status: "ATIVO",
              ie_situacao: "A",
            })
            .eq("nr_inventario", filhoId);

          if (filhoUpdateError) {
            throw new Error(`Erro ao transferir filho ${filhoId} para o novo pai: ${filhoUpdateError.message}`);
          }

          await registrarMovimentacaoSeNecessario({
            supabase,
            nm_usuario: nmUsuario,
            cd_usuario: cdUsuario,
            nr_inventario: filhoId,
            cd_setor_origem: setorFilhoOrigem,
            cd_setor_destino: cdSetorDestino,
            ds_observacao: `${observacaoSubstituicao} | Filho vinculado ao novo pai`,
          });
          filhosAcompanharam += 1;
          continue;
        }

        if (acao === "MOVER_ESTOQUE") {
          if (!setorEstoque) {
            setorEstoque = await resolverSetorEstoque(supabase);
          }

          if (!setorEstoque) {
            throw new Error("Nao foi possivel resolver o setor de estoque para mover filhos remanescentes.");
          }

          const { error: filhoUpdateError } = await supabase
            .from("inventario")
            .update({
              nr_invent_sup: null,
              cd_setor: setorEstoque,
              tp_status: "BACKUP",
              ie_situacao: "I",
            })
            .eq("nr_inventario", filhoId);

          if (filhoUpdateError) {
            throw new Error(`Erro ao mover filho ${filhoId} para estoque: ${filhoUpdateError.message}`);
          }

          await registrarMovimentacaoSeNecessario({
            supabase,
            nm_usuario: nmUsuario,
            cd_usuario: cdUsuario,
            nr_inventario: filhoId,
            cd_setor_origem: setorFilhoOrigem,
            cd_setor_destino: setorEstoque,
            ds_observacao: `${observacaoSubstituicao} | Filho movido para estoque`,
          });
          filhosEstoque += 1;
          continue;
        }

        filhosPendentes += 1;
      }

      return jsonResponse({
        ok: true,
        data: {
          item_manutencao: itemManutencao,
          item_substituto: substitutoAtualizado,
          resumo: {
            nr_inventario_manutencao: nrInventarioManutencao,
            nr_inventario_substituto: nrInventarioSubstituto,
            cd_setor_destino: cdSetorDestino,
            nr_chamado: nrChamado,
            filhos_acompanharam_novo_pai: filhosAcompanharam,
            filhos_permaneceram_pendentes: filhosPendentes,
            filhos_movidos_estoque: filhosEstoque,
          },
        },
      });
    }

    if (action === "substituir_manutencao") {
      const nrInventarioManutencao = Number(payload?.nr_inventario_manutencao);
      const nrInventarioSubstituto = Number(payload?.nr_inventario_substituto);
      const cdSetorDestinoPayload = payload?.cd_setor_destino;
      const cdSetorDestinoInformado =
        cdSetorDestinoPayload !== null && cdSetorDestinoPayload !== undefined && String(cdSetorDestinoPayload).trim() !== ""
          ? Number(cdSetorDestinoPayload)
          : null;
      const observacao = limparTexto(payload?.observacao);
      const nrChamadoInformado = limparTexto(payload?.nr_chamado);
      const filhosAcoesPayload = Array.isArray(payload?.filhos_acoes) ? payload.filhos_acoes : [];
      const acoesFilhos = new Map<
        number,
        "ACOMPANHAR_NOVO_PAI" | "PERMANECER_ANTIGO_PENDENTE" | "MOVER_ESTOQUE"
      >();

      for (const entrada of filhosAcoesPayload) {
        const filhoId = Number((entrada as any)?.nr_inventario_filho);
        const acaoRaw = String((entrada as any)?.acao || "").trim().toUpperCase();
        if (!Number.isFinite(filhoId) || filhoId <= 0) continue;
        if (["ACOMPANHAR_NOVO_PAI", "PERMANECER_ANTIGO_PENDENTE", "MOVER_ESTOQUE"].includes(acaoRaw)) {
          acoesFilhos.set(filhoId, acaoRaw as "ACOMPANHAR_NOVO_PAI" | "PERMANECER_ANTIGO_PENDENTE" | "MOVER_ESTOQUE");
        }
      }

      if (!Number.isFinite(nrInventarioManutencao) || nrInventarioManutencao <= 0) {
        return badRequest("nr_inventario_manutencao e obrigatorio.");
      }

      if (!Number.isFinite(nrInventarioSubstituto) || nrInventarioSubstituto <= 0) {
        return badRequest("nr_inventario_substituto e obrigatorio.");
      }

      if (nrInventarioManutencao === nrInventarioSubstituto) {
        return badRequest("O item substituto deve ser diferente do item em manutencao.");
      }

      const { data: itemManutencao, error: itemManutencaoError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_equipamento, cd_setor, tp_status, nr_patrimonio")
        .eq("nr_inventario", nrInventarioManutencao)
        .maybeSingle();

      if (itemManutencaoError) throw new Error(itemManutencaoError.message);
      if (!itemManutencao) {
        return badRequest("Item em manutencao nao encontrado.");
      }

      if (parseTpStatus(itemManutencao.tp_status) !== "MANUTENCAO") {
        return badRequest("A substituicao exige um item atualmente em MANUTENCAO.");
      }

      const { data: itemSubstituto, error: itemSubstitutoError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_equipamento, cd_setor, nr_invent_sup, tp_status, nr_patrimonio")
        .eq("nr_inventario", nrInventarioSubstituto)
        .maybeSingle();

      if (itemSubstitutoError) throw new Error(itemSubstitutoError.message);
      if (!itemSubstituto) {
        return badRequest("Item substituto nao encontrado.");
      }

      if (parseTpStatus(itemSubstituto.tp_status) !== "BACKUP") {
        return badRequest("O item substituto deve estar em BACKUP/ESTOQUE.");
      }

      if (Number.isFinite(Number(itemSubstituto.nr_invent_sup)) && Number(itemSubstituto.nr_invent_sup) > 0) {
        return badRequest("O item substituto nao pode estar vinculado como filho de outro equipamento.");
      }

      let cdSetorDestino = Number.isFinite(cdSetorDestinoInformado) && Number(cdSetorDestinoInformado) > 0
        ? Number(cdSetorDestinoInformado)
        : null;

      if (!cdSetorDestino) {
        cdSetorDestino = await buscarSetorOrigemDaUltimaManutencao({
          supabase,
          nr_inventario: nrInventarioManutencao,
          cd_setor_manutencao: Number(itemManutencao.cd_setor || 0),
        });
      }

      if (!cdSetorDestino) {
        return badRequest("Nao foi possivel identificar setor de destino. Informe cd_setor_destino.");
      }

      await validarHierarquiaInventario({
        supabase,
        cd_equipamento: Number(itemSubstituto.cd_equipamento),
        cd_setor: cdSetorDestino,
        nr_invent_sup: null,
        tp_status: "ATIVO",
      });

      const { data: filhosDiretos, error: filhosError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_setor")
        .eq("nr_invent_sup", nrInventarioManutencao);

      if (filhosError) {
        throw new Error(`Erro ao listar filhos do item em manutencao: ${filhosError.message}`);
      }

      const nrChamado = nrChamadoInformado;

      const partesObs: string[] = [
        `SUBSTITUICAO: ${itemManutencao.nr_patrimonio || nrInventarioManutencao} -> ${itemSubstituto.nr_patrimonio || nrInventarioSubstituto}`,
      ];
      if (nrChamado) partesObs.push(`CHAMADO: ${nrChamado}`);
      if (observacao) partesObs.push(`OBS: ${observacao}`);
      const observacaoSubstituicao = partesObs.join(" | ");

      const cdSetorSubstitutoOrigem = Number.isFinite(Number(itemSubstituto.cd_setor))
        ? Number(itemSubstituto.cd_setor)
        : null;

      const { data: substitutoAtualizado, error: substitutoUpdateError } = await supabase
        .from("inventario")
        .update({
          cd_setor: cdSetorDestino,
          nr_invent_sup: null,
          tp_status: "ATIVO",
          ie_situacao: "A",
        })
        .eq("nr_inventario", nrInventarioSubstituto)
        .select("*")
        .single();

      if (substitutoUpdateError) throw new Error(substitutoUpdateError.message);

      await registrarMovimentacaoSeNecessario({
        supabase,
        nm_usuario: nmUsuario,
        cd_usuario: cdUsuario,
        nr_inventario: nrInventarioSubstituto,
        cd_setor_origem: cdSetorSubstitutoOrigem,
        cd_setor_destino: cdSetorDestino,
        ds_observacao: observacaoSubstituicao,
      });

      let filhosAcompanharam = 0;
      let filhosPendentes = 0;
      let filhosEstoque = 0;
      let setorEstoque: number | null = null;

      for (const filho of filhosDiretos || []) {
        const filhoId = Number(filho.nr_inventario);
        if (!Number.isFinite(filhoId) || filhoId <= 0) continue;

        const acao = acoesFilhos.get(filhoId) || "PERMANECER_ANTIGO_PENDENTE";
        const setorFilhoOrigem = Number.isFinite(Number(filho.cd_setor)) ? Number(filho.cd_setor) : null;

        if (acao === "ACOMPANHAR_NOVO_PAI") {
          const { error: filhoUpdateError } = await supabase
            .from("inventario")
            .update({
              nr_invent_sup: nrInventarioSubstituto,
              cd_setor: cdSetorDestino,
              tp_status: "ATIVO",
              ie_situacao: "A",
            })
            .eq("nr_inventario", filhoId);

          if (filhoUpdateError) {
            throw new Error(`Erro ao transferir filho ${filhoId} para o novo pai: ${filhoUpdateError.message}`);
          }

          await registrarMovimentacaoSeNecessario({
            supabase,
            nm_usuario: nmUsuario,
            cd_usuario: cdUsuario,
            nr_inventario: filhoId,
            cd_setor_origem: setorFilhoOrigem,
            cd_setor_destino: cdSetorDestino,
            ds_observacao: `${observacaoSubstituicao} | Filho vinculado ao novo pai`,
          });
          filhosAcompanharam += 1;
          continue;
        }

        if (acao === "MOVER_ESTOQUE") {
          if (!setorEstoque) {
            setorEstoque = await resolverSetorEstoque(supabase);
          }

          if (!setorEstoque) {
            throw new Error("Nao foi possivel resolver o setor de estoque para mover filhos remanescentes.");
          }

          const { error: filhoUpdateError } = await supabase
            .from("inventario")
            .update({
              nr_invent_sup: null,
              cd_setor: setorEstoque,
              tp_status: "BACKUP",
              ie_situacao: "I",
            })
            .eq("nr_inventario", filhoId);

          if (filhoUpdateError) {
            throw new Error(`Erro ao mover filho ${filhoId} para estoque: ${filhoUpdateError.message}`);
          }

          await registrarMovimentacaoSeNecessario({
            supabase,
            nm_usuario: nmUsuario,
            cd_usuario: cdUsuario,
            nr_inventario: filhoId,
            cd_setor_origem: setorFilhoOrigem,
            cd_setor_destino: setorEstoque,
            ds_observacao: `${observacaoSubstituicao} | Filho movido para estoque`,
          });
          filhosEstoque += 1;
          continue;
        }

        filhosPendentes += 1;
      }

      return jsonResponse({
        ok: true,
        data: {
          item_manutencao: itemManutencao,
          item_substituto: substitutoAtualizado,
          resumo: {
            nr_inventario_manutencao: nrInventarioManutencao,
            nr_inventario_substituto: nrInventarioSubstituto,
            cd_setor_destino: cdSetorDestino,
            nr_chamado: nrChamado,
            filhos_acompanharam_novo_pai: filhosAcompanharam,
            filhos_permaneceram_pendentes: filhosPendentes,
            filhos_movidos_estoque: filhosEstoque,
          },
        },
      });
    }

    if (action === "resolver_manutencao") {
      const nr_inventario = Number(payload?.nr_inventario);
      const tipoResolucao = String(payload?.tipo_resolucao || "").trim().toUpperCase();
      const destinoResolucao = String(payload?.destino_resolucao || "ORIGEM").trim().toUpperCase();
      const cdSetorDestinoPayload = payload?.cd_setor_destino;
      const cdSetorDestinoInformado =
        cdSetorDestinoPayload !== null && cdSetorDestinoPayload !== undefined && String(cdSetorDestinoPayload).trim() !== ""
          ? Number(cdSetorDestinoPayload)
          : null;
      const observacao = limparTexto(payload?.observacao);
      const nrChamadoInformado = limparTexto(payload?.nr_chamado);

      if (!Number.isFinite(nr_inventario) || nr_inventario <= 0) {
        return badRequest("nr_inventario e obrigatorio para resolver manutencao");
      }

      if (!["RESOLVIDO", "SEM_RESOLUCAO"].includes(tipoResolucao)) {
        return badRequest("tipo_resolucao invalido. Use RESOLVIDO ou SEM_RESOLUCAO.");
      }

      const { data: existente, error: existenteError } = await supabase
        .from("inventario")
        .select("nr_inventario, cd_equipamento, cd_setor, nr_invent_sup, tp_status, nr_patrimonio")
        .eq("nr_inventario", nr_inventario)
        .maybeSingle();

      if (existenteError) throw new Error(existenteError.message);
      if (!existente) {
        return badRequest("Item de inventario nao encontrado.");
      }

      const statusAtual = parseTpStatus(existente.tp_status);
      if (statusAtual !== "MANUTENCAO") {
        return badRequest("Resolucao disponivel apenas para itens em MANUTENCAO.");
      }

      const setorAtual = Number(existente.cd_setor);
      if (!Number.isFinite(setorAtual) || setorAtual <= 0) {
        return badRequest("Item sem setor atual valido para resolver manutencao.");
      }

      let novoTpStatus: TpStatus = "ATIVO";
      let novoCdSetor = setorAtual;
      let novoNrInventSup: number | null =
        Number.isFinite(Number(existente.nr_invent_sup)) && Number(existente.nr_invent_sup) > 0
          ? Number(existente.nr_invent_sup)
          : null;

      const nrChamado = nrChamadoInformado;

      if (tipoResolucao === "SEM_RESOLUCAO") {
        if (!nrChamado) {
          return badRequest("Numero do chamado nao encontrado. Informe para devolucao sem resolucao.");
        }

        novoTpStatus = "DEVOLUCAO";
        const regrasStatus = await aplicarRegrasStatusInventario({
          supabase,
          tp_status: novoTpStatus,
          cd_setor: setorAtual,
          nr_invent_sup: null,
        });
        novoCdSetor = Number(regrasStatus.cd_setor);
        novoNrInventSup = regrasStatus.nr_invent_sup;
      } else {
        if (!["ORIGEM", "NOVO_SETOR", "ESTOQUE"].includes(destinoResolucao)) {
          return badRequest("destino_resolucao invalido. Use ORIGEM, NOVO_SETOR ou ESTOQUE.");
        }

        if (destinoResolucao === "ORIGEM") {
          const setorOrigem = await buscarSetorOrigemDaUltimaManutencao({
            supabase,
            nr_inventario,
            cd_setor_manutencao: setorAtual,
          });

          if (!setorOrigem) {
            return badRequest("Nao foi possivel identificar setor de origem. Selecione NOVO_SETOR.");
          }

          novoTpStatus = "ATIVO";
          novoCdSetor = setorOrigem;
        } else if (destinoResolucao === "NOVO_SETOR") {
          if (!Number.isFinite(cdSetorDestinoInformado) || Number(cdSetorDestinoInformado) <= 0) {
            return badRequest("Informe cd_setor_destino para NOVO_SETOR.");
          }

          novoTpStatus = "ATIVO";
          novoCdSetor = Number(cdSetorDestinoInformado);
        } else {
          novoTpStatus = "BACKUP";

          if (Number.isFinite(cdSetorDestinoInformado) && Number(cdSetorDestinoInformado) > 0) {
            novoCdSetor = Number(cdSetorDestinoInformado);
          } else {
            const setorEstoque = await resolverSetorEstoque(supabase);
            if (!setorEstoque) {
              return badRequest("Nao foi possivel resolver o setor de estoque.");
            }
            novoCdSetor = setorEstoque;
          }
        }
      }

      await validarHierarquiaInventario({
        supabase,
        cd_equipamento: Number(existente.cd_equipamento),
        cd_setor: novoCdSetor,
        nr_invent_sup: novoNrInventSup,
        tp_status: novoTpStatus,
      });

      const updatePayload = {
        cd_setor: novoCdSetor,
        nr_invent_sup: novoNrInventSup,
        tp_status: novoTpStatus,
        ie_situacao: tpStatusParaSituacao(novoTpStatus),
      };

      const { data: atualizado, error: updateError } = await supabase
        .from("inventario")
        .update(updatePayload)
        .eq("nr_inventario", nr_inventario)
        .select("*")
        .single();

      if (updateError) throw new Error(updateError.message);

      await registrarMovimentacaoSeNecessario({
        supabase,
        nm_usuario: nmUsuario,
        cd_usuario: cdUsuario,
        nr_inventario,
        cd_setor_origem: setorAtual,
        cd_setor_destino: novoCdSetor,
        ds_observacao: tipoResolucao === "SEM_RESOLUCAO"
          ? await montarObservacaoMovimentacaoStatus({
            supabase,
            tp_status: "DEVOLUCAO",
            nr_chamado: nrChamado || "",
            nr_patrimonio: limparTexto(existente.nr_patrimonio),
            cd_equipamento: Number(existente.cd_equipamento),
            observacao_livre: observacao,
          })
          : observacao ||
            (destinoResolucao === "ESTOQUE"
              ? "Resolvido e movido para estoque"
              : destinoResolucao === "ORIGEM"
                ? "Resolvido e retornado ao setor de origem"
                : "Resolvido e movido para novo setor"),
      });

      return jsonResponse({
        ok: true,
        data: {
          item: atualizado,
          resumo: {
            nr_inventario,
            nr_chamado: nrChamado,
            tipo_resolucao: tipoResolucao,
            destino_resolucao: tipoResolucao === "SEM_RESOLUCAO" ? "DEVOLUCAO" : destinoResolucao,
            tp_status_final: novoTpStatus,
            cd_setor_final: novoCdSetor,
          },
        },
      });
    }

    if (action === "matrix_lookup") {
      const patrimonio = limparTexto(payload?.patrimonio);
      const competencia = limparTexto(payload?.competencia);
      const cdCgc = limparTexto(payload?.cd_cgc);

      if (!patrimonio) {
        return badRequest("Informe o patrimonio para busca.");
      }

      if (competencia && !validarCompetencia(competencia)) {
        return badRequest("Competencia invalida. Use MM/AAAA.");
      }

      const data = await matrixLookup(supabase, patrimonio, competencia, cdCgc);
      return jsonResponse({ ok: true, data });
    }

    if (action === "matrix_lines") {
      const competencia = limparTexto(payload?.competencia);
      const cdCgc = limparTexto(payload?.cd_cgc);
      const patrimonio = limparTexto(payload?.patrimonio);
      const serie = limparTexto(payload?.serie);
      const tipo = limparTexto(payload?.tipo);
      const modelo = limparTexto(payload?.modelo);
      const pagina = Number(payload?.pagina || 1);
      const tamanhoPagina = Number(payload?.tamanhoPagina || payload?.limite || 500);

      if (competencia && !validarCompetencia(competencia)) {
        return badRequest("Competencia invalida. Use MM/AAAA.");
      }

      const data = await matrixLinhas(supabase, competencia, cdCgc, patrimonio, serie, tipo, modelo, pagina, tamanhoPagina);
      return jsonResponse({ ok: true, data });
    }

    if (action === "matrix_conciliacao") {
      const competencia = limparTexto(payload?.competencia);
      const patrimonio = limparTexto(payload?.patrimonio);
      const limite = Number(payload?.limite || 1000);

      if (competencia && !validarCompetencia(competencia)) {
        return badRequest("Competencia invalida. Use MM/AAAA.");
      }

      const data = await matrixConciliacao(supabase, competencia, patrimonio, limite);
      return jsonResponse({ ok: true, data });
    }

    return badRequest("Action not supported");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
