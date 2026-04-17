import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sincronizarCategoriaCompletaNaPlanilha } from "@/services/googleSheetsSyncService";

export type ResultadoServico<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

type TipoCampo = "texto" | "numero" | "booleano" | "data" | "ip" | "patrimonio" | "lista";
type TipoSemantico =
  | "nenhum"
  | "patrimonio"
  | "ip"
  | "hostname"
  | "setor"
  | "localizacao"
  | "modelo"
  | "fabricante"
  | "numero_serie"
  | "impressora_modelo"
  | "impressora_patrimonio"
  | "impressora_ip";

type CampoDefinicao = {
  nome_campo_exibicao: string;
  chave_campo?: string;
  tipo_campo: TipoCampo;
  tipo_semantico: TipoSemantico;
  obrigatorio: boolean;
  unico: boolean;
  ordem: number;
  opcoes_json?: string[] | null;
};

type PreviewInput = {
  modo_importacao?: "itens" | "dinamico";
  nome_arquivo: string;
  nome_aba?: string | null;
  headers?: string[];
  rows: Array<Record<string, unknown>>;
  mapeamento_colunas: Record<string, string>;
  aba_inventario_id?: string | null;
  categoria_id?: string | null;
  categoria_nova?: {
    nome: string;
    descricao?: string | null;
    ordem?: number;
  } | null;
  campos_definicao?: CampoDefinicao[];
};

type LinhaPreview = {
  indice_linha: number;
  acao_sugerida: "criar" | "erro" | "ignorar";
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
  campos_resolvidos: CampoDefinicao[];
};

type ResultadoExecucao = {
  importacao_id: string | null;
  total_processadas: number;
  total_criadas: number;
  total_atualizadas: number;
  total_conflitos: number;
  total_erros: number;
  total_ignoradas: number;
  erros: Array<{ indice_linha: number; erro: string }>;
  categoria_id: string | null;
};

async function atualizarStatusLinhaImportacao(
  importacaoId: string | null,
  indiceLinha: number,
  payload: {
    status: "sucesso" | "erro" | "conflito" | "ignorado";
    erros?: string[];
    item_inventario_id?: string | null;
  }
) {
  if (!importacaoId) return;

  const supabase = getSupabaseServerClient();
  const updatePayload: Record<string, unknown> = {
    status: payload.status,
    processado_em: new Date().toISOString()
  };

  if (payload.erros) {
    updatePayload.erros = payload.erros;
  }

  if (payload.item_inventario_id !== undefined) {
    updatePayload.item_inventario_id = payload.item_inventario_id;
  }

  const { error } = await supabase
    .from("importacoes_planilha_linhas")
    .update(updatePayload)
    .eq("importacao_id", importacaoId)
    .eq("indice_linha", indiceLinha);

  if (error) {
    console.warn("[importacao-dinamica] Falha ao atualizar status da linha", {
      importacao_id: importacaoId,
      indice_linha: indiceLinha,
      status: payload.status,
      error
    });
  }
}

const campoSemanticoPorChave: Array<{ hint: string; semantico: TipoSemantico; tipo: TipoCampo }> = [
  { hint: "impressora_ip", semantico: "impressora_ip", tipo: "ip" },
  { hint: "impressora_patrimonio", semantico: "impressora_patrimonio", tipo: "patrimonio" },
  { hint: "impressora_modelo", semantico: "impressora_modelo", tipo: "texto" },
  { hint: "patrimonio", semantico: "patrimonio", tipo: "patrimonio" },
  { hint: "ip", semantico: "ip", tipo: "ip" },
  { hint: "hostname", semantico: "hostname", tipo: "texto" },
  { hint: "setor", semantico: "setor", tipo: "texto" },
  { hint: "localizacao", semantico: "localizacao", tipo: "texto" },
  { hint: "modelo", semantico: "modelo", tipo: "texto" },
  { hint: "fabricante", semantico: "fabricante", tipo: "texto" },
  { hint: "numero_serie", semantico: "numero_serie", tipo: "texto" }
];

