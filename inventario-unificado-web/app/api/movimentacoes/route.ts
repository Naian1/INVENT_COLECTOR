import { NextRequest, NextResponse } from 'next/server';
import { getMovimentacoes, createMovimentacao } from '@/services/movimentacaoService';

// GET /api/movimentacoes - list all movimentacoes
export async function GET() {
  try {
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
    const body = await request.json();
    const result = await createMovimentacao(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/movimentacoes]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
