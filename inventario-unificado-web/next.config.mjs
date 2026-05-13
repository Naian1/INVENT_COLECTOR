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
   * O que faz: Executa a responsabilidade central da funcao 'headers', conectando validacao, processamento e retorno de forma didatica.
   * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
   * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
   * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
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

