import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type Perfil = {
  cd_perfil: number;
  nm_perfil: string;
  ds_perfil?: string | null;
  ie_situacao?: "A" | "I";
};

type Usuario = {
  cd_usuario: number;
  nm_usuario: string;
  ds_email: string;
  ds_login: string;
  cd_perfil: number;
  ie_situacao: "A" | "I";
  dt_ultimo_login?: string | null;
  dt_cadastro?: string | null;
  perfil?: Perfil | null;
};

type UsuarioRow = Omit<Usuario, "perfil"> & {
  perfil: { cd_perfil: number; nm_perfil: string } | null;
};

type UsuarioPerfil = {
  cd_usuario: number;
  cd_perfil: number;
  ie_situacao?: "A" | "I";
  perfil?: Perfil | null;
};

function badRequest(message: string) {
  return NextResponse.json({ sucesso: false, erro: message }, { status: 400 });
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

function parsePerfilIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((id) => Number.isFinite(id) && id > 0);
}

type PerfilNomeLookupRow = {
  perfil: { nm_perfil: string } | { nm_perfil: string }[] | null;
};

function getPerfilNome(value: PerfilNomeLookupRow["perfil"]): string {
  if (Array.isArray(value)) {
    return String(value[0]?.nm_perfil || "");
  }
  return String(value?.nm_perfil || "");
}

async function getAuthActor(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json(
        { sucesso: false, erro: "Token ausente." },
        { status: 401 },
      ),
      actorId: null as number | null,
      authUserId: null as string | null,
      isAdmin: false,
    };
  }

  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return {
      error: NextResponse.json(
        { sucesso: false, erro: "Token invalido." },
        { status: 401 },
      ),
      actorId: null as number | null,
      authUserId: null as string | null,
      isAdmin: false,
    };
  }

  const actorResult = await supabase
    .from("usuario")
    .select("cd_usuario, ie_situacao, cd_perfil")
    .eq("auth_user_id", authData.user.id)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (actorResult.error) {
    return {
      error: NextResponse.json(
        { sucesso: false, erro: `Falha ao validar sessao: ${actorResult.error.message}` },
        { status: 500 },
      ),
      actorId: null as number | null,
      authUserId: null as string | null,
      isAdmin: false,
    };
  }

  if (!actorResult.data) {
    return {
      error: NextResponse.json(
        { sucesso: false, erro: "Usuario inativo ou inexistente." },
        { status: 401 },
      ),
      actorId: null as number | null,
      authUserId: null as string | null,
      isAdmin: false,
    };
  }

  const perfisResponse = await supabase
    .from("usuario_perfil")
    .select("perfil:perfil (nm_perfil)")
    .eq("cd_usuario", actorResult.data.cd_usuario)
    .eq("ie_situacao", "A")
    .returns<PerfilNomeLookupRow[]>();

  let isAdmin =
    (perfisResponse.data || []).some(
      (row) => getPerfilNome(row.perfil).trim().toUpperCase() === "ADMIN",
    ) || false;

  if (!isAdmin && actorResult.data.cd_perfil) {
    const perfilPrincipal = await supabase
      .from("perfil")
      .select("nm_perfil")
      .eq("cd_perfil", actorResult.data.cd_perfil)
      .limit(1)
      .maybeSingle();
    if (perfilPrincipal.data) {
      isAdmin =
        String(perfilPrincipal.data.nm_perfil || "").trim().toUpperCase() === "ADMIN";
    }
  }

  if (perfisResponse.error) {
    return {
      error: NextResponse.json(
        { sucesso: false, erro: `Falha ao validar perfis: ${perfisResponse.error.message}` },
        { status: 500 },
      ),
      actorId: null as number | null,
      authUserId: null as string | null,
      isAdmin: false,
    };
  }

  return {
    error: null as NextResponse<unknown> | null,
    actorId: Number(actorResult.data.cd_usuario),
    authUserId: authData.user.id,
    isAdmin,
  };
}

async function syncUsuarioPerfis(
  usuarioId: number,
  perfilPrincipal: number,
  perfisExtras: unknown,
) {
  const supabase = getSupabaseServerClient();
  const unicos = Array.from(
    new Set([perfilPrincipal, ...parsePerfilIds(perfisExtras)]),
  ).filter((id) => Number.isFinite(id) && id > 0);

  const { error: deleteError } = await supabase
    .from("usuario_perfil")
    .delete()
    .eq("cd_usuario", usuarioId);
  if (deleteError) {
    throw new Error(`Falha ao limpar perfis do usuario: ${deleteError.message}`);
  }

  if (unicos.length === 0) return;

  const inserts = unicos.map((cd_perfil) => ({
    cd_usuario: usuarioId,
    cd_perfil,
    ie_situacao: "A",
  }));

  const { error: insertError } = await supabase
    .from("usuario_perfil")
    .insert(inserts);
  if (insertError) {
    throw new Error(`Falha ao salvar perfis do usuario: ${insertError.message}`);
  }
}

