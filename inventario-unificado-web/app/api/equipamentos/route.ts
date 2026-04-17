import { NextRequest, NextResponse } from 'next/server';
import { getEquipamentos, createEquipamento } from '@/services/equipamentoService';

// GET /api/equipamentos - list all equipamentos
export async function GET() {
  try {
    const equipamentos = await getEquipamentos();
    return NextResponse.json(equipamentos);
  } catch (error: any) {
    console.error('[GET /api/equipamentos]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/equipamentos - create new equipamento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createEquipamento(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/equipamentos]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
