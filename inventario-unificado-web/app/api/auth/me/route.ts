import { NextRequest, NextResponse } from "next/server";

import { getSessionCookieName, readSessionToken } from "@/lib/security/sessionAuth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  const session = readSessionToken(sessionToken);

  if (!session) {
    return NextResponse.json(
      { sucesso: false, erro: "Sessao invalida ou expirada." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServerClient();
  const result = await supabase
    .from("usuario")
    .select("cd_usuario, nm_usuario, ds_email, cd_perfil, ie_situacao")
    .eq("cd_usuario", session.cdUsuario)
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
    const response = NextResponse.json(
      { sucesso: false, erro: "Usuario inativo ou inexistente." },
      { status: 401 }
    );

    response.cookies.set({
      name: getSessionCookieName(),
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    return response;
  }

  return NextResponse.json({ sucesso: true, dados: result.data });
}
