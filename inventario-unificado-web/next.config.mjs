/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\next.config.mjs
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  /**
   * [DOC-FUNC] headers
   * O que faz: Orquestra a etapa 'headers' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
   * Entradas: Trabalha com os parametros declarados (sem parametros obrigatorios) e com contexto local carregado durante a execucao.
   * Como executa: Encadeia sequencia de validacao e processamento interno, garantindo continuidade do processamento mesmo com entradas variaveis.
   * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
          }
        ]
      }
    ];
  }
};

export default nextConfig;

