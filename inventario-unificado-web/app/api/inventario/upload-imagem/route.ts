import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extensionFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(request: NextRequest) {
  try {
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

    const bytes = Buffer.from(await file.arrayBuffer());

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
