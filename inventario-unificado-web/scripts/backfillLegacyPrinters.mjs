#!/usr/bin/env node
/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web/scripts/backfillLegacyPrinters.mjs
 * [DOC-CODEMAP] Papel: Script operacional: automacao para carga, migracao ou extracao de dados.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const UNKNOWN_VALUES = new Set([
  "",
  "desconhecido",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "-",
  "sem setor",
  "sem_setor"
]);

const META_KEYS = new Set(["id", "categoryid", "category_id", "status"]);

/**
 * [DOC-FUNC] normalizeKey
 * O que faz: A funcao 'normalizeKey' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * [DOC-FUNC] normalizeText
 * O que faz: A funcao 'normalizeText' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (UNKNOWN_VALUES.has(text.toLowerCase())) return null;
  return text;
}

/**
 * [DOC-FUNC] normalizeIp
 * O que faz: A funcao 'normalizeIp' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeIp(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  return ipv4.test(text) ? text : null;
}

/**
 * [DOC-FUNC] normalizeMac
 * O que faz: A funcao 'normalizeMac' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeMac(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const compact = text.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (compact.length !== 12) return null;
  return compact.match(/.{1,2}/g).join(":");
}

/**
 * [DOC-FUNC] normalizeAssetTagForLabel
 * O que faz: A funcao 'normalizeAssetTagForLabel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: assetTag. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeAssetTagForLabel(assetTag) {
  if (!assetTag) return null;
  return /^pat\b/i.test(assetTag) ? assetTag : `PAT ${assetTag}`;
}

/**
 * [DOC-FUNC] buildDisplayName
 * O que faz: A funcao 'buildDisplayName' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: { hostname, asset_tag, sector, model, ip_address }. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function buildDisplayName({ hostname, asset_tag, sector, model, ip_address }) {
  const cleanHostname = normalizeText(hostname);
  const cleanAssetTag = normalizeText(asset_tag);
  const cleanSector = normalizeText(sector);
  const cleanModel = normalizeText(model);
  const cleanIp = normalizeIp(ip_address) ?? normalizeText(ip_address);

  if (cleanAssetTag && cleanSector) {
    return `${normalizeAssetTagForLabel(cleanAssetTag)} - ${cleanSector}`;
  }
  if (cleanModel && cleanSector) {
    return `${cleanModel} - ${cleanSector}`;
  }
  if (cleanHostname) return cleanHostname;
  if (cleanAssetTag) return normalizeAssetTagForLabel(cleanAssetTag);
  if (cleanModel) return cleanModel;
  if (cleanIp) return cleanIp;
  return null;
}

/**
 * [DOC-FUNC] parseArgs
 * O que faz: A funcao 'parseArgs' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: argv. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function parseArgs(argv) {
  const args = {
    input: null,
    write: false,
    limit: null,
    report: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") {
      args.input = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--limit") {
      const value = Number(argv[i + 1]);
      args.limit = Number.isFinite(value) && value > 0 ? value : null;
      i += 1;
      continue;
    }
    if (token === "--report") {
      args.report = argv[i + 1] ?? null;
      i += 1;
    }
  }

  return args;
}

/**
 * [DOC-FUNC] loadDotEnvLocal
 * O que faz: A funcao 'loadDotEnvLocal' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: cwd. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function loadDotEnvLocal(cwd) {
  const envPath = path.join(cwd, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * [DOC-FUNC] readJson
 * O que faz: A funcao 'readJson' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: filePath. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function readJson(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

/**
 * [DOC-FUNC] buildLegacyFieldNameMap
 * O que faz: A funcao 'buildLegacyFieldNameMap' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: legacy. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function buildLegacyFieldNameMap(legacy) {
  const byCategory = new Map();
  for (const field of legacy.fields ?? []) {
    const categoryId = String(field.categoryId ?? "");
    if (!categoryId) continue;
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, new Map());
    const map = byCategory.get(categoryId);
    if (field.key) map.set(normalizeKey(field.key), field.name ?? field.key);
    if (field.name) map.set(normalizeKey(field.name), field.name);
  }
  return byCategory;
}

/**
 * [DOC-FUNC] isLikelyPrinterItem
 * O que faz: A funcao 'isLikelyPrinterItem' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: categoryName, itemEntries. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isLikelyPrinterItem(categoryName, itemEntries) {
  const cat = normalizeKey(categoryName ?? "");
  if (cat.includes("impress")) return true;
  if (cat.includes("printer")) return true;

  const printerHints = [
    "toner",
    "cartucho",
    "suprimento",
    "contador_paginas",
    "page_count",
    "impress",
    "printer"
  ];

  for (const entry of itemEntries) {
    const key = entry.keyNorm;
    const label = entry.labelNorm;
    if (printerHints.some((hint) => key.includes(hint) || label.includes(hint))) {
      return true;
    }
  }

  return false;
}

/**
 * [DOC-FUNC] itemEntriesWithFieldLabels
 * O que faz: A funcao 'itemEntriesWithFieldLabels' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: item, fieldMapForCategory. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function itemEntriesWithFieldLabels(item, fieldMapForCategory) {
  const entries = [];
  for (const [rawKey, rawValue] of Object.entries(item ?? {})) {
    const keyNorm = normalizeKey(rawKey);
    if (META_KEYS.has(keyNorm)) continue;

    const labelName = fieldMapForCategory?.get(keyNorm) ?? rawKey;
    const labelNorm = normalizeKey(labelName);

    entries.push({
      rawKey,
      rawValue,
      keyNorm,
      labelNorm
    });
  }
  return entries;
}

/**
 * [DOC-FUNC] pickFromAliases
 * O que faz: A funcao 'pickFromAliases' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: entries, aliases. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function pickFromAliases(entries, aliases) {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias));

  for (const alias of normalizedAliases) {
    for (const entry of entries) {
      if (entry.keyNorm === alias || entry.labelNorm === alias) {
        const value = normalizeText(entry.rawValue);
        if (value) return value;
      }
    }
  }

  for (const alias of normalizedAliases) {
    for (const entry of entries) {
      if (
        entry.keyNorm.includes(alias) ||
        entry.labelNorm.includes(alias) ||
        alias.includes(entry.keyNorm) ||
        alias.includes(entry.labelNorm)
      ) {
        const value = normalizeText(entry.rawValue);
        if (value) return value;
      }
    }
  }

  return null;
}

/**
 * [DOC-FUNC] extractLegacyPrinterRecords
 * O que faz: A funcao 'extractLegacyPrinterRecords' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: legacy. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function extractLegacyPrinterRecords(legacy) {
  const categoriesById = new Map((legacy.categories ?? []).map((c) => [String(c.id), c.name]));
  const fieldNameMap = buildLegacyFieldNameMap(legacy);

  const extracted = [];
  for (const item of legacy.items ?? []) {
    const categoryId = String(item.categoryId ?? "");
    const categoryName = categoriesById.get(categoryId) ?? "Sem categoria";
    const fieldsForCategory = fieldNameMap.get(categoryId);
    const entries = itemEntriesWithFieldLabels(item, fieldsForCategory);

    if (!isLikelyPrinterItem(categoryName, entries)) continue;

    const sector = pickFromAliases(entries, [
      "setor",
      "secao",
      "departamento",
      "unidade",
      "lotacao"
    ]);
    const local = pickFromAliases(entries, [
      "local",
      "localizacao",
      "ambiente",
      "sala",
      "recepcao"
    ]);
    const combinedSector =
      sector && local && !sector.toLowerCase().includes(local.toLowerCase())
        ? `${sector} - ${local}`
        : sector ?? local ?? null;

    const candidate = {
      source_item_id: normalizeText(item.id) ?? "sem-id",
      source_category: categoryName,
      asset_tag: pickFromAliases(entries, [
        "patrimonio",
        "asset_tag",
        "tag_patrimonial",
        "tombamento"
      ]),
      serial_number: pickFromAliases(entries, [
        "serial_number",
        "serial",
        "numero_serie",
        "n_serie",
        "ns",
        "serie"
      ]),
      ip_address: normalizeIp(
        pickFromAliases(entries, ["ip_address", "ip", "endereco_ip", "ipv4"])
      ),
      model: pickFromAliases(entries, ["modelo", "model"]),
      sector: combinedSector,
      manufacturer: pickFromAliases(entries, ["fabricante", "marca", "manufacturer", "vendor"]),
      hostname: pickFromAliases(entries, ["hostname", "host", "nome_host", "nome_rede"]),
      mac_address: normalizeMac(
        pickFromAliases(entries, ["mac_address", "mac", "endereco_mac", "macaddress"])
      ),
      display_name: pickFromAliases(entries, ["display_name", "nome_amigavel", "apelido", "nome"])
    };

    candidate.display_name =
      normalizeText(candidate.display_name) ??
      buildDisplayName({
        hostname: candidate.hostname,
        asset_tag: candidate.asset_tag,
        sector: candidate.sector,
        model: candidate.model,
        ip_address: candidate.ip_address
      });

    if (!candidate.asset_tag && !candidate.serial_number && !candidate.ip_address) {
      continue;
    }

    extracted.push(candidate);
  }

  return extracted;
}

/**
 * [DOC-FUNC] isMissingOrUnknown
 * O que faz: A funcao 'isMissingOrUnknown' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isMissingOrUnknown(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  if (!text) return true;
  return UNKNOWN_VALUES.has(text.toLowerCase());
}

/**
 * [DOC-FUNC] normalizeMatchKey
 * O que faz: A funcao 'normalizeMatchKey' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeMatchKey(value) {
  const text = normalizeText(value);
  return text ? text.toLowerCase() : null;
}

/**
 * [DOC-FUNC] buildIndex
 * O que faz: A funcao 'buildIndex' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: printers, key. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function buildIndex(printers, key) {
  const index = new Map();
  for (const printer of printers) {
    const normalized = normalizeMatchKey(printer[key]);
    if (!normalized) continue;
    if (!index.has(normalized)) index.set(normalized, []);
    index.get(normalized).push(printer);
  }
  return index;
}

/**
 * [DOC-FUNC] pickMatch
 * O que faz: A funcao 'pickMatch' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: candidate, indexes. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function pickMatch(candidate, indexes) {
  const order = [
    { key: "ip_address", index: indexes.byIp },
    { key: "serial_number", index: indexes.bySerial },
    { key: "asset_tag", index: indexes.byAssetTag }
  ];

  let selected = null;
  let strategy = null;

  for (const item of order) {
    const normalized = normalizeMatchKey(candidate[item.key]);
    if (!normalized) continue;
    const hits = item.index.get(normalized) ?? [];

    if (hits.length > 1) {
      return { matched: null, strategy: null, ambiguous: true, reason: `ambiguous_${item.key}` };
    }

    if (hits.length === 0) continue;

    if (!selected) {
      selected = hits[0];
      strategy = item.key;
      continue;
    }

    if (selected.id !== hits[0].id) {
      return { matched: null, strategy: null, ambiguous: true, reason: "cross_key_conflict" };
    }
  }

  if (!selected) {
    return { matched: null, strategy: null, ambiguous: false, reason: "not_found" };
  }

  return { matched: selected, strategy, ambiguous: false, reason: null };
}

/**
 * [DOC-FUNC] buildUpdatePayload
 * O que faz: A funcao 'buildUpdatePayload' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: existing, candidate. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function buildUpdatePayload(existing, candidate) {
  const payload = {};
  const fields = [
    "hostname",
    "sector",
    "asset_tag",
    "serial_number",
    "model",
    "manufacturer",
    "mac_address",
    "ip_address"
  ];

  for (const field of fields) {
    const incoming = normalizeText(candidate[field]);
    if (!incoming) continue;

    if (field === "ip_address") {
      const normalizedIp = normalizeIp(incoming);
      if (!normalizedIp) continue;
      if (isMissingOrUnknown(existing.ip_address)) payload.ip_address = normalizedIp;
      continue;
    }

    if (field === "mac_address") {
      const normalizedMac = normalizeMac(incoming);
      if (!normalizedMac) continue;
      if (isMissingOrUnknown(existing.mac_address)) payload.mac_address = normalizedMac;
      continue;
    }

    if (isMissingOrUnknown(existing[field])) {
      payload[field] = incoming;
    }
  }

  const merged = { ...existing, ...payload };
  const suggestedDisplayName =
    normalizeText(candidate.display_name) ??
    buildDisplayName({
      hostname: merged.hostname,
      asset_tag: merged.asset_tag,
      sector: merged.sector,
      model: merged.model,
      ip_address: merged.ip_address
    });

  if (suggestedDisplayName && isMissingOrUnknown(existing.display_name)) {
    payload.display_name = suggestedDisplayName;
  }

  return payload;
}

/**
 * [DOC-FUNC] parsePrinterInventoryJson
 * O que faz: A funcao 'parsePrinterInventoryJson' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: legacyRaw. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function parsePrinterInventoryJson(legacyRaw) {
  if (
    legacyRaw &&
    typeof legacyRaw === "object" &&
    Array.isArray(legacyRaw.categories) &&
    Array.isArray(legacyRaw.fields) &&
    Array.isArray(legacyRaw.items)
  ) {
    return legacyRaw;
  }

  if (
    legacyRaw &&
    typeof legacyRaw === "object" &&
    legacyRaw.inventoryData &&
    Array.isArray(legacyRaw.inventoryData.items)
  ) {
    return legacyRaw.inventoryData;
  }

  throw new Error(
    "JSON de inventario invalido. Esperado formato com categories/fields/items."
  );
}

/**
 * [DOC-FUNC] printUsage
 * O que faz: A funcao 'printUsage' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function printUsage() {
  console.log("Uso:");
  console.log(
    "  node scripts/backfillLegacyPrinters.mjs --input <arquivo.json> [--write] [--limit 100] [--report report.json]"
  );
  console.log("");
  console.log("Padrao: dry-run (nao grava). Use --write para aplicar updates.");
}

/**
 * [DOC-FUNC] main
 * O que faz: A funcao 'main' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna o resultado da persistencia (dados gravados/atualizados ou erro contextualizado), permitindo auditoria e tratamento adequado na camada chamadora.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    printUsage();
    process.exit(1);
  }

  const cwd = process.cwd();
  loadDotEnvLocal(cwd);

  const inputPath = path.resolve(cwd, args.input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo de entrada nao encontrado: ${inputPath}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  const raw = readJson(inputPath);
  const legacy = parsePrinterInventoryJson(raw);
  const extracted = extractLegacyPrinterRecords(legacy);
  const candidates = args.limit ? extracted.slice(0, args.limit) : extracted;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: printers, error: printerError } = await supabase
    .from("printers")
    .select(
      "id,display_name,hostname,sector,asset_tag,serial_number,model,manufacturer,ip_address,mac_address,last_seen_at,is_active,created_at,updated_at"
    );

  if (printerError) {
    throw new Error(`Erro ao buscar printers no Supabase: ${printerError.message}`);
  }

  const allPrinters = printers ?? [];
  const indexes = {
    byAssetTag: buildIndex(allPrinters, "asset_tag"),
    byIp: buildIndex(allPrinters, "ip_address"),
    bySerial: buildIndex(allPrinters, "serial_number")
  };

  const stats = {
    inventory_items: (legacy.items ?? []).length,
    printer_candidates: candidates.length,
    matched: 0,
    updated: 0,
    unchanged: 0,
    skipped_not_found: 0,
    skipped_ambiguous: 0,
    errors: 0
  };

  const sampleChanges = [];

  for (const candidate of candidates) {
    const match = pickMatch(candidate, indexes);
    if (!match.matched) {
      if (match.ambiguous) stats.skipped_ambiguous += 1;
      else stats.skipped_not_found += 1;
      continue;
    }

    stats.matched += 1;

    const updatePayload = buildUpdatePayload(match.matched, candidate);
    const updateKeys = Object.keys(updatePayload);
    if (updateKeys.length === 0) {
      stats.unchanged += 1;
      continue;
    }

    const before = {
      id: match.matched.id,
      display_name: match.matched.display_name,
      hostname: match.matched.hostname,
      sector: match.matched.sector,
      asset_tag: match.matched.asset_tag,
      serial_number: match.matched.serial_number,
      model: match.matched.model,
      manufacturer: match.matched.manufacturer,
      ip_address: match.matched.ip_address,
      mac_address: match.matched.mac_address
    };

    const after = { ...before, ...updatePayload };

    if (sampleChanges.length < 10) {
      sampleChanges.push({
        matched_by: match.strategy,
        source_category: candidate.source_category,
        source_item_id: candidate.source_item_id,
        before,
        after
      });
    }

    if (args.write) {
      const { error: updateError } = await supabase
        .from("printers")
        .update(updatePayload)
        .eq("id", match.matched.id);

      if (updateError) {
        stats.errors += 1;
        console.error(
          `[erro] printer ${match.matched.id} (${match.strategy}): ${updateError.message}`
        );
        continue;
      }
    }

    stats.updated += 1;
  }

  const report = {
    mode: args.write ? "write" : "dry-run",
    input_file: inputPath,
    stats,
    sample_changes: sampleChanges
  };

  console.log(JSON.stringify(report, null, 2));

  if (args.report) {
    const reportPath = path.resolve(cwd, args.report);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`[ok] Relatorio salvo em: ${reportPath}`);
  }
}

main().catch((error) => {
  console.error(`[fatal] ${error.message}`);
  process.exit(1);
});
