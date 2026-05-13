/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\suprimentos\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSuprimentos, upsertSuprimento } from '@/services/suprimentosService';
import { SuprimentosSchema } from '@/types/suprimentos';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/suprimentos - list all suprimentos
/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const suprimentos = await getSuprimentos();
    return NextResponse.json(suprimentos);
  } catch (error: any) {
    console.error('[GET /api/suprimentos]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/suprimentos - upsert suprimento (update or insert)
// This endpoint is used primarily by the SNMP collector
/**
 * [DOC-FUNC] POST
 * O que faz: Implementa o endpoint HTTP POST 'POST' para receber payload, validar regras e processar/gravar dados.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const payload = SuprimentosSchema.omit({
      cd_suprimento: true,
      dt_criacao: true,
      dt_atualizacao: true,
    }).parse(body);
    const result = await upsertSuprimento(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/suprimentos]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

