import { listarVisaoGeralImpressoras } from "@/services/visaoGeralImpressorasService";

function formatSupplyLevel(level: number | null) {
  if (level === null || Number.isNaN(level)) return "-";
  return `${level}%`;
}

export default async function OperacionalPage() {
  const overview = await listarVisaoGeralImpressoras();

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Impressoras - Visão Operacional</h1>
      <p>Fonte: API/serviços reais (Supabase).</p>

      {!overview.success ? (
        <p style={{ color: "#b00020" }}>Erro ao carregar dados: {overview.error}</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 16
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Nome</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>IP</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Setor</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Modelo</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Status</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Páginas</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Menor suprimento</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Último visto</th>
            </tr>
          </thead>
          <tbody>
            {overview.data.map((printer) => (
              <tr key={printer.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {printer.patrimonio ?? printer.hostname ?? printer.ip}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{printer.ip}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{printer.setor}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{printer.modelo}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{printer.status_atual}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {printer.contador_paginas_atual ?? "-"}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {formatSupplyLevel(printer.menor_nivel_suprimento)}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {printer.ultima_coleta_em ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
