import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type CargaConsolidado = {
  nr_carga: number;
  nr_competencia: string;
  nm_arquivo: string;
  nr_total_linhas: number;
  dt_importacao: string;
};

type InventarioItem = {
  nr_inventario: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  tp_status: string | null;
  cd_equipamento: number;
  cd_setor: number;
};

type ConsolidadoItem = {
  nr_linha: number;
  nr_patrimonio: string | null;
  nr_serie: string | null;
  nr_id_equipamento: string | null;
  nm_tipo: string | null;
  ds_produto: string | null;
};

function validarCompetencia(competencia: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia);
}

function limparTexto(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  return text ? text : null;
}

function normalizarPatrimonio(value: string | null): string | null {
  const text = limparTexto(value);
  if (!text) return null;
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized || null;
}

function contemFiltro(value: string | null, filtroNormalizado: string | null): boolean {
  if (!filtroNormalizado) return true;
  const normalized = normalizarPatrimonio(value);
  return normalized ? normalized.includes(filtroNormalizado) : false;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const competenciaParam = limparTexto(params.get('competencia'));
    const patrimonioParam = limparTexto(params.get('patrimonio'));
    const limite = Number(params.get('limite') || 500);
    const limiteSeguro = Math.max(50, Math.min(2000, Number.isFinite(limite) ? limite : 500));

    if (competenciaParam && !validarCompetencia(competenciaParam)) {
      return NextResponse.json({ error: 'Competencia invalida. Use MM/AAAA.' }, { status: 400 });
    }

    const filtroPatrimonioNormalizado = normalizarPatrimonio(patrimonioParam);
    const supabase = getSupabaseServerClient();

    const { data: cargasData, error: cargasError } = await supabase
      .from('inventario_consolidado_carga')
      .select('nr_carga, nr_competencia, nm_arquivo, nr_total_linhas, dt_importacao')
      .order('dt_importacao', { ascending: false })
      .limit(24);

    if (cargasError) {
      throw new Error(cargasError.message);
    }

    const cargas: CargaConsolidado[] = (cargasData || []).map((carga) => ({
      nr_carga: Number(carga.nr_carga),
      nr_competencia: String(carga.nr_competencia),
      nm_arquivo: String(carga.nm_arquivo || ''),
      nr_total_linhas: Number(carga.nr_total_linhas || 0),
      dt_importacao: String(carga.dt_importacao || ''),
    }));

    const cargaSelecionada = competenciaParam
      ? cargas.find((item) => item.nr_competencia === competenciaParam) || null
      : (cargas[0] || null);

    const { data: inventarioData, error: inventarioError } = await supabase
      .from('inventario')
      .select('nr_inventario, nr_patrimonio, nr_serie, tp_status, cd_equipamento, cd_setor')
      .order('nr_inventario', { ascending: true });

    if (inventarioError) {
      throw new Error(inventarioError.message);
    }

    const inventarioItems: InventarioItem[] = (inventarioData || []).map((item) => ({
      nr_inventario: Number(item.nr_inventario),
      nr_patrimonio: item.nr_patrimonio ? String(item.nr_patrimonio) : null,
      nr_serie: item.nr_serie ? String(item.nr_serie) : null,
      tp_status: item.tp_status ? String(item.tp_status) : null,
      cd_equipamento: Number(item.cd_equipamento),
      cd_setor: Number(item.cd_setor),
    }));

    let consolidadoItems: ConsolidadoItem[] = [];
    if (cargaSelecionada) {
      const { data: consolidadoData, error: consolidadoError } = await supabase
        .from('inventario_consolidado_linha')
        .select('nr_linha, nr_patrimonio, nr_serie, nr_id_equipamento, nm_tipo, ds_produto')
        .eq('nr_carga', cargaSelecionada.nr_carga)
        .order('nr_linha', { ascending: true });

      if (consolidadoError) {
        throw new Error(consolidadoError.message);
      }

      consolidadoItems = (consolidadoData || []).map((item) => ({
        nr_linha: Number(item.nr_linha),
        nr_patrimonio: item.nr_patrimonio ? String(item.nr_patrimonio) : null,
        nr_serie: item.nr_serie ? String(item.nr_serie) : null,
        nr_id_equipamento: item.nr_id_equipamento ? String(item.nr_id_equipamento) : null,
        nm_tipo: item.nm_tipo ? String(item.nm_tipo) : null,
        ds_produto: item.ds_produto ? String(item.ds_produto) : null,
      }));
    }

    const inventarioSemPatrimonio = inventarioItems.filter((item) => !normalizarPatrimonio(item.nr_patrimonio));
    const consolidadoSemPatrimonio = consolidadoItems.filter((item) => !normalizarPatrimonio(item.nr_patrimonio));

    const invPorPatrimonio = new Map<string, InventarioItem[]>();
    for (const item of inventarioItems) {
      const key = normalizarPatrimonio(item.nr_patrimonio);
      if (!key) continue;
      const current = invPorPatrimonio.get(key) || [];
      current.push(item);
      invPorPatrimonio.set(key, current);
    }

    const consPorPatrimonio = new Map<string, ConsolidadoItem[]>();
    for (const item of consolidadoItems) {
      const key = normalizarPatrimonio(item.nr_patrimonio);
      if (!key) continue;
      const current = consPorPatrimonio.get(key) || [];
      current.push(item);
      consPorPatrimonio.set(key, current);
    }

    const duplicidadesInventario = Array.from(invPorPatrimonio.entries())
      .filter(([key, list]) => list.length > 1 && (!filtroPatrimonioNormalizado || key.includes(filtroPatrimonioNormalizado)))
      .slice(0, limiteSeguro)
      .map(([key, list]) => ({
        patrimonio_normalizado: key,
        quantidade: list.length,
        itens: list,
      }));

    const duplicidadesConsolidado = Array.from(consPorPatrimonio.entries())
      .filter(([key, list]) => list.length > 1 && (!filtroPatrimonioNormalizado || key.includes(filtroPatrimonioNormalizado)))
      .slice(0, limiteSeguro)
      .map(([key, list]) => ({
        patrimonio_normalizado: key,
        quantidade: list.length,
        itens: list,
      }));

    const consolidadoNaoNoInventario = consolidadoItems
      .filter((item) => {
        const key = normalizarPatrimonio(item.nr_patrimonio);
        if (!key) return false;
        if (!contemFiltro(item.nr_patrimonio, filtroPatrimonioNormalizado)) return false;
        return !invPorPatrimonio.has(key);
      })
      .slice(0, limiteSeguro);

    const inventarioNaoNoConsolidado = inventarioItems
      .filter((item) => {
        const key = normalizarPatrimonio(item.nr_patrimonio);
        if (!key) return false;
        if (!contemFiltro(item.nr_patrimonio, filtroPatrimonioNormalizado)) return false;
        return !consPorPatrimonio.has(key);
      })
      .slice(0, limiteSeguro);

    return NextResponse.json({
      filtros: {
        competencia: cargaSelecionada?.nr_competencia || competenciaParam,
        patrimonio: patrimonioParam,
        limite: limiteSeguro,
      },
      cargas,
      cargaSelecionada,
      resumo: {
        totalInventario: inventarioItems.length,
        totalConsolidado: consolidadoItems.length,
        inventarioSemPatrimonio: inventarioSemPatrimonio.length,
        consolidadoSemPatrimonio: consolidadoSemPatrimonio.length,
        duplicidadesInventario: duplicidadesInventario.length,
        duplicidadesConsolidado: duplicidadesConsolidado.length,
        consolidadoNaoNoInventario: consolidadoNaoNoInventario.length,
        inventarioNaoNoConsolidado: inventarioNaoNoConsolidado.length,
      },
      duplicidades: {
        inventario: duplicidadesInventario,
        consolidado: duplicidadesConsolidado,
      },
      divergencias: {
        consolidadoNaoNoInventario,
        inventarioNaoNoConsolidado,
      },
      amostras: {
        inventarioSemPatrimonio: inventarioSemPatrimonio.slice(0, limiteSeguro),
        consolidadoSemPatrimonio: consolidadoSemPatrimonio.slice(0, limiteSeguro),
      },
    });
  } catch (error: any) {
    console.error('[GET /api/inventario/conciliacao]', error);
    return NextResponse.json({ error: error.message || 'Falha ao executar conciliacao.' }, { status: 500 });
  }
}
