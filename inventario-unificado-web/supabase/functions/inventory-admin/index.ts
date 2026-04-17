import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Action =
  | "list"
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
      const [empRes, tipRes, setRes, eqRes] = await Promise.all([
        supabase.from("empresa").select("*").eq("ie_situacao", "A").order("nm_empresa"),
        supabase.from("tipo_equipamento").select("*").eq("ie_situacao", "A").order("nm_tipo_equipamento"),
        supabase.from("setor").select("*").eq("ie_situacao", "A").order("nm_setor"),
        supabase.from("equipamento").select("*").eq("ie_situacao", "A").order("nm_modelo"),
      ]);

      if (empRes.error) throw new Error(`empresa: ${empRes.error.message}`);
      if (tipRes.error) throw new Error(`tipo_equipamento: ${tipRes.error.message}`);
      if (setRes.error) throw new Error(`setor: ${setRes.error.message}`);
      if (eqRes.error) throw new Error(`equipamento: ${eqRes.error.message}`);

      return jsonResponse({
        ok: true,
        data: {
          empresas: empRes.data || [],
          tipos: tipRes.data || [],
          setores: setRes.data || [],
          equipamentos: eqRes.data || [],
        },
      });
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
      const nm_setor = String(payload?.nm_setor || "").trim();
      if (!nm_setor) {
        return badRequest("nm_setor e obrigatorio");
      }

      const { data, error } = await supabase
        .from("setor")
        .insert([
          {
            nm_setor,
            ds_setor: payload?.ds_setor ? String(payload.ds_setor) : null,
            ie_situacao: "A",
          },
        ])
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, data });
    }

    if (action === "update_setor") {
      const cd_setor = Number(payload?.cd_setor);
      const nm_setor = String(payload?.nm_setor || "").trim();

      if (!Number.isFinite(cd_setor) || !nm_setor) {
        return badRequest("cd_setor e nm_setor sao obrigatorios");
      }

      const { data, error } = await supabase
        .from("setor")
        .update({
          nm_setor,
          ds_setor: payload?.ds_setor ? String(payload.ds_setor) : null,
        })
        .eq("cd_setor", cd_setor)
        .eq("ie_situacao", "A")
        .select("*")
        .single();

      if (error) throw new Error(error.message);
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
