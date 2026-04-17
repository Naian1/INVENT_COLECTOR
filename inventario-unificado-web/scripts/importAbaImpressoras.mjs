import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#") || !clean.includes("=")) continue;
    const idx = clean.indexOf("=");
    const key = clean.slice(0, idx).trim();
    const value = clean.slice(idx + 1).trim().replace(/^"|"$/g, "");
    env[key] = value;
  }
  return env;
}

function envValue(name, fallback = "") {
  return process.env[name] || localEnv[name] || fallback;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function chaveCampo(value) {
  const core = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  const pref = core.startsWith("nm_") ? core : `nm_${core}`;
  return pref.replace(/[^a-z0-9_]/g, "").slice(0, 63) || "nm_campo";
}

function normHeader(v) {
  return String(v || "")
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pickHeaderIndex(headers, aliases) {
  const normalized = headers.map(normHeader);
  for (const alias of aliases) {
    const a = normHeader(alias);
    const idx = normalized.findIndex((h) => h === a || h.includes(a));
    if (idx >= 0) return idx;
  }
  return -1;
}

function toText(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function inferFabricante(modelo) {
  const m = String(modelo || "").toLowerCase();
  if (m.includes("lexmark") || m.startsWith("m") || m.startsWith("xm") || m.startsWith("cx")) {
    return "Lexmark";
  }
  return null;
}

async function ensureAba(nome) {
  const { data: existing, error } = await supabase
    .from("abas_inventario")
    .select("id,nome")
    .ilike("nome", nome)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erro buscando aba: ${error.message}`);
  if (existing) return existing;

  const { data, error: insErr } = await supabase
    .from("abas_inventario")
    .insert({ nome, slug: slugify(nome), ordem: 10, ativo: true })
    .select("id,nome")
    .single();
  if (insErr || !data) throw new Error(`Erro criando aba: ${insErr?.message || "desconhecido"}`);
  return data;
}

async function ensureCategoria(abaId, nome) {
  const { data: existing, error } = await supabase
    .from("categorias_inventario")
    .select("id,nome,aba_inventario_id")
    .eq("aba_inventario_id", abaId)
    .ilike("nome", nome)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erro buscando categoria: ${error.message}`);
  if (existing) return existing;

  const { data, error: insErr } = await supabase
    .from("categorias_inventario")
    .insert({
      aba_inventario_id: abaId,
      nome,
      slug: slugify(nome),
      descricao: "Importacao automatica da aba Impressoras",
      ordem: 10,
      origem_tipo: "importacao",
      ativo: true
    })
    .select("id,nome,aba_inventario_id")
    .single();
  if (insErr || !data) throw new Error(`Erro criando categoria: ${insErr?.message || "desconhecido"}`);
  return data;
}

async function ensureCampos(categoriaId) {
  const camposEsperados = [
    ["Patrimonio", "nm_patrimonio", "patrimonio", "impressora_patrimonio", true, true, 1],
    ["Modelo", "nm_modelo", "texto", "impressora_modelo", true, false, 2],
    ["IP Equipamento", "nm_ip", "ip", "impressora_ip", true, true, 3],
    ["Numero Serie", "nm_numero_serie", "texto", "numero_serie", false, true, 4],
    ["Hostname", "nm_hostname", "texto", "hostname", false, false, 5],
    ["Setor", "nm_setor", "texto", "setor", false, false, 6],
    ["Localizacao", "nm_localizacao", "texto", "localizacao", false, false, 7],
    ["Fabricante", "nm_fabricante", "texto", "fabricante", false, false, 8],
    ["MAC", "nm_mac", "texto", "nenhum", false, false, 9]
  ];

  const { data: atual, error } = await supabase
    .from("categoria_campos")
    .select("id,chave_campo")
    .eq("categoria_id", categoriaId)
    .eq("ativo", true);
  if (error) throw new Error(`Erro listando campos: ${error.message}`);

  const atualMap = new Map((atual || []).map((c) => [String(c.chave_campo).toLowerCase(), c.id]));

  for (const [nome, chave, tipo, sem, obrig, unico, ordem] of camposEsperados) {
    if (atualMap.has(chave.toLowerCase())) continue;
    const { error: insErr } = await supabase.from("categoria_campos").insert({
      categoria_id: categoriaId,
      nome_campo_exibicao: nome,
      chave_campo: chave,
      tipo_campo: tipo,
      tipo_semantico: sem,
      obrigatorio: obrig,
      unico,
      ordem,
      ativo: true
    });
    if (insErr) throw new Error(`Erro criando campo ${chave}: ${insErr.message}`);
  }

  const { data: finalCampos, error: finalErr } = await supabase
    .from("categoria_campos")
    .select("id,chave_campo")
    .eq("categoria_id", categoriaId)
    .eq("ativo", true);
  if (finalErr) throw new Error(`Erro carregando campos finais: ${finalErr.message}`);

  return new Map((finalCampos || []).map((c) => [String(c.chave_campo), String(c.id)]));
}

async function loadExistingLinhas(categoriaId, campoPatId, campoIpId) {
  const { data: linhas, error: lErr } = await supabase
    .from("linhas_inventario")
    .select("id,categoria_id")
    .eq("categoria_id", categoriaId)
    .eq("ativo", true)
    .limit(5000);
  if (lErr) throw new Error(`Erro carregando linhas existentes: ${lErr.message}`);

  const linhaIds = (linhas || []).map((l) => l.id);
  if (!linhaIds.length) return { porPat: new Map(), porIp: new Map() };

  const { data: valores, error: vErr } = await supabase
    .from("linha_valores_campos")
    .select("linha_id,campo_id,valor_texto,valor_ip")
    .in("linha_id", linhaIds)
    .in("campo_id", [campoPatId, campoIpId]);
  if (vErr) throw new Error(`Erro carregando valores existentes: ${vErr.message}`);

  const porPat = new Map();
  const porIp = new Map();
  for (const v of valores || []) {
    if (String(v.campo_id) === String(campoPatId)) {
      const key = String(v.valor_texto || "").trim();
      if (key) porPat.set(key, String(v.linha_id));
    }
    if (String(v.campo_id) === String(campoIpId)) {
      const key = String(v.valor_ip || "").replace(/\/32$/, "").trim();
      if (key) porIp.set(key, String(v.linha_id));
    }
  }
  return { porPat, porIp };
}

async function upsertOperacional(row) {
  const payload = {
    patrimonio: row.patrimonio,
    ip: row.ip,
    setor: row.setor || "IMPRESSORAS",
    localizacao: row.localizacao,
    modelo: row.modelo,
    fabricante: row.fabricante,
    numero_serie: row.numero_serie,
    hostname: row.hostname,
    endereco_mac: row.mac,
    ativo: true
  };

  const { error } = await supabase.from("impressoras").upsert(payload, { onConflict: "ip" });
  if (!error) return "ok";

  const { data: byPat, error: byPatErr } = await supabase
    .from("impressoras")
    .select("id")
    .ilike("patrimonio", row.patrimonio)
    .limit(1)
    .maybeSingle();
  if (byPatErr) throw new Error(`Erro buscando impressora por patrimonio: ${byPatErr.message}`);

  if (byPat?.id) {
    const { error: updErr } = await supabase.from("impressoras").update(payload).eq("id", byPat.id);
    if (updErr) throw new Error(`Erro atualizando impressora por patrimonio: ${updErr.message}`);
    return "atualizado";
  }

  throw new Error(`Erro upsert impressora (${row.ip}/${row.patrimonio}): ${error.message}`);
}

function detectarHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const normalized = row.map(normHeader);
    const hasPat = normalized.some((h) => h.includes("patrimonio"));
    const hasModel = normalized.some((h) => h === "modelo" || h.includes("modelo"));
    const hasIp = normalized.some((h) => h.includes("ip"));
    if (hasPat && hasModel && hasIp) return i;
  }
  return -1;
}

