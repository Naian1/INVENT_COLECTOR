import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ResultadoServico<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

type ChaveMatching = "patrimonio" | "ip" | "numero_serie";
type AcaoLinha = "criar" | "atualizar" | "erro" | "conflito" | "ignorar";

type PreviewInput = {
  nome_arquivo: string;
  nome_aba?: string | null;
  headers?: string[];
  rows: Array<Record<string, unknown>>;
  mapeamento_colunas: Record<string, string>;
  aba_inventario_id?: string | null;
  tipo_item_id?: string | null;
  estrategia_matching: ChaveMatching[];
};

type LinhaPreview = {
  indice_linha: number;
  acao_sugerida: AcaoLinha;
  match_por: ChaveMatching | null;
  item_inventario_id: string | null;
  dados_originais: Record<string, unknown>;
  dados_normalizados: Record<string, unknown>;
  erros: string[];
};

type PreviewResultado = {
  importacao_id: string | null;
  linhas_normalizadas: LinhaPreview[];
  total_validas: number;
  total_erros: number;
  conflitos_detectados: LinhaPreview[];
  preview: {
    total_linhas: number;
    total_criar: number;
    total_atualizar: number;
    total_conflitos: number;
    total_ignorar: number;
  };
};

type ExecutarInput =
  | {
      importacao_id: string;
    }
  | (PreviewInput & {
      importacao_id?: string;
    });

type ResultadoExecucao = {
  importacao_id: string | null;
  total_processadas: number;
  total_criadas: number;
  total_atualizadas: number;
  total_conflitos: number;
  total_erros: number;
  total_ignoradas: number;
  erros: Array<{ indice_linha: number; erro: string }>;
};

const CAMPOS_DIRETOS = new Set([
  "patrimonio",
  "descricao",
  "setor",
  "localizacao",
  "modelo",
  "fabricante",
  "numero_serie",
  "hostname",
  "ip",
  "status_item",
  "ativo"
]);

const STATUS_ITEM_VALIDOS = new Set([
  "ativo",
  "estoque",
  "manutencao",
  "substituido",
  "devolvido",
  "descartado"
]);

const VALORES_VAZIOS = new Set(["", "null", "none", "n/a", "na", "-", "desconhecido", "unknown"]);

function normalizarTexto(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (VALORES_VAZIOS.has(normalized.toLowerCase())) return undefined;
  return normalized;
}

