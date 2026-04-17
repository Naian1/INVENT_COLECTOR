import { getSupabaseServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/inventario/postos_de_trabalho?aba=9-andar&search=patrimonio
 * Buscar registros de uma tabela com opcional filtro por aba
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tabela: string }> }
) {
  try {
    const { tabela } = await params;
    const { searchParams } = new URL(req.url);
    const aba = searchParams.get('aba');
    const search = searchParams.get('search');

    if (!tabela) {
      return NextResponse.json(
        { erro: 'Tabela não especificada' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    let query = supabase.from(tabela).select('id,aba,setor,local_descricao,hostname_referencia,status_posto,observacao,ativo,criado_em,atualizado_em').limit(500);

    // Se houver slug de aba, filtrar por aba (não aba_id)
    if (aba) {
      query = query.eq('aba', aba);
    }

    // Se houver busca, filtrar por patrimonio ou hostname
    if (search) {
      query = query.or(
        `patrimonio.ilike.%${search}%,hostname.ilike.%${search}%,nm_ip.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Erro ao buscar ${tabela}:`, error);
      return NextResponse.json(
        { erro: `Erro ao buscar registros de ${tabela}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json(
      { erro: err.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
