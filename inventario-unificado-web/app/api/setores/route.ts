import { NextRequest, NextResponse } from 'next/server';
import { getSetores, createSetor } from '@/services/setorService';

// GET /api/setores - list all setores
export async function GET() {
  try {
    const setores = await getSetores();
    return NextResponse.json(setores);
  } catch (error: any) {
    console.error('[GET /api/setores]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/setores - create new setor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createSetor(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/setores]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
