/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\me\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * [DOC-FUNC] getBearerToken
 * O que faz: Consulta informacoes na funcao 'getBearerToken' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (request) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * [DOC-FUNC] GET
 * O que faz: Implementa o endpoint HTTP GET 'GET', usado para leitura de dados pela interface e por integracoes.
 * Entradas: Le query params, cabecalhos/autenticacao e contexto da requisicao; assinatura local: request.
 * Como executa: Valida filtros recebidos, consulta servicos/repositorios, trata erros de dominio e padroniza o payload de resposta.
 * Retorno/Efeitos: Devolve JSON com status HTTP coerente (200/4xx/5xx), sem gravacao de estado no fluxo principal.
 */
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { sucesso: false, erro: "Token ausente." },
      { status: 401 }
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
    .select("cd_usuario, nm_usuario, ds_email, cd_perfil, ie_situacao")
    .eq("auth_user_id", authData.user.id)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar sessao: ${result.error.message}` },
      { status: 500 }
    );
  }

  if (!result.data) {
    return NextResponse.json(
      { sucesso: false, erro: "Usuario inativo ou inexistente." },
      { status: 401 }
    );
  }

  type UsuarioPerfilRow = {
    cd_perfil: number;
    perfil: { cd_perfil: number; nm_perfil: string } | null;
  };

  const perfisResponse = await supabase
    .from("usuario_perfil")
    .select("cd_perfil, perfil:perfil (cd_perfil, nm_perfil)")
    .eq("cd_usuario", result.data.cd_usuario)
    .eq("ie_situacao", "A")
    .order("cd_perfil", { ascending: true })
    .returns<UsuarioPerfilRow[]>();

  if (perfisResponse.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar perfis: ${perfisResponse.error.message}` },
      { status: 500 }
    );
  }

  let perfis = (perfisResponse.data || [])
    .map((item) => item.perfil)
    .filter(
      (perfil): perfil is { cd_perfil: number; nm_perfil: string } =>
        Boolean(perfil && typeof perfil.cd_perfil === "number" && typeof perfil.nm_perfil === "string")
    );

  if (perfis.length === 0 && result.data?.cd_perfil) {
    const fallbackPerfil = await supabase
      .from("perfil")
      .select("cd_perfil, nm_perfil")
      .eq("cd_perfil", result.data.cd_perfil)
      .limit(1)
      .maybeSingle();
    if (fallbackPerfil.data) {
      perfis = [fallbackPerfil.data];
    }
  }

  const cdPerfilCookie = Number(request.cookies.get("inv_profile")?.value);
  const perfilCookieValido = perfis.find((perfil) => perfil.cd_perfil === cdPerfilCookie) || null;
  const perfilAtual =
    perfilCookieValido ||
    perfis.find((perfil) => perfil.cd_perfil === result.data?.cd_perfil) ||
    perfis[0] ||
    null;
  const cdPerfilAtivo = perfilAtual?.cd_perfil || result.data.cd_perfil;

  return NextResponse.json({
    sucesso: true,
    dados: {
      ...result.data,
      cd_perfil: cdPerfilAtivo,
      perfil: perfilAtual,
      perfis
    }
  });
}