function normalizarTexto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (["null", "none", "n/a", "na", "-", "desconhecido", "unknown"].includes(text.toLowerCase())) {
    return null;
  }
  return text;
}

function normalizarChave(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function chaveTecnica(value: string) {
  const base = normalizarChave(value).replace(/[^a-z0-9_]/g, "");
  const prefixed = base.startsWith("nm_") ? base : `nm_${base}`;
  const sanitized = prefixed.replace(/_+/g, "_").slice(0, 63);
  return sanitized.length >= 2 ? sanitized : "nm_campo";
}

const gruposAliasChaveCampo = [
  ["nm_ip", "nm_ip_do_equipamento"],
  ["nm_numero_serie", "nm_n_serie", "nm_serie"],
  ["nm_hostname", "nm_nome_impressora_servidor", "nm_nome_servidor"],
  ["nm_setor", "nm_unidades", "nm_unidade"],
  ["nm_localizacao", "nm_local"]
] as const;

function chavesEquivalentes(chave: string) {
  const alvo = chaveTecnica(chave);
  const tentativas = new Set<string>([alvo]);

  for (const grupo of gruposAliasChaveCampo) {
    const grupoNormalizado = grupo.map((item) => chaveTecnica(item));
    if (grupoNormalizado.includes(alvo)) {
      for (const item of grupoNormalizado) tentativas.add(item);
    }
  }

  return Array.from(tentativas);
}

function syncPlanilhaEstrito() {
  return process.env.GOOGLE_SHEETS_SYNC_ENABLED === "true" && process.env.GOOGLE_SHEETS_SYNC_STRICT === "true";
}

function inferirCampo(header: string, destino?: string): CampoDefinicao {
  const chave = chaveTecnica(destino && destino !== "dados_extras" ? destino : header);
  const found = campoSemanticoPorChave.find((entry) => chave.includes(entry.hint));
  return {
    nome_campo_exibicao: header,
    chave_campo: chave,
    tipo_campo: found?.tipo ?? "texto",
    tipo_semantico: found?.semantico ?? "nenhum",
    obrigatorio: false,
    unico: found?.semantico === "patrimonio" || found?.semantico === "ip",
    ordem: 100,
    opcoes_json: null
  };
}

function montarCampos(input: PreviewInput): CampoDefinicao[] {
  if (input.campos_definicao && input.campos_definicao.length > 0) {
    const dedupFromInput = new Map<string, CampoDefinicao>();
    for (let i = 0; i < input.campos_definicao.length; i += 1) {
      const campo = input.campos_definicao[i];
      const nome = normalizarTexto(campo.nome_campo_exibicao) ?? `Campo ${i + 1}`;
      let chave = chaveTecnica(campo.chave_campo ?? nome);
      let suffix = 2;
      while (dedupFromInput.has(chave)) {
        chave = `${chaveTecnica(campo.chave_campo ?? nome)}_${suffix}`.slice(0, 63);
        suffix += 1;
      }
      dedupFromInput.set(chave, {
        ...campo,
        nome_campo_exibicao: nome,
        chave_campo: chave,
        ordem: campo.ordem ?? i + 1
      });
    }
    return Array.from(dedupFromInput.values());
  }

  const headers = input.headers ?? Object.keys(input.rows[0] ?? {});
  const campos = headers.map((header, index) => {
    const destino = input.mapeamento_colunas?.[header];
    const campo = inferirCampo(header, destino);
    return { ...campo, ordem: index + 1 };
  });

  const dedup = new Map<string, CampoDefinicao>();
  for (const campo of campos) {
    const chave = chaveTecnica(campo.chave_campo ?? campo.nome_campo_exibicao);
    if (!dedup.has(chave)) {
      dedup.set(chave, { ...campo, chave_campo: chave });
    }
  }
  return Array.from(dedup.values());
}

function normalizarValorPorTipo(tipo: TipoCampo, raw: unknown): { valor: unknown; erro?: string } {
  const text = normalizarTexto(raw);
  if (text === null) return { valor: null };

  if (tipo === "numero") {
    const n = Number(text);
    if (Number.isNaN(n)) return { valor: null, erro: `Valor '${text}' invalido para numero.` };
    return { valor: n };
  }
  if (tipo === "booleano") {
    const lower = text.toLowerCase();
    if (["true", "1", "sim", "s"].includes(lower)) return { valor: true };
    if (["false", "0", "nao", "n"].includes(lower)) return { valor: false };
    return { valor: null, erro: `Valor '${text}' invalido para booleano.` };
  }
  if (tipo === "ip") {
    const ip = text.replace(/\/32$/, "");
    const ipv4 =
      /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
    if (!ipv4.test(ip)) return { valor: null, erro: `IP '${text}' invalido.` };
    return { valor: ip };
  }
  if (tipo === "data") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { valor: null, erro: `Data '${text}' fora do padrao YYYY-MM-DD.` };
    return { valor: text };
  }

  return { valor: text };
}

