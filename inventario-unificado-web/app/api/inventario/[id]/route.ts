import { NextRequest, NextResponse } from 'next/server';
import { getInventarioById, updateInventario, deleteInventario, moveInventarioToSetor } from '@/services/inventarioService';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// GET /api/inventario/[id] - get specific inventario item
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id = '?';
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;

    // Backward-compatible behavior: non-numeric path segment is treated as dynamic table name.
    if (!/^\d+$/.test(id)) {
      const tabela = id;
      const { searchParams } = new URL(request.url);
      const aba = searchParams.get('aba');
      const search = searchParams.get('search');

      const supabase = getSupabaseServerClient();
      let query = supabase
        .from(tabela)
        .select('id,aba,setor,local_descricao,hostname_referencia,status_posto,observacao,ativo,criado_em,atualizado_em')
        .limit(500);

      if (aba) {
        query = query.eq('aba', aba);
      }

      if (search) {
        query = query.or(`patrimonio.ilike.%${search}%,hostname.ilike.%${search}%,nm_ip.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Erro ao buscar ${tabela}:`, error);
        return NextResponse.json({ erro: `Erro ao buscar registros de ${tabela}` }, { status: 500 });
      }

      return NextResponse.json(data || []);
    }

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
