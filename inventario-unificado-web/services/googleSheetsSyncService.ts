import { google } from "googleapis";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ResultadoServico<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

type CategoriaRow = {
  id: string;
  nome: string;
  planilha_aba_nome: string | null;
  planilha_aba_id: number | null;
};

type CampoRow = {
  id: string;
  nome_campo_exibicao: string;
  ordem: number;
  ativo: boolean;
};

type LinhaRow = {
  id: string;
  categoria_id: string;
  dados_extras: Record<string, unknown> | null;
  ativo: boolean;
};

type ValorLinhaRow = {
  campo_id: string;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_booleano: boolean | null;
  valor_data: string | null;
  valor_ip: string | null;
  valor_json: Record<string, unknown> | unknown[] | null;
};

function erroColunaAusente(errorMessage?: string | null) {
  if (!errorMessage) return false;
  const msg = errorMessage.toLowerCase();
  return msg.includes("column") && msg.includes("planilha_aba_");
}

function syncHabilitado() {
  return process.env.GOOGLE_SHEETS_SYNC_ENABLED === "true";
}

function modoEstrito() {
  return process.env.GOOGLE_SHEETS_SYNC_STRICT === "true";
}

function sheetTitle(nomeCategoria: string) {
  const clean = nomeCategoria.replace(/[:\\/?*\[\]]/g, " ").trim();
  return (clean || "Categoria").slice(0, 100);
}

function toCell(valor: ValorLinhaRow) {
  if (valor.valor_texto !== null) return String(valor.valor_texto);
  if (valor.valor_numero !== null) return String(valor.valor_numero);
  if (valor.valor_booleano !== null) return valor.valor_booleano ? "true" : "false";
  if (valor.valor_data !== null) return String(valor.valor_data);
  if (valor.valor_ip !== null) return String(valor.valor_ip);
  if (valor.valor_json !== null) return JSON.stringify(valor.valor_json);
  return "";
}

function colunaAte(indice: number) {
  let n = indice + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function getSheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!spreadsheetId || !email || !privateKey) {
    return {
      ok: false as const,
      error:
        "Configuracao Google Sheets ausente. Defina GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    };
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const sheets = google.sheets({ version: "v4", auth });
  return { ok: true as const, sheets, spreadsheetId };
}

async function buscarCategoriaCampos(categoriaId: string): Promise<ResultadoServico<{ categoria: CategoriaRow; campos: CampoRow[] }>> {
  const supabase = getSupabaseServerClient();
  let categoria: CategoriaRow | null = null;
  let categoriaError: { message: string } | null = null;

  const categoriaRes = await supabase
    .from("categorias_inventario")
    .select("id,nome,planilha_aba_nome,planilha_aba_id")
    .eq("id", categoriaId)
    .single();

  if (categoriaRes.error && erroColunaAusente(categoriaRes.error.message)) {
    const fallback = await supabase
      .from("categorias_inventario")
      .select("id,nome")
      .eq("id", categoriaId)
      .single();
    if (fallback.error || !fallback.data) {
      categoriaError = { message: fallback.error?.message ?? "Categoria nao encontrada." };
    } else {
      categoria = {
        id: String(fallback.data.id),
        nome: String(fallback.data.nome),
        planilha_aba_nome: null,
        planilha_aba_id: null
      };
    }
  } else if (categoriaRes.error || !categoriaRes.data) {
    categoriaError = { message: categoriaRes.error?.message ?? "Categoria nao encontrada." };
  } else {
    categoria = categoriaRes.data as CategoriaRow;
  }

  const { data: campos, error: camposError } = await supabase
    .from("categoria_campos")
    .select("id,nome_campo_exibicao,ordem,ativo")
    .eq("categoria_id", categoriaId)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (categoriaError || !categoria) {
    return { success: false, status: 404, error: "Categoria nao encontrada para sincronizacao da planilha." };
  }
  if (camposError) {
    return { success: false, status: 500, error: "Falha ao carregar campos da categoria para planilha." };
  }
  return { success: true, data: { categoria: categoria as CategoriaRow, campos: (campos ?? []) as CampoRow[] } };
}

async function resolverAbaPlanilha(categoria: CategoriaRow, titleDesejado: string) {
  const client = getSheetsClient();
  if (!client.ok) return { success: false as const, error: client.error };

  const spreadsheet = await client.sheets.spreadsheets.get({ spreadsheetId: client.spreadsheetId });
  const sheets = spreadsheet.data.sheets ?? [];

  let sheet = sheets.find((s) => s.properties?.sheetId === categoria.planilha_aba_id);
  if (!sheet) {
    sheet = sheets.find((s) => s.properties?.title === categoria.planilha_aba_nome);
  }
  if (!sheet) {
    sheet = sheets.find((s) => s.properties?.title === titleDesejado);
  }

  if (!sheet) {
    const add = await client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: client.spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: titleDesejado } } }]
      }
    });
    const added = add.data.replies?.[0]?.addSheet?.properties;
    if (!added?.sheetId || !added.title) {
      return { success: false as const, error: "Falha ao criar aba no Google Sheets." };
    }
    return {
      success: true as const,
      data: {
        sheets: client.sheets,
        spreadsheetId: client.spreadsheetId,
        sheetId: added.sheetId,
        title: added.title
      }
    };
  }

  const sheetId = sheet.properties?.sheetId;
  const titleAtual = sheet.properties?.title;
  if (!sheetId || !titleAtual) {
    return { success: false as const, error: "Aba do Google Sheets invalida." };
  }

  if (titleAtual !== titleDesejado) {
    await client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: client.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, title: titleDesejado },
              fields: "title"
            }
          }
        ]
      }
    });
  }

  return {
    success: true as const,
    data: { sheets: client.sheets, spreadsheetId: client.spreadsheetId, sheetId, title: titleDesejado }
  };
}

