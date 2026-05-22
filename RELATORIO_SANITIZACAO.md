# Relatorio de Sanitizacao do Repositorio

Data da analise: 2026-05-22  
Escopo: analise estatica do repositorio, sem refatorar, remover ou alterar codigo de producao.  
Objetivo: identificar duplicidade, codigo morto, riscos de manutencao e oportunidades de refatoracao segura.

## Resumo Executivo

O projeto esta funcional, mas cresceu em camadas paralelas: frontend Next.js, rotas internas em `app/api`, Supabase Edge Functions, services TypeScript, scripts Python do coletor SNMP e SQL do banco. A maior oportunidade de melhoria esta em reduzir duplicidade entre essas camadas e remover referencias antigas a tabelas que nao existem mais no banco atual.

Ponto importante: a tela de impressoras nao esta 100% responsiva em 1360x768. Pelas imagens, a tabela cria rolagem horizontal e vertical ao mesmo tempo, algumas colunas ficam desalinhadas ou escondidas, e linhas com muitos suprimentos ficam muito altas. Isso nao impede o sistema de funcionar, mas atrapalha bastante o uso em notebook, monitor menor e apresentacao.

## O Que E a Pasta app/api

A pasta `inventario-unificado-web/app/api` e a camada de API interna do Next.js.

No Next.js App Router, qualquer arquivo `route.ts` dentro de `app/api/...` vira um endpoint HTTP executado no servidor. Exemplo:

- `app/api/auth/login/route.ts` vira `/api/auth/login`
- `app/api/inventario/route.ts` vira `/api/inventario`
- `app/api/impressoras/route.ts` vira `/api/impressoras`

Essas rotas nao sao componentes visuais. Elas sao backend dentro do projeto Next.js, rodando no Vercel quando o site esta em producao. Elas podem validar sessao, chamar services, consultar Supabase e devolver JSON para o frontend.

No sistema existem duas camadas principais de API:

- `app/api`: API interna do Next.js, usada pelo proprio site.
- `supabase/functions`: Edge Functions do Supabase, usadas para regras criticas, telemetria, inventario, impressoras e coletor.

O ideal e evitar que as mesmas regras de negocio fiquem duplicadas nas duas camadas.

## Estrutura Geral do Projeto

### Raiz

- `coletor-snmp`: aplicacao Python responsavel por sincronizar impressoras ativas, coletar dados SNMP e enviar telemetria.
- `inventario-unificado-web`: aplicacao web Next.js, services TypeScript, Supabase Edge Functions e migrations SQL.
- `docs`: documentacao tecnica do sistema, banco, deploy, telemetria, TCC e fluxos.
- `.venv`: ambiente Python local.
- `.git`, `.vscode`: controle de versao e configuracoes locais.

### inventario-unificado-web

- `app`: telas, layouts e rotas API do Next.js.
- `app/api`: endpoints backend internos do Next.js.
- `components`: componentes reutilizaveis do frontend.
- `services`: regras de consulta, montagem de dados, importacao e dashboards.
- `lib`: clientes Supabase, seguranca, helpers e wrappers.
- `supabase/functions`: Edge Functions do Supabase.
- `supabase/migrations`: SQL estrutural e scripts do banco.
- `public`: arquivos estaticos.

### coletor-snmp

- `scripts`: scripts de execucao, loop de coleta e rotinas auxiliares.
- `utils`: funcoes de cache, telemetria, autenticacao, mapeamento e SNMP.
- `data`: arquivos locais de cache, pendencias e dados operacionais.
- `logs`: logs runtime do coletor.
- `app`, `dist`, `build`: empacotamento/interface local do coletor.

## Problemas Encontrados

### 1. Tela de impressoras nao esta totalmente responsiva em 1360x768

**Problema encontrado**  
A tela `Impressoras Operacionais` usa uma tabela muito larga. Em resolucao 1360x768, a experiencia quebra: aparece rolagem horizontal, rolagem vertical interna, colunas ficam fora da area visivel, algumas linhas ficam gigantes por causa de muitos suprimentos e a leitura fica cansativa.

**Arquivos envolvidos**

- `inventario-unificado-web/app/impressoras/page.tsx`
- `inventario-unificado-web/app/globals.css`

**Risco: medio**  
Nao parece risco direto de perda de dados, mas afeta uso real, suporte, apresentacao e confianca visual do sistema.

**Sugestao de correcao**  
Transformar a tabela em um layout responsivo por faixas:

