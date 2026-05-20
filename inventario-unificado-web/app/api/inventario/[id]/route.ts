/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web/app/api/inventario/[id]/route.ts
 * [DOC-CODEMAP] Papel: Rota API para consultar, atualizar, mover e remover itens individuais do inventario.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  deleteInventario,
  getInventarioById,
  moveInventarioToSetor,
  updateInventario,
} from '@/services/inventarioService';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import { CreateInventarioSchema } from '@/types/inventario';

/**
 * [DOC-FUNC] parseIdOrThrow
 * O que faz: A funcao 'parseIdOrThrow' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: raw. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function parseIdOrThrow(raw: string) {
  if (!/^\d+$/.test(raw)) {
    throw new Error('Identificador invalido.');
  }

  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Identificador invalido.');
  }

  return id;
}

const MoveInventarioSchema = z.object({
  action: z.literal('move'),
  novoSetorId: z.coerce.number().int().positive(),
  motivo: z.string().trim().max(500).optional().nullable(),
});

const UpdateInventarioSchema = CreateInventarioSchema.partial();

// GET /api/inventario/[id] - get specific inventario item
/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request, { params }. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id = '?';
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const resolvedParams = await params;
    id = resolvedParams.id;

    const inventario = await getInventarioById(parseIdOrThrow(id));

    if (!inventario) {
      return NextResponse.json({ error: 'Inventario nao encontrado' }, { status: 404 });
    }

    return NextResponse.json(inventario);
  } catch (error: any) {
    console.error(`[GET /api/inventario/${id}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/inventario/[id] - update inventario item
/**
 * [DOC-FUNC] PUT
 * O que faz: A funcao 'PUT' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request, { params }. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id = '?';
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const resolvedParams = await params;
    id = resolvedParams.id;
    const inventarioId = parseIdOrThrow(id);

    const body = (await request.json()) as Record<string, unknown>;

    const tentativaMovimento = MoveInventarioSchema.safeParse(body);
    if (tentativaMovimento.success) {
      const result = await moveInventarioToSetor(
        inventarioId,
        tentativaMovimento.data.novoSetorId,
        tentativaMovimento.data.motivo ?? undefined,
      );
      return NextResponse.json(result);
    }

    const payload = UpdateInventarioSchema.parse(body);
    const result = await updateInventario(inventarioId, payload);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[PUT /api/inventario/${id}]`, error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE /api/inventario/[id] - delete inventario item
/**
 * [DOC-FUNC] DELETE
 * O que faz: A funcao 'DELETE' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request, { params }. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id = '?';
  try {
    const auth = await authenticateApiRequest(request, { requireAdmin: true });
    if (auth.response) return auth.response;

    const resolvedParams = await params;
    id = resolvedParams.id;
    await deleteInventario(parseIdOrThrow(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[DELETE /api/inventario/${id}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
