import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventario Unificado",
  description: "Sistema unificado de inventario e monitoramento de impressoras"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