export async function GET(request: NextRequest) {
  const actor = await getAuthActor(request);
  if (actor.error) return actor.error;
  if (!actor.isAdmin) {
    return NextResponse.json(
      { sucesso: false, erro: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }

  const supabase = getSupabaseServerClient();
  const [usuariosResponse, perfisResponse, usuarioPerfisResponse] = await Promise.all([
    supabase
      .from("usuario")
      .select(
        "cd_usuario, nm_usuario, ds_email, ds_login, cd_perfil, ie_situacao, dt_ultimo_login, dt_cadastro, perfil:perfil (cd_perfil, nm_perfil)",
      )
      .order("nm_usuario", { ascending: true })
      .returns<UsuarioRow[]>(),
    supabase
      .from("perfil")
      .select("cd_perfil, nm_perfil, ds_perfil, ie_situacao")
      .eq("ie_situacao", "A")
      .order("nm_perfil", { ascending: true })
      .returns<Perfil[]>(),
    supabase
      .from("usuario_perfil")
      .select("cd_usuario, cd_perfil, ie_situacao, perfil:perfil (cd_perfil, nm_perfil)")
      .eq("ie_situacao", "A")
      .returns<UsuarioPerfil[]>(),
  ]);

  if (usuariosResponse.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar usuarios: ${usuariosResponse.error.message}` },
      { status: 500 },
    );
  }
  if (perfisResponse.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar perfis: ${perfisResponse.error.message}` },
      { status: 500 },
    );
  }
  if (usuarioPerfisResponse.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar vinculos de perfis: ${usuarioPerfisResponse.error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sucesso: true,
    dados: {
      usuarios: usuariosResponse.data || [],
      perfis: perfisResponse.data || [],
      usuarioPerfis: usuarioPerfisResponse.data || [],
    },
  });
}

