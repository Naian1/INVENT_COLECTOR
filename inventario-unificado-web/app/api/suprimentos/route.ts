import { NextRequest, NextResponse } from 'next/server';
import { getSuprimentos, upsertSuprimento } from '@/services/suprimentosService';

// GET /api/suprimentos - list all suprimentos
export async function GET() {
  try {
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
    const body = await request.json();
    const result = await upsertSuprimento(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/suprimentos]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
