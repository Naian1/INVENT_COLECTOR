/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\tipos-equipamento\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { CreateTipoEquipamentoSchema } from '@/types/tipoEquipamento';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import {
  createTipoEquipamento,
  getTiposEquipamento,
} from '@/services/tipoEquipamentoService';

/**
 * [DOC-FUNC] GET
 * Objetivo: Executa a rotina de 'g et'.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const data = await getTiposEquipamento();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao listar tipos' }, { status: 500 });
  }
}

/**
 * [DOC-FUNC] POST
 * Objetivo: Executa a rotina de 'p os t'.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, { requireAdmin: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const input = CreateTipoEquipamentoSchema.parse(body);
    const data = await createTipoEquipamento(input);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao criar tipo' }, { status: 400 });
  }
}