function linhaNormalizada(
  row: Record<string, unknown>,
  campos: CampoDefinicao[],
  headers: string[],
  mapeamento: Record<string, string>
): { dados: Record<string, unknown>; erros: string[] } {
  const dados: Record<string, unknown> = {};
  const erros: string[] = [];

  for (const campo of campos) {
    const chaveCampo = chaveTecnica(campo.chave_campo ?? campo.nome_campo_exibicao);
    let raw: unknown = null;
    for (const header of headers) {
      const destino = mapeamento[header];
      const destinoNormalizado = normalizarChave(destino ?? header);
      const chaveCampoNormalizada = normalizarChave(chaveCampo);
      if (
        destinoNormalizado === chaveCampoNormalizada ||
        `nm_${destinoNormalizado}` === chaveCampoNormalizada
      ) {
        raw = row[header];
        break;
      }
    }

    const normalized = normalizarValorPorTipo(campo.tipo_campo, raw);
    if (normalized.erro) erros.push(`${campo.nome_campo_exibicao}: ${normalized.erro}`);
    if (campo.obrigatorio && (normalized.valor === null || normalized.valor === "")) {
      erros.push(`${campo.nome_campo_exibicao}: campo obrigatorio nao preenchido.`);
    }

    dados[chaveCampo] = normalized.valor;
  }

  return { dados, erros };
}

async function persistirPreview(input: PreviewInput, linhas: LinhaPreview[], campos: CampoDefinicao[]) {
  const supabase = getSupabaseServerClient();
  const resumo = {
    total_linhas: linhas.length,
    total_criar: linhas.filter((l) => l.acao_sugerida === "criar").length,
    total_atualizar: 0,
    total_conflitos: 0,
    total_ignorar: linhas.filter((l) => l.acao_sugerida === "ignorar").length
  };

  const { data: imp, error: impError } = await supabase
    .from("importacoes_planilha")
    .insert({
      nome_arquivo: input.nome_arquivo,
      nome_aba: input.nome_aba ?? null,
      aba_inventario_id: input.aba_inventario_id ?? null,
      tipo_item_id: null,
      estrategia_matching: ["patrimonio", "ip", "numero_serie"],
      status: "preview",
      resumo,
      payload_bruto: {
        modo_importacao: "dinamico",
        categoria_id: input.categoria_id ?? null,
        categoria_nova: input.categoria_nova ?? null,
        campos_definicao: campos
      }
    })
    .select("id")
    .single();

  if (impError || !imp) {
    console.error("[importacao-dinamica] Falha ao persistir preview em importacoes_planilha", {
      error: impError,
      nome_arquivo: input.nome_arquivo,
      nome_aba: input.nome_aba,
      aba_inventario_id: input.aba_inventario_id,
      categoria_id: input.categoria_id
    });
    return {
      success: false as const,
      error: `Falha ao persistir preview: ${impError?.message ?? "erro desconhecido"}`,
      status: 500
    };
  }

  const linhasPersist = linhas.map((linha) => ({
    importacao_id: String(imp.id),
    indice_linha: linha.indice_linha,
    dados_originais: linha.dados_originais,
    dados_normalizados: linha.dados_normalizados,
    acao_sugerida: linha.acao_sugerida,
    status: linha.acao_sugerida === "erro" ? "erro" : linha.acao_sugerida === "ignorar" ? "ignorado" : "pendente",
    item_inventario_id: null,
    match_por: null,
    erros: linha.erros
  }));

  if (linhasPersist.length > 0) {
    const { error: linhasError } = await supabase.from("importacoes_planilha_linhas").insert(linhasPersist);
    if (linhasError) {
      console.error("[importacao-dinamica] Falha ao persistir linhas do preview", {
        error: linhasError,
        importacao_id: imp.id,
        total_linhas: linhasPersist.length
      });
      return {
        success: false as const,
        error: `Falha ao persistir linhas do preview: ${linhasError.message}`,
        status: 500
      };
    }
  }

  return { success: true as const, data: String(imp.id) };
}