- Desktop grande: tabela completa.
- Notebook 1360x768: reduzir colunas visiveis, agrupar suprimentos em painel expansivel.
- Mobile/tablet: cards por impressora, sem tabela horizontal.

Tambem vale limitar altura visual dos suprimentos agrupados e abrir detalhes em drawer/modal.

**Ordem recomendada para refatorar**  
Alta prioridade. Corrigir antes de mexer em refatoracoes internas grandes, porque impacta diretamente o uso diario.

---

### 2. CSS global muito grande e com responsabilidades misturadas

**Problema encontrado**  
O arquivo `globals.css` concentra estilos de muitas areas: dashboard, inventario, impressoras, dialogs, formularios, tabelas, tema claro/escuro e utilitarios. Isso dificulta saber qual classe pertence a qual tela e aumenta risco de uma alteracao visual quebrar outra pagina.

**Arquivos envolvidos**

- `inventario-unificado-web/app/globals.css`
- `inventario-unificado-web/app/impressoras/page.tsx`
- `inventario-unificado-web/components/PainelDashboard.tsx`
- `inventario-unificado-web/app/inventario/devolucao/page.tsx`
- `inventario-unificado-web/app/inventario/categorias/page.tsx`

**Risco: medio**  
Risco visual e de manutencao. Uma mudanca em classe global pode afetar telas diferentes.

**Sugestao de correcao**  
Separar CSS por dominio:

- `styles/base.css`
- `styles/layout.css`
- `styles/components.css`
- `styles/inventario.css`
- `styles/impressoras.css`
- `styles/dashboard.css`
- `styles/themes.css`

Se o projeto preferir manter tudo no `globals.css`, organizar por secoes comentadas e remover classes antigas nao usadas.

**Ordem recomendada para refatorar**  
Depois da correcao responsiva da tela de impressoras.

---

### 3. Referencias a tabelas antigas ou inexistentes no banco atual

**Problema encontrado**  
Foram encontradas referencias a tabelas antigas como `impressoras`, `telemetria_impressoras`, `leituras_paginas_impressoras`, `suprimentos_impressoras` e `alertas_impressoras`. Pelo banco atual, a fonte oficial de impressoras e `public.inventario`, e a telemetria atual usa `telemetria_pagecount`, `telemetria_pagecount_diaria`, `suprimentos` e tabelas de substituicao.

**Arquivos envolvidos**

- `inventario-unificado-web/services/metricasImpressorasService.ts`
- `inventario-unificado-web/services/resumoDashboardService.ts`
- `inventario-unificado-web/services/statusSuprimentosImpressorasService.ts`
- `inventario-unificado-web/services/importacaoInventarioService.ts`
- `inventario-unificado-web/services/visaoGeralImpressorasService.ts`
- `inventario-unificado-web/supabase/functions/inventory-print/index.ts`

**Risco: alto**  
Alto porque chamadas a tabelas inexistentes podem gerar erro 404/522/timeout, forcar retries, piorar carga no Supabase e confundir diagnostico.

**Sugestao de correcao**  
Criar uma lista oficial das tabelas atuais e remover ou isolar codigo legado. Se alguma rota ainda depende dessas tabelas antigas, migrar para `public.inventario` e tabelas atuais de telemetria.

**Ordem recomendada para refatorar**  
Prioridade muito alta, logo depois da responsividade de impressoras. Esse ponto pode afetar estabilidade do Supabase.

---

### 4. Pasta legacy aparenta codigo morto ou legado nao usado pelo fluxo atual

**Problema encontrado**  
Existe uma pasta `legacy` com services e tipos antigos de impressoras. As buscas indicam que ela nao e usada diretamente pelo app atual, exceto internamente dentro da propria pasta legacy.

**Arquivos envolvidos**

- `inventario-unificado-web/legacy/lib/validation/collectorSchemas.ts`
- `inventario-unificado-web/legacy/lib/validation/printerSchemas.ts`
- `inventario-unificado-web/legacy/services/dashboardService.ts`
- `inventario-unificado-web/legacy/services/metricsService.ts`
- `inventario-unificado-web/legacy/services/printerOverviewService.ts`
- `inventario-unificado-web/legacy/services/printerService.ts`
- `inventario-unificado-web/legacy/services/printerStatusSuppliesService.ts`
- `inventario-unificado-web/legacy/services/telemetryService.ts`
- `inventario-unificado-web/legacy/types/printer.ts`

**Risco: medio**  
Nao parece quebrar o sistema, mas gera confusao, aumenta o repositorio e pode fazer alguem reutilizar regra antiga por engano.

