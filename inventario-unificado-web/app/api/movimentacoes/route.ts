/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\movimentacoes\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMovimentacoes, createMovimentacao } from '@/services/movimentacaoService';
import { MovimentacaoSchema } from '@/types/movimentacao';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/movimentacoes - list all movimentacoes
/**
 * [DOC-FUNC] GET
 * O que faz: Implementa endpoint HTTP GET 'GET', retornando dados de forma segura e padronizada.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna resposta de leitura tipada/padronizada ou erro claro de validacao/autorizacao/acesso.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const movimentacoes = await getMovimentacoes();
    return NextResponse.json(movimentacoes);
  } catch (error: any) {
    console.error('[GET /api/movimentacoes]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/movimentacoes - create new movimentacao
/**
 * [DOC-FUNC] POST
 * O que faz: Implementa endpoint HTTP POST 'POST', validando payload e processando persistencia/integracao.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna resultado da operacao de escrita/processamento e efeitos de persistencia quando aplicavel.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const payload = MovimentacaoSchema.omit({ nr_movimentacao: true }).parse(body);
    const result = await createMovimentacao(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/movimentacoes]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

