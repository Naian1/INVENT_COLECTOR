import Link from "next/link";
import { BasicPageShell } from "@/components/BasicPageShell";
import { PainelDashboard } from "@/components/PainelDashboard";

export default function HomePage() {
  return (
    <BasicPageShell
      title="Painel de Operacao"
      subtitle="Resumo rapido do inventario, impressoras e atalhos de operacao diaria."
    >
      <PainelDashboard />

      <section
        className="ui-card ui-stage-overview"
        style={{ marginBottom: 14 }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Visao geral da etapa</h2>
        <p className="ui-kv" style={{ marginTop: 0 }}>
          Inventario e impressoras com fluxo unificado: cadastro, movimentacao, manutencao, devolucao e monitoramento de suprimentos.
        </p>
        <div className="ui-row" style={{ marginTop: 8 }}>
          <Link className="ui-btn ui-btn-primary" href="/inventario">
            Ir para inventario
          </Link>
          <Link className="ui-btn" href="/impressoras">
            Ir para impressoras
          </Link>
          <Link className="ui-btn" href="/inventario/devolucao">
            Ir para devolucao
          </Link>
        </div>
      </section>

      <section className="ui-dashboard-grid" style={{ marginBottom: 14 }}>
        <article className="ui-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Categorias dinamicas</h3>
          <p className="ui-kv" style={{ margin: 0 }}>
            Estrutura de campos para organizar ativos por tipo e processo.
          </p>
          <Link className="ui-btn" href="/inventario/categorias">
            Gerenciar categorias
          </Link>
        </article>
        <article className="ui-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Inventario oficial</h3>
          <p className="ui-kv" style={{ margin: 0 }}>
            Operacao de ativos com hierarquia pai-filho e status operacional.
          </p>
          <Link className="ui-btn" href="/inventario">
            Abrir inventario
          </Link>
        </article>
        <article className="ui-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Impressoras operacionais</h3>
          <p className="ui-kv" style={{ margin: 0 }}>
            Leitura de status, paginas e suprimentos com filtros de apoio ao time TI.
          </p>
          <Link className="ui-btn" href="/impressoras">
            Ver impressoras
          </Link>
        </article>
      </section>

      <section className="ui-card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Acessos rapidos</h2>
        <div className="ui-row">
          <Link className="ui-btn ui-btn-primary" href="/inventario/categorias">
            Gerenciar Categorias
          </Link>
          <Link className="ui-btn" href="/inventario">
            Abrir Inventario
          </Link>
          <Link className="ui-btn" href="/inventario/importacoes">
            Importar Planilha
          </Link>
          <Link className="ui-btn" href="/impressoras">
            Ver Impressoras
          </Link>
        </div>
      </section>

      <section className="ui-card">
        <h2 style={{ marginTop: 0 }}>Status tecnico atual</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Fluxos de movimentacao, manutencao e substituicao com rastreabilidade no historico.</li>
          <li>Tela de devolucao com exportacao CSV, XLSX e PDF por download direto.</li>
          <li>Suprimentos da impressora com leitura percentual consistente na visao operacional.</li>
          <li>Documentacao tecnica consolidada em docs e API por edge function.</li>
        </ul>
      </section>
    </BasicPageShell>
  );
}