function normalizarChave(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function slugify(value: string): string {
  return normalizarChave(value).replace(/_+/g, "-");
}

function normalizarIp(value: string): string {
  return value.replace(/\/32$/, "").trim();
}

function ipValido(ip: string): boolean {
  const ipv4Regex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  return ipv4Regex.test(ip);
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = normalizarTexto(value);
  if (!text) return undefined;
  const lowered = text.toLowerCase();
  if (["1", "true", "sim", "s"].includes(lowered)) return true;
  if (["0", "false", "nao", "n"].includes(lowered)) return false;
  return undefined;
}

function resolverCampoDestino(coluna: string, mapping: Record<string, string>): string {
  const mapped = mapping[coluna];
  if (mapped && mapped.trim()) return mapped.trim();
  return normalizarChave(coluna);
}

async function validarReferenciasBase(input: PreviewInput): Promise<
  ResultadoServico<{ tipoEhImpressora: boolean }>
> {
  const supabase = getSupabaseServerClient();

  if (input.aba_inventario_id) {
    const { data, error } = await supabase
      .from("abas_inventario")
      .select("id")
      .eq("id", input.aba_inventario_id)
      .single();
    if (error || !data) {
      return {
        success: false,
        status: 400,
        error: "aba_inventario_id invalido para importacao."
      };
    }
  }

  if (!input.tipo_item_id) {
    return { success: true, data: { tipoEhImpressora: false } };
  }

  const { data: tipoData, error: tipoError } = await supabase
    .from("tipos_itens")
    .select("nome,slug")
    .eq("id", input.tipo_item_id)
    .single();

  if (tipoError || !tipoData) {
    return {
      success: false,
      status: 400,
      error: "tipo_item_id invalido para importacao."
    };
  }

  const slug = String(tipoData.slug ?? "").toLowerCase();
  const nome = String(tipoData.nome ?? "").toLowerCase();
  const tipoEhImpressora =
    slug === "impressora" || nome === "impressora" || slug.includes("impressora");

  return { success: true, data: { tipoEhImpressora } };
}

function normalizarLinha(
  row: Record<string, unknown>,
  mapping: Record<string, string>
): { dadosNormalizados: Record<string, unknown>; erros: string[] } {
  const erros: string[] = [];
  const dados: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};

  for (const [coluna, rawValue] of Object.entries(row)) {
    const destino = resolverCampoDestino(coluna, mapping);
    if (destino === "ignorar") continue;

    const valorTexto = normalizarTexto(rawValue);
    if (!valorTexto && destino !== "ativo") continue;

    if (destino.startsWith("dados_extras.")) {
      const extraKey = destino.split(".")[1] ?? normalizarChave(coluna);
      if (valorTexto) extras[extraKey] = valorTexto;
      continue;
    }

    if (destino === "dados_extras") {
      if (valorTexto) extras[normalizarChave(coluna)] = valorTexto;
      continue;
    }

    if (!CAMPOS_DIRETOS.has(destino)) {
      if (valorTexto) extras[normalizarChave(coluna)] = valorTexto;
      continue;
    }

    if (destino === "ativo") {
      const boolValue = toBoolean(rawValue);
      if (boolValue === undefined) {
        erros.push(`Valor invalido para ativo na coluna '${coluna}'.`);
      } else {
        dados.ativo = boolValue;
      }
      continue;
    }

    if (!valorTexto) continue;

    if (destino === "ip") {
      const ip = normalizarIp(valorTexto);
      if (!ipValido(ip)) {
        erros.push(`IP invalido na coluna '${coluna}'.`);
      } else {
        dados.ip = ip;
      }
      continue;
    }

    if (destino === "status_item") {
      const normalizedStatus = valorTexto.toLowerCase();
      if (!STATUS_ITEM_VALIDOS.has(normalizedStatus)) {
        erros.push(`status_item invalido na coluna '${coluna}'.`);
      } else {
        dados.status_item = normalizedStatus;
      }
      continue;
    }

    dados[destino] = valorTexto;
  }

  if (Object.keys(extras).length > 0) {
    dados.dados_extras = extras;
  }

  return { dadosNormalizados: dados, erros };
}

async function buscarIdsPorChave(
  campo: ChaveMatching,
  valor: string
): Promise<ResultadoServico<string[]>> {
  const supabase = getSupabaseServerClient();
  const query = supabase.from("itens_inventario").select("id").limit(10);

  const { data, error } =
    campo === "ip" ? await query.eq("ip", valor) : await query.ilike(campo, valor);

  if (error) {
    return { success: false, status: 500, error: "Falha ao consultar matching de itens." };
  }

  const ids = (data ?? []).map((row) => String(row.id));
  return { success: true, data: ids };
}

async function detectarMatching(
  dados: Record<string, unknown>,
  estrategia: ChaveMatching[]
): Promise<
  ResultadoServico<{
    itemId: string | null;
    matchPor: ChaveMatching | null;
    erroConflito: string | null;
  }>
> {
  const hits: Array<{ chave: ChaveMatching; itemId: string }> = [];

  for (const chave of estrategia) {
    const raw = dados[chave];
    if (!raw || typeof raw !== "string") continue;

    const consulta = await buscarIdsPorChave(chave, raw);
    if (!consulta.success) return consulta;

    if (consulta.data.length > 1) {
      return {
        success: true,
        data: {
          itemId: null,
          matchPor: null,
          erroConflito: `Conflito ambiguo: chave '${chave}' encontrou mais de um item.`
        }
      };
    }

    if (consulta.data.length === 1) {
      hits.push({ chave, itemId: consulta.data[0] });
    }
  }

  if (hits.length === 0) {
    return { success: true, data: { itemId: null, matchPor: null, erroConflito: null } };
  }

  const uniqueIds = Array.from(new Set(hits.map((hit) => hit.itemId)));
  if (uniqueIds.length > 1) {
    return {
      success: true,
      data: {
        itemId: null,
        matchPor: null,
        erroConflito: "Conflito ambiguo: chaves de matching apontam para itens diferentes."
      }
    };
  }

  return {
    success: true,
    data: {
      itemId: uniqueIds[0],
      matchPor: hits[0].chave,
      erroConflito: null
    }
  };
}

