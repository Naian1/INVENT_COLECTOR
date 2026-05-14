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
 * O que faz: Implementa endpoint HTTP GET 'GET', retornando dados de forma segura e padronizada.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna resposta de leitura tipada/padronizada ou erro claro de validacao/autorizacao/acesso.
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
 * O que faz: Implementa endpoint HTTP POST 'POST', validando payload e processando persistencia/integracao.
 * Entradas: Parametros esperados: request; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna resultado da operacao de escrita/processamento e efeitos de persistencia quando aplicavel.
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

