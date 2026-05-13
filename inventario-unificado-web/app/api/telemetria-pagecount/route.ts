/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\telemetria-pagecount\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/security/apiAuth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const TelemetriaPagecountCreateSchema = z.object({
  nr_inventario: z.coerce.number().int().positive(),
  nr_paginas_total: z.coerce.number().int().min(0),
  ds_status_impressora: z.string().trim().min(1).max(32).optional().default("unknown"),
  ds_observacao: z.string().trim().max(500).optional().nullable(),
  dt_leitura: z.coerce.date().optional(),
});

/**
 * [DOC-FUNC] hasOnConflictConstraintError
 * Objetivo: Executa a rotina de 'h as on co nf li ct co ns tr ai nt er ro r'.
 */
function hasOnConflictConstraintError(message: string) {
  return (
    /no unique or exclusion constraint matching the ON CONFLICT specification/i.test(message) ||
    /there is no unique or exclusion constraint/i.test(message)
  );
}

// GET /api/telemetria-pagecount - estado atual de pagecount por inventario
/**
 * [DOC-FUNC] GET
 * Objetivo: Executa a rotina de 'g et'.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const inventarioId = request.nextUrl.searchParams.get("nr_inventario");
    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("telemetria_pagecount")
      .select("*")
      .order("dt_leitura", { ascending: false })
      .limit(1000);

    if (inventarioId && /^\d+$/.test(inventarioId)) {
      query = query.eq("nr_inventario", Number(inventarioId));
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar telemetria: ${error.message}`);

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("[GET /api/telemetria-pagecount]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/telemetria-pagecount - upsert por inventario (1 linha por impressora)
/**
 * [DOC-FUNC] POST
 * Objetivo: Executa a rotina de 'p os t'.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const payload = TelemetriaPagecountCreateSchema.parse(body);
    const dtLeituraIso = (payload.dt_leitura ?? new Date()).toISOString();

    const supabase = getSupabaseServerClient();
    const row = {
      nr_inventario: payload.nr_inventario,
      nr_paginas_total: payload.nr_paginas_total,
      ds_status_impressora: payload.ds_status_impressora,
      ds_observacao: payload.ds_observacao ?? null,
      dt_leitura: dtLeituraIso,
    };

    const upsert = await supabase
      .from("telemetria_pagecount")
      .upsert([row], { onConflict: "nr_inventario", ignoreDuplicates: false })
      .select()
      .single();

    if (!upsert.error) {
      return NextResponse.json(upsert.data, { status: 200 });
    }

    const message = String(upsert.error.message || "");
    if (!hasOnConflictConstraintError(message)) {
      throw new Error(`Erro ao gravar telemetria: ${message}`);
    }

    // Fallback para schema antigo sem UNIQUE(nr_inventario).
    const insert = await supabase.from("telemetria_pagecount").insert([row]).select().single();
    if (insert.error) throw new Error(`Erro ao inserir telemetria: ${insert.error.message}`);

    return NextResponse.json(insert.data, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/telemetria-pagecount]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

