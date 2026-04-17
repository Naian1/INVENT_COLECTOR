import { NextRequest, NextResponse } from 'next/server';
import { getInventarioById, updateInventario, deleteInventario, moveInventarioToSetor } from '@/services/inventarioService';

// GET /api/inventario/[id] - get specific inventario item
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id = '?';
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    const inventario = await getInventarioById(parseInt(id));

    if (!inventario) {
      return NextResponse.json({ error: 'Inventário não encontrado' }, { status: 404 });
    }

    return NextResponse.json(inventario);
  } catch (error: any) {
    console.error(`[GET /api/inventario/${id}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/inventario/[id] - update inventario item
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id = '?';
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    const body = await request.json();

    // Check if this is a move operation
    if (body.action === 'move' && body.novoSetorId) {
      const result = await moveInventarioToSetor(
        parseInt(id),
        body.novoSetorId,
        body.motivo,
      );
      return NextResponse.json(result);
    }

    // Regular update
    const result = await updateInventario(parseInt(id), body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[PUT /api/inventario/${id}]`, error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE /api/inventario/[id] - delete inventario item
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id = '?';
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    await deleteInventario(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[DELETE /api/inventario/${id}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
