import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ResultadoServico } from "@/services/impressorasService";
import type { ImpressoraVisaoGeral, SuprimentoResumo } from "@/types/impressora";

type ImpressoraRow = {
  id: string;
  patrimonio: string;
  ip: string;
  setor: string;
  localizacao: string | null;
  modelo: string;
  fabricante: string | null;
  numero_serie: string | null;
  hostname: string | null;
  ativo: boolean;
  ultima_coleta_em: string | null;
};

type StatusRow = {
  impressora_id: string;
  status: string;
  coletado_em: string;
};

type LeituraRow = {
  impressora_id: string;
  contador_total_paginas: number;
  coletado_em: string;
};

type SuprimentoRow = {
  impressora_id: string;
  coletado_em: string;
  chave_suprimento: string;
  nome_suprimento: string;
  nivel_percentual: number | null;
  status_suprimento: string;
};

type CategoriaImpressoraRow = {
  id: string;
  nome: string;
};

type LinhaInventarioRow = {
  id: string;
  categoria_id: string;
  setor: string | null;
  localizacao: string | null;
  ativo: boolean;
};

type CampoCategoriaRow = {
  id: string;
  categoria_id: string;
  tipo_semantico: string;
  ativo: boolean;
};

type LinhaValorRow = {
  linha_id: string;
  campo_id: string;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_booleano: boolean | null;
  valor_data: string | null;
  valor_ip: string | null;
  valor_json: unknown;
};

const LIMITE_MAXIMO_ROWS_QUERY = 1000;

