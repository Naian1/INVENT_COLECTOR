import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { CreateTelemetriaPagecountInput } from '@/types/telemetria';

// GET /api/telemetria-pagecount - list all telemetria records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const inventarioId = searchParams.get('nr_inventario');

    let query = supabase.from('telemetria_pagecount').select('*');

    if (inventarioId) {
      query = query.eq('nr_inventario', parseInt(inventarioId));
    }

    const { data, error } = await query.order('dt_coleta', { ascending: false }).limit(1000);

    if (error) throw new Error(`Erro ao listar telemetria: ${error.message}`);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('[GET /api/telemetria-pagecount]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/telemetria-pagecount - insert new telemetria record (append-only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar campos obrigatórios
    if (!body.nr_inventario || body.nr_paginas_impressas === undefined) {
      return NextResponse.json(
        { error: 'nr_inventario e nr_paginas_impressas são obrigatórios' },
        { status: 400 },
      );
    }

    const payload: CreateTelemetriaPagecountInput = {
      nr_inventario: body.nr_inventario,
      nr_patrimonio: body.nr_patrimonio,
      nr_paginas_impressas: body.nr_paginas_impressas,
      dt_coleta: body.dt_coleta ? new Date(body.dt_coleta) : new Date(),
    };

    const { data, error } = await supabase
      .from('telemetria_pagecount')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(`Erro ao inserir telemetria: ${error.message}`);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/telemetria-pagecount]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