async function persistirPreviewImportacao(
  input: PreviewInput,
  linhas: LinhaPreview[],
  resumo: PreviewResultado["preview"]
): Promise<ResultadoServico<{ importacaoId: string }>> {
  const supabase = getSupabaseServerClient();

  const { data: importacaoData, error: importacaoError } = await supabase
    .from("importacoes_planilha")
    .insert({
      nome_arquivo: input.nome_arquivo,
      nome_aba: input.nome_aba ?? null,
      aba_inventario_id: input.aba_inventario_id ?? null,
      tipo_item_id: input.tipo_item_id ?? null,
      estrategia_matching: input.estrategia_matching,
      status: "preview",
      resumo,
      payload_bruto: {
        headers: input.headers ?? [],
        rows_count: input.rows.length,
        mapeamento_colunas: input.mapeamento_colunas
      }
    })
    .select("id")
    .single();

  if (importacaoError || !importacaoData) {
    return {
      success: false,
      status: 500,
      error: "Falha ao registrar importacao_planilha (preview)."
    };
  }

  const importacaoId = String(importacaoData.id);

  const rows = linhas.map((linha) => ({
    importacao_id: importacaoId,
    indice_linha: linha.indice_linha,
    dados_originais: linha.dados_originais,
    dados_normalizados: linha.dados_normalizados,
    acao_sugerida: linha.acao_sugerida,
    status:
      linha.acao_sugerida === "conflito"
        ? "conflito"
        : linha.acao_sugerida === "erro"
          ? "erro"
          : linha.acao_sugerida === "ignorar"
            ? "ignorado"
            : "pendente",
    item_inventario_id: linha.item_inventario_id,
    match_por: linha.match_por,
    erros: linha.erros
  }));

  if (rows.length > 0) {
    const { error: linhasError } = await supabase.from("importacoes_planilha_linhas").insert(rows);
    if (linhasError) {
      return {
        success: false,
        status: 500,
        error: "Falha ao registrar linhas do preview."
      };
    }
  }

  return { success: true, data: { importacaoId } };
}

export async function gerarPreviewImportacao(
  input: PreviewInput,
  persistir = true
): Promise<ResultadoServico<PreviewResultado>> {
  const referencias = await validarReferenciasBase(input);
  if (!referencias.success) return referencias;

  const linhas: LinhaPreview[] = [];
  let totalErros = 0;
  let totalConflitos = 0;
  let totalCriar = 0;
  let totalAtualizar = 0;
  let totalIgnorar = 0;

  for (let i = 0; i < input.rows.length; i += 1) {
    const row = input.rows[i];
    const indiceLinha = i + 1;
    const normalized = normalizarLinha(row, input.mapeamento_colunas);

    const linha: LinhaPreview = {
      indice_linha: indiceLinha,
      acao_sugerida: "ignorar",
      match_por: null,
      item_inventario_id: null,
      dados_originais: row,
      dados_normalizados: normalized.dadosNormalizados,
      erros: [...normalized.erros]
    };

    const keysCount = Object.keys(normalized.dadosNormalizados).length;
    if (keysCount === 0) {
      linha.acao_sugerida = "ignorar";
      totalIgnorar += 1;
      linhas.push(linha);
      continue;
    }

    if (linha.erros.length > 0) {
      linha.acao_sugerida = "erro";
      totalErros += 1;
      linhas.push(linha);
      continue;
    }

    const matching = await detectarMatching(normalized.dadosNormalizados, input.estrategia_matching);
    if (!matching.success) return matching;

    if (matching.data.erroConflito) {
      linha.acao_sugerida = "conflito";
      linha.erros.push(matching.data.erroConflito);
      totalConflitos += 1;
      linhas.push(linha);
      continue;
    }

    linha.item_inventario_id = matching.data.itemId;
    linha.match_por = matching.data.matchPor;

    if (matching.data.itemId) {
      linha.acao_sugerida = "atualizar";
      totalAtualizar += 1;
      linhas.push(linha);
      continue;
    }

    if (input.tipo_item_id && referencias.data.tipoEhImpressora && !normalizarTexto(normalized.dadosNormalizados.patrimonio)) {
      linha.acao_sugerida = "erro";
      linha.erros.push("Para tipo_item impressora, patrimonio e obrigatorio.");
      totalErros += 1;
      linhas.push(linha);
      continue;
    }

    if (!input.aba_inventario_id || !input.tipo_item_id) {
      linha.erros.push(
        "Aba/tipo nao informados: o backend tentara resolver automaticamente na execucao."
      );
    }

    linha.acao_sugerida = "criar";
    totalCriar += 1;
    linhas.push(linha);
  }

  const totalValidas = linhas.filter((linha) => ["criar", "atualizar"].includes(linha.acao_sugerida)).length;
  const conflitosDetectados = linhas.filter((linha) => linha.acao_sugerida === "conflito");

  const previewSummary: PreviewResultado["preview"] = {
    total_linhas: input.rows.length,
    total_criar: totalCriar,
    total_atualizar: totalAtualizar,
    total_conflitos: totalConflitos,
    total_ignorar: totalIgnorar
  };

  let importacaoId: string | null = null;
  if (persistir) {
    const persist = await persistirPreviewImportacao(input, linhas, previewSummary);
    if (!persist.success) return persist;
    importacaoId = persist.data.importacaoId;
  }

  return {
    success: true,
    data: {
      importacao_id: importacaoId,
      linhas_normalizadas: linhas,
      total_validas: totalValidas,
      total_erros: totalErros,
      conflitos_detectados: conflitosDetectados,
      preview: previewSummary
    }
  };
}