export async function gerarPreviewImportacaoDinamica(input: PreviewInput): Promise<ResultadoServico<PreviewResultado>> {
  const headers = input.headers ?? Object.keys(input.rows[0] ?? {});
  const campos = montarCampos(input);
  const linhas: LinhaPreview[] = [];

  for (let i = 0; i < input.rows.length; i += 1) {
    const row = input.rows[i];
    const normalizada = linhaNormalizada(row, campos, headers, input.mapeamento_colunas ?? {});
    const temValor = Object.values(normalizada.dados).some((v) => v !== null && v !== "");
    linhas.push({
      indice_linha: i + 1,
      acao_sugerida: normalizada.erros.length > 0 ? "erro" : temValor ? "criar" : "ignorar",
      dados_originais: row,
      dados_normalizados: normalizada.dados,
      erros: normalizada.erros
    });
  }

  const persist = await persistirPreview(input, linhas, campos);
  if (!persist.success) return persist;

  return {
    success: true,
    data: {
      importacao_id: persist.data,
      linhas_normalizadas: linhas,
      total_validas: linhas.filter((l) => l.acao_sugerida === "criar").length,
      total_erros: linhas.filter((l) => l.acao_sugerida === "erro").length,
      conflitos_detectados: [],
      preview: {
        total_linhas: linhas.length,
        total_criar: linhas.filter((l) => l.acao_sugerida === "criar").length,
        total_atualizar: 0,
        total_conflitos: 0,
        total_ignorar: linhas.filter((l) => l.acao_sugerida === "ignorar").length
      },
      campos_resolvidos: campos
    }
  };
}

async function resolverAba(abaId: string | null, nomeAba: string | null): Promise<ResultadoServico<string>> {
  const supabase = getSupabaseServerClient();
  if (abaId) return { success: true, data: abaId };

  const nome = normalizarTexto(nomeAba) ?? "Importacao";
  const slug = normalizarChave(nome).replace(/_+/g, "-");
  const { data: ex } = await supabase.from("abas_inventario").select("id").or(`nome.ilike.${nome},slug.eq.${slug}`).limit(1);
  if (ex && ex.length > 0) return { success: true, data: String(ex[0].id) };

  const { data: created, error } = await supabase
    .from("abas_inventario")
    .insert({ nome, slug, ordem: 999, ativo: true })
    .select("id")
    .single();
  if (error || !created) return { success: false, error: "Falha ao criar aba automaticamente.", status: 500 };
  return { success: true, data: String(created.id) };
}

