# 22 - Mapa Completo de Arquivos do Projeto

Este documento lista todos os arquivos versionados no Git e explica o papel de cada um. A ideia e servir como um mapa de estudo para apresentacao, manutencao e auditoria do projeto.

> Escopo: entram aqui os arquivos retornados por `git ls-files`. Pastas geradas/localizadas como `node_modules`, `.next`, `.vercel`, `.venv`, `dist`, `build`, logs locais e zips nao entram quando nao estao versionadas, porque nao sao fonte principal do sistema.

## Como Ler Este Mapa

- `Sistema Web, APIs e Supabase`: codigo do Next.js, rotas internas, services TypeScript, Edge Functions e SQL.
- `Coletor Python SNMP`: aplicativo local que busca impressoras no Supabase, coleta SNMP e envia telemetria.
- `Documentacao`: material tecnico, TCC, arquitetura, banco, deploy e troubleshooting.
- `Raiz`: arquivos que controlam o repositorio inteiro.

## Coletor Python SNMP

### `coletor-snmp/`

- `coletor-snmp/.env.example`: Modelo das variaveis de ambiente do coletor Python. Mostra URLs, tokens, modo de sincronizacao, timeouts e limites operacionais sem expor segredo real.
- `coletor-snmp/.gitignore`: Ignora arquivos locais do coletor, como logs, filas JSONL, executaveis gerados e ambiente virtual.
- `coletor-snmp/CollectorControlApp.spec`: Receita do PyInstaller para empacotar o aplicativo visual do coletor em executavel Windows.
- `coletor-snmp/requirements.txt`: Lista as bibliotecas Python necessarias para SNMP, HTTP, dotenv, Supabase e utilitarios do coletor.

### `coletor-snmp/data/`

- `coletor-snmp/data/printers.json`: Cache local de runtime com a ultima lista valida de impressoras. Nao deve ser versionado, porque pode conter IPs, patrimonios, series, setores e MACs reais; o arquivo de referencia segura e `coletor-snmp/data/printers.example.json`.
- `coletor-snmp/data/printers.example.json`: Exemplo ficticio e seguro do formato esperado pelo cache local de impressoras.

### `coletor-snmp/scripts/`

- `coletor-snmp/scripts/collector_control_app.py`: Aplicativo desktop simples para iniciar, parar e acompanhar o processo do coletor sem usar terminal manualmente.
- `coletor-snmp/scripts/run_collector_loop.py`: Loop principal do coletor. Executa ciclos periodicos, atualiza cache, coleta SNMP, envia payloads e registra logs.
- `coletor-snmp/scripts/test_collector_push.py`: Script de teste manual para montar/enviar payload de telemetria e validar comunicacao com a Edge Function.

### `coletor-snmp/utils/`

- `coletor-snmp/utils/__init__.py`: Marca a pasta utils como pacote Python importavel pelos scripts do coletor.
- `coletor-snmp/utils/api_client.py`: Camada HTTP/Supabase do coletor. Le configuracao, busca impressoras no banco, envia telemetria, aplica retry controlado e replay de pendencias.
- `coletor-snmp/utils/cache_manager.py`: Orquestra a coleta: sincroniza lista de impressoras, filtra elegiveis, chama SNMP, monta linhas de cache e controla erros por ciclo.
- `coletor-snmp/utils/file_manager.py`: Utilitarios para ler e gravar arquivos locais do coletor com seguranca, principalmente JSON e JSONL.
- `coletor-snmp/utils/runtime_trace.py`: Grava rastros tecnicos estruturados em JSONL para auditoria e diagnostico de ciclos, payloads e falhas.
- `coletor-snmp/utils/snmp_client.py`: Cliente SNMP baseado em pysnmp. Consulta OIDs de impressoras para obter contadores, serie, MAC, status e suprimentos.
- `coletor-snmp/utils/telemetry_mapper.py`: Transforma dados brutos coletados via SNMP/cache no payload padronizado esperado pela Edge collector-telemetria.

## Documentacao

### `docs/`