function normalizarIp(value: string) {
  return value.replace(/\/32$/, "");
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function limparTexto(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v.length ? v : null;
}

function extrairValorTexto(row: LinhaValorRow) {
  if (row.valor_texto !== null && row.valor_texto !== undefined) return limparTexto(row.valor_texto);
  if (row.valor_numero !== null && row.valor_numero !== undefined) return limparTexto(String(row.valor_numero));
  if (row.valor_booleano !== null && row.valor_booleano !== undefined) return row.valor_booleano ? "true" : "false";
  if (row.valor_data !== null && row.valor_data !== undefined) return limparTexto(row.valor_data);
  if (row.valor_ip !== null && row.valor_ip !== undefined) return limparTexto(normalizarIp(String(row.valor_ip)));
  if (row.valor_json !== null && row.valor_json !== undefined) return limparTexto(JSON.stringify(row.valor_json));
  return null;
}

function pickSemantico(
  bag: Map<string, string>,
  semanticos: string[]
) {
  for (const sem of semanticos) {
    const value = limparTexto(bag.get(sem) ?? null);
    if (value) return value;
  }
  return null;
}

function normalizarTextoComparacao(value: string | null | undefined) {
  const txt = limparTexto(value);
  return txt ? txt.toLowerCase() : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function carregarPendentesInventario(
  operacionais: ImpressoraVisaoGeral[]
): Promise<ResultadoServico<ImpressoraVisaoGeral[]>> {
  const supabase = getSupabaseServerClient();

  const patrimonioOps = new Set<string>();
  const ipOps = new Set<string>();
  for (const row of operacionais) {
    const pat = normalizarTextoComparacao(row.patrimonio);
    if (pat) patrimonioOps.add(pat);
    const ip = normalizarTextoComparacao(normalizarIp(row.ip));
    if (ip) ipOps.add(ip);
  }

  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias_inventario")
    .select("id,nome")
    .eq("ativo", true)
    .ilike("nome", "%impress%");

  if (categoriasError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar categorias de impressoras do inventario."
    };
  }

  if (!categorias || categorias.length === 0) {
    return { success: true, data: [] };
  }

  const categoriaIds = categorias.map((row) => String(row.id));

  const { data: linhas, error: linhasError } = await supabase
    .from("linhas_inventario")
    .select("id,categoria_id,setor,localizacao,ativo")
    .in("categoria_id", categoriaIds)
    .eq("ativo", true);

  if (linhasError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar linhas de inventario para impressoras."
    };
  }

  if (!linhas || linhas.length === 0) {
    return { success: true, data: [] };
  }

  const linhaIds = linhas.map((row) => String(row.id));

  const { data: campos, error: camposError } = await supabase
    .from("categoria_campos")
    .select("id,categoria_id,tipo_semantico,ativo")
    .in("categoria_id", categoriaIds)
    .eq("ativo", true)
    .in("tipo_semantico", [
      "patrimonio",
      "impressora_patrimonio",
      "ip",
      "impressora_ip",
      "modelo",
      "impressora_modelo",
      "fabricante",
      "numero_serie",
      "hostname",
      "setor",
      "localizacao"
    ]);

  if (camposError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar campos semanticos das categorias de impressora."
    };
  }

  if (!campos || campos.length === 0) {
    return { success: true, data: [] };
  }

  const campoIds = campos.map((row) => String(row.id));
  const campoSemanticoMap = new Map<string, string>();
  for (const campo of campos as CampoCategoriaRow[]) {
    campoSemanticoMap.set(String(campo.id), String(campo.tipo_semantico));
  }

  const { data: valores, error: valoresError } = await supabase
    .from("linha_valores_campos")
    .select("linha_id,campo_id,valor_texto,valor_numero,valor_booleano,valor_data,valor_ip,valor_json")
    .in("linha_id", linhaIds)
    .in("campo_id", campoIds);

  if (valoresError) {
    return {
      success: false,
      status: 500,
      error: "Falha ao carregar valores das linhas de impressoras no inventario."
    };
  }

  const valorSemanticoPorLinha = new Map<string, Map<string, string>>();
  for (const row of (valores ?? []) as LinhaValorRow[]) {
    const linhaId = String(row.linha_id);
    const sem = campoSemanticoMap.get(String(row.campo_id));
    if (!sem) continue;

    const valor = extrairValorTexto(row);
    if (!valor) continue;

    if (!valorSemanticoPorLinha.has(linhaId)) {
      valorSemanticoPorLinha.set(linhaId, new Map<string, string>());
    }
    const bag = valorSemanticoPorLinha.get(linhaId) as Map<string, string>;
    if (!bag.has(sem)) {
      bag.set(sem, valor);
    }
  }

  const categoriasMap = new Map<string, string>();
  for (const cat of categorias as CategoriaImpressoraRow[]) {
    categoriasMap.set(String(cat.id), String(cat.nome));
  }

  const pendentes: ImpressoraVisaoGeral[] = [];
  for (const linha of linhas as LinhaInventarioRow[]) {
    const linhaId = String(linha.id);
    const bag = valorSemanticoPorLinha.get(linhaId) ?? new Map<string, string>();

    const patrimonio = pickSemantico(bag, ["impressora_patrimonio", "patrimonio"]);
    const ip = pickSemantico(bag, ["impressora_ip", "ip"]);
    const modelo = pickSemantico(bag, ["impressora_modelo", "modelo"]);
    const fabricante = pickSemantico(bag, ["fabricante"]);
    const numeroSerie = pickSemantico(bag, ["numero_serie"]);
    const hostname = pickSemantico(bag, ["hostname"]);
    const setor = pickSemantico(bag, ["setor"]) ?? limparTexto(linha.setor) ?? categoriasMap.get(String(linha.categoria_id)) ?? "Inventario";
    const localizacao = pickSemantico(bag, ["localizacao"]) ?? limparTexto(linha.localizacao);

    const patNorm = normalizarTextoComparacao(patrimonio);
    const ipNorm = normalizarTextoComparacao(ip ? normalizarIp(ip) : null);
    if (!patNorm && !ipNorm) continue;

    const jaOperacional = (patNorm && patrimonioOps.has(patNorm)) || (ipNorm && ipOps.has(ipNorm));
    if (jaOperacional) continue;

    pendentes.push({
      id: `pendente:${linhaId}`,
      patrimonio: patrimonio ?? "",
      ip: ip ? normalizarIp(ip) : "",
      setor,
      localizacao: localizacao ?? null,
      modelo: modelo ?? "",
      fabricante: fabricante ?? null,
      numero_serie: numeroSerie ?? null,
      hostname: hostname ?? null,
      ativo: true,
      ultima_coleta_em: null,
      status_atual: "nao_operacional",
      contador_paginas_atual: null,
      menor_nivel_suprimento: null,
      resumo_suprimentos: [],
      operacional: false,
      origem_linha_id: linhaId,
      display_name_legacy: null
    });
  }

  return { success: true, data: pendentes };
}

