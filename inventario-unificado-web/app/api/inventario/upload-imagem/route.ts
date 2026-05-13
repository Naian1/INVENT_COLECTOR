/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\upload-imagem\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * [DOC-FUNC] hasPrefix
 * O que faz: Avalia condicoes de controle na funcao 'hasPrefix' para decidir se o fluxo pode avancar.
 * Entradas: Parametros esperados: bytes, prefix; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna verdadeiro/falso para controlar a continuidade do fluxo nas proximas etapas.
 */
function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  if (bytes.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
}

/**
 * [DOC-FUNC] matchesImageSignature
 * O que faz: Executa a responsabilidade central da funcao 'matchesImageSignature', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: bytes, mime; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
function matchesImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  }

  if (mime === 'image/png') {
    return hasPrefix(bytes, PNG_SIGNATURE);
  }

  if (mime === 'image/webp') {
    if (bytes.length < 12) return false;
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    const webp = String.fromCharCode(...bytes.slice(8, 12));
    return riff === 'RIFF' && webp === 'WEBP';
  }

  return false;
}

/**
 * [DOC-FUNC] extensionFromMime
 * O que faz: Executa a responsabilidade central da funcao 'extensionFromMime', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: mime; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
function extensionFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * [DOC-FUNC] POST
 * O que faz: Implementa o endpoint HTTP POST 'POST' para receber payload, validar regras e processar/gravar dados.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de imagem nao enviado.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo nao permitido. Use JPG, PNG ou WEBP.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo acima de 10MB. Reduza a imagem.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const extension = extensionFromMime(file.type);
    const now = new Date();
    const ano = String(now.getFullYear());
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime();
    const random = Math.random().toString(36).slice(2, 10);
    const filePath = `${ano}/${mes}/inventario-${timestamp}-${random}.${extension}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (!matchesImageSignature(bytes, file.type)) {
      return NextResponse.json(
        { error: 'Arquivo invalido para o tipo informado.' },
        { status: 400 },
      );
    }

    const { error: uploadError } = await supabase.storage
      .from('inventario-imagens')
      .upload(filePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from('inventario-imagens')
      .getPublicUrl(filePath);

    return NextResponse.json({
      sucesso: true,
      path: filePath,
      publicUrl: data.publicUrl,
    });
  } catch (error: any) {
    console.error('[POST /api/inventario/upload-imagem]', error);
    return NextResponse.json({ error: error.message || 'Falha ao enviar imagem.' }, { status: 500 });
  }
}

