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
 * O que faz: Padroniza dados de 'parse id or throw' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: raw.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
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
 * O que faz: Consulta dados de 'get' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: request, params.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
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
 * O que faz: Executa a rotina principal de 'put' no contexto deste modulo.
 * Entradas: Parametros esperados: request, params.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * O que faz: Remove ou inativa dados de 'delete' conforme politica do sistema.
 * Entradas: Parametros esperados: request, params.
 * Como executa: Recebe chave do alvo, valida dependencias e executa a operacao segura.
 * Retorno/Efeitos: Retorna confirmacao da acao e sinaliza erros de integridade/permissao.
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

