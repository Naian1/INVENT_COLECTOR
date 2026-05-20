/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\layout.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventário Unificado",
  description: "Sistema unificado de inventário e monitoramento de impressoras",
};

const themeInitScript = `(() => {
  try {
    const key = "inventario-ui-theme";
    const saved = localStorage.getItem(key);
    const theme = saved === "dark" || saved === "light" ? saved : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (_error) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
  }
})();`;

/**
 * [DOC-FUNC] RootLayout
 * Objetivo: organiza uma etapa funcional do sistema para manter o fluxo previsivel e estudavel.
 * Entradas: usa os parametros da assinatura e/ou estado ja carregado pela tela/servico.
 * Como executa: valida entradas, chama dependencias necessarias, transforma dados e devolve uma resposta padronizada para a camada seguinte; quando algo falha, propaga mensagem contextualizada para facilitar suporte e apresentacao.
 * Saida/Efeito: devolve dados prontos para a proxima etapa ou renderiza/atualiza a interface sem alterar a regra de negocio principal.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning data-theme="light">
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}

