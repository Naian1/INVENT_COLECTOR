import { NextRequest, NextResponse } from 'next/server';
import { CreateTipoEquipamentoSchema } from '@/types/tipoEquipamento';
import {
  createTipoEquipamento,
  getTiposEquipamento,
} from '@/services/tipoEquipamentoService';

export async function GET() {
  try {
    const data = await getTiposEquipamento();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao listar tipos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateTipoEquipamentoSchema.parse(body);
    const data = await createTipoEquipamento(input);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao criar tipo' }, { status: 400 });
  }
}
