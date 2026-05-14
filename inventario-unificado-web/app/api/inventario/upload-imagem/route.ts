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
 * O que faz: A funcao 'hasPrefix' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: bytes, prefix. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
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
 * O que faz: A funcao 'matchesImageSignature' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: bytes, mime. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'extensionFromMime' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: mime. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function extensionFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * [DOC-FUNC] POST
 * O que faz: A funcao 'POST' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) persiste alteracoes somente quando as regras de negocio permitem; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
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

