/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\perfil\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * [DOC-FUNC] getBearerToken
 * O que faz: A funcao 'getBearerToken' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * [DOC-FUNC] POST
 * O que faz: A funcao 'POST' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: "Body JSON invalido." },
      { status: 400 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { sucesso: false, erro: "Token ausente." },
      { status: 401 }
    );
  }

  const cdPerfil = (body as { cd_perfil?: number })?.cd_perfil;
  if (!cdPerfil || typeof cdPerfil !== "number") {
    return NextResponse.json(
      { sucesso: false, erro: "Perfil invalido." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return NextResponse.json(
      { sucesso: false, erro: "Token invalido." },
      { status: 401 }
    );
  }

  const result = await supabase
    .from("usuario")
    .select("cd_usuario, nm_usuario, cd_perfil, ie_situacao")
    .eq("auth_user_id", authData.user.id)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar usuario: ${result.error.message}` },
      { status: 500 }
    );
  }

  if (!result.data) {
    return NextResponse.json(
      { sucesso: false, erro: "Usuario inativo ou inexistente." },
      { status: 401 }
    );
  }

  const perfilVinculo = await supabase
    .from("usuario_perfil")
    .select("cd_perfil")
    .eq("cd_usuario", result.data.cd_usuario)
    .eq("cd_perfil", cdPerfil)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (perfilVinculo.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar perfis: ${perfilVinculo.error.message}` },
      { status: 500 }
    );
  }

  if (!perfilVinculo.data && result.data.cd_perfil !== cdPerfil) {
    return NextResponse.json(
      { sucesso: false, erro: "Perfil nao autorizado para este usuario." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ sucesso: true });
  response.cookies.set({
    name: "inv_profile",
    value: String(cdPerfil),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return response;
}

