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
 * O que faz: Consulta dados de 'get' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: request.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Sincroniza/enfila dados de 'post' entre camadas internas e servicos externos.
 * Entradas: Parametros esperados: request.
 * Como executa: Executa transmissao com controle de timeout, retentativa e observabilidade.
 * Retorno/Efeitos: Retorna status operacional com metadados de sucesso ou motivo de falha.
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

