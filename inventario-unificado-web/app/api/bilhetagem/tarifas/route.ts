/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\bilhetagem\tarifas\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const TarifaBodySchema = z.object({
  competencia_mes: z.coerce.number().int().min(1).max(12),
  competencia_ano: z.coerce.number().int().min(2000).max(2100),
  empresa_locadora: z.string().trim().min(2),
  fonte_arquivo: z.string().trim().optional().nullable(),
  substituir_ativos: z.coerce.boolean().optional().default(true),
  tarifas: z.object({
    pb: z.coerce.number().min(0),
    colorida: z.coerce.number().min(0),
  }),
});

/**
 * [DOC-FUNC] normalizeText
 * O que faz: Padroniza dados de 'normalize text' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: value.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * [DOC-FUNC] isMissingTableError
 * O que faz: Executa a rotina principal de 'is missing table error' no contexto deste modulo.
 * Entradas: Parametros esperados: message.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function isMissingTableError(message: string) {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

/**
 * [DOC-FUNC] GET
 * O que faz: Consulta dados de 'get' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: request.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const mes = Number(request.nextUrl.searchParams.get("mes"));
  const ano = Number(request.nextUrl.searchParams.get("ano"));
  const empresa = normalizeText(request.nextUrl.searchParams.get("empresa"));

  const supabase = getSupabaseServerClient();
  // Sempre retorna as tarifas mais recentes primeiro para facilitar auditoria no frontend.
  let query = supabase
    .from("tarifas_bilhetagem")
    .select("id,competencia_mes,competencia_ano,empresa_locadora,tipo_impressao,valor_pagina,fonte_arquivo,ativo,created_at,updated_at")
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (Number.isFinite(mes) && mes >= 1 && mes <= 12) query = query.eq("competencia_mes", mes);
  if (Number.isFinite(ano) && ano >= 2000 && ano <= 2100) query = query.eq("competencia_ano", ano);
  if (empresa) query = query.eq("empresa_locadora", empresa);

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(String(error.message || ""))) {
      return NextResponse.json({ sucesso: false, erro: "Tabela tarifas_bilhetagem ainda nao existe." }, { status: 404 });
    }
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, dados: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * [DOC-FUNC] POST
 * O que faz: Sincroniza/enfila dados de 'post' entre camadas internas e servicos externos.
 * Entradas: Parametros esperados: request.
 * Como executa: Executa transmissao com controle de timeout, retentativa e observabilidade.
 * Retorno/Efeitos: Retorna status operacional com metadados de sucesso ou motivo de falha.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  let parsed: z.infer<typeof TarifaBodySchema>;
  try {
    const body = await request.json();
    parsed = TarifaBodySchema.parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload invalido.";
    return NextResponse.json({ sucesso: false, erro: message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const empresa = normalizeText(parsed.empresa_locadora);
  const fonte = normalizeText(parsed.fonte_arquivo);

  if (parsed.substituir_ativos) {
    // Desativa tarifas antigas da mesma competencia antes do upsert das novas.
    const { error: disableError } = await supabase
      .from("tarifas_bilhetagem")
      .update({ ativo: false })
      .eq("ativo", true)
      .eq("empresa_locadora", empresa)
      .eq("competencia_mes", parsed.competencia_mes)
      .eq("competencia_ano", parsed.competencia_ano);

    if (disableError && !isMissingTableError(String(disableError.message || ""))) {
      return NextResponse.json({ sucesso: false, erro: disableError.message }, { status: 500 });
    }
  }

  const payload = [
    {
      competencia_mes: parsed.competencia_mes,
      competencia_ano: parsed.competencia_ano,
      empresa_locadora: empresa,
      tipo_impressao: "pb",
      valor_pagina: parsed.tarifas.pb,
      fonte_arquivo: fonte || null,
      ativo: true,
    },
    {
      competencia_mes: parsed.competencia_mes,
      competencia_ano: parsed.competencia_ano,
      empresa_locadora: empresa,
      tipo_impressao: "colorida",
      valor_pagina: parsed.tarifas.colorida,
      fonte_arquivo: fonte || null,
      ativo: true,
    },
  ];

  const { data, error } = await supabase
    .from("tarifas_bilhetagem")
    .upsert(payload, { onConflict: "competencia_mes,competencia_ano,empresa_locadora,tipo_impressao", ignoreDuplicates: false })
    .select("id,competencia_mes,competencia_ano,empresa_locadora,tipo_impressao,valor_pagina,fonte_arquivo,ativo,updated_at");

  if (error) {
    if (isMissingTableError(String(error.message || ""))) {
      return NextResponse.json({ sucesso: false, erro: "Tabela tarifas_bilhetagem ainda nao existe." }, { status: 404 });
    }
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: data || [],
      mensagem: "Tarifas de bilhetagem salvas com sucesso.",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

