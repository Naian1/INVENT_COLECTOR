import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function findTarifas(rows) {
  for (const row of rows) {
    const normalized = row.map((cell) => String(cell ?? "").trim().toLowerCase());
    // Procura dois blocos "valor pagina" na mesma linha (pb e colorida).
    const idx = normalized.findIndex((cell) => cell === "valor pagina");
    if (idx < 0) continue;
    const pb = toNumber(row[idx + 1]);
    const idx2 = normalized.findIndex((cell, i) => i > idx && cell === "valor pagina");
    const color = idx2 >= 0 ? toNumber(row[idx2 + 1]) : null;
    if (pb !== null && color !== null) return { pb, colorida: color };
  }
  return null;
}

function inferCompetenciaFromName(fileName) {
  const m = fileName.match(/(\d{2})_(\d{4})/);
  if (!m) return null;
  return { competencia_mes: Number(m[1]), competencia_ano: Number(m[2]) };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Uso: node scripts/extractTarifasBilhetagem.mjs <arquivo.xlsx> [empresa_locadora]");
    process.exit(1);
  }

  const filePath = path.resolve(input);
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo nao encontrado: ${filePath}`);
    process.exit(1);
  }

  const empresaLocadora = normalizeText(process.argv[3] || "ARKLOK");
  const workbook = XLSX.readFile(filePath);
  let tarifas = null;

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    tarifas = findTarifas(rows);
    if (tarifas) break;
  }

  if (!tarifas) {
    console.error("Nao foi possivel localizar as tarifas na planilha.");
    process.exit(1);
  }

  const competencia = inferCompetenciaFromName(path.basename(filePath));
  const today = new Date();
  const output = {
    competencia_mes: competencia?.competencia_mes ?? today.getMonth() + 1,
    competencia_ano: competencia?.competencia_ano ?? today.getFullYear(),
    empresa_locadora: empresaLocadora,
    fonte_arquivo: path.basename(filePath),
    tarifas,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
