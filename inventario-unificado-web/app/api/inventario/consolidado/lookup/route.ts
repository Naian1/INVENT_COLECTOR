import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

function validarCompetencia(competencia: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia);
}

function limparTexto(value: string | null): string | null {
  if (!value) return null;
  const texto = value.trim();
  return texto ? texto : null;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const patrimonio = limparTexto(params.get('patrimonio'));
    const competencia = limparTexto(params.get('competencia'));

    if (!patrimonio) {
      return NextResponse.json({ error: 'Informe o patrimonio para busca.' }, { status: 400 });
    }

    if (competencia && !validarCompetencia(competencia)) {
      return NextResponse.json({ error: 'Competencia invalida. Use MM/AAAA.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    let cargaSelecionada: { nr_carga: number; nr_competencia: string } | null = null;

    if (competencia) {
      const { data, error } = await supabase
        .from('inventario_consolidado_carga')
        .select('nr_carga, nr_competencia')
        .eq('nr_competencia', competencia)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data?.nr_carga) {
        cargaSelecionada = {
          nr_carga: Number(data.nr_carga),
          nr_competencia: String(data.nr_competencia),
        };
      }
    } else {
      const { data, error } = await supabase
        .from('inventario_consolidado_carga')
        .select('nr_carga, nr_competencia')
        .order('dt_importacao', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data?.nr_carga) {
        cargaSelecionada = {
          nr_carga: Number(data.nr_carga),
          nr_competencia: String(data.nr_competencia),
        };
      }
    }

    if (!cargaSelecionada) {
      return NextResponse.json({ encontrado: false, motivo: 'Sem consolidado cadastrado.' });
    }

    const { data: linhas, error: linhasError } = await supabase
      .from('inventario_consolidado_linha')
      .select(
        'nr_linha, nr_patrimonio, nr_serie, nm_tipo, ds_produto, nr_id_equipamento, nm_cliente, nm_local, tp_status',
      )
      .eq('nr_carga', cargaSelecionada.nr_carga)
      .ilike('nr_patrimonio', `%${patrimonio}%`)
      .order('nr_linha', { ascending: true })
      .limit(10);

    if (linhasError) {
      throw new Error(linhasError.message);
    }

    if (!linhas || linhas.length === 0) {
      return NextResponse.json({
        encontrado: false,
        competencia: cargaSelecionada.nr_competencia,
        motivo: 'Patrimonio nao encontrado na competencia selecionada.',
      });
    }

    const correspondenciaExata =
      linhas.find(
        (item) =>
          String(item.nr_patrimonio || '').trim().toUpperCase() === patrimonio.toUpperCase(),
      ) || linhas[0];

    return NextResponse.json({
      encontrado: true,
      competencia: cargaSelecionada.nr_competencia,
      item: correspondenciaExata,
      candidatos: linhas,
    });
  } catch (error: any) {
    console.error('[GET /api/inventario/consolidado/lookup]', error);
    return NextResponse.json({ error: error.message || 'Falha ao buscar patrimonio.' }, { status: 500 });
  }
}
