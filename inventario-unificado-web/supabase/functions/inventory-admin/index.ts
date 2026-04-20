import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Action =
  | "list"
  | "create_piso"
  | "update_piso"
  | "create_empresa"
  | "update_empresa"
  | "create_tipo"
  | "update_tipo"
  | "create_setor"
  | "update_setor"
  | "create_equipamento"
  | "update_equipamento";

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function badRequest(message: string) {
  return jsonResponse({ ok: false, error: message }, 400);
}

function isMissingPisoTable(message: string): boolean {
  return /relation\s+"?piso"?\s+does not exist/i.test(message);
}

async function resolveCdPiso(
  supabase: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>,
): Promise<number | null> {
  const cd_piso_raw = payload?.cd_piso;
  const cd_piso = cd_piso_raw !== null && cd_piso_raw !== undefined && String(cd_piso_raw).trim() !== ""
    ? Number(cd_piso_raw)
    : null;

  if (Number.isFinite(cd_piso) && Number(cd_piso) > 0) {
    return Number(cd_piso);
  }

  const nm_piso = String(payload?.nm_piso || "").trim();
  if (!nm_piso) {
    return null;
  }

  const { data: existente, error: buscaError } = await supabase
    .from("piso")
    .select("cd_piso")
    .eq("ie_situacao", "A")
    .ilike("nm_piso", nm_piso)
    .maybeSingle();

  if (buscaError && !isMissingPisoTable(buscaError.message)) {
    throw new Error(`piso: ${buscaError.message}`);
  }

  if (existente?.cd_piso) {
    return Number(existente.cd_piso);
  }

  const { data: criado, error: createError } = await supabase
    .from("piso")
    .insert([
      {
        nm_piso,
        ds_piso: payload?.ds_piso ? String(payload.ds_piso).trim() : null,
        ie_situacao: "A",
      },
    ])
    .select("cd_piso")
    .single();

  if (createError) {
    throw new Error(`piso: ${createError.message}`);
  }

  return criado?.cd_piso ? Number(criado.cd_piso) : null;
}