type LinhaPersistida = {
  indice_linha: number;
  acao_sugerida: AcaoLinha;
  item_inventario_id: string | null;
  dados_normalizados: Record<string, unknown>;
};

function pickUpdatePayload(dados: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    "patrimonio",
    "descricao",
    "setor",
    "localizacao",
    "modelo",
    "fabricante",
    "numero_serie",
    "hostname",
    "ip",
    "status_item",
    "ativo",
    "dados_extras"
  ];

  const payload: Record<string, unknown> = {};
  for (const campo of allowed) {
    if (dados[campo] !== undefined) payload[campo] = dados[campo];
  }
  return payload;
}

function normalizarErroBanco(errorMessage: string) {
  if (errorMessage.includes("uq_itens_inventario_patrimonio_ci")) {
    return "Conflito de patrimonio na gravacao.";
  }
  if (errorMessage.includes("uq_itens_inventario_ip")) {
    return "Conflito de IP na gravacao.";
  }
  if (errorMessage.includes("uq_itens_inventario_numero_serie_ci")) {
    return "Conflito de numero_serie na gravacao.";
  }
  return "Erro de banco ao gravar item de inventario.";
}

function linhaPareceImpressora(dados: Record<string, unknown>): boolean {
  const descricao = String(dados.descricao ?? "").toLowerCase();
  const modelo = String(dados.modelo ?? "").toLowerCase();
  const tipoRecurso = String(
    (dados.dados_extras as Record<string, unknown> | undefined)?.tipo_recurso ?? ""
  ).toLowerCase();

  return (
    descricao.includes("impressora") ||
    tipoRecurso.includes("impressora") ||
    modelo.includes("lexmark") ||
    modelo.includes("ricoh") ||
    modelo.includes("xerox") ||
    modelo.includes("hp")
  );
}

async function encontrarImpressoraPorChaves(
  dados: Record<string, unknown>
): Promise<ResultadoServico<string | null>> {
  const supabase = getSupabaseServerClient();
  const patrimonio = normalizarTexto(dados.patrimonio);
  const ip = normalizarTexto(dados.ip);
  const numeroSerie = normalizarTexto(dados.numero_serie);

  if (patrimonio) {
    const { data, error } = await supabase
      .from("impressoras")
      .select("id")
      .ilike("patrimonio", patrimonio)
      .limit(1);
    if (error) {
      return { success: false, status: 500, error: "Falha ao buscar impressora por patrimonio." };
    }
    if (data && data.length > 0) return { success: true, data: String(data[0].id) };
  }

  if (ip) {
    const ipNormalizado = normalizarIp(ip);
    const { data, error } = await supabase
      .from("impressoras")
      .select("id")
      .eq("ip", ipNormalizado)
      .limit(1);
    if (error) {
      return { success: false, status: 500, error: "Falha ao buscar impressora por IP." };
    }
    if (data && data.length > 0) return { success: true, data: String(data[0].id) };
  }

  if (numeroSerie) {
    const { data, error } = await supabase
      .from("impressoras")
      .select("id")
      .ilike("numero_serie", numeroSerie)
      .limit(1);
    if (error) {
      return {
        success: false,
        status: 500,
        error: "Falha ao buscar impressora por numero de serie."
      };
    }
    if (data && data.length > 0) return { success: true, data: String(data[0].id) };
  }

  return { success: true, data: null };
}

