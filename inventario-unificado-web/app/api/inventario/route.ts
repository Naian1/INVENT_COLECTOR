/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInventarios, createInventario } from '@/services/inventarioService';
import { CreateInventarioSchema } from '@/types/inventario';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/inventario - list all inventario items
/**
 * [DOC-FUNC] GET
 * Objetivo: Executa a rotina de 'g et'.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const inventarios = await getInventarios();
    return NextResponse.json(inventarios);
  } catch (error: any) {
    console.error('[GET /api/inventario]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/inventario - create new inventario item
/**
 * [DOC-FUNC] POST
 * Objetivo: Executa a rotina de 'p os t'.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const createData = CreateInventarioSchema.parse(body);
    const result = await createInventario(createData);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/inventario]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

