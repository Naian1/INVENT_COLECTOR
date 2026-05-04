import { NextRequest, NextResponse } from 'next/server';
import { getSuprimentos, upsertSuprimento } from '@/services/suprimentosService';
import { SuprimentosSchema } from '@/types/suprimentos';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/suprimentos - list all suprimentos
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
