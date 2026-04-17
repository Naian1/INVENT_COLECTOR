# ADR 002 - Matrix Separada do Inventario Oficial

Status: Aceito

## Contexto

A base Matrix mensal tem comportamento de carga periodica e pode conter divergencias, duplicidades e mudancas frequentes que nao devem contaminar a base oficial de inventario.

## Decisao

Manter Matrix em staging dedicado (carga + linhas) e executar conciliacao com inventario oficial por regras explicitas.

## Consequencias

Positivas:

- Reimportacao por competencia sem impacto direto no inventario oficial.
- Rastreabilidade de diferencas entre origens.
- Fluxo de conciliacao mais controlado para operacao.

Negativas:

- Maior complexidade de consulta para visao consolidada.
- Necessidade de manter processo de conciliacao recorrente.

## Operacao associada

Fluxo padrao start -> append -> finish em inventory-matrix para cada competencia MM/AAAA.
