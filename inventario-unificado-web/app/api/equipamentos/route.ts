import { NextRequest, NextResponse } from 'next/server';
import { getEquipamentos, createEquipamento } from '@/services/equipamentoService';
import { CreateEquipamentoSchema } from '@/types/equipamento';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/equipamentos - list all equipamentos
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

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
    const auth = await authenticateApiRequest(request, { requireAdmin: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const payload = CreateEquipamentoSchema.parse(body);
    const result = await createEquipamento(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/equipamentos]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
