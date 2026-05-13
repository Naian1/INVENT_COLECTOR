# 19 - Cobertura global de comentarios (sistema inteiro)

## Atualizado em 2026-05-13

## Objetivo

Padronizar a leitura didatica do projeto inteiro para estudo/TCC, incluindo coletor, backend, frontend, scripts e SQL.

## Regras aplicadas no codigo

- Todo arquivo de codigo recebe cabecalho com marcador `DOC-CODEMAP`.
- Toda funcao do sistema recebe comentario com marcador `DOC-FUNC` imediatamente acima da declaracao.
- Os dois marcadores podem ser buscados globalmente no editor para navegacao rapida.

## Escopo desta rodada

- Arquivos de codigo no escopo: 130
- Arquivos com cabecalho `DOC-CODEMAP`: 129
- Linhas de codigo no escopo: 42914
- Comentarios de funcao (`DOC-FUNC`) ativos: 779

## Como estudar

1. Comecar por `docs/18-mapa-codigo-linhas-tcc.md` para localizar fluxos-chave.
2. Abrir o arquivo alvo e ler o cabecalho `DOC-CODEMAP` para entender contexto.
3. Ler funcao por funcao usando os blocos `DOC-FUNC` como guia do objetivo de cada rotina.
4. Cruza com `docs/18-mapa-codigo-linhas-tcc.md` quando precisar entender fluxo ponta-a-ponta.

## Estrutura do comentario `DOC-FUNC`

- `O que faz`: objetivo funcional direto da rotina.
- `Entradas`: parametros esperados pela assinatura.
- `Como executa`: resumo do processamento principal e validacoes.
- `Retorno/Efeitos`: o que devolve e efeitos relevantes no fluxo.

## Nivel de detalhe aplicado

- Os comentarios foram enriquecidos para linguagem didatica, com foco em leitura por iniciantes.
- O texto descreve explicitamente passos de validacao, transformacao, consulta/escrita e tratamento de erro quando presentes.
- A navegacao por linha foi atualizada em `docs/18-mapa-codigo-linhas-tcc.md` para bater com a versao atual do codigo.

## Observacao importante

- A base agora esta comentada por funcao para estudo integral.
- Em trechos legados comentados por bloco (`/* ... */`), os comentarios de funcao podem ser omitidos para nao quebrar sintaxe.
