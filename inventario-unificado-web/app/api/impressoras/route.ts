/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\impressoras\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { criarImpressoraSchema } from "@/lib/validation/impressoraSchemas";
import { criarImpressora, listarImpressoras } from "@/services/impressorasService";

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET', usado para leitura de dados pela interface e por integracoes.
 * Entradas: Le query params, cabecalhos/autenticacao e contexto da requisicao; assinatura local: request.
 * Como executa: Valida filtros recebidos, consulta servicos/repositorios, trata erros de dominio e padroniza o payload de resposta.
 * Retorno/Efeitos: Devolve JSON com status HTTP coerente (200/4xx/5xx), sem gravacao de estado no fluxo principal.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.response) return auth.response;

  const result = await listarImpressoras();

  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    dados: result.data
  });
}

/**
 * [DOC-FUNC] POST
 * O que faz: Implementa o endpoint HTTP POST 'POST', recebendo dados para criacao, ingestao ou processamento.
 * Entradas: Consome body da requisicao, identidade/permissoes e argumentos auxiliares; assinatura local: request.
 * Como executa: Valida o corpo recebido, aplica regras de negocio, chama servicos de escrita/processamento e concentra tratamento de excecoes.
 * Retorno/Efeitos: Retorna JSON com resultado da operacao e status HTTP adequado; pode gerar persistencia, auditoria e eventos internos.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireAdmin: true });
  if (auth.response) return auth.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: "Body JSON invalido." },
      { status: 400 }
    );
  }

  const parsed = criarImpressoraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Payload invalido.",
        detalhes: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const result = await criarImpressora(parsed.data);
  if (!result.success) {
    return NextResponse.json(
      { sucesso: false, erro: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json(
    {
      sucesso: true,
      dados: result.data
    },
    { status: 201 }
  );
}

