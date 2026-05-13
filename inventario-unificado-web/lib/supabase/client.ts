/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\supabase\client.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing environment variables - SUPABASE_URL or SUPABASE_KEY not set');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

