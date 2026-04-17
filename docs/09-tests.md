# 09 - Tests

## Estado atual

Cobertura automatizada atual:

- Coletor: script de validacao de envio em coletor-snmp/scripts/test_collector_push.py
- Web: sem suite de teste dedicada no momento
- Edge Functions: sem suite automatizada versionada no repo no momento

## Objetivo

Aumentar cobertura para reduzir regressao em inventario, Matrix, conciliacao e impressoras.

## Plano de ampliacao

Fase 1 (curto prazo)

1. Web
- Adotar Vitest + Testing Library para testes de componentes e hooks.
- Cobrir telas criticas: inventario, importacoes, conciliacao, impressoras.

2. Edge Functions
- Criar testes de contrato por action (request/response/error).
- Validar regras criticas de create_inventario e matrix workflow.

3. Coletor
- Separar parsing SNMP em unidades testaveis.
- Criar testes de normalizacao de payload.

Fase 2 (medio prazo)

1. Integracao
- Pipeline que sobe ambiente de teste e executa smoke de APIs.
2. Qualidade
- Meta inicial de cobertura minima: 60% nos modulos criticos.

## Suite minima recomendada por release

- Testes unitarios de regras de inventario.
- Testes de contrato das actions inventory-matrix.
- Smoke test da tela de conciliacao com pagina e totais.
- Teste de envio do coletor com token valido.

## Comandos existentes

Web:

```bash
cd inventario-unificado-web
npm run typecheck
npm run build
```

Coletor:

```powershell
cd coletor-snmp
.venv\Scripts\activate
python scripts\test_collector_push.py
```
