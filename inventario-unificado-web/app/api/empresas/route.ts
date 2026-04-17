import { NextRequest, NextResponse } from 'next/server';
import { CreateEmpresaSchema } from '@/types/empresa';
import { createEmpresa, getEmpresas } from '@/services/empresaService';

export async function GET() {
  try {
    const data = await getEmpresas();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao listar empresas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateEmpresaSchema.parse(body);
    const data = await createEmpresa(input);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao criar empresa' }, { status: 400 });
  }
}