async function resolverCategoria(
  abaInventarioId: string,
  payload: { categoria_id?: string | null; categoria_nova?: { nome: string; descricao?: string | null; ordem?: number } | null; campos_definicao: CampoDefinicao[] }
): Promise<ResultadoServico<string>> {
  const supabase = getSupabaseServerClient();
  let categoriaIdEfetiva = payload.categoria_id ?? null;

  // Regra do schema: apenas 1 categoria ativa por aba.
  // Se nenhuma categoria foi informada, reaproveita a categoria ativa existente.
  if (!categoriaIdEfetiva) {
    const { data: categoriaAtivaExistente, error: categoriaAtivaError } = await supabase
      .from("categorias_inventario")
      .select("id")
      .eq("aba_inventario_id", abaInventarioId)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (categoriaAtivaError) {
      return {
        success: false,
        error: "Falha ao verificar categoria ativa da aba.",
        status: 500
      };
    }

    categoriaIdEfetiva = categoriaAtivaExistente?.id ? String(categoriaAtivaExistente.id) : null;
  }

  if (categoriaIdEfetiva) {
    const { data: categoriaExistente, error: categoriaError } = await supabase
      .from("categorias_inventario")
      .select("id")
      .eq("id", categoriaIdEfetiva)
      .single();

    if (categoriaError || !categoriaExistente) {
      return { success: false, error: "Categoria informada nao encontrada.", status: 404 };
    }

    const { count: totalCamposAtivos, error: countError } = await supabase
      .from("categoria_campos")
      .select("id", { head: true, count: "exact" })
      .eq("categoria_id", categoriaIdEfetiva)
      .eq("ativo", true);

    if (countError) {
      return { success: false, error: "Falha ao validar campos da categoria existente.", status: 500 };
    }

    if ((totalCamposAtivos ?? 0) === 0 && payload.campos_definicao.length > 0) {
      const camposInsert = payload.campos_definicao.map((campo, idx) => ({
        categoria_id: categoriaIdEfetiva,
        nome_campo_exibicao: campo.nome_campo_exibicao,
        chave_campo: chaveTecnica(campo.chave_campo ?? campo.nome_campo_exibicao),
        tipo_campo: campo.tipo_campo,
        tipo_semantico: campo.tipo_semantico,
        obrigatorio: campo.obrigatorio,
        unico: campo.unico,
        ordem: campo.ordem ?? idx + 1,
        opcoes_json: campo.tipo_campo === "lista" ? campo.opcoes_json ?? [] : null,
        ativo: true
      }));

      if (camposInsert.length > 0) {
        const { error: camposError } = await supabase.from("categoria_campos").insert(camposInsert);
        if (camposError) {
          return {
            success: false,
            error: "Categoria existente sem campos. Falha ao criar campos sugeridos da importacao.",
            status: 500
          };
        }
      }
    }

    const { count: totalCamposDepois, error: countDepoisError } = await supabase
      .from("categoria_campos")
      .select("id", { head: true, count: "exact" })
      .eq("categoria_id", categoriaIdEfetiva)
      .eq("ativo", true);

    if (countDepoisError) {
      return { success: false, error: "Falha ao validar campos ativos da categoria.", status: 500 };
    }
    if ((totalCamposDepois ?? 0) === 0) {
      return {
        success: false,
        status: 422,
        error: "Categoria sem campos ativos. Defina os campos antes de importar linhas."
      };
    }

    return { success: true, data: categoriaIdEfetiva };
  }

  const nome = normalizarTexto(payload.categoria_nova?.nome) ?? "Categoria importada";
  const slug = normalizarChave(nome).replace(/_+/g, "-");
  const { data: created, error } = await supabase
    .from("categorias_inventario")
    .insert({
      aba_inventario_id: abaInventarioId,
      nome,
      slug,
      descricao: payload.categoria_nova?.descricao ?? null,
      ordem: payload.categoria_nova?.ordem ?? 100,
      origem_tipo: "importacao",
      ativo: true
    })
    .select("id")
    .single();
  if (error || !created) return { success: false, error: "Falha ao criar categoria da importacao.", status: 500 };

  const camposInsert = payload.campos_definicao.map((campo, idx) => ({
    categoria_id: String(created.id),
    nome_campo_exibicao: campo.nome_campo_exibicao,
    chave_campo: chaveTecnica(campo.chave_campo ?? campo.nome_campo_exibicao),
    tipo_campo: campo.tipo_campo,
    tipo_semantico: campo.tipo_semantico,
    obrigatorio: campo.obrigatorio,
    unico: campo.unico,
    ordem: campo.ordem ?? idx + 1,
    opcoes_json: campo.tipo_campo === "lista" ? campo.opcoes_json ?? [] : null,
    ativo: true
  }));
  if (camposInsert.length > 0) {
    const { error: camposError } = await supabase.from("categoria_campos").insert(camposInsert);
    if (camposError) return { success: false, error: "Categoria criada, mas falhou ao criar campos.", status: 500 };
  }

  return { success: true, data: String(created.id) };
}