export async function sincronizarCabecalhoCategoriaNaPlanilha(categoriaId: string): Promise<ResultadoServico<{ categoria_id: string; sheet: string }>> {
  if (!syncHabilitado()) {
    return { success: true, data: { categoria_id: categoriaId, sheet: "sync-desabilitado" } };
  }

  const dados = await buscarCategoriaCampos(categoriaId);
  if (!dados.success) return dados as ResultadoServico<{ categoria_id: string; sheet: string }>;

  const targetTitle = sheetTitle(dados.data.categoria.nome);
  const sheetRes = await resolverAbaPlanilha(dados.data.categoria, targetTitle);
  if (!sheetRes.success) return { success: false, status: 500, error: sheetRes.error };

  const headers = ["_linha_id", "_categoria_id", ...dados.data.campos.map((campo) => campo.nome_campo_exibicao)];
  const range = `'${sheetRes.data.title.replace(/'/g, "''")}'!A1:${colunaAte(headers.length - 1)}1`;

  await sheetRes.data.sheets.spreadsheets.values.update({
    spreadsheetId: sheetRes.data.spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [headers] }
  });

  const supabase = getSupabaseServerClient();
  const updateRes = await supabase
    .from("categorias_inventario")
    .update({ planilha_aba_nome: sheetRes.data.title, planilha_aba_id: sheetRes.data.sheetId })
    .eq("id", categoriaId);

  if (updateRes.error && !erroColunaAusente(updateRes.error.message)) {
    return { success: false, status: 500, error: "Falha ao atualizar metadados de aba no banco." };
  }

  return { success: true, data: { categoria_id: categoriaId, sheet: sheetRes.data.title } };
}