function enrichSetoresComPiso(setores: any[]): any[] {
  return [...(setores || [])]
    .sort((a, b) => {
      const pisoA = String(a.nm_piso || "").localeCompare(String(b.nm_piso || ""));
      if (pisoA !== 0) return pisoA;
      const setorA = String(a.nm_setor || "").localeCompare(String(b.nm_setor || ""));
      if (setorA !== 0) return setorA;
      return String(a.nm_localizacao || "").localeCompare(String(b.nm_localizacao || ""));
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "") as Action;
    const payload = body?.payload ?? {};

    if (!action) {
      return badRequest("Action is required");
    }

    const supabase = getAdminClient();

    if (action === "list") {
      const [pisRes, empRes, tipRes, setRes, eqRes] = await Promise.all([
        supabase.from("piso").select("*").eq("ie_situacao", "A").order("nm_piso"),
        supabase.from("empresa").select("*").eq("ie_situacao", "A").order("nm_empresa"),
        supabase.from("tipo_equipamento").select("*").eq("ie_situacao", "A").order("nm_tipo_equipamento"),
        supabase
          .from("vw_setor")
          .select("*")
          .eq("ie_situacao", "A")
          .order("nm_setor")
          .order("nm_localizacao"),
        supabase.from("equipamento").select("*").eq("ie_situacao", "A").order("nm_modelo"),
      ]);

      if (pisRes.error) throw new Error(`piso: ${pisRes.error.message}`);
      if (empRes.error) throw new Error(`empresa: ${empRes.error.message}`);
      if (tipRes.error) throw new Error(`tipo_equipamento: ${tipRes.error.message}`);
      if (setRes.error) throw new Error(`setor: ${setRes.error.message}`);
      if (eqRes.error) throw new Error(`equipamento: ${eqRes.error.message}`);

      const setoresComPiso = enrichSetoresComPiso(setRes.data || []);

      return jsonResponse({
        ok: true,
        data: {
          pisos: pisRes.data || [],
          empresas: empRes.data || [],
          tipos: tipRes.data || [],
          setores: setoresComPiso,
          equipamentos: eqRes.data || [],
        },
      });
    }

    if (action === "create_piso") {
      const nm_piso = String(payload?.nm_piso || "").trim();
      if (!nm_piso) {
        return badRequest("nm_piso e obrigatorio");
      }

      const { data, error } = await supabase
        .from("piso")
        .insert([
          {
            nm_piso,
            ds_piso: payload?.ds_piso ? String(payload.ds_piso).trim() : null,
            ie_situacao: "A",
          },
        ])
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "update_piso") {
      const cd_piso = Number(payload?.cd_piso);
      const nm_piso = String(payload?.nm_piso || "").trim();

      if (!Number.isFinite(cd_piso) || cd_piso <= 0 || !nm_piso) {
        return badRequest("cd_piso e nm_piso sao obrigatorios");
      }

      const { data, error } = await supabase
        .from("piso")
        .update({
          nm_piso,
          ds_piso: payload?.ds_piso ? String(payload.ds_piso).trim() : null,
        })
        .eq("cd_piso", cd_piso)
        .eq("ie_situacao", "A")
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "create_empresa") {
      const cd_cgc = String(payload?.cd_cgc || "").trim();
      const nm_empresa = String(payload?.nm_empresa || "").trim();

      if (!cd_cgc || !nm_empresa) {
        return badRequest("cd_cgc e nm_empresa sao obrigatorios");
      }

      const { data, error } = await supabase
        .from("empresa")
        .insert([
          {
            cd_cgc,
            nm_empresa,
            nm_fantasia: payload?.nm_fantasia ? String(payload.nm_fantasia) : null,
            ds_email: payload?.ds_email ? String(payload.ds_email) : null,
            nr_telefone: payload?.nr_telefone ? String(payload.nr_telefone) : null,
            ie_situacao: "A",
          },
        ])
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "update_empresa") {
      const cd_cgc = String(payload?.cd_cgc || "").trim();
      const nm_empresa = String(payload?.nm_empresa || "").trim();

      if (!cd_cgc || !nm_empresa) {
        return badRequest("cd_cgc e nm_empresa sao obrigatorios");
      }

      const { data, error } = await supabase
        .from("empresa")
        .update({
          nm_empresa,
          nm_fantasia: payload?.nm_fantasia ? String(payload.nm_fantasia) : null,
          ds_email: payload?.ds_email ? String(payload.ds_email) : null,
          nr_telefone: payload?.nr_telefone ? String(payload.nr_telefone) : null,
        })
        .eq("cd_cgc", cd_cgc)
        .eq("ie_situacao", "A")
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "create_tipo") {
      const nm_tipo_equipamento = String(payload?.nm_tipo_equipamento || "").trim();
      if (!nm_tipo_equipamento) {
        return badRequest("nm_tipo_equipamento e obrigatorio");
      }

      const { data, error } = await supabase
        .from("tipo_equipamento")
        .insert([
          {
            nm_tipo_equipamento,
            ds_tipo_equipamento: payload?.ds_tipo_equipamento ? String(payload.ds_tipo_equipamento) : null,
            ie_situacao: "A",
          },
        ])
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "update_tipo") {
      const cd_tipo_equipamento = Number(payload?.cd_tipo_equipamento);
      const nm_tipo_equipamento = String(payload?.nm_tipo_equipamento || "").trim();

      if (!Number.isFinite(cd_tipo_equipamento) || !nm_tipo_equipamento) {
        return badRequest("cd_tipo_equipamento e nm_tipo_equipamento sao obrigatorios");
      }

      const { data, error } = await supabase
        .from("tipo_equipamento")
        .update({
          nm_tipo_equipamento,
          ds_tipo_equipamento: payload?.ds_tipo_equipamento ? String(payload.ds_tipo_equipamento) : null,
        })
        .eq("cd_tipo_equipamento", cd_tipo_equipamento)
        .eq("ie_situacao", "A")
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "create_setor") {
      const cd_piso = await resolveCdPiso(supabase, payload);
      const nm_setor = String(payload?.nm_setor || "").trim();
      if (!Number.isFinite(cd_piso) || Number(cd_piso) <= 0 || !nm_setor) {
        return badRequest("cd_piso e nm_setor sao obrigatorios");
      }

      const { data: setorCriado, error } = await supabase
        .from("setor")
        .insert([
          {
            cd_piso,
            nm_setor,
            nm_localizacao: payload?.nm_localizacao ? String(payload.nm_localizacao).trim() : null,
            ds_setor: payload?.ds_setor ? String(payload.ds_setor) : null,
            ie_situacao: "A",
          },
        ])
        .select("cd_setor")
        .single();

      if (error) throw new Error(error.message);

      const { data, error: viewError } = await supabase
        .from("vw_setor")
        .select("*")
        .eq("cd_setor", Number(setorCriado?.cd_setor))
        .single();

      if (viewError) throw new Error(`vw_setor: ${viewError.message}`);
      return jsonResponse({ ok: true, data });
    }

    if (action === "update_setor") {
      const cd_setor = Number(payload?.cd_setor);
      const cd_piso = await resolveCdPiso(supabase, payload);
      const nm_setor = String(payload?.nm_setor || "").trim();

      if (!Number.isFinite(cd_setor) || !Number.isFinite(cd_piso) || Number(cd_piso) <= 0 || !nm_setor) {
        return badRequest("cd_setor, cd_piso e nm_setor sao obrigatorios");
      }

      const { data: setorAtualizado, error } = await supabase
        .from("setor")
        .update({
          cd_piso,
          nm_setor,
          nm_localizacao: payload?.nm_localizacao ? String(payload.nm_localizacao).trim() : null,
          ds_setor: payload?.ds_setor ? String(payload.ds_setor) : null,
        })
        .eq("cd_setor", cd_setor)
        .eq("ie_situacao", "A")
        .select("cd_setor")
        .single();

      if (error) throw new Error(error.message);

      const { data, error: viewError } = await supabase
        .from("vw_setor")
        .select("*")
        .eq("cd_setor", Number(setorAtualizado?.cd_setor))
        .single();

      if (viewError) throw new Error(`vw_setor: ${viewError.message}`);
      return jsonResponse({ ok: true, data });
    }

    if (action === "create_equipamento") {
      const cd_cgc = String(payload?.cd_cgc || "").trim();
      const cd_tipo_equipamento = Number(payload?.cd_tipo_equipamento);
      const nm_equipamento = String(payload?.nm_equipamento || "").trim();
      const nm_modelo = String(payload?.nm_modelo || "").trim();
      const tp_hierarquia = String(payload?.tp_hierarquia || "AMBOS").trim().toUpperCase();

      if (!cd_cgc || !Number.isFinite(cd_tipo_equipamento) || !nm_equipamento || !nm_modelo) {
        return badRequest("cd_cgc, cd_tipo_equipamento, nm_equipamento e nm_modelo sao obrigatorios");
      }

      if (!["RAIZ", "FILHO", "AMBOS"].includes(tp_hierarquia)) {
        return badRequest("tp_hierarquia invalido. Use RAIZ, FILHO ou AMBOS");
      }

      const { data, error } = await supabase
        .from("equipamento")
        .insert([
          {
            cd_cgc,
            cd_tipo_equipamento,
            nm_equipamento,
            ds_equipamento: payload?.ds_equipamento ? String(payload.ds_equipamento) : null,
            nm_marca: payload?.nm_marca ? String(payload.nm_marca) : null,
            nm_modelo,
            tp_hierarquia,
            ie_situacao: "A",
          },
        ])
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "update_equipamento") {
      const cd_equipamento = Number(payload?.cd_equipamento);
      const cd_cgc = String(payload?.cd_cgc || "").trim();
      const cd_tipo_equipamento = Number(payload?.cd_tipo_equipamento);
      const nm_equipamento = String(payload?.nm_equipamento || "").trim();
      const nm_modelo = String(payload?.nm_modelo || "").trim();
      const tp_hierarquia = String(payload?.tp_hierarquia || "AMBOS").trim().toUpperCase();

      if (
        !Number.isFinite(cd_equipamento) ||
        !cd_cgc ||
        !Number.isFinite(cd_tipo_equipamento) ||
        !nm_equipamento ||
        !nm_modelo
      ) {
        return badRequest(
          "cd_equipamento, cd_cgc, cd_tipo_equipamento, nm_equipamento e nm_modelo sao obrigatorios",
        );
      }

      if (![
        "RAIZ",
        "FILHO",
        "AMBOS",
      ].includes(tp_hierarquia)) {
        return badRequest("tp_hierarquia invalido. Use RAIZ, FILHO ou AMBOS");
      }

      const { data, error } = await supabase
        .from("equipamento")
        .update({
          cd_cgc,
          cd_tipo_equipamento,
          nm_equipamento,
          ds_equipamento: payload?.ds_equipamento ? String(payload.ds_equipamento) : null,
          nm_marca: payload?.nm_marca ? String(payload.nm_marca) : null,
          nm_modelo,
          tp_hierarquia,
        })
        .eq("cd_equipamento", cd_equipamento)
        .eq("ie_situacao", "A")
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    return badRequest("Action not supported");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