export async function executarImportacaoDinamica(
  input:
    | { importacao_id: string; modo_importacao?: "itens" | "dinamico" }
    | ({ importacao_id?: string } & PreviewInput)
): Promise<ResultadoServico<ResultadoExecucao>> {
  const supabase = getSupabaseServerClient();
  const previewInput = "nome_arquivo" in input ? (input as PreviewInput) : null;

  let importacaoId = input.importacao_id ?? null;
  let nomeAba = previewInput?.nome_aba ?? null;
  let abaId = previewInput?.aba_inventario_id ?? null;
  let categoriaId = previewInput?.categoria_id ?? null;
  let categoriaNova = previewInput?.categoria_nova ?? null;
  let campos = previewInput?.campos_definicao ?? [];
  let linhas: Array<{
    indice_linha: number;
    acao_sugerida: "criar" | "erro" | "ignorar";
    dados_normalizados: Record<string, unknown>;
    erros: string[];
  }> = [];

  if (importacaoId) {
    const { data: importacao, error: importacaoError } = await supabase
      .from("importacoes_planilha")
      .select("id,nome_aba,aba_inventario_id,payload_bruto")
      .eq("id", importacaoId)
      .single();
    if (importacaoError || !importacao) return { success: false, error: "Importacao nao encontrada.", status: 404 };

    const payload = (importacao.payload_bruto ?? {}) as Record<string, unknown>;
    nomeAba = (importacao.nome_aba as string | null) ?? nomeAba;
    abaId = (importacao.aba_inventario_id as string | null) ?? abaId;
    categoriaId = (payload.categoria_id as string | null) ?? categoriaId;
    categoriaNova = (payload.categoria_nova as { nome: string; descricao?: string | null; ordem?: number } | null) ?? categoriaNova;
    campos = (payload.campos_definicao as CampoDefinicao[] | undefined) ?? campos;

    const { data: linhasData, error: linhasError } = await supabase
      .from("importacoes_planilha_linhas")
      .select("indice_linha,acao_sugerida,dados_normalizados,erros")
      .eq("importacao_id", importacaoId)
      .order("indice_linha", { ascending: true });
    if (linhasError) return { success: false, error: "Falha ao carregar linhas da importacao.", status: 500 };

    linhas = (linhasData ?? []).map((l) => ({
      indice_linha: Number(l.indice_linha),
      acao_sugerida: String(l.acao_sugerida) as "criar" | "erro" | "ignorar",
      dados_normalizados: (l.dados_normalizados ?? {}) as Record<string, unknown>,
      erros: Array.isArray(l.erros)
        ? l.erros.filter((e): e is string => typeof e === "string" && e.trim().length > 0)
        : []
    }));
  } else {
    if (!previewInput) {
      return {
        success: false,
        status: 400,
        error: "Payload insuficiente para executar importacao dinamica sem importacao_id."
      };
    }
    const preview = await gerarPreviewImportacaoDinamica(previewInput);
    if (!preview.success) return preview as ResultadoServico<ResultadoExecucao>;
    importacaoId = preview.data.importacao_id;
    campos = preview.data.campos_resolvidos;
    linhas = preview.data.linhas_normalizadas.map((l) => ({
      indice_linha: l.indice_linha,
      acao_sugerida: l.acao_sugerida,
      dados_normalizados: l.dados_normalizados,
      erros: l.erros
    }));
  }

  const abaResult = await resolverAba(abaId, nomeAba);
  if (!abaResult.success) return abaResult as ResultadoServico<ResultadoExecucao>;

  const categoriaResult = await resolverCategoria(abaResult.data, {
    categoria_id: categoriaId,
    categoria_nova: categoriaNova,
    campos_definicao: campos
  });
  if (!categoriaResult.success) return categoriaResult as ResultadoServico<ResultadoExecucao>;

  const categoriaFinalId = categoriaResult.data;
  const { data: camposCategoria, error: camposCategoriaError } = await supabase
    .from("categoria_campos")
    .select("id,chave_campo,tipo_campo,tipo_semantico")
    .eq("categoria_id", categoriaFinalId)
    .eq("ativo", true);
  if (camposCategoriaError) return { success: false, error: "Falha ao carregar campos da categoria.", status: 500 };

  type CampoCategoriaResolvido = {
    id: string;
    tipo_campo: TipoCampo;
    tipo_semantico: TipoSemantico;
  };

  const campoByKey = new Map(
    (camposCategoria ?? []).map((c) => [
      String(c.chave_campo),
      { id: String(c.id), tipo_campo: String(c.tipo_campo) as TipoCampo, tipo_semantico: String(c.tipo_semantico) as TipoSemantico }
    ])
  );

  const campoBySemantico = new Map<TipoSemantico, CampoCategoriaResolvido>();
  for (const campo of campoByKey.values()) {
    if (campo.tipo_semantico === "nenhum") continue;
    if (!campoBySemantico.has(campo.tipo_semantico)) {
      campoBySemantico.set(campo.tipo_semantico, campo);
    }
  }

  const semanticoPreviewByKey = new Map<string, TipoSemantico>(
    campos.map((campo) => [
      chaveTecnica(campo.chave_campo ?? campo.nome_campo_exibicao),
      campo.tipo_semantico
    ])
  );

  const resolverCampoCategoria = (chaveEntrada: string): CampoCategoriaResolvido | null => {
    for (const chaveCandidata of chavesEquivalentes(chaveEntrada)) {
      const campo = campoByKey.get(chaveCandidata);
      if (campo) return campo;
    }

    const semantico = semanticoPreviewByKey.get(chaveTecnica(chaveEntrada));
    if (semantico && semantico !== "nenhum") {
      const campoPorSemantico = campoBySemantico.get(semantico);
      if (campoPorSemantico) return campoPorSemantico;
    }

    return null;
  };

  const resumo: ResultadoExecucao = {
    importacao_id: importacaoId,
    total_processadas: 0,
    total_criadas: 0,
    total_atualizadas: 0,
    total_conflitos: 0,
    total_erros: 0,
    total_ignoradas: 0,
    erros: [],
    categoria_id: categoriaFinalId
  };

  for (const linha of linhas) {
    resumo.total_processadas += 1;
    if (linha.acao_sugerida === "ignorar") {
      resumo.total_ignoradas += 1;
      await atualizarStatusLinhaImportacao(importacaoId, linha.indice_linha, {
        status: "ignorado"
      });
      continue;
    }
    if (linha.acao_sugerida === "erro") {
      resumo.total_erros += 1;
      const erroDetalhado = linha.erros.length > 0 ? linha.erros.join(" | ") : "Linha marcada como erro no preview.";
      resumo.erros.push({ indice_linha: linha.indice_linha, erro: erroDetalhado });
      await atualizarStatusLinhaImportacao(importacaoId, linha.indice_linha, {
        status: "erro",
        erros: linha.erros.length > 0 ? linha.erros : [erroDetalhado]
      });
      continue;
    }

    const { data: novaLinha, error: novaLinhaError } = await supabase
      .from("linhas_inventario")
      .insert({
        aba_inventario_id: abaResult.data,
        categoria_id: categoriaFinalId,
        origem_tipo: "importacao",
        origem_sheet: nomeAba,
        origem_indice_linha: String(linha.indice_linha),
        ativo: true
      })
      .select("id")
      .single();
    if (novaLinhaError || !novaLinha) {
      resumo.total_erros += 1;
      resumo.erros.push({ indice_linha: linha.indice_linha, erro: "Falha ao criar linha de inventario." });
      await atualizarStatusLinhaImportacao(importacaoId, linha.indice_linha, {
        status: "erro",
        erros: ["Falha ao criar linha de inventario."]
      });
      continue;
    }

    const insertsValoresByCampoId = new Map<string, Record<string, unknown>>();

    for (const [chave, valor] of Object.entries(linha.dados_normalizados)) {
      const campo = resolverCampoCategoria(chave);
      if (!campo || valor === null || valor === "") continue;
      if (insertsValoresByCampoId.has(campo.id)) continue;

      insertsValoresByCampoId.set(campo.id, {
        linha_id: String(novaLinha.id),
        campo_id: campo.id,
        valor_texto:
          campo.tipo_campo === "texto" || campo.tipo_campo === "lista" || campo.tipo_campo === "patrimonio"
            ? String(valor)
            : null,
        valor_numero: campo.tipo_campo === "numero" ? Number(valor) : null,
        valor_booleano: campo.tipo_campo === "booleano" ? Boolean(valor) : null,
        valor_data: campo.tipo_campo === "data" ? String(valor) : null,
        valor_ip: campo.tipo_campo === "ip" ? String(valor) : null,
        valor_json: null
      });
    }

    const insertsValores = Array.from(insertsValoresByCampoId.values());

    if (insertsValores.length > 0) {
      const { error: insertValoresError } = await supabase
        .from("linha_valores_campos")
        .insert(insertsValores);
      if (insertValoresError) {
        resumo.total_erros += 1;
        resumo.erros.push({ indice_linha: linha.indice_linha, erro: "Falha ao inserir valores da linha." });
        await supabase.from("linhas_inventario").delete().eq("id", String(novaLinha.id));
        await atualizarStatusLinhaImportacao(importacaoId, linha.indice_linha, {
          status: "erro",
          erros: ["Falha ao inserir valores da linha."]
        });
        continue;
      }
    }

    resumo.total_criadas += 1;
    await atualizarStatusLinhaImportacao(importacaoId, linha.indice_linha, {
      status: "sucesso"
    });
  }

  if (importacaoId) {
    await supabase
      .from("importacoes_planilha")
      .update({
        status: resumo.total_erros > 0 ? "erro" : "executada",
        resumo,
        executado_em: new Date().toISOString()
      })
      .eq("id", importacaoId);
  }

  try {
    const syncPlanilha = await sincronizarCategoriaCompletaNaPlanilha(categoriaFinalId);
    if (!syncPlanilha.success) {
      const mensagem = `Importacao concluida, mas falhou sincronizacao Google Sheets: ${syncPlanilha.error}`;
      if (syncPlanilhaEstrito()) {
        return { success: false, status: syncPlanilha.status ?? 502, error: mensagem };
      }
      console.warn(mensagem);
    }
  } catch (error) {
    const mensagem = `Importacao concluida, mas ocorreu excecao na sincronizacao Google Sheets: ${error instanceof Error ? error.message : "erro desconhecido"}`;
    if (syncPlanilhaEstrito()) {
      return { success: false, status: 502, error: mensagem };
    }
    console.warn(mensagem);
  }

  return { success: true, data: resumo };
}
