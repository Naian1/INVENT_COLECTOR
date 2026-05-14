/**
 * [DOC-CODEMAP] Arquivo: 
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
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
 * O que faz: Normaliza entradas na funcao 'parseIdOrThrow', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: raw; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
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
 * O que faz: Implementa endpoint HTTP GET 'GET', retornando dados de forma segura e padronizada.
 * Entradas: Parametros esperados: request, { params }; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; aplica atualizacoes de estado; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna resposta de leitura tipada/padronizada ou erro claro de validacao/autorizacao/acesso.
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
 * O que faz: Implementa endpoint HTTP PUT 'PUT', atualizando estado com validacao e consistencia.
 * Entradas: Parametros esperados: request, { params }; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; aplica atualizacoes de estado; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna estado atualizado e sinaliza conflitos/erros de integridade com contexto.
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
 * O que faz: Implementa endpoint HTTP DELETE 'DELETE', removendo/inativando recursos com seguranca.
 * Entradas: Parametros esperados: request, { params }; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos; trata erros com mensagens de diagnostico.
 * Retorno/Efeitos: Retorna confirmacao de remocao/inativacao e bloqueios quando houver dependencia.
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