async function tentarVincularItemComImpressora(
  itemInventarioId: string,
  dados: Record<string, unknown>
): Promise<void> {
  if (!linhaPareceImpressora(dados)) return;

  const impressoraMatch = await encontrarImpressoraPorChaves(dados);
  if (!impressoraMatch.success || !impressoraMatch.data) return;

  const supabase = getSupabaseServerClient();

  const { data: vinculoItem } = await supabase
    .from("vinculos_itens_impressoras")
    .select("item_inventario_id")
    .eq("item_inventario_id", itemInventarioId)
    .maybeSingle();
  if (vinculoItem?.item_inventario_id) return;

  const { data: vinculoImpressora } = await supabase
    .from("vinculos_itens_impressoras")
    .select("item_inventario_id")
    .eq("impressora_id", impressoraMatch.data)
    .maybeSingle();
  if (vinculoImpressora?.item_inventario_id) return;

  await supabase.from("vinculos_itens_impressoras").insert({
    item_inventario_id: itemInventarioId,
    impressora_id: impressoraMatch.data,
    origem_vinculo: "importacao"
  });
}

async function executarLinhaCriar(
  linha: LinhaPersistida,
  abaInventarioId: string,
  tipoItemId: string
): Promise<ResultadoServico<{ itemId: string }>> {
  const supabase = getSupabaseServerClient();
  const payload = pickUpdatePayload(linha.dados_normalizados);

  const { data, error } = await supabase
    .from("itens_inventario")
    .insert({
      aba_inventario_id: abaInventarioId,
      tipo_item_id: tipoItemId,
      ...payload
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      status: 409,
      error: normalizarErroBanco(error?.message ?? "Erro ao criar item.")
    };
  }

  return { success: true, data: { itemId: String(data.id) } };
}

async function executarLinhaAtualizar(
  linha: LinhaPersistida
): Promise<ResultadoServico<{ itemId: string }>> {
  if (!linha.item_inventario_id) {
    return { success: false, status: 400, error: "Linha sem item_inventario_id para atualizar." };
  }

  const payload = pickUpdatePayload(linha.dados_normalizados);
  if (Object.keys(payload).length === 0) {
    return { success: true, data: { itemId: linha.item_inventario_id } };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("itens_inventario")
    .update(payload)
    .eq("id", linha.item_inventario_id)
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      status: 409,
      error: normalizarErroBanco(error?.message ?? "Erro ao atualizar item.")
    };
  }

  return { success: true, data: { itemId: String(data.id) } };
}

async function carregarPreviewPersistido(importacaoId: string): Promise<
  ResultadoServico<{
    abaInventarioId: string | null;
    tipoItemId: string | null;
    nomeAba: string | null;
    linhas: LinhaPersistida[];
  }>
> {
  const supabase = getSupabaseServerClient();

  const { data: importacaoData, error: importacaoError } = await supabase
    .from("importacoes_planilha")
    .select("id,aba_inventario_id,tipo_item_id,nome_aba")
    .eq("id", importacaoId)
    .single();

  if (importacaoError || !importacaoData) {
    return { success: false, status: 404, error: "Importacao nao encontrada." };
  }

  const { data: linhasData, error: linhasError } = await supabase
    .from("importacoes_planilha_linhas")
    .select("indice_linha,acao_sugerida,item_inventario_id,dados_normalizados")
    .eq("importacao_id", importacaoId)
    .order("indice_linha", { ascending: true });

  if (linhasError) {
    return { success: false, status: 500, error: "Falha ao carregar linhas da importacao." };
  }

  return {
    success: true,
    data: {
      abaInventarioId: importacaoData.aba_inventario_id ?? null,
      tipoItemId: importacaoData.tipo_item_id ?? null,
      nomeAba: importacaoData.nome_aba ?? null,
      linhas: (linhasData ?? []) as LinhaPersistida[]
    }
  };
}

