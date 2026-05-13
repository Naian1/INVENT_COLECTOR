/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\setores\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSetores, createSetor } from '@/services/setorService';
import { CreateSetorSchema } from '@/types/setor';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/setores - list all setores
/**
 * [DOC-FUNC] GET
 * Objetivo: Executa a rotina de 'g et'.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const setores = await getSetores();
    return NextResponse.json(setores);
  } catch (error: any) {
    console.error('[GET /api/setores]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/setores - create new setor
/**
 * [DOC-FUNC] POST
 * Objetivo: Executa a rotina de 'p os t'.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, { requireAdmin: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const payload = CreateSetorSchema.parse(body);
    const result = await createSetor(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/setores]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

