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
 * O que faz: Normaliza valores na funcao 'normalizeText', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * [DOC-FUNC] isMissingTableError
 * O que faz: Avalia uma condicao booleana na funcao 'isMissingTableError' para decidir o caminho de execucao do modulo.
 * Entradas: Analisa parametros/contexto (message) e possiveis variaveis de ambiente/estado atual.
 * Como executa: Aplica comparacoes diretas e regras simples de validacao para classificar o estado como verdadeiro ou falso.
 * Retorno/Efeitos: Retorna um indicador de controle que habilita, bloqueia ou redireciona as proximas etapas do fluxo.
 */
function isMissingTableError(message: string) {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET', usado para leitura de dados pela interface e por integracoes.
 * Entradas: Le query params, cabecalhos/autenticacao e contexto da requisicao; assinatura local: request.
 * Como executa: Valida filtros recebidos, consulta servicos/repositorios, trata erros de dominio e padroniza o payload de resposta.
 * Retorno/Efeitos: Devolve JSON com status HTTP coerente (200/4xx/5xx), sem gravacao de estado no fluxo principal.
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
 * O que faz: Implementa o endpoint HTTP POST 'POST', recebendo dados para criacao, ingestao ou processamento.
 * Entradas: Consome body da requisicao, identidade/permissoes e argumentos auxiliares; assinatura local: request.
 * Como executa: Valida o corpo recebido, aplica regras de negocio, chama servicos de escrita/processamento e concentra tratamento de excecoes.
 * Retorno/Efeitos: Retorna JSON com resultado da operacao e status HTTP adequado; pode gerar persistencia, auditoria e eventos internos.
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