export async function sincronizarLinhaNaPlanilha(linhaId: string): Promise<ResultadoServico<{ linha_id: string; sheet: string }>> {
  if (!syncHabilitado()) return { success: true, data: { linha_id: linhaId, sheet: "sync-desabilitado" } };

  const supabase = getSupabaseServerClient();
  const { data: linha, error: linhaError } = await supabase
    .from("linhas_inventario")
    .select("id,categoria_id,dados_extras,ativo")
    .eq("id", linhaId)
    .single();
  if (linhaError || !linha) return { success: false, status: 404, error: "Linha nao encontrada para sincronizacao da planilha." };

  const cabecalho = await sincronizarCabecalhoCategoriaNaPlanilha(String(linha.categoria_id));
  if (!cabecalho.success) return cabecalho as ResultadoServico<{ linha_id: string; sheet: string }>;

  const dadosCampos = await buscarCategoriaCampos(String(linha.categoria_id));
  if (!dadosCampos.success) return dadosCampos as ResultadoServico<{ linha_id: string; sheet: string }>;

  const { data: valores, error: valoresError } = await supabase
    .from("linha_valores_campos")
    .select("campo_id,valor_texto,valor_numero,valor_booleano,valor_data,valor_ip,valor_json")
    .eq("linha_id", linhaId);
  if (valoresError) return { success: false, status: 500, error: "Falha ao carregar valores da linha para planilha." };

  const mapValores = new Map<string, ValorLinhaRow>((valores ?? []).map((v) => [String(v.campo_id), v as ValorLinhaRow]));
  const row = [
    String(linha.id),
    String(linha.categoria_id),
    ...dadosCampos.data.campos.map((campo) => toCell(mapValores.get(campo.id) ?? {
      campo_id: campo.id,
      valor_texto: null,
      valor_numero: null,
      valor_booleano: null,
      valor_data: null,
      valor_ip: null,
      valor_json: null
    }))
  ];

  const categoria = dadosCampos.data.categoria;
  const sheetName = categoria.planilha_aba_nome || sheetTitle(categoria.nome);
  const sheetRes = await resolverAbaPlanilha(categoria, sheetName);
  if (!sheetRes.success) return { success: false, status: 500, error: sheetRes.error };

  const colA = `'${sheetRes.data.title.replace(/'/g, "''")}'!A2:A`;
  const existing = await sheetRes.data.sheets.spreadsheets.values.get({
    spreadsheetId: sheetRes.data.spreadsheetId,
    range: colA
  });
  const values = existing.data.values ?? [];
  const idx = values.findIndex((v) => String(v[0] ?? "") === String(linha.id));

  if (idx >= 0) {
    const rowNumber = idx + 2;
    const range = `'${sheetRes.data.title.replace(/'/g, "''")}'!A${rowNumber}:${colunaAte(row.length - 1)}${rowNumber}`;
    await sheetRes.data.sheets.spreadsheets.values.update({
      spreadsheetId: sheetRes.data.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [row] }
    });
  } else {
    const range = `'${sheetRes.data.title.replace(/'/g, "''")}'!A2:${colunaAte(row.length - 1)}`;
    await sheetRes.data.sheets.spreadsheets.values.append({
      spreadsheetId: sheetRes.data.spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] }
    });
  }

  return { success: true, data: { linha_id: linhaId, sheet: sheetRes.data.title } };
}

export async function removerLinhaDaPlanilha(linhaId: string): Promise<ResultadoServico<{ linha_id: string }>> {
  if (!syncHabilitado()) return { success: true, data: { linha_id: linhaId } };
  const supabase = getSupabaseServerClient();
  const { data: linha } = await supabase
    .from("linhas_inventario")
    .select("id,categoria_id")
    .eq("id", linhaId)
    .maybeSingle();
  if (!linha?.categoria_id) return { success: true, data: { linha_id: linhaId } };

  const dados = await buscarCategoriaCampos(String(linha.categoria_id));
  if (!dados.success) return { success: true, data: { linha_id: linhaId } };
  const sheetRes = await resolverAbaPlanilha(dados.data.categoria, sheetTitle(dados.data.categoria.nome));
  if (!sheetRes.success) return { success: true, data: { linha_id: linhaId } };

  const colA = `'${sheetRes.data.title.replace(/'/g, "''")}'!A2:A`;
  const existing = await sheetRes.data.sheets.spreadsheets.values.get({
    spreadsheetId: sheetRes.data.spreadsheetId,
    range: colA
  });
  const values = existing.data.values ?? [];
  const idx = values.findIndex((v) => String(v[0] ?? "") === linhaId);
  if (idx >= 0) {
    const rowNumber = idx + 2;
    await sheetRes.data.sheets.spreadsheets.values.clear({
      spreadsheetId: sheetRes.data.spreadsheetId,
      range: `'${sheetRes.data.title.replace(/'/g, "''")}'!A${rowNumber}:${colunaAte(dados.data.campos.length + 1)}${rowNumber}`
    });
  }

  return { success: true, data: { linha_id: linhaId } };
}

export async function sincronizarCategoriaCompletaNaPlanilha(categoriaId: string): Promise<ResultadoServico<{ categoria_id: string }>> {
  const cabecalho = await sincronizarCabecalhoCategoriaNaPlanilha(categoriaId);
  if (!cabecalho.success) return cabecalho as ResultadoServico<{ categoria_id: string }>;

  const supabase = getSupabaseServerClient();
  const { data: linhas, error } = await supabase
    .from("linhas_inventario")
    .select("id")
    .eq("categoria_id", categoriaId)
    .eq("ativo", true);
  if (error) return { success: false, status: 500, error: "Falha ao carregar linhas para sincronizacao completa." };

  for (const linha of linhas ?? []) {
    const syncLinha = await sincronizarLinhaNaPlanilha(String(linha.id));
    if (!syncLinha.success && modoEstrito()) {
      return { success: false, status: syncLinha.status ?? 500, error: syncLinha.error };
    }
  }

  return { success: true, data: { categoria_id: categoriaId } };
}