**Sugestao de correcao**  
Confirmar se nenhuma rota em producao usa `legacy`. Se nao usar, mover para documentacao historica ou remover em uma branch separada.

**Ordem recomendada para refatorar**  
Depois de limpar referencias a tabelas antigas.

---

### 5. Funcoes utilitarias duplicadas em varias telas e services

**Problema encontrado**  
Funcoes simples aparecem repetidas em varios arquivos, como normalizacao de texto, formatacao de data, formatacao monetaria e validacao de competencia.

**Arquivos envolvidos**

- `inventario-unificado-web/app/inventario/page.tsx`
- `inventario-unificado-web/app/inventario/devolucao/page.tsx`
- `inventario-unificado-web/app/impressoras/page.tsx`
- `inventario-unificado-web/app/usuarios/page.tsx`
- `inventario-unificado-web/app/api/inventario/conciliacao/route.ts`
- `inventario-unificado-web/app/api/inventario/consolidado/route.ts`
- `inventario-unificado-web/app/api/inventario/consolidado/linhas/route.ts`
- `inventario-unificado-web/app/api/inventario/consolidado/lookup/route.ts`
- `inventario-unificado-web/services/coletorScaResumoService.ts`
- `inventario-unificado-web/services/importacaoInventarioDinamicoService.ts`
- `inventario-unificado-web/services/importacaoInventarioService.ts`
- `inventario-unificado-web/services/impressorasService.ts`
- `inventario-unificado-web/services/visaoGeralImpressorasService.ts`
- `inventario-unificado-web/components/PainelDashboard.tsx`
- `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx`

**Risco: baixo**  
Baixo para funcionamento imediato, mas medio para manutencao. Se uma regra de normalizacao mudar, pode ser corrigida em um arquivo e continuar errada em outro.

**Sugestao de correcao**  
Criar utilitarios compartilhados:

- `lib/utils/text.ts`
- `lib/utils/date.ts`
- `lib/utils/number.ts`
- `lib/utils/competencia.ts`

Depois substituir chamadas duplicadas aos poucos.

**Ordem recomendada para refatorar**  
Media prioridade. Fazer depois das correcoes de estabilidade.

---

### 6. Logica de chamada das Edge Functions duplicada

**Problema encontrado**  
Existe um helper central `lib/supabase/invokeEdge.ts`, mas varias telas ainda possuem funcoes locais para chamar `inventory-core`, `inventory-print` ou outras Edge Functions.

**Arquivos envolvidos**

- `inventario-unificado-web/lib/supabase/invokeEdge.ts`
- `inventario-unificado-web/app/inventario/page.tsx`
- `inventario-unificado-web/app/inventario/devolucao/page.tsx`
- `inventario-unificado-web/app/inventario/conciliacao/page.tsx`
- `inventario-unificado-web/app/inventario/consolidado/page.tsx`
- `inventario-unificado-web/app/inventario/categorias/page.tsx`
- `inventario-unificado-web/app/inventario/importacoes/page.tsx`
- `inventario-unificado-web/app/impressoras/page.tsx`
- `inventario-unificado-web/components/PainelDashboard.tsx`
- `inventario-unificado-web/components/BasicPageShell.tsx`

**Risco: medio**  
Pode causar diferencas de header, tratamento de erro, retry e autenticacao. Isso e especialmente sensivel porque ja houve sinais de erro 401 em massa em Edge Function.

**Sugestao de correcao**  
Obrigar todas as chamadas autenticadas de Edge Function a passar por um unico wrapper. Esse wrapper deve:

- Buscar sessao atual.
- Montar `Authorization`.
- Tratar 401 sem retry infinito.
- Padronizar erro exibido ao usuario.
- Registrar contexto minimo para debug.

**Ordem recomendada para refatorar**  
Alta prioridade, junto com limpeza de tabelas antigas.

---

### 7. Validacao de token/autenticacao repetida em APIs internas

**Problema encontrado**  
Funcoes como `getBearerToken` e validacoes de token aparecem repetidas em rotas API, mesmo existindo arquivo de seguranca compartilhado.

**Arquivos envolvidos**

- `inventario-unificado-web/lib/security/apiAuth.ts`
- `inventario-unificado-web/app/api/usuarios/route.ts`
- `inventario-unificado-web/app/api/inventario/auditoria/route.ts`
- `inventario-unificado-web/app/api/auth/me/route.ts`
- `inventario-unificado-web/app/api/auth/perfil/route.ts`