const localEnv = loadEnvLocal();
const SUPABASE_URL = envValue("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_KEY = envValue("SUPABASE_SECRET_KEY") || envValue("SUPABASE_SERVICE_ROLE_KEY") || envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Env do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const fileArg = process.argv[2];
  let filePath = fileArg;
  if (!filePath) {
    const desktop = "C:/Users/7003233/Desktop";
    const candidate = fs
      .readdirSync(desktop)
      .find((f) => f.toLowerCase().includes("hgg") && f.toLowerCase().includes("invent") && f.toLowerCase().endsWith(".xlsx"));
    if (!candidate) throw new Error("Arquivo XLSX de inventario nao encontrado na Desktop.");
    filePath = path.join(desktop, candidate);
  }

  if (!fs.existsSync(filePath)) throw new Error(`Arquivo nao encontrado: ${filePath}`);

  const wb = XLSX.readFile(filePath, { raw: false, defval: "" });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("impress"));
  if (!sheetName) throw new Error("Aba 'Impressoras' nao encontrada na planilha.");

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: "" });
  const headerIndex = detectarHeader(rows);
  if (headerIndex < 0) throw new Error("Cabecalho da aba Impressoras nao identificado.");

  const headers = rows[headerIndex] || [];

  const idxPat = pickHeaderIndex(headers, ["Patrimonio"]);
  const idxModel = pickHeaderIndex(headers, ["Modelo", "Impressora"]);
  const idxUnid = pickHeaderIndex(headers, ["Unidades", "Setor", "Andar"]);
  const idxLocal = pickHeaderIndex(headers, ["Local", "Localizacao"]);
  const idxSerie = pickHeaderIndex(headers, ["N° Série", "Nº Serie", "Numero Serie"]);
  const idxIp = pickHeaderIndex(headers, ["IP do Equipamento", "IP"]);
  const idxHost = pickHeaderIndex(headers, ["Nome Impressora Servidor", "Hostname"]);
  const idxMac = pickHeaderIndex(headers, ["MAC", "Endereco MAC"]);

  if (idxPat < 0 || idxModel < 0 || idxIp < 0) {
    throw new Error("Colunas obrigatorias nao encontradas (Patrimonio/Modelo/IP).");
  }

  const parsed = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const patrimonio = toText(row[idxPat]);
    const modelo = toText(row[idxModel]);
    const ip = toText(row[idxIp]);
    if (!patrimonio || !modelo || !ip) continue;

    parsed.push({
      patrimonio,
      modelo,
      setor: toText(row[idxUnid]) || "IMPRESSORAS",
      localizacao: toText(row[idxLocal]),
      numero_serie: toText(row[idxSerie]),
      ip,
      hostname: toText(row[idxHost]),
      mac: toText(row[idxMac]),
      fabricante: inferFabricante(modelo)
    });
  }

  console.log(`Linhas validas extraidas da aba '${sheetName}':`, parsed.length);

  const aba = await ensureAba("IMPRESSORAS");
  const categoria = await ensureCategoria(aba.id, "IMPRESSORAS");
  const campos = await ensureCampos(categoria.id);

  const idPat = campos.get("nm_patrimonio");
  const idModelo = campos.get("nm_modelo");
  const idIp = campos.get("nm_ip");
  const idSerie = campos.get("nm_numero_serie");
  const idHost = campos.get("nm_hostname");
  const idSetor = campos.get("nm_setor");
  const idLocal = campos.get("nm_localizacao");
  const idFab = campos.get("nm_fabricante");
  const idMac = campos.get("nm_mac");

  if (!idPat || !idModelo || !idIp) throw new Error("Campos base da categoria IMPRESSORAS nao encontrados.");

  const { porPat, porIp } = await loadExistingLinhas(categoria.id, idPat, idIp);

  let criadas = 0;
  let atualizadas = 0;
  let operacionais = 0;

  for (const row of parsed) {
    let linhaId = porPat.get(row.patrimonio) || porIp.get(row.ip) || null;

    if (!linhaId) {
      const { data: novaLinha, error: linhaErr } = await supabase
        .from("linhas_inventario")
        .insert({
          aba_inventario_id: aba.id,
          categoria_id: categoria.id,
          codigo_linha: row.patrimonio,
          setor: row.setor,
          localizacao: row.localizacao,
          hostname_base: row.hostname,
          observacao: "Importacao automatica - aba Impressoras",
          origem_tipo: "importacao",
          origem_sheet: sheetName,
          ativo: true
        })
        .select("id")
        .single();

      if (linhaErr || !novaLinha) {
        console.warn(`Falha ao criar linha ${row.patrimonio}/${row.ip}:`, linhaErr?.message);
        continue;
      }

      linhaId = String(novaLinha.id);
      porPat.set(row.patrimonio, linhaId);
      porIp.set(row.ip, linhaId);
      criadas += 1;
    } else {
      const { error: updLinhaErr } = await supabase
        .from("linhas_inventario")
        .update({
          codigo_linha: row.patrimonio,
          setor: row.setor,
          localizacao: row.localizacao,
          hostname_base: row.hostname,
          ativo: true
        })
        .eq("id", linhaId);
      if (updLinhaErr) {
        console.warn(`Falha ao atualizar linha ${linhaId}:`, updLinhaErr.message);
      }
      atualizadas += 1;
    }

    const valores = [
      [idPat, "valor_texto", row.patrimonio],
      [idModelo, "valor_texto", row.modelo],
      [idIp, "valor_ip", row.ip],
      [idSerie, "valor_texto", row.numero_serie],
      [idHost, "valor_texto", row.hostname],
      [idSetor, "valor_texto", row.setor],
      [idLocal, "valor_texto", row.localizacao],
      [idFab, "valor_texto", row.fabricante],
      [idMac, "valor_texto", row.mac]
    ];

    for (const [campoId, tipoCampo, valor] of valores) {
      if (!campoId || !valor) continue;
      const payload = { linha_id: linhaId, campo_id: campoId, valor_texto: null, valor_ip: null };
      if (tipoCampo === "valor_ip") {
        payload.valor_ip = String(valor).replace(/\/32$/, "");
      } else {
        payload.valor_texto = String(valor);
      }

      const { error: valErr } = await supabase
        .from("linha_valores_campos")
        .upsert(payload, { onConflict: "linha_id,campo_id" });
      if (valErr) {
        console.warn(`Falha ao gravar valor campo ${campoId} linha ${linhaId}:`, valErr.message);
      }
    }

    try {
      await upsertOperacional(row);
      operacionais += 1;
    } catch (e) {
      console.warn(`Falha upsert operacional ${row.patrimonio}/${row.ip}:`, e.message || e);
    }
  }

  console.log("Importacao concluida:");
  console.log(`- Linhas criadas: ${criadas}`);
  console.log(`- Linhas atualizadas: ${atualizadas}`);
  console.log(`- Impressoras operacionais upsert: ${operacionais}`);
}

main().catch((err) => {
  console.error("Erro na importacao:", err.message || err);
  process.exit(1);
});