- `docs/01-overview.md`: Documentacao tecnica do tema "01 overview". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/02-architecture.md`: Documentacao tecnica do tema "02 architecture". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/03-setup.md`: Documentacao tecnica do tema "03 setup". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/04-database.md`: Documentacao tecnica do tema "04 database". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/06-collector.md`: Documentacao tecnica do tema "06 collector". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/07-deploy.md`: Documentacao tecnica do tema "07 deploy". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/08-security.md`: Documentacao tecnica do tema "08 security". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/09-tests.md`: Documentacao tecnica do tema "09 tests". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/10-troubleshooting.md`: Documentacao tecnica do tema "10 troubleshooting". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/11-release-review.md`: Documentacao tecnica do tema "11 release review". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/12-versionamento-github.md`: Documentacao tecnica do tema "12 versionamento github". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/13-auth-rbac-auditoria.md`: Documentacao tecnica do tema "13 auth rbac auditoria". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/14-migracao-auth-supabase-login-coletor-2026-04-29.md`: Documentacao tecnica do tema "14 migracao auth supabase login coletor 2026 04 29". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/15-visao-geral-tcc-impressoras.md`: Documentacao tecnica do tema "15 visao geral tcc impressoras". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/16-telemetria-pagecount-modelo-diario.md`: Documentacao tecnica do tema "16 telemetria pagecount modelo diario". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/17-bilhetagem-tarifas-supabase.md`: Documentacao tecnica do tema "17 bilhetagem tarifas supabase". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/18-mapa-codigo-linhas-tcc.md`: Documentacao tecnica do tema "18 mapa codigo linhas tcc". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/19-cobertura-global-comentarios-sistema.md`: Documentacao tecnica do tema "19 cobertura global comentarios sistema". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/20-guia-integrado-tcc-impressao-telemetria.md`: Documentacao tecnica do tema "20 guia integrado tcc impressao telemetria". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/21-estrutura-pastas-css.md`: Documentacao tecnica do tema "21 estrutura pastas css". Serve como material de estudo, operacao e apresentacao do sistema.
- `docs/22-mapa-completo-arquivos.md`: Este proprio catalogo. Lista os arquivos versionados por pasta e descreve o papel de cada um para estudo, auditoria e manutencao.

### `docs/05-api/`

- `docs/05-api/collector-impressoras.md`: Documenta a API/Edge Function `collector-impressoras`, explicando objetivo, entradas, saidas, seguranca e papel no fluxo.
- `docs/05-api/collector-telemetria.md`: Documenta a API/Edge Function `collector-telemetria`, explicando objetivo, entradas, saidas, seguranca e papel no fluxo.
- `docs/05-api/inventory-admin.md`: Documenta a API/Edge Function `inventory-admin`, explicando objetivo, entradas, saidas, seguranca e papel no fluxo.
- `docs/05-api/inventory-core.md`: Documenta a API/Edge Function `inventory-core`, explicando objetivo, entradas, saidas, seguranca e papel no fluxo.
- `docs/05-api/inventory-matrix.md`: Documenta a API/Edge Function `inventory-matrix`, explicando objetivo, entradas, saidas, seguranca e papel no fluxo.
- `docs/05-api/inventory-print.md`: Documenta a API/Edge Function `inventory-print`, explicando objetivo, entradas, saidas, seguranca e papel no fluxo.
- `docs/05-api/overview.md`: Documenta a API/Edge Function `overview`, explicando objetivo, entradas, saidas, seguranca e papel no fluxo.

### `docs/ADR/`

- `docs/ADR/001-edge-first.md`: Registro de decisao arquitetural. Explica uma escolha tecnica importante, seu contexto, consequencias e motivo.
- `docs/ADR/002-matrix-separada.md`: Registro de decisao arquitetural. Explica uma escolha tecnica importante, seu contexto, consequencias e motivo.

## Raiz do Repositorio

### `./`

- `.gitignore`: Define arquivos e pastas que nao devem entrar no Git, como dependencias, builds, logs e segredos locais.
- `README.md`: Arquivo principal do GitHub. Resume objetivo, arquitetura, fluxos de impressoras, coletor Python e links para documentacao detalhada.

## Sistema Web, APIs e Supabase

### `inventario-unificado-web/`

- `inventario-unificado-web/.env.example`: Modelo das variaveis do Next.js/Supabase usadas pelo site e rotas internas, sem segredos reais.
- `inventario-unificado-web/.gitignore`: Define o que nao entra no Git dentro do projeto web, como .next, node_modules, .vercel e arquivos locais.
- `inventario-unificado-web/middleware.ts`: Middleware do Next.js. Protege rotas, valida sessao e redireciona usuarios conforme autenticacao.
- `inventario-unificado-web/next-env.d.ts`: Arquivo gerado pelo Next.js para tipos globais do framework em TypeScript.
- `inventario-unificado-web/next.config.mjs`: Configuracao do Next.js, incluindo ajustes de build, imagens ou comportamento do framework.
- `inventario-unificado-web/package-lock.json`: Trava versoes exatas das dependencias npm para builds reproduziveis.
- `inventario-unificado-web/package.json`: Define scripts npm, dependencias, devDependencies e metadados do projeto web.
- `inventario-unificado-web/tsconfig.json`: Configuracao do TypeScript usada pelo Next.js, services, components e rotas.
- `inventario-unificado-web/vercel.json`: Configuracao de deploy/execucao da Vercel para o projeto web.

### `inventario-unificado-web/app/`

- `inventario-unificado-web/app/globals.css`: CSS global do Next.js. Contem tokens de tema, estilos base, layout, componentes reutilizaveis e estilos especificos de paginas.
- `inventario-unificado-web/app/layout.tsx`: Layout raiz do App Router. Importa o CSS global, monta estrutura base e envolve as paginas do sistema.
- `inventario-unificado-web/app/page.tsx`: Pagina inicial/painel principal do sistema apos login, com visao geral e navegacao para os modulos.

### `inventario-unificado-web/app/api/auth/login/`

- `inventario-unificado-web/app/api/auth/login/route.ts`: Rota API interna do Next.js para `auth/login`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/auth/logout/`

