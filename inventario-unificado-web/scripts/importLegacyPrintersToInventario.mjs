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

const localEnv = loadEnvLocal();
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  localEnv.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  localEnv.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Env do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

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
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (["***", "n/a", "na", "null", "-", "verificar", "0"].includes(low)) return null;
  return s;
}

function normalizeIp(ip) {
  const txt = toText(ip);
  if (!txt) return null;
  const clean = txt.replace(/\/32$/, "");
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  return ipv4.test(clean) ? clean : null;
}

function normalizeMac(mac) {
  const txt = toText(mac);
  if (!txt) return null;
  const compact = txt.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (compact.length !== 12) return null;
  return compact;
}

function inferMarca(modelo) {
  const m = String(modelo || "").toLowerCase();
  if (m.includes("lexmark") || m.startsWith("m") || m.startsWith("xm") || m.startsWith("cx")) {
    return "Lexmark";
  }
  return "Desconhecido";
}

function detectarHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const normalized = row.map(normHeader);
    const hasPat = normalized.some((h) => h.includes("patrimonio"));
    const hasModel = normalized.some((h) => h === "modelo" || h.includes("modelo"));
    const hasIp = normalized.some((h) => h.includes("ip"));
    if (hasPat && hasModel && hasIp) return i;
  }
  return -1;
}

