import { NextRequest, NextResponse } from 'next/server';
import { getMovimentacoes, createMovimentacao } from '@/services/movimentacaoService';
import { MovimentacaoSchema } from '@/types/movimentacao';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/movimentacoes - list all movimentacoes
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