**Risco: medio**  
Autenticacao duplicada aumenta chance de uma rota ficar mais permissiva ou mais restritiva que outra.

**Sugestao de correcao**  
Centralizar autenticacao das rotas `app/api` em um helper unico. Cada rota deveria chamar algo como `requireApiSession(request)`.

**Ordem recomendada para refatorar**  
Media/alta prioridade, principalmente antes de criar novas rotas.

---

### 8. Regras de negocio espalhadas entre frontend, Edge Functions, services e SQL

**Problema encontrado**  
Regras importantes aparecem em varias camadas: troca assistida, correcao de dados, pagecount diario, substituicao pendente, movimentacao e telemetria. Parte fica em Edge Function, parte em SQL trigger, parte em services e parte no frontend.

**Arquivos envolvidos**

- `inventario-unificado-web/supabase/functions/inventory-core/index.ts`
- `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts`
- `inventario-unificado-web/supabase/functions/inventory-print/index.ts`
- `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`
- `inventario-unificado-web/app/inventario/page.tsx`
- `inventario-unificado-web/app/impressoras/page.tsx`
- `inventario-unificado-web/services/telemetriaDiariaService.ts`

**Risco: alto**  
Alto porque regra duplicada ou espalhada pode gerar comportamento diferente dependendo de onde a acao foi iniciada.

**Sugestao de correcao**  
Definir donos por regra:

- Identidade da impressora e troca assistida: Edge Function + banco.
- Calculo de pagecount diario: banco/SQL e service de leitura.
- UI apenas exibe e solicita acao.
- Coletor apenas coleta e envia payload.

Documentar essa separacao e remover regra duplicada do frontend quando existir.

**Ordem recomendada para refatorar**  
Alta prioridade, mas deve ser feita em passos pequenos e com testes.

---

### 9. Arquivos grandes demais concentram muitas responsabilidades

**Problema encontrado**  
Alguns arquivos ficaram muito grandes e fazem varias coisas ao mesmo tempo: renderizacao, estado, filtros, chamadas API, regras de montagem, validacao e tratamento de erro.

**Arquivos envolvidos**

- `inventario-unificado-web/supabase/functions/inventory-core/index.ts`
- `inventario-unificado-web/supabase/functions/inventory-print/index.ts`
- `inventario-unificado-web/app/inventario/page.tsx`
- `inventario-unificado-web/app/impressoras/page.tsx`
- `inventario-unificado-web/components/PainelDashboard.tsx`
- `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx`
- `inventario-unificado-web/services/telemetriaDiariaService.ts`
- `inventario-unificado-web/services/importacaoInventarioService.ts`
- `inventario-unificado-web/services/importacaoInventarioDinamicoService.ts`

**Risco: medio**  
Nao necessariamente quebra, mas dificulta entender, testar e evoluir.

**Sugestao de correcao**  
Dividir por responsabilidade:

- Componentes visuais pequenos.
- Hooks para estado e filtros.
- Services para consulta.
- Helpers para formatacao.
- Edge Functions divididas por acoes internas.

**Ordem recomendada para refatorar**  
Media prioridade. Fazer depois de estabilizar API, layout e tabelas antigas.

---

### 10. Possivel duplicidade entre dashboard de painel e dashboard de impressoras

**Problema encontrado**  
O dashboard geral e a tela de impressoras parecem calcular indicadores semelhantes: total de paginas, custo por categoria, volume por dia, suprimentos criticos e ranking.

**Arquivos envolvidos**

- `inventario-unificado-web/components/PainelDashboard.tsx`
- `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx`
- `inventario-unificado-web/services/telemetriaDiariaService.ts`
- `inventario-unificado-web/services/dashboardAnaliticoService.ts`
- `inventario-unificado-web/supabase/functions/inventory-print/index.ts`

**Risco: medio**  
Pode gerar numeros diferentes entre telas, dependendo da fonte usada.

**Sugestao de correcao**  
Criar uma camada unica de leitura de indicadores de impressao. O frontend consumiria o mesmo contrato de dados em todas as telas.

**Ordem recomendada para refatorar**  
Depois da limpeza das tabelas antigas.

---

### 11. Rotas API internas e services fazem consultas Supabase repetidas

**Problema encontrado**  
Varias rotas e services consultam Supabase diretamente para entidades basicas como empresa, setor, equipamento, usuarios, inventario e movimentacao. Parte disso e normal, mas ha chance de centralizar padroes de paginacao, erro e filtros.

**Arquivos envolvidos**

