import { NextRequest, NextResponse } from 'next/server';
import { getInventarios, createInventario } from '@/services/inventarioService';
import { CreateInventarioSchema } from '@/types/inventario';

// GET /api/inventario - list all inventario items
export async function GET() {
  try {
    const inventarios = await getInventarios();
    return NextResponse.json(inventarios);
  } catch (error: any) {
    console.error('[GET /api/inventario]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/inventario - create new inventario item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const createData = CreateInventarioSchema.parse(body);
    const result = await createInventario(createData);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/inventario]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
