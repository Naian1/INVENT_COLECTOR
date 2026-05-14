/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\scripts\extractTarifasBilhetagem.mjs
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

/**
 * [DOC-FUNC] toNumber
 * O que faz: Executa a responsabilidade principal da funcao 'toNumber' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * [DOC-FUNC] normalizeText
 * O que faz: Normaliza entradas na funcao 'normalizeText', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizeText(value) {
  return String(value ?? "").trim();
}

/**
 * [DOC-FUNC] findTarifas
 * O que faz: Consulta e organiza informacoes na funcao 'findTarifas' para retorno confiavel.
 * Entradas: Parametros esperados: rows; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna dados consistentes para consumo da camada chamadora ou ausencia tratada.
 */
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

/**
 * [DOC-FUNC] inferCompetenciaFromName
 * O que faz: Executa a responsabilidade principal da funcao 'inferCompetenciaFromName' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: fileName; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function inferCompetenciaFromName(fileName) {
  const m = fileName.match(/(\d{2})_(\d{4})/);
  if (!m) return null;
  return { competencia_mes: Number(m[1]), competencia_ano: Number(m[2]) };
}

/**
 * [DOC-FUNC] main
 * O que faz: Executa a responsabilidade principal da funcao 'main' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
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

