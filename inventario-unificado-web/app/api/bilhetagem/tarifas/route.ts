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
 * O que faz: A funcao 'normalizeText' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * [DOC-FUNC] isMissingTableError
 * O que faz: A funcao 'isMissingTableError' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: message. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function isMissingTableError(message: string) {
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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
 * O que faz: A funcao 'POST' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) persiste alteracoes somente quando as regras de negocio permitem; 5) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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

