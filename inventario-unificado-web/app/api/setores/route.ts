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
 * O que faz: Implementa o endpoint HTTP GET 'GET' para leitura de dados com resposta padronizada.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
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
 * O que faz: Implementa o endpoint HTTP POST 'POST' para receber payload, validar regras e processar/gravar dados.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
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