- `inventario-unificado-web/app/api/empresas/route.ts`
- `inventario-unificado-web/app/api/equipamentos/route.ts`
- `inventario-unificado-web/app/api/setores/route.ts`
- `inventario-unificado-web/app/api/tipos-equipamento/route.ts`
- `inventario-unificado-web/app/api/movimentacoes/route.ts`
- `inventario-unificado-web/services/empresaService.ts`
- `inventario-unificado-web/services/equipamentoService.ts`
- `inventario-unificado-web/services/setorService.ts`
- `inventario-unificado-web/services/tipoEquipamentoService.ts`
- `inventario-unificado-web/services/movimentacaoService.ts`

**Risco: baixo/medio**  
Baixo para funcionamento, medio para manutencao e performance.

**Sugestao de correcao**  
Criar helpers de repository/query para padronizar:

- select paginado;
- tratamento de erro Supabase;
- filtros comuns;
- retorno consistente.

**Ordem recomendada para refatorar**  
Media prioridade.

---

### 12. Possiveis artefatos locais e arquivos de runtime no projeto

**Problema encontrado**  
Existem diretorios e arquivos locais de build/runtime no workspace, como `.next`, `.vercel`, `node_modules`, `build`, `dist`, logs, caches e zips locais. Nem todos estao necessariamente versionados, mas eles aumentam confusao ao auditar o projeto.

**Arquivos envolvidos**

- `inventario-unificado-web/.next`
- `inventario-unificado-web/.vercel`
- `inventario-unificado-web/node_modules`
- `coletor-snmp/build`
- `coletor-snmp/dist`
- `coletor-snmp/logs`
- `coletor-snmp/data`
- `inventario-unificado-web.zip`
- `projeto.zip`

**Risco: baixo/medio**  
Se estiverem ignorados pelo Git, o risco e baixo. Se algum arquivo de runtime estiver versionado, o risco sobe porque pode vazar estado local ou gerar diffs falsos.

**Sugestao de correcao**  
Conferir `.gitignore` e garantir que builds, logs, zips e caches nao sejam versionados. Para arquivos necessarios como exemplo, usar `.example`.

**Ordem recomendada para refatorar**  
Baixa prioridade, mas vale fazer antes de entregas finais no GitHub.

---

### 13. Arquivo local de impressoras pode representar estado de ambiente

**Problema encontrado**  
O arquivo `coletor-snmp/data/printers.json` aparece como cache/lista operacional do coletor. Se esse arquivo estiver versionado, pode confundir ambiente local com dados reais atuais do Supabase.

**Arquivos envolvidos**

- `coletor-snmp/data/printers.json`
- `coletor-snmp/utils/cache_manager.py`
- `coletor-snmp/scripts/run_collector_loop.py`

**Risco: medio**  
O coletor depende de lista de impressoras atualizada. Um arquivo antigo versionado pode induzir teste errado ou comportamento confuso em outro ambiente.

**Sugestao de correcao**  
Manter apenas `printers.example.json` versionado e deixar `printers.json` como runtime local ignorado, se o sistema permitir.

**Ordem recomendada para refatorar**  
Depois de validar que o coletor sempre sincroniza direto do Supabase como fonte obrigatoria.

---

### 14. Coletor Python tem regras importantes que precisam continuar bem documentadas

**Problema encontrado**  
O coletor Python nao e apenas um script auxiliar. Ele participa do fluxo principal: busca impressoras ativas no Supabase, coleta SNMP, monta payload, envia para Edge Function, registra pendencias e faz retry. Isso precisa estar muito claro na documentacao e nos comentarios de funcao.

**Arquivos envolvidos**

- `coletor-snmp/scripts/run_collector_loop.py`
- `coletor-snmp/utils/cache_manager.py`
- `coletor-snmp/utils/telemetry_mapper.py`
- `coletor-snmp/utils/supabase_client.py`
- `coletor-snmp/utils/collector_auth.py`
- `coletor-snmp/utils/pending_queue.py`
- `coletor-snmp/utils/snmp_*`
- `docs/06-coletor-snmp.md`
- `README.md`

**Risco: medio**  
Para producao, o risco e medio. Para apresentacao de TCC, o risco e alto se a documentacao nao explicar bem o papel de cada arquivo.

**Sugestao de correcao**  
Criar uma secao didatica do coletor com:

- O que cada arquivo faz.
- Como o `.env` controla o comportamento.
- Como o coletor busca impressoras ativas.
- Como o SNMP coleta dados.
- Como o payload e enviado.
- Como retry/pendencia funcionam.

