# 11 - Release Review

## Objetivo

Garantir revisao continua da documentacao a cada release, evitando desvio entre sistema real e conteudo publicado.

## Definicao de pronto de release

Uma release so e concluida quando:

1. Mudancas tecnicas estao refletidas em docs.
2. Exemplos de API estao atualizados.
3. Guia de deploy/troubleshooting foi revisado.
4. Proximos passos foram reavaliados.

## Checklist obrigatorio

### Arquitetura

- [ ] Houve mudanca de fluxo entre web, edge e banco?
- [ ] [02-architecture](02-architecture.md) foi atualizado?
- [ ] Alguma decisao exige novo ADR?

### API

- [ ] Action nova/adaptada documentada em [05-api](05-api/overview.md)
- [ ] Request, response e erro real atualizados
- [ ] Endpoints legados alterados em [05-api/overview](05-api/overview.md)

### Dados

- [ ] Migration nova registrada em [04-database](04-database.md)
- [ ] Regras de integridade alteradas foram documentadas

### Operacao

- [ ] [07-deploy](07-deploy.md) revisado
- [ ] [10-troubleshooting](10-troubleshooting.md) revisado
- [ ] [08-security](08-security.md) revisado

### Testes

- [ ] [09-tests](09-tests.md) atualizado com cobertura atual
- [ ] Evidencias de smoke/regressao registradas

## Cadencia

- Revisao obrigatoria em toda release de producao.
- Revisao parcial opcional em releases internas de homologacao.

## Responsabilidade

- Owner tecnico da release: garante consistencia do pacote.
- Revisor secundario: valida navegabilidade e clareza da documentacao.

## Ultimas atualizacoes (2026-04-14)

- Impressoras: leitura de suprimentos com fallback percentual legado (`nr_quantidade` entre 0 e 100).
- Impressoras: ajuste visual das barras e remocao do destaque amarelo de linha por staleness.
- Devolucao: exportacao CSV, XLSX e PDF por download direto (sem popup de impressao).
- Painel inicial: reorganizacao visual de cards e atalhos para reduzir ruido e melhorar legibilidade.
- API docs revisadas em `inventory-core` e `inventory-print` para refletir contratos atuais.

## Ultimas atualizacoes (2026-04-16)

- Importacao Matrix: parser de cabecalhos expandido para aceitar variacoes de planilha (ex.: `N.Serie`, `Descricao`, `Codigo do Cliente`, `Sku`, `Contrato`, `Termo`).
- Importacao Matrix: diagnostico visual no upload com aviso de colunas obrigatorias ausentes e colunas ignoradas.
- Processo de reimportacao Matrix documentado com reset seguro da carga (`TRUNCATE public.inventario_consolidado_carga RESTART IDENTITY CASCADE`).
- Deploy frontend publicado em producao com validacao de disponibilidade HTTP 200 na URL principal.
- Preparacao para versionamento GitHub: reforco de `.gitignore` no coletor para ignorar `.env` local e higienizacao de arquivos texto com placeholders de segredo.