- `inventario-unificado-web/app/api/auth/logout/route.ts`: Rota API interna do Next.js para `auth/logout`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/auth/me/`

- `inventario-unificado-web/app/api/auth/me/route.ts`: Rota API interna do Next.js para `auth/me`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/auth/perfil/`

- `inventario-unificado-web/app/api/auth/perfil/route.ts`: Rota API interna do Next.js para `auth/perfil`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/bilhetagem/tarifas/`

- `inventario-unificado-web/app/api/bilhetagem/tarifas/route.ts`: Rota API interna do Next.js para `bilhetagem/tarifas`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/coletor/impressoras/`

- `inventario-unificado-web/app/api/coletor/impressoras/route.ts`: Rota API interna do Next.js para `coletor/impressoras`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/coletor/telemetria/`

- `inventario-unificado-web/app/api/coletor/telemetria/route.ts`: Rota API interna do Next.js para `coletor/telemetria`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/empresas/`

- `inventario-unificado-web/app/api/empresas/route.ts`: Rota API interna do Next.js para `empresas`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/equipamentos/`

- `inventario-unificado-web/app/api/equipamentos/route.ts`: Rota API interna do Next.js para `equipamentos`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/impressoras/`

- `inventario-unificado-web/app/api/impressoras/route.ts`: Rota API interna do Next.js para `impressoras`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/impressoras/[id]/`

- `inventario-unificado-web/app/api/impressoras/[id]/route.ts`: Rota API interna do Next.js para `impressoras/[id]`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/`

- `inventario-unificado-web/app/api/inventario/route.ts`: Rota API interna do Next.js para `inventario`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/[id]/`

- `inventario-unificado-web/app/api/inventario/[id]/route.ts`: Rota API interna do Next.js para `inventario/[id]`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/auditoria/`

- `inventario-unificado-web/app/api/inventario/auditoria/route.ts`: Rota API interna do Next.js para `inventario/auditoria`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/conciliacao/`

- `inventario-unificado-web/app/api/inventario/conciliacao/route.ts`: Rota API interna do Next.js para `inventario/conciliacao`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/consolidado/`