async function fetchBaseContext() {
  const [empresasRes, tiposRes, pisosRes, setoresRes, equipamentosRes] = await Promise.all([
    supabase.from("empresa").select("cd_cgc, ie_situacao"),
    supabase
      .from("tipo_equipamento")
      .select("cd_tipo_equipamento, nm_tipo_equipamento, ie_situacao"),
    supabase.from("piso").select("cd_piso, nm_piso, ie_situacao"),
    supabase.from("setor").select("cd_setor, cd_piso, nm_setor, nm_localizacao, ie_situacao"),
    supabase
      .from("equipamento")
      .select("cd_equipamento, cd_cgc, cd_tipo_equipamento, nm_equipamento, nm_marca, nm_modelo, ie_situacao")
  ]);

  for (const r of [empresasRes, tiposRes, pisosRes, setoresRes, equipamentosRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const empresaAtiva =
    (empresasRes.data || []).find((e) => String(e.ie_situacao || "A").toUpperCase() === "A") || null;
  if (!empresaAtiva?.cd_cgc) {
    throw new Error("Nenhuma empresa ativa encontrada em 'empresa'.");
  }

  const tipoImpressora =
    (tiposRes.data || []).find(
      (t) =>
        String(t.ie_situacao || "A").toUpperCase() === "A" &&
        String(t.nm_tipo_equipamento || "").toLowerCase().includes("impress")
    ) || null;
  if (!tipoImpressora?.cd_tipo_equipamento) {
    throw new Error("Tipo de equipamento de impressora nao encontrado em 'tipo_equipamento'.");
  }

  return {
    empresaCgc: String(empresaAtiva.cd_cgc),
    tipoImpressoraId: Number(tipoImpressora.cd_tipo_equipamento),
    pisos: pisosRes.data || [],
    setores: setoresRes.data || [],
    equipamentos: equipamentosRes.data || []
  };
}

function pisoKey(nomePiso) {
  return String(nomePiso || "").trim().toLowerCase();
}

function setorKey(cdPiso, nomeSetor) {
  return `${cdPiso}::${String(nomeSetor || "").trim().toLowerCase()}`;
}

function equipamentoKey(modelo) {
  return String(modelo || "").trim().toLowerCase();
}

async function ensurePiso(nomePiso, cachePisos) {
  const cleanNome = toText(nomePiso) || "NAO INFORMADO";
  const key = pisoKey(cleanNome);
  if (cachePisos.has(key)) return cachePisos.get(key);

  const { data, error } = await supabase
    .from("piso")
    .insert({ nm_piso: cleanNome, ie_situacao: "A" })
    .select("cd_piso, nm_piso")
    .single();
  if (error || !data) throw new Error(`Falha ao criar piso '${cleanNome}': ${error?.message || "desconhecido"}`);
  cachePisos.set(key, data);
  return data;
}

async function ensureSetor(cdPiso, nomeSetor, cacheSetores) {
  const cleanSetor = toText(nomeSetor) || "IMPRESSORAS";
  const key = setorKey(cdPiso, cleanSetor);
  if (cacheSetores.has(key)) return cacheSetores.get(key);

  const { data, error } = await supabase
    .from("setor")
    .insert({
      cd_piso: cdPiso,
      nm_setor: cleanSetor,
      nm_localizacao: null,
      ie_situacao: "A"
    })
    .select("cd_setor, cd_piso, nm_setor")
    .single();
  if (error || !data) throw new Error(`Falha ao criar setor '${cleanSetor}': ${error?.message || "desconhecido"}`);
  cacheSetores.set(key, data);
  return data;
}

async function ensureEquipamento(modelo, marca, context, cacheEquipamentos) {
  const cleanModelo = toText(modelo);
  if (!cleanModelo) throw new Error("Modelo ausente para criar equipamento.");
  const key = equipamentoKey(cleanModelo);
  if (cacheEquipamentos.has(key)) return cacheEquipamentos.get(key);

  const { data, error } = await supabase
    .from("equipamento")
    .insert({
      cd_cgc: context.empresaCgc,
      cd_tipo_equipamento: context.tipoImpressoraId,
      nm_equipamento: "Impressora",
      nm_marca: toText(marca) || inferMarca(cleanModelo),
      nm_modelo: cleanModelo,
      ie_situacao: "A",
      tp_hierarquia: "AMBOS"
    })
    .select("cd_equipamento, nm_modelo")
    .single();
  if (error || !data) {
    throw new Error(`Falha ao criar equipamento '${cleanModelo}': ${error?.message || "desconhecido"}`);
  }
  cacheEquipamentos.set(key, data);
  return data;
}

async function carregarInventarioExistente() {
  const { data, error } = await supabase
    .from("inventario")
    .select("nr_inventario, nr_patrimonio, nr_serie, nr_ip")
    .limit(20000);
  if (error) throw new Error(`Falha ao carregar inventario existente: ${error.message}`);

  const byPat = new Map();
  const bySerie = new Map();
  const byIp = new Map();
  for (const row of data || []) {
    const pat = toText(row.nr_patrimonio);
    const serie = toText(row.nr_serie);
    const ip = normalizeIp(row.nr_ip);
    if (pat) byPat.set(pat.toLowerCase(), row);
    if (serie) bySerie.set(serie.toLowerCase(), row);
    if (ip) byIp.set(ip, row);
  }
  return { byPat, bySerie, byIp };
}

async function main() {
  const fileArg = process.argv[2];
  const filePath = fileArg || "C:/Users/7003233/Desktop/Inventário SPDM - HGG.xlsx";
  if (!fs.existsSync(filePath)) throw new Error(`Arquivo nao encontrado: ${filePath}`);

  const workbook = XLSX.readFile(filePath, { raw: false, defval: "" });
  const sheetName = workbook.SheetNames.find((n) => n.toLowerCase().includes("impress"));
  if (!sheetName) throw new Error("Aba de impressoras nao encontrada na planilha.");

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
  const headerIndex = detectarHeader(rows);
  if (headerIndex < 0) throw new Error("Cabecalho da aba Impressoras nao identificado.");
  const headers = rows[headerIndex] || [];

  const idxPat = pickHeaderIndex(headers, ["Patrimonio"]);
  const idxModelo = pickHeaderIndex(headers, ["Modelo"]);
  const idxUnidade = pickHeaderIndex(headers, ["Unidades", "Andar"]);
  const idxLocal = pickHeaderIndex(headers, ["Local", "Setor", "Localizacao"]);
  const idxSerie = pickHeaderIndex(headers, ["N° Série", "Nº Serie", "Numero Serie", "Serie"]);
  const idxIp = pickHeaderIndex(headers, ["IP do Equipamento", "IP"]);
  const idxHost = pickHeaderIndex(headers, ["Nome Impressora Servidor", "Hostname"]);
  const idxMac = pickHeaderIndex(headers, ["MAC", "Endereco MAC"]);

  if (idxPat < 0 || idxModelo < 0 || idxIp < 0) {
    throw new Error("Colunas obrigatorias nao encontradas (Patrimonio/Modelo/IP).");
  }

  const parsed = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const patrimonio = toText(row[idxPat]);
    const modelo = toText(row[idxModelo]);
    const ip = normalizeIp(row[idxIp]);
    if (!patrimonio || !modelo || !ip) continue;

    parsed.push({
      patrimonio,
      modelo,
      unidade: toText(row[idxUnidade]) || "NAO INFORMADO",
      local: toText(row[idxLocal]) || "IMPRESSORAS",
      numero_serie: toText(row[idxSerie]),
      ip,
      hostname: toText(row[idxHost]),
      mac: normalizeMac(row[idxMac]),
      marca: inferMarca(modelo)
    });
  }

  console.log(`Linhas validas extraidas da aba '${sheetName}': ${parsed.length}`);
  if (parsed.length === 0) return;

  const context = await fetchBaseContext();
  const cachePisos = new Map(
    context.pisos.map((p) => [pisoKey(p.nm_piso), { cd_piso: p.cd_piso, nm_piso: p.nm_piso }])
  );
  const cacheSetores = new Map(
    context.setores.map((s) => [setorKey(s.cd_piso, s.nm_setor), { cd_setor: s.cd_setor, cd_piso: s.cd_piso, nm_setor: s.nm_setor }])
  );
  const cacheEquipamentos = new Map(
    context.equipamentos
      .filter((e) => String(e.ie_situacao || "A").toUpperCase() === "A")
      .map((e) => [equipamentoKey(e.nm_modelo), { cd_equipamento: e.cd_equipamento, nm_modelo: e.nm_modelo }])
  );

  const inventarioAtual = await carregarInventarioExistente();

  let inseridos = 0;
  let atualizados = 0;
  let falhas = 0;

  for (const row of parsed) {
    try {
      const piso = await ensurePiso(row.unidade, cachePisos);
      const setor = await ensureSetor(piso.cd_piso, row.local, cacheSetores);
      const equipamento = await ensureEquipamento(row.modelo, row.marca, context, cacheEquipamentos);

      const byPat = inventarioAtual.byPat.get(row.patrimonio.toLowerCase()) || null;
      const bySerie = row.numero_serie ? inventarioAtual.bySerie.get(row.numero_serie.toLowerCase()) || null : null;
      const byIp = inventarioAtual.byIp.get(row.ip) || null;
      const existente = byPat || bySerie || byIp;

      const payload = {
        cd_equipamento: equipamento.cd_equipamento,
        cd_setor: setor.cd_setor,
        nr_patrimonio: row.patrimonio,
        nr_serie: row.numero_serie,
        nr_ip: row.ip,
        nm_hostname: row.hostname,
        nm_mac: row.mac,
        tp_status: "ATIVO",
        ie_situacao: "A",
        dt_saida: null
      };

      if (existente?.nr_inventario) {
        const { error } = await supabase
          .from("inventario")
          .update(payload)
          .eq("nr_inventario", existente.nr_inventario);
        if (error) throw new Error(`update inventario ${existente.nr_inventario}: ${error.message}`);
        atualizados += 1;
        inventarioAtual.byPat.set(row.patrimonio.toLowerCase(), { nr_inventario: existente.nr_inventario, ...payload });
        if (row.numero_serie) inventarioAtual.bySerie.set(row.numero_serie.toLowerCase(), { nr_inventario: existente.nr_inventario, ...payload });
        inventarioAtual.byIp.set(row.ip, { nr_inventario: existente.nr_inventario, ...payload });
      } else {
        const { data, error } = await supabase
          .from("inventario")
          .insert(payload)
          .select("nr_inventario")
          .single();
        if (error || !data) throw new Error(`insert inventario: ${error?.message || "desconhecido"}`);
        inseridos += 1;
        inventarioAtual.byPat.set(row.patrimonio.toLowerCase(), { nr_inventario: data.nr_inventario, ...payload });
        if (row.numero_serie) inventarioAtual.bySerie.set(row.numero_serie.toLowerCase(), { nr_inventario: data.nr_inventario, ...payload });
        inventarioAtual.byIp.set(row.ip, { nr_inventario: data.nr_inventario, ...payload });
      }
    } catch (err) {
      falhas += 1;
      console.warn(`Falha ${row.patrimonio}/${row.ip}: ${err?.message || err}`);
    }
  }

  console.log("Importacao inventario concluida:");
  console.log(`- Inseridos: ${inseridos}`);
  console.log(`- Atualizados: ${atualizados}`);
  console.log(`- Falhas: ${falhas}`);
}

main().catch((err) => {
  console.error("Erro na importacao:", err.message || err);
  process.exit(1);
});
