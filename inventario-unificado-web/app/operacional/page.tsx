/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\operacional\page.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { listarVisaoGeralImpressoras } from "@/services/visaoGeralImpressorasService";

/**
 * [DOC-FUNC] formatSupplyLevel
 * O que faz: A funcao 'formatSupplyLevel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: level. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatSupplyLevel(level: number | null) {
  if (level === null || Number.isNaN(level)) return "-";
  return `${level}%`;
}

/**
 * [DOC-FUNC] OperacionalPage
 * Objetivo: organiza uma etapa funcional do sistema para manter o fluxo previsivel e estudavel.
 * Entradas: usa os parametros da assinatura e/ou estado ja carregado pela tela/servico.
 * Como executa: valida entradas, chama dependencias necessarias, transforma dados e devolve uma resposta padronizada para a camada seguinte; quando algo falha, propaga mensagem contextualizada para facilitar suporte e apresentacao.
 * Saida/Efeito: devolve dados prontos para a proxima etapa ou renderiza/atualiza a interface sem alterar a regra de negocio principal.
 */
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