async function obterOuCriarAbaInventario(nomeAba: string): Promise<ResultadoServico<string>> {
  const supabase = getSupabaseServerClient();
  const nomeNormalizado = normalizarTexto(nomeAba);
  if (!nomeNormalizado) {
    return { success: false, status: 400, error: "Nome de aba invalido para resolucao automatica." };
  }

  const slug = slugify(nomeNormalizado);

  const { data: existente } = await supabase
    .from("abas_inventario")
    .select("id")
    .or(`nome.ilike.${nomeNormalizado},slug.eq.${slug}`)
    .limit(1);

  if (existente && existente.length > 0) {
    return { success: true, data: String(existente[0].id) };
  }

  const { data: criada, error } = await supabase
    .from("abas_inventario")
    .insert({
      nome: nomeNormalizado,
      slug,
      ordem: 999,
      ativo: true
    })
    .select("id")
    .single();

  if (error || !criada) {
    return { success: false, status: 500, error: "Falha ao criar aba automaticamente." };
  }

  return { success: true, data: String(criada.id) };
}

async function obterOuCriarTipoPadrao(): Promise<ResultadoServico<string>> {
  const supabase = getSupabaseServerClient();
  const { data: existente } = await supabase
    .from("tipos_itens")
    .select("id")
    .or("slug.eq.equipamento,nome.ilike.Equipamento")
    .limit(1);

  if (existente && existente.length > 0) {
    return { success: true, data: String(existente[0].id) };
  }

  const { data: criado, error } = await supabase
    .from("tipos_itens")
    .insert({
      nome: "Equipamento",
      slug: "equipamento",
      ativo: true
    })
    .select("id")
    .single();

  if (error || !criado) {
    return { success: false, status: 500, error: "Falha ao criar tipo padrao automaticamente." };
  }

  return { success: true, data: String(criado.id) };
}

async function atualizarLinhaProcessada(
  importacaoId: string,
  indiceLinha: number,
  status: "sucesso" | "erro" | "conflito" | "ignorado",
  erro: string | null,
  itemId: string | null
) {
  const supabase = getSupabaseServerClient();
  await supabase
    .from("importacoes_planilha_linhas")
    .update({
      status,
      erros: erro ? [erro] : [],
      item_inventario_id: itemId,
      processado_em: new Date().toISOString()
    })
    .eq("importacao_id", importacaoId)
    .eq("indice_linha", indiceLinha);
}

async function finalizarImportacao(
  importacaoId: string,
  resumo: ResultadoExecucao
): Promise<void> {
  const supabase = getSupabaseServerClient();
  await supabase
    .from("importacoes_planilha")
    .update({
      status: resumo.total_erros > 0 ? "erro" : "executada",
      resumo,
      executado_em: new Date().toISOString()
    })
    .eq("id", importacaoId);
}

