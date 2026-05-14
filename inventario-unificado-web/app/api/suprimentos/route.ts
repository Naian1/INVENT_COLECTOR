/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\suprimentos\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSuprimentos, upsertSuprimento } from '@/services/suprimentosService';
import { SuprimentosSchema } from '@/types/suprimentos';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/suprimentos - list all suprimentos
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

    const suprimentos = await getSuprimentos();
    return NextResponse.json(suprimentos);
  } catch (error: any) {
    console.error('[GET /api/suprimentos]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/suprimentos - upsert suprimento (update or insert)
// This endpoint is used primarily by the SNMP collector
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
    const payload = SuprimentosSchema.omit({
      cd_suprimento: true,
      dt_criacao: true,
      dt_atualizacao: true,
    }).parse(body);
    const result = await upsertSuprimento(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/suprimentos]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

