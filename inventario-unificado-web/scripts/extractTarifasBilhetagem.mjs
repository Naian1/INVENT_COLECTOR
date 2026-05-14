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
 * O que faz: A funcao 'toNumber' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'normalizeText' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeText(value) {
  return String(value ?? "").trim();
}

/**
 * [DOC-FUNC] findTarifas
 * O que faz: A funcao 'findTarifas' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: rows. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'inferCompetenciaFromName' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: fileName. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function inferCompetenciaFromName(fileName) {
  const m = fileName.match(/(\d{2})_(\d{4})/);
  if (!m) return null;
  return { competencia_mes: Number(m[1]), competencia_ano: Number(m[2]) };
}

/**
 * [DOC-FUNC] main
 * O que faz: A funcao 'main' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

