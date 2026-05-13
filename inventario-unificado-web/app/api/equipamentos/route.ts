/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\equipamentos\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEquipamentos, createEquipamento } from '@/services/equipamentoService';
import { CreateEquipamentoSchema } from '@/types/equipamento';
import { authenticateApiRequest } from '@/lib/security/apiAuth';

// GET /api/equipamentos - list all equipamentos
/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET', usado para leitura de dados pela interface e por integracoes.
 * Entradas: Le query params, cabecalhos/autenticacao e contexto da requisicao; assinatura local: request.
 * Como executa: Valida filtros recebidos, consulta servicos/repositorios, trata erros de dominio e padroniza o payload de resposta.
 * Retorno/Efeitos: Devolve JSON com status HTTP coerente (200/4xx/5xx), sem gravacao de estado no fluxo principal.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const equipamentos = await getEquipamentos();
    return NextResponse.json(equipamentos);
  } catch (error: any) {
    console.error('[GET /api/equipamentos]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/equipamentos - create new equipamento
/**
 * [DOC-FUNC] POST
 * O que faz: Implementa o endpoint HTTP POST 'POST', recebendo dados para criacao, ingestao ou processamento.
 * Entradas: Consome body da requisicao, identidade/permissoes e argumentos auxiliares; assinatura local: request.
 * Como executa: Valida o corpo recebido, aplica regras de negocio, chama servicos de escrita/processamento e concentra tratamento de excecoes.
 * Retorno/Efeitos: Retorna JSON com resultado da operacao e status HTTP adequado; pode gerar persistencia, auditoria e eventos internos.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, { requireAdmin: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const payload = CreateEquipamentoSchema.parse(body);
    const result = await createEquipamento(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/equipamentos]', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