export async function POST(request: NextRequest) {
  const actor = await getAuthActor(request);
  if (actor.error) return actor.error;
  if (!actor.isAdmin) {
    return NextResponse.json(
      { sucesso: false, erro: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body JSON invalido.");
  }

  const nm_usuario = String((body as Record<string, unknown>)?.nm_usuario || "").trim();
  const ds_email = String((body as Record<string, unknown>)?.ds_email || "").trim();
  const ds_login = String((body as Record<string, unknown>)?.ds_login || "").trim();
  const cd_perfil = Number((body as Record<string, unknown>)?.cd_perfil);
  const ie_situacao = String((body as Record<string, unknown>)?.ie_situacao || "A").trim().toUpperCase();
  const senha = String((body as Record<string, unknown>)?.senha || "").trim();

  if (!nm_usuario || !ds_email || !ds_login) {
    return badRequest("Preencha nome, email e login.");
  }
  if (!Number.isFinite(cd_perfil) || cd_perfil <= 0) {
    return badRequest("Selecione um perfil valido.");
  }
  if (!senha) {
    return badRequest("Informe uma senha para o novo usuario.");
  }
  if (!["A", "I"].includes(ie_situacao)) {
    return badRequest("Status de usuario invalido.");
  }

  const supabase = getSupabaseServerClient();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: ds_email,
    password: senha,
    email_confirm: true,
  });

  if (authError || !authUser?.user?.id) {
    return NextResponse.json(
      { sucesso: false, erro: authError?.message || "Falha ao criar usuario de autenticacao." },
      { status: 500 },
    );
  }

  const payload: Record<string, unknown> = {
    nm_usuario,
    ds_email,
    ds_login,
    cd_perfil,
    ie_situacao,
    auth_user_id: authUser.user.id,
    ds_senha_hash: "auth",
    cd_usuario_criacao: actor.actorId,
    cd_usuario_ultima_alteracao: actor.actorId,
  };

  const createResult = await supabase
    .from("usuario")
    .insert([payload])
    .select("cd_usuario")
    .single();

  if (createResult.error || !createResult.data?.cd_usuario) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao criar usuario: ${createResult.error?.message || "sem retorno de id"}` },
      { status: 500 },
    );
  }

  try {
    await syncUsuarioPerfis(
      Number(createResult.data.cd_usuario),
      cd_perfil,
      (body as Record<string, unknown>)?.perfis,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao vincular perfis.";
    return NextResponse.json({ sucesso: false, erro: message }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true });
}

export async function PUT(request: NextRequest) {
  const actor = await getAuthActor(request);
  if (actor.error) return actor.error;
  if (!actor.isAdmin) {
    return NextResponse.json(
      { sucesso: false, erro: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body JSON invalido.");
  }

  const cd_usuario = Number((body as Record<string, unknown>)?.cd_usuario);
  const nm_usuario = String((body as Record<string, unknown>)?.nm_usuario || "").trim();
  const ds_email = String((body as Record<string, unknown>)?.ds_email || "").trim();
  const ds_login = String((body as Record<string, unknown>)?.ds_login || "").trim();
  const cd_perfil = Number((body as Record<string, unknown>)?.cd_perfil);
  const ie_situacao = String((body as Record<string, unknown>)?.ie_situacao || "A").trim().toUpperCase();
  const senha = String((body as Record<string, unknown>)?.senha || "").trim();

  if (!Number.isFinite(cd_usuario) || cd_usuario <= 0) {
    return badRequest("Informe um usuario valido.");
  }
  if (!nm_usuario || !ds_email || !ds_login) {
    return badRequest("Preencha nome, email e login.");
  }
  if (!Number.isFinite(cd_perfil) || cd_perfil <= 0) {
    return badRequest("Selecione um perfil valido.");
  }
  if (!["A", "I"].includes(ie_situacao)) {
    return badRequest("Status de usuario invalido.");
  }

  const supabase = getSupabaseServerClient();
  const existingUser = await supabase
    .from("usuario")
    .select("auth_user_id")
    .eq("cd_usuario", cd_usuario)
    .limit(1)
    .maybeSingle();

  if (existingUser.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar usuario: ${existingUser.error.message}` },
      { status: 500 },
    );
  }

  if (!existingUser.data) {
    return NextResponse.json(
      { sucesso: false, erro: "Usuario nao encontrado." },
      { status: 404 },
    );
  }

  let authUserId = (existingUser.data as { auth_user_id?: string | null }).auth_user_id || null;

  if (senha) {
    if (authUserId) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(authUserId, {
        email: ds_email,
        password: senha,
      });
      if (authUpdateError) {
        return NextResponse.json(
          { sucesso: false, erro: `Falha ao atualizar autenticacao: ${authUpdateError.message}` },
          { status: 500 },
        );
      }
    } else {
      const { data: createdUser, error: authCreateError } = await supabase.auth.admin.createUser({
        email: ds_email,
        password: senha,
        email_confirm: true,
      });

      if (authCreateError || !createdUser?.user?.id) {
        return NextResponse.json(
          { sucesso: false, erro: authCreateError?.message || "Falha ao criar autenticacao." },
          { status: 500 },
        );
      }

      authUserId = createdUser.user.id;
    }
  } else if (authUserId) {
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(authUserId, {
      email: ds_email,
    });
    if (authUpdateError) {
      return NextResponse.json(
        { sucesso: false, erro: `Falha ao atualizar email de autenticacao: ${authUpdateError.message}` },
        { status: 500 },
      );
    }
  }

  const payload: Record<string, unknown> = {
    nm_usuario,
    ds_email,
    ds_login,
    cd_perfil,
    ie_situacao,
    cd_usuario_ultima_alteracao: actor.actorId,
  };

  if (authUserId) {
    payload.auth_user_id = authUserId;
    payload.ds_senha_hash = "auth";
  }
  const updateResult = await supabase
    .from("usuario")
    .update(payload)
    .eq("cd_usuario", cd_usuario);

  if (updateResult.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao atualizar usuario: ${updateResult.error.message}` },
      { status: 500 },
    );
  }

  try {
    await syncUsuarioPerfis(
      cd_usuario,
      cd_perfil,
      (body as Record<string, unknown>)?.perfis,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao vincular perfis.";
    return NextResponse.json({ sucesso: false, erro: message }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true });
}

export async function PATCH(request: NextRequest) {
  const actor = await getAuthActor(request);
  if (actor.error) return actor.error;
  if (!actor.isAdmin) {
    return NextResponse.json(
      { sucesso: false, erro: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body JSON invalido.");
  }

  const cd_usuario = Number((body as Record<string, unknown>)?.cd_usuario);
  const ie_situacao = String((body as Record<string, unknown>)?.ie_situacao || "").trim().toUpperCase();

  if (!Number.isFinite(cd_usuario) || cd_usuario <= 0) {
    return badRequest("Informe um usuario valido.");
  }
  if (!["A", "I"].includes(ie_situacao)) {
    return badRequest("Status de usuario invalido.");
  }

  const payload: Record<string, unknown> = {
    ie_situacao,
    cd_usuario_ultima_alteracao: actor.actorId,
  };

  if (ie_situacao === "A") {
    payload.cd_usuario_ativacao = actor.actorId;
  } else {
    payload.cd_usuario_inativacao = actor.actorId;
  }

  const supabase = getSupabaseServerClient();
  const updateResult = await supabase
    .from("usuario")
    .update(payload)
    .eq("cd_usuario", cd_usuario);

  if (updateResult.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao atualizar status do usuario: ${updateResult.error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ sucesso: true });
}
