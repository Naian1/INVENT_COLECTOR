# 19 - Cobertura global de comentarios (sistema inteiro)

## Atualizado em 2026-05-13

## Objetivo

Padronizar a leitura didatica do projeto inteiro para estudo/TCC, incluindo coletor, backend, frontend, scripts e SQL.

## Regra aplicada no codigo

- Todo arquivo de codigo recebe cabecalho com marcador `DOC-CODEMAP`.
- O cabecalho identifica caminho do arquivo e papel arquitetural.
- Esse marcador facilita busca global no editor (`DOC-CODEMAP`).

## Escopo desta rodada

- Arquivos de codigo anotados: 131
- Linhas totais de codigo no escopo: 40667

## Cobertura por modulo

| Modulo | Arquivos | Linhas |
|---|---:|---:|
| Outros arquivos de codigo | 131 | 40667 |

## Como estudar

1. Comecar por `docs/18-mapa-codigo-linhas-tcc.md` para localizar fluxos-chave.
2. Abrir o arquivo alvo e ler o cabecalho `DOC-CODEMAP` para entender contexto.
3. Seguir para funcoes principais do modulo (servicos, rotas e componentes).

## Observacao importante

- Comentarios em todas as linhas, literalmente, tendem a poluir manutencao e aumentar risco de conflito.
- A estrategia adotada prioriza didatica por arquivo e por bloco funcional, preservando legibilidade do codigo.
