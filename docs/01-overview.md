# 01 - Overview

## Objetivo

Padronizar a operacao de inventario e monitoramento de impressoras com fluxo automatizado, historico tecnico e visao web unica para TI.

## Problemas que o sistema resolve

- Reduz verificacao manual de impressoras e suprimentos.
- Centraliza dados operacionais e tecnicos.
- Compara base Matrix mensal com inventario oficial.
- Aumenta rastreabilidade e capacidade de resposta da equipe.

## Escopo funcional

No escopo:

- Coleta SNMP periodica de impressoras.
- Persistencia de telemetria e historico de paginas.
- Operacao de inventario com hierarquia pai-filho.
- Importacao Matrix por competencia MM/AAAA.
- Conciliacao de divergencias entre Matrix e inventario.

Fora do escopo:

- BI corporativo completo.
- Automacao de compras.
- Integracoes hospitalares externas nao implementadas.

## Fluxos principais

1. Fluxo de operacao de impressoras
- Coletor consulta impressoras por SNMP.
- Dados sao enviados para APIs de backend no Supabase.
- Interface web mostra status, consumo e alertas.

2. Fluxo de inventario
- Time cadastra ativo no inventario oficial.
- Regras validam setor, hierarquia e status.
- Ativo passa a compor base operacional e historico.

3. Fluxo Matrix e conciliacao
- Base mensal entra por importacao em lote.
- Competencia existente e substituida de forma controlada.
- Tela de conciliacao mostra duplicidades e diferencas.

## Publico alvo por secao

- Dev: [03-setup](03-setup.md), [05-api overview](05-api/overview.md), [09-tests](09-tests.md)
- Operacao TI: [06-collector](06-collector.md), [10-troubleshooting](10-troubleshooting.md)
- Arquitetura/Governanca: [02-architecture](02-architecture.md), [ADR](ADR/001-edge-first.md), [08-security](08-security.md)
