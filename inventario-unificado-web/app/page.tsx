/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\page.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import Link from "next/link";

import { BasicPageShell } from "@/components/BasicPageShell";
import { ResumoTelemetriaDiaria } from "@/components/ResumoTelemetriaDiaria";

export default function HomePage() {
  return (
    <BasicPageShell
      title="Operacao de Impressoras"
      subtitle="Painel novo com consolidacao diaria por patrimonio e foco em coleta SNMP."
    >
      <ResumoTelemetriaDiaria />

      <section className="ui-card" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Acoes rapidas</h2>
        <div className="ui-row">
          <Link className="ui-btn ui-btn-primary" href="/impressoras">
            Abrir impressoras
          </Link>
          <Link className="ui-btn" href="/inventario">
            Abrir inventario
          </Link>
          <Link className="ui-btn" href="/inventario/importacoes">
            Abrir importacoes
          </Link>
        </div>
      </section>
    </BasicPageShell>
  );
}

