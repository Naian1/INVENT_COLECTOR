import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildSessionToken,
  getSessionCookieName,
  getSessionTtlSeconds,
  verifyPassword
} from "@/lib/security/sessionAuth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  login: z.string().trim().min(1, "Informe login ou email."),
  senha: z.string().min(1, "Informe a senha.")
});

type UsuarioLoginRow = {
  cd_usuario: number;
  nm_usuario: string;
  ds_email: string;
  ds_login: string;
  ds_senha_hash: string;
  cd_perfil: number;
  ie_situacao: string;
};

async function buscarUsuarioPorLoginOuEmail(login: string) {
  const supabase = getSupabaseServerClient();

  const byLogin = await supabase
    .from("usuario")
    .select("cd_usuario, nm_usuario, ds_email, ds_login, ds_senha_hash, cd_perfil, ie_situacao")
    .ilike("ds_login", login)
    .limit(1)
    .maybeSingle<UsuarioLoginRow>();

  if (byLogin.data) return byLogin;
  if (byLogin.error && byLogin.error.code !== "PGRST116") return byLogin;

  const byEmail = await supabase
    .from("usuario")
    .select("cd_usuario, nm_usuario, ds_email, ds_login, ds_senha_hash, cd_perfil, ie_situacao")
    .ilike("ds_email", login)
    .limit(1)
    .maybeSingle<UsuarioLoginRow>();

  return byEmail;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: "Body JSON invalido." },
      { status: 400 }
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { sucesso: false, erro: "Dados de login invalidos." },
      { status: 400 }
    );
  }

  const login = parsed.data.login.trim();
  const senha = parsed.data.senha;

  const result = await buscarUsuarioPorLoginOuEmail(login);
  if (result.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar usuario: ${result.error.message}` },
      { status: 500 }
    );
  }

  const usuario = result.data;
  if (!usuario) {
    return NextResponse.json(
      { sucesso: false, erro: "Usuario ou senha invalidos." },
      { status: 401 }
    );
  }

  if (usuario.ie_situacao !== "A") {
    return NextResponse.json(
      { sucesso: false, erro: "Usuario inativo. Contate um administrador." },
      { status: 403 }
    );
  }

  const senhaValida = verifyPassword(senha, usuario.ds_senha_hash);
  if (!senhaValida) {
    return NextResponse.json(
      { sucesso: false, erro: "Usuario ou senha invalidos." },
      { status: 401 }
    );
  }

  const token = buildSessionToken({
    cdUsuario: usuario.cd_usuario,
    nmUsuario: usuario.nm_usuario,
    cdPerfil: usuario.cd_perfil
  });

  const response = NextResponse.json({
    sucesso: true,
    dados: {
      cd_usuario: usuario.cd_usuario,
      nm_usuario: usuario.nm_usuario,
      cd_perfil: usuario.cd_perfil
    }
  });

  response.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds()
  });

  void getSupabaseServerClient()
    .from("usuario")
    .update({ dt_ultimo_login: new Date().toISOString() })
    .eq("cd_usuario", usuario.cd_usuario)
    .eq("ie_situacao", "A");

  return response;
}
