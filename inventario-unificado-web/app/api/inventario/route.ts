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
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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
 * O que faz: A funcao 'POST' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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