export async function executarImportacaoInventario(
  input: ExecutarInput
): Promise<ResultadoServico<ResultadoExecucao>> {
  let importacaoId: string | null = null;
  let abaInventarioId: string | null = null;
  let tipoItemId: string | null = null;
  let nomeAba: string | null = null;
  let linhas: LinhaPersistida[] = [];

  if ("importacao_id" in input && input.importacao_id) {
    importacaoId = input.importacao_id;
    const carregada = await carregarPreviewPersistido(importacaoId);
    if (!carregada.success) return carregada;
    abaInventarioId = carregada.data.abaInventarioId;
    tipoItemId = carregada.data.tipoItemId;
    nomeAba = carregada.data.nomeAba;
    linhas = carregada.data.linhas;
  } else {
    const rawInput = input as PreviewInput;
    const preview = await gerarPreviewImportacao(rawInput, true);
    if (!preview.success) return preview;
    importacaoId = preview.data.importacao_id;
    abaInventarioId = rawInput.aba_inventario_id ?? null;
    tipoItemId = rawInput.tipo_item_id ?? null;
    nomeAba = rawInput.nome_aba ?? null;
    linhas = preview.data.linhas_normalizadas.map((linha) => ({
      indice_linha: linha.indice_linha,
      acao_sugerida: linha.acao_sugerida,
      item_inventario_id: linha.item_inventario_id,
      dados_normalizados: linha.dados_normalizados
    }));
  }

  const exec: ResultadoExecucao = {
    importacao_id: importacaoId,
    total_processadas: 0,
    total_criadas: 0,
    total_atualizadas: 0,
    total_conflitos: 0,
    total_erros: 0,
    total_ignoradas: 0,
    erros: []
  };

  const possuiCriacao = linhas.some((linha) => linha.acao_sugerida === "criar");
  if (possuiCriacao && !abaInventarioId && nomeAba) {
    const abaAuto = await obterOuCriarAbaInventario(nomeAba);
    if (!abaAuto.success) return abaAuto;
    abaInventarioId = abaAuto.data;
  }

  if (possuiCriacao && !tipoItemId) {
    const tipoAuto = await obterOuCriarTipoPadrao();
    if (!tipoAuto.success) return tipoAuto;
    tipoItemId = tipoAuto.data;
  }

  for (const linha of linhas) {
    exec.total_processadas += 1;

    if (linha.acao_sugerida === "ignorar") {
      exec.total_ignoradas += 1;
      if (importacaoId) {
        await atualizarLinhaProcessada(importacaoId, linha.indice_linha, "ignorado", null, linha.item_inventario_id);
      }
      continue;
    }

    if (linha.acao_sugerida === "erro" || linha.acao_sugerida === "conflito") {
      if (linha.acao_sugerida === "erro") exec.total_erros += 1;
      if (linha.acao_sugerida === "conflito") exec.total_conflitos += 1;
      exec.erros.push({
        indice_linha: linha.indice_linha,
        erro: `Linha marcada como ${linha.acao_sugerida} no preview.`
      });
      if (importacaoId) {
        await atualizarLinhaProcessada(
          importacaoId,
          linha.indice_linha,
          linha.acao_sugerida === "erro" ? "erro" : "conflito",
          `Linha marcada como ${linha.acao_sugerida} no preview.`,
          linha.item_inventario_id
        );
      }
      continue;
    }

    if (linha.acao_sugerida === "criar") {
      if (!abaInventarioId || !tipoItemId) {
        exec.total_erros += 1;
        const erro = "Sem aba_inventario_id/tipo_item_id para criar novos itens.";
        exec.erros.push({ indice_linha: linha.indice_linha, erro });
        if (importacaoId) {
          await atualizarLinhaProcessada(importacaoId, linha.indice_linha, "erro", erro, null);
        }
        continue;
      }

      const createResult = await executarLinhaCriar(linha, abaInventarioId, tipoItemId);
      if (!createResult.success) {
        exec.total_erros += 1;
        exec.erros.push({
          indice_linha: linha.indice_linha,
          erro: createResult.error
        });
        if (importacaoId) {
          await atualizarLinhaProcessada(
            importacaoId,
            linha.indice_linha,
            "erro",
            createResult.error,
            null
          );
        }
        continue;
      }

      exec.total_criadas += 1;
      await tentarVincularItemComImpressora(createResult.data.itemId, linha.dados_normalizados);
      if (importacaoId) {
        await atualizarLinhaProcessada(
          importacaoId,
          linha.indice_linha,
          "sucesso",
          null,
          createResult.data.itemId
        );
      }
      continue;
    }

    const updateResult = await executarLinhaAtualizar(linha);
    if (!updateResult.success) {
      exec.total_erros += 1;
      exec.erros.push({
        indice_linha: linha.indice_linha,
        erro: updateResult.error
      });
      if (importacaoId) {
        await atualizarLinhaProcessada(
          importacaoId,
          linha.indice_linha,
          "erro",
          updateResult.error,
          linha.item_inventario_id
        );
      }
      continue;
    }

    exec.total_atualizadas += 1;
    await tentarVincularItemComImpressora(updateResult.data.itemId, linha.dados_normalizados);
    if (importacaoId) {
      await atualizarLinhaProcessada(
        importacaoId,
        linha.indice_linha,
        "sucesso",
        null,
        updateResult.data.itemId
      );
    }
  }

  if (importacaoId) {
    await finalizarImportacao(importacaoId, exec);
  }

  return { success: true, data: exec };
}