export async function listarVisaoGeralImpressoras(options?: {
  incluir_nao_operacionais?: boolean;
}): Promise<ResultadoServico<ImpressoraVisaoGeral[]>> {
  const supabase = getSupabaseServerClient();
  const incluirNaoOperacionais = options?.incluir_nao_operacionais === true;

  const { data: impressoras, error: impressorasError } = await supabase
    .from("impressoras")
    .select("id,patrimonio,ip,setor,localizacao,modelo,fabricante,numero_serie,hostname,ativo,ultima_coleta_em")
    .order("setor", { ascending: true })
    .order("ip", { ascending: true });

  if (impressorasError) {
    return { success: false, status: 500, error: "Erro ao buscar impressoras." };
  }

  const impressorasRows = (impressoras ?? []) as ImpressoraRow[];
  if (impressorasRows.length === 0 && !incluirNaoOperacionais) {
    return { success: true, data: [] };
  }

  const impressoraIds = impressorasRows.map((row) => row.id);
  const limiteStatusInicial = clamp(impressoraIds.length * 2, 160, 700);
  const limiteLeituraInicial = clamp(impressoraIds.length * 2, 160, 700);
  const limiteSuprimentoInicial = clamp(impressoraIds.length * 6, 240, 900);

  const [
    { data: statusRows, error: statusError },
    { data: leituraRows, error: leituraError },
    { data: suprimentoRows, error: suprimentoError }
  ] = await Promise.all([
    impressoraIds.length
      ? supabase
          .from("telemetria_impressoras")
          .select("impressora_id,status,coletado_em")
          .in("impressora_id", impressoraIds)
          .order("coletado_em", { ascending: false })
          .limit(Math.min(limiteStatusInicial, LIMITE_MAXIMO_ROWS_QUERY))
      : Promise.resolve({ data: [], error: null }),
    impressoraIds.length
      ? supabase
          .from("leituras_paginas_impressoras")
          .select("impressora_id,contador_total_paginas,coletado_em")
          .eq("valido", true)
          .in("impressora_id", impressoraIds)
          .order("coletado_em", { ascending: false })
          .limit(Math.min(limiteLeituraInicial, LIMITE_MAXIMO_ROWS_QUERY))
      : Promise.resolve({ data: [], error: null }),
    impressoraIds.length
      ? supabase
          .from("suprimentos_impressoras")
          .select("impressora_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,status_suprimento")
          .eq("valido", true)
          .in("impressora_id", impressoraIds)
          .order("coletado_em", { ascending: false })
          .limit(Math.min(limiteSuprimentoInicial, LIMITE_MAXIMO_ROWS_QUERY))
      : Promise.resolve({ data: [], error: null })
  ]);

  if (statusError || leituraError || suprimentoError) {
    return {
      success: false,
      status: 500,
      error: "Erro ao montar visao geral das impressoras."
    };
  }

  const latestStatusByImpressora = new Map<string, StatusRow>();
  for (const row of (statusRows ?? []) as StatusRow[]) {
    if (!latestStatusByImpressora.has(row.impressora_id)) {
      latestStatusByImpressora.set(row.impressora_id, row);
    }
  }

  const latestLeituraByImpressora = new Map<string, LeituraRow>();
  for (const row of (leituraRows ?? []) as LeituraRow[]) {
    if (!latestLeituraByImpressora.has(row.impressora_id)) {
      latestLeituraByImpressora.set(row.impressora_id, row);
    }
  }

  const snapshotSuprimentosByImpressora = new Map<
    string,
    {
      coletado_em: string;
      resumo: SuprimentoResumo[];
      menor_nivel: number | null;
      chaves: Set<string>;
    }
  >();

  const registrarSuprimentos = (rows: SuprimentoRow[]) => {
    for (const row of rows) {
      const atual = snapshotSuprimentosByImpressora.get(row.impressora_id);
      const nivel = toFiniteNumber(row.nivel_percentual);

      if (!atual) {
        snapshotSuprimentosByImpressora.set(row.impressora_id, {
          coletado_em: row.coletado_em,
          resumo: [
            {
              chave_suprimento: row.chave_suprimento,
              nome_suprimento: row.nome_suprimento,
              nivel_percentual: nivel,
              status_suprimento: row.status_suprimento
            }
          ],
          menor_nivel: nivel,
          chaves: new Set([row.chave_suprimento])
        });
        continue;
      }

      if (new Date(row.coletado_em).getTime() > new Date(atual.coletado_em).getTime()) {
        atual.coletado_em = row.coletado_em;
      }

      if (atual.chaves.has(row.chave_suprimento)) {
        continue;
      }
      atual.chaves.add(row.chave_suprimento);

      atual.resumo.push({
        chave_suprimento: row.chave_suprimento,
        nome_suprimento: row.nome_suprimento,
        nivel_percentual: nivel,
        status_suprimento: row.status_suprimento
      });

      if (nivel !== null && (atual.menor_nivel === null || nivel < atual.menor_nivel)) {
        atual.menor_nivel = nivel;
      }
    }
  };

  registrarSuprimentos((suprimentoRows ?? []) as SuprimentoRow[]);

  const idsSemStatus = impressoraIds.filter((id) => !latestStatusByImpressora.has(id));
  const idsSemLeitura = impressoraIds.filter((id) => !latestLeituraByImpressora.has(id));
  const idsSemSuprimentos = impressoraIds.filter((id) => !snapshotSuprimentosByImpressora.has(id));

  if (idsSemStatus.length || idsSemLeitura.length || idsSemSuprimentos.length) {
    const [
      { data: statusFallbackRows, error: statusFallbackError },
      { data: leituraFallbackRows, error: leituraFallbackError },
      { data: suprimentoFallbackRows, error: suprimentoFallbackError }
    ] = await Promise.all([
      idsSemStatus.length
        ? supabase
            .from("telemetria_impressoras")
            .select("impressora_id,status,coletado_em")
            .in("impressora_id", idsSemStatus)
            .order("coletado_em", { ascending: false })
            .limit(Math.min(clamp(idsSemStatus.length * 3, 60, LIMITE_MAXIMO_ROWS_QUERY), LIMITE_MAXIMO_ROWS_QUERY))
        : Promise.resolve({ data: [], error: null }),
      idsSemLeitura.length
        ? supabase
            .from("leituras_paginas_impressoras")
            .select("impressora_id,contador_total_paginas,coletado_em")
            .eq("valido", true)
            .in("impressora_id", idsSemLeitura)
            .order("coletado_em", { ascending: false })
            .limit(Math.min(clamp(idsSemLeitura.length * 3, 60, LIMITE_MAXIMO_ROWS_QUERY), LIMITE_MAXIMO_ROWS_QUERY))
        : Promise.resolve({ data: [], error: null }),
      idsSemSuprimentos.length
        ? supabase
            .from("suprimentos_impressoras")
            .select("impressora_id,coletado_em,chave_suprimento,nome_suprimento,nivel_percentual,status_suprimento")
            .eq("valido", true)
            .in("impressora_id", idsSemSuprimentos)
            .order("coletado_em", { ascending: false })
            .limit(Math.min(clamp(idsSemSuprimentos.length * 10, 120, LIMITE_MAXIMO_ROWS_QUERY), LIMITE_MAXIMO_ROWS_QUERY))
        : Promise.resolve({ data: [], error: null })
    ]);

    if (statusFallbackError || leituraFallbackError || suprimentoFallbackError) {
      return {
        success: false,
        status: 500,
        error: "Erro ao montar visao geral das impressoras."
      };
    }

    for (const row of (statusFallbackRows ?? []) as StatusRow[]) {
      if (!latestStatusByImpressora.has(row.impressora_id)) {
        latestStatusByImpressora.set(row.impressora_id, row);
      }
    }

    for (const row of (leituraFallbackRows ?? []) as LeituraRow[]) {
      if (!latestLeituraByImpressora.has(row.impressora_id)) {
        latestLeituraByImpressora.set(row.impressora_id, row);
      }
    }

    registrarSuprimentos((suprimentoFallbackRows ?? []) as SuprimentoRow[]);
  }

  const visaoOperacional: ImpressoraVisaoGeral[] = impressorasRows.map((impressora) => {
    const latestStatus = latestStatusByImpressora.get(impressora.id);
    const latestLeitura = latestLeituraByImpressora.get(impressora.id);
    const latestSuprimentos = snapshotSuprimentosByImpressora.get(impressora.id);

    return {
      id: impressora.id,
      patrimonio: impressora.patrimonio,
      ip: normalizarIp(impressora.ip),
      setor: impressora.setor,
      localizacao: impressora.localizacao ?? null,
      modelo: impressora.modelo,
      fabricante: impressora.fabricante ?? null,
      numero_serie: impressora.numero_serie ?? null,
      hostname: impressora.hostname ?? null,
      ativo: impressora.ativo,
      ultima_coleta_em: impressora.ultima_coleta_em,
      status_atual: latestStatus?.status ?? "unknown",
      contador_paginas_atual: latestLeitura ? Number(latestLeitura.contador_total_paginas) : null,
      menor_nivel_suprimento: latestSuprimentos?.menor_nivel ?? null,
      resumo_suprimentos: latestSuprimentos?.resumo ?? [],
      operacional: true,
      origem_linha_id: null,
      display_name_legacy: null
    };
  });

  if (!incluirNaoOperacionais) {
    return { success: true, data: visaoOperacional };
  }

  const pendentes = await carregarPendentesInventario(visaoOperacional);
  if (!pendentes.success) {
    return pendentes;
  }

  const merged = [...visaoOperacional, ...pendentes.data].sort((a, b) => {
    if (a.operacional !== b.operacional) return a.operacional ? -1 : 1;
    const setorCmp = String(a.setor ?? "").localeCompare(String(b.setor ?? ""));
    if (setorCmp !== 0) return setorCmp;
    return String(a.ip ?? "").localeCompare(String(b.ip ?? ""));
  });

  return { success: true, data: merged };
}