- `inventario-unificado-web/app/api/inventario/consolidado/route.ts`: Rota API interna do Next.js para `inventario/consolidado`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/consolidado/linhas/`

- `inventario-unificado-web/app/api/inventario/consolidado/linhas/route.ts`: Rota API interna do Next.js para `inventario/consolidado/linhas`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/consolidado/lookup/`

- `inventario-unificado-web/app/api/inventario/consolidado/lookup/route.ts`: Rota API interna do Next.js para `inventario/consolidado/lookup`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/importacoes/`

- `inventario-unificado-web/app/api/inventario/importacoes/route.ts`: Rota API interna do Next.js para `inventario/importacoes`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/inventario/upload-imagem/`

- `inventario-unificado-web/app/api/inventario/upload-imagem/route.ts`: Rota API interna do Next.js para `inventario/upload-imagem`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/movimentacoes/`

- `inventario-unificado-web/app/api/movimentacoes/route.ts`: Rota API interna do Next.js para `movimentacoes`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/setores/`

- `inventario-unificado-web/app/api/setores/route.ts`: Rota API interna do Next.js para `setores`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/suprimentos/`

- `inventario-unificado-web/app/api/suprimentos/route.ts`: Rota API interna do Next.js para `suprimentos`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/telemetria-pagecount/`

- `inventario-unificado-web/app/api/telemetria-pagecount/route.ts`: Rota API interna do Next.js para `telemetria-pagecount`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/telemetria/resumo-diario/`

- `inventario-unificado-web/app/api/telemetria/resumo-diario/route.ts`: Rota API interna do Next.js para `telemetria/resumo-diario`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/tipos-equipamento/`