**Ordem recomendada para refatorar**  
Documentacao pode evoluir em paralelo, sem risco de quebrar o sistema.

---

### 15. Tratamento de erro 401 e retry precisa ser padronizado

**Problema encontrado**  
Logs anteriores indicaram chamadas 401 repetidas para Edge Function. Mesmo que o problema tenha sido mitigado, o sistema deve ter uma regra unica: erro 401 nao deve entrar em retry infinito.

**Arquivos envolvidos**

- `inventario-unificado-web/lib/supabase/invokeEdge.ts`
- `inventario-unificado-web/app/impressoras/page.tsx`
- `inventario-unificado-web/components/PainelDashboard.tsx`
- `inventario-unificado-web/supabase/functions/inventory-print/index.ts`
- `coletor-snmp/utils/cache_manager.py`
- `coletor-snmp/utils/pending_queue.py`

**Risco: alto**  
Retry agressivo em erro de autenticacao pode causar carga desnecessaria, afetar Supabase e derrubar experiencia do usuario.

**Sugestao de correcao**  
Padronizar:

- 401 no frontend: parar retry, pedir nova autenticacao.
- 401 no coletor: nao reprocessar indefinidamente, registrar erro claro.
- Timeout: retry limitado com backoff.
- 5xx: retry controlado.

**Ordem recomendada para refatorar**  
Alta prioridade.

---

### 16. Documentacao pode conter caracteres corrompidos em alguns pontos

**Problema encontrado**  
Ha historico de textos com caracteres `?` no lugar de acentos, indicando risco de encoding incorreto em documentos.

**Arquivos envolvidos**

- `README.md`
- `docs/*.md`
- `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`

**Risco: baixo/medio**  
Nao afeta diretamente o sistema, mas afeta qualidade de entrega, GitHub e TCC.

**Sugestao de correcao**  
Padronizar arquivos Markdown e SQL em UTF-8. Fazer uma revisao ortografica e de encoding antes da entrega final.

**Ordem recomendada para refatorar**  
Baixa prioridade tecnica, alta prioridade para apresentacao/documentacao.

## Duplicidades Especificas Mapeadas

### Funcoes de texto e normalizacao

- `normalizarTexto` aparece em varios pontos.
- `limparTexto` aparece em rotas e services.
- Sugestao: mover para `lib/utils/text.ts`.

### Funcoes de data e formatacao

- `formatarDataHora` aparece em telas diferentes.
- `formatNumber` e `formatCurrency` aparecem em dashboards.
- Sugestao: mover para `lib/utils/date.ts` e `lib/utils/number.ts`.

### Funcoes de autenticacao

- `getBearerToken` aparece em varias rotas.
- Sugestao: usar apenas `lib/security/apiAuth.ts`.

### Chamadas Edge Function

- `invokeInventoryCore` e `invokePrintFunction` aparecem duplicadas.
- Sugestao: usar apenas `lib/supabase/invokeEdge.ts`.

### Validacao de competencia

- `validarCompetencia` aparece em importacao e rotas de consolidado/conciliacao.
- Sugestao: mover para `lib/utils/competencia.ts`.

## Ordem Recomendada Geral Para Refatorar

1. Corrigir responsividade da tela de impressoras em 1360x768.
2. Remover ou isolar referencias a tabelas antigas/inexistentes.
3. Padronizar chamada de Edge Functions e tratamento de 401/retry.
4. Centralizar autenticacao das rotas `app/api`.
5. Extrair helpers duplicados de texto, data, numero e competencia.
6. Separar CSS global por dominio ou organizar secoes com padrao claro.
7. Dividir arquivos grandes em componentes, hooks, services e helpers menores.
8. Consolidar indicadores de dashboard/impressoras em uma fonte unica.
9. Auditar pasta `legacy` e remover somente depois de confirmar que nao e usada.
10. Conferir `.gitignore` e remover artefatos locais do versionamento, se existirem.
11. Revisar documentacao Markdown/SQL para corrigir encoding e ortografia.

## Observacoes Sobre Segurança da Analise

Esta auditoria nao removeu arquivos, nao alterou codigo de producao e nao executou refatoracao. O unico arquivo criado foi este relatorio.

Antes de qualquer limpeza real, a recomendacao e criar uma branch separada e validar com:

- `npm run build`
- testes manuais de login;
- tela de inventario;
- tela de impressoras;
- pendencias de substituicao;
- dashboard;
- coletor Python com Supabase saudavel;
- deploy das Edge Functions afetadas, se houver mudanca nelas.