- `inventario-unificado-web/app/api/tipos-equipamento/route.ts`: Rota API interna do Next.js para `tipos-equipamento`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/api/usuarios/`

- `inventario-unificado-web/app/api/usuarios/route.ts`: Rota API interna do Next.js para `usuarios`. Recebe requisicoes HTTP, valida contexto e chama services ou Supabase conforme a regra do modulo.

### `inventario-unificado-web/app/impressoras/`

- `inventario-unificado-web/app/impressoras/page.tsx`: Tela operacional de impressoras. Lista status, suprimentos, filtros, notificacoes e dados de telemetria consolidados.

### `inventario-unificado-web/app/inventario/`

- `inventario-unificado-web/app/inventario/page.tsx`: Tela principal do inventario unificado. Lista equipamentos, filtros, pendencias de substituicao e acoes de cadastro/movimentacao.

### `inventario-unificado-web/app/inventario/categorias/`

- `inventario-unificado-web/app/inventario/categorias/page.tsx`: Tela de gerenciamento de categorias/tipos auxiliares usados na organizacao do inventario.

### `inventario-unificado-web/app/inventario/conciliacao/`

- `inventario-unificado-web/app/inventario/conciliacao/page.tsx`: Tela de conciliacao/importacao para comparar dados externos com o inventario oficial.

### `inventario-unificado-web/app/inventario/consolidado/`

- `inventario-unificado-web/app/inventario/consolidado/page.tsx`: Tela para visualizar carga consolidada/importada antes ou durante a conciliacao com o inventario.

### `inventario-unificado-web/app/inventario/devolucao/`

- `inventario-unificado-web/app/inventario/devolucao/page.tsx`: Tela que agrupa itens em devolucao por empresa/chamado e permite exportar ou acompanhar esse fluxo.

### `inventario-unificado-web/app/inventario/importacoes/`

- `inventario-unificado-web/app/inventario/importacoes/page.tsx`: Tela de importacoes de planilhas/dados externos para alimentar ou reconciliar o inventario.

### `inventario-unificado-web/app/login/`

- `inventario-unificado-web/app/login/page.tsx`: Tela de autenticacao. Recebe credenciais, cria sessao Supabase e direciona o usuario para o sistema.

### `inventario-unificado-web/app/usuarios/`

- `inventario-unificado-web/app/usuarios/page.tsx`: Tela administrativa para listar e gerenciar usuarios/perfis do sistema.

### `inventario-unificado-web/components/`

- `inventario-unificado-web/components/BasicPageShell.tsx`: Componente React `BasicPageShell`. Encapsula uma parte visual/funcional reutilizavel do sistema para deixar paginas menores e mais organizadas.
- `inventario-unificado-web/components/PainelDashboard.tsx`: Componente React `PainelDashboard`. Encapsula uma parte visual/funcional reutilizavel do sistema para deixar paginas menores e mais organizadas.
- `inventario-unificado-web/components/ResumoTelemetriaDiaria.tsx`: Componente React `ResumoTelemetriaDiaria`. Encapsula uma parte visual/funcional reutilizavel do sistema para deixar paginas menores e mais organizadas.
- `inventario-unificado-web/components/StatusFeedback.tsx`: Componente React `StatusFeedback`. Encapsula uma parte visual/funcional reutilizavel do sistema para deixar paginas menores e mais organizadas.
- `inventario-unificado-web/components/SuprimentosLista.tsx`: Componente React `SuprimentosLista`. Encapsula uma parte visual/funcional reutilizavel do sistema para deixar paginas menores e mais organizadas.

### `inventario-unificado-web/components/ui/`

- `inventario-unificado-web/components/ui/button.tsx`: Componente base de UI `button`. Padroniza elemento visual reutilizavel para evitar repeticao de markup e estilo nas paginas.
- `inventario-unificado-web/components/ui/card.tsx`: Componente base de UI `card`. Padroniza elemento visual reutilizavel para evitar repeticao de markup e estilo nas paginas.
- `inventario-unificado-web/components/ui/dialog.tsx`: Componente base de UI `dialog`. Padroniza elemento visual reutilizavel para evitar repeticao de markup e estilo nas paginas.
- `inventario-unificado-web/components/ui/input.tsx`: Componente base de UI `input`. Padroniza elemento visual reutilizavel para evitar repeticao de markup e estilo nas paginas.
- `inventario-unificado-web/components/ui/select.tsx`: Componente base de UI `select`. Padroniza elemento visual reutilizavel para evitar repeticao de markup e estilo nas paginas.
- `inventario-unificado-web/components/ui/textarea.tsx`: Componente base de UI `textarea`. Padroniza elemento visual reutilizavel para evitar repeticao de markup e estilo nas paginas.

### `inventario-unificado-web/lib/`

- `inventario-unificado-web/lib/.gitkeep`: Mantem a pasta lib versionada mesmo quando alguma subpasta ainda estiver vazia em certos momentos.

### `inventario-unificado-web/lib/printers/`

- `inventario-unificado-web/lib/printers/naming.ts`: Utilitario especifico de impressoras. Normaliza nomes, modelos ou exibicoes relacionadas ao modulo de impressao.

### `inventario-unificado-web/lib/security/`

- `inventario-unificado-web/lib/security/apiAuth.ts`: Modulo de seguranca. Centraliza validacao de token, sessao, permissao ou autenticacao para evitar regras duplicadas nas rotas.
- `inventario-unificado-web/lib/security/collectorAuth.ts`: Modulo de seguranca. Centraliza validacao de token, sessao, permissao ou autenticacao para evitar regras duplicadas nas rotas.
- `inventario-unificado-web/lib/security/sessionAuth.ts`: Modulo de seguranca. Centraliza validacao de token, sessao, permissao ou autenticacao para evitar regras duplicadas nas rotas.

### `inventario-unificado-web/lib/supabase/`

- `inventario-unificado-web/lib/supabase/client.ts`: Modulo de integracao Supabase. Cria clientes, helpers ou chamadas seguras para banco/Auth/Edge Functions.
- `inventario-unificado-web/lib/supabase/invokeEdge.ts`: Modulo de integracao Supabase. Cria clientes, helpers ou chamadas seguras para banco/Auth/Edge Functions.
- `inventario-unificado-web/lib/supabase/server.ts`: Modulo de integracao Supabase. Cria clientes, helpers ou chamadas seguras para banco/Auth/Edge Functions.

### `inventario-unificado-web/lib/validation/`

- `inventario-unificado-web/lib/validation/coletorSchemasPtBr.ts`: Schema de validacao TypeScript/Zod. Confere formato dos dados antes de gravar, importar ou processar informacoes sensiveis.
- `inventario-unificado-web/lib/validation/importacoesInventarioSchemas.ts`: Schema de validacao TypeScript/Zod. Confere formato dos dados antes de gravar, importar ou processar informacoes sensiveis.
- `inventario-unificado-web/lib/validation/impressoraSchemas.ts`: Schema de validacao TypeScript/Zod. Confere formato dos dados antes de gravar, importar ou processar informacoes sensiveis.
- `inventario-unificado-web/lib/validation/inventarioDinamicoSchemas.ts`: Schema de validacao TypeScript/Zod. Confere formato dos dados antes de gravar, importar ou processar informacoes sensiveis.
- `inventario-unificado-web/lib/validation/inventarioSchemas.ts`: Schema de validacao TypeScript/Zod. Confere formato dos dados antes de gravar, importar ou processar informacoes sensiveis.

### `inventario-unificado-web/public/brand/`

- `inventario-unificado-web/public/brand/ntech-black.png`: Logo NTECH para uso em fundos claros ou contextos que pedem versao escura.
- `inventario-unificado-web/public/brand/ntech-n.png`: Icone compacto da marca NTECH usado quando o menu esta recolhido ou em espacos pequenos.
- `inventario-unificado-web/public/brand/ntech-white.png`: Logo NTECH para uso em fundos escuros.

### `inventario-unificado-web/scripts/`

- `inventario-unificado-web/scripts/backfillLegacyPrinters.mjs`: Script Node/MJS de manutencao/importacao. Executa tarefas pontuais como importar planilhas, extrair tarifas ou migrar dados legados.
- `inventario-unificado-web/scripts/extractTarifasBilhetagem.mjs`: Script Node/MJS de manutencao/importacao. Executa tarefas pontuais como importar planilhas, extrair tarifas ou migrar dados legados.
- `inventario-unificado-web/scripts/importAbaImpressoras.mjs`: Script Node/MJS de manutencao/importacao. Executa tarefas pontuais como importar planilhas, extrair tarifas ou migrar dados legados.
- `inventario-unificado-web/scripts/importLegacyPrintersToInventario.mjs`: Script Node/MJS de manutencao/importacao. Executa tarefas pontuais como importar planilhas, extrair tarifas ou migrar dados legados.

### `inventario-unificado-web/services/`

- `inventario-unificado-web/services/.gitkeep`: Mantem a pasta services versionada mesmo quando alguma subpasta ainda estiver vazia em certos momentos.
- `inventario-unificado-web/services/coletorTelemetriaPtService.ts`: Servico TypeScript `coletorTelemetriaPt`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/empresaService.ts`: Servico TypeScript `empresa`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/equipamentoService.ts`: Servico TypeScript `equipamento`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/googleSheetsSyncService.ts`: Servico TypeScript `googleSheetsSync`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/importacaoInventarioDinamicoService.ts`: Servico TypeScript `importacaoInventarioDinamico`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/impressorasService.ts`: Servico TypeScript `impressoras`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/inventarioService.ts`: Servico TypeScript `inventario`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/movimentacaoService.ts`: Servico TypeScript `movimentacao`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/setorService.ts`: Servico TypeScript `setor`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/suprimentosService.ts`: Servico TypeScript `suprimentos`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/telemetriaDiariaService.ts`: Servico TypeScript `telemetriaDiaria`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.
- `inventario-unificado-web/services/tipoEquipamentoService.ts`: Servico TypeScript `tipoEquipamento`. Concentra consultas, transformacoes e regras de dados usadas por APIs, telas ou Edge-related flows.

### `inventario-unificado-web/supabase/functions/_shared/`

- `inventario-unificado-web/supabase/functions/_shared/cors.ts`: Utilitario compartilhado por Edge Functions Supabase, evitando repetir configuracao comum como CORS.

### `inventario-unificado-web/supabase/functions/collector-impressoras/`

- `inventario-unificado-web/supabase/functions/collector-impressoras/config.toml`: Configuracao da Edge Function `collector-impressoras`, incluindo comportamento de verificacao JWT/deploy conforme Supabase CLI.
- `inventario-unificado-web/supabase/functions/collector-impressoras/index.ts`: Codigo principal da Edge Function `collector-impressoras`. Recebe requests, valida autorizacao, aplica regras de negocio e escreve/consulta o banco.

### `inventario-unificado-web/supabase/functions/collector-telemetria/`

- `inventario-unificado-web/supabase/functions/collector-telemetria/config.toml`: Configuracao da Edge Function `collector-telemetria`, incluindo comportamento de verificacao JWT/deploy conforme Supabase CLI.
- `inventario-unificado-web/supabase/functions/collector-telemetria/index.ts`: Codigo principal da Edge Function `collector-telemetria`. Recebe requests, valida autorizacao, aplica regras de negocio e escreve/consulta o banco.

### `inventario-unificado-web/supabase/functions/inventory-admin/`

- `inventario-unificado-web/supabase/functions/inventory-admin/config.toml`: Configuracao da Edge Function `inventory-admin`, incluindo comportamento de verificacao JWT/deploy conforme Supabase CLI.
- `inventario-unificado-web/supabase/functions/inventory-admin/index.ts`: Codigo principal da Edge Function `inventory-admin`. Recebe requests, valida autorizacao, aplica regras de negocio e escreve/consulta o banco.

### `inventario-unificado-web/supabase/functions/inventory-core/`

- `inventario-unificado-web/supabase/functions/inventory-core/config.toml`: Configuracao da Edge Function `inventory-core`, incluindo comportamento de verificacao JWT/deploy conforme Supabase CLI.
- `inventario-unificado-web/supabase/functions/inventory-core/index.ts`: Codigo principal da Edge Function `inventory-core`. Recebe requests, valida autorizacao, aplica regras de negocio e escreve/consulta o banco.

### `inventario-unificado-web/supabase/functions/inventory-matrix/`

- `inventario-unificado-web/supabase/functions/inventory-matrix/config.toml`: Configuracao da Edge Function `inventory-matrix`, incluindo comportamento de verificacao JWT/deploy conforme Supabase CLI.
- `inventario-unificado-web/supabase/functions/inventory-matrix/index.ts`: Codigo principal da Edge Function `inventory-matrix`. Recebe requests, valida autorizacao, aplica regras de negocio e escreve/consulta o banco.

### `inventario-unificado-web/supabase/functions/inventory-print/`

- `inventario-unificado-web/supabase/functions/inventory-print/config.toml`: Configuracao da Edge Function `inventory-print`, incluindo comportamento de verificacao JWT/deploy conforme Supabase CLI.
- `inventario-unificado-web/supabase/functions/inventory-print/index.ts`: Codigo principal da Edge Function `inventory-print`. Recebe requests, valida autorizacao, aplica regras de negocio e escreve/consulta o banco.

### `inventario-unificado-web/supabase/migrations/`

- `inventario-unificado-web/supabase/migrations/SQL Sistema.sql`: Script SQL consolidado do sistema. Documenta/cria tabelas, indices, triggers e funcoes do banco Supabase/PostgreSQL.

### `inventario-unificado-web/types/`

- `inventario-unificado-web/types/empresa.ts`: Tipos TypeScript do dominio `empresa`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/equipamento.ts`: Tipos TypeScript do dominio `equipamento`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/impressora.ts`: Tipos TypeScript do dominio `impressora`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/inventario.ts`: Tipos TypeScript do dominio `inventario`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/movimentacao.ts`: Tipos TypeScript do dominio `movimentacao`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/piso.ts`: Tipos TypeScript do dominio `piso`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/setor.ts`: Tipos TypeScript do dominio `setor`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/suprimentos.ts`: Tipos TypeScript do dominio `suprimentos`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/telemetria.ts`: Tipos TypeScript do dominio `telemetria`. Define o formato dos dados usados entre services, paginas e APIs.
- `inventario-unificado-web/types/tipoEquipamento.ts`: Tipos TypeScript do dominio `tipoEquipamento`. Define o formato dos dados usados entre services, paginas e APIs.
