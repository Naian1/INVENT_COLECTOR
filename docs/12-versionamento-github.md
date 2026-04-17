# 12 - Versionamento GitHub (Guia Geral)

## Objetivo

Consolidar um processo unico para subir o projeto no GitHub com seguranca, preservando historico tecnico sem expor segredos.

## Escopo desta versao

Esta versao inclui:

- Correcao de importacao Matrix para variacoes de cabecalho entre planilhas.
- Diagnostico de colunas ausentes/ignoradas na tela de importacao Matrix.
- Deploy frontend publicado e validado em producao.
- Ajustes de preparo para versionamento (higiene de segredos e ignores).

## Regras de seguranca antes do primeiro commit

1. Nunca commitar arquivos `.env` com valores reais.
2. Nunca commitar chaves `service_role`, tokens de coletor ou segredos equivalentes.
3. Usar apenas exemplos com placeholder (`.env.example`).
4. Se algum segredo foi exposto localmente, rotacionar antes de publicar repositorio.

## Estado de protecao aplicado

- `.gitignore` raiz criado para cobrir `.venv`, `node_modules`, artefatos de build e `**/.env*` (com excecao de `.env.example`).
- `coletor-snmp/.gitignore` atualizado para ignorar `.env` local.
- Arquivos texto de referencia com segredo explicito foram higienizados para placeholder `<redacted_rotate_before_use>`.

## Checklist pre-push (obrigatorio)

1. Conferir ignores:

```bash
# Linux/macOS
cat .gitignore
cat coletor-snmp/.gitignore
```

```powershell
# Windows PowerShell
Get-Content .gitignore
Get-Content .\coletor-snmp\.gitignore
```

2. Procurar vazamento de segredo em arquivos rastreados:

```bash
rg -n --hidden --glob '!**/.venv/**' --glob '!**/node_modules/**' "sb_secret_|SUPABASE_SERVICE_ROLE_KEY|COLLECTOR_API_TOKEN|BEGIN RSA|BEGIN OPENSSH"
```

3. Garantir que apenas exemplos de env estao versionados:

```bash
rg --files -g "**/.env*"
```

4. Validar estado final antes do commit:

```bash
git status
```

## Fluxo recomendado de inicializacao Git

Se ainda nao houver repositorio git no root:

```bash
git init
git add .
git status
```

Revisar cuidadosamente a lista de arquivos em stage. Se aparecer qualquer `.env` real ou arquivo com segredo, remover antes do commit:

```bash
git restore --staged <arquivo>
```

Depois:

```bash
git commit -m "chore: baseline inicial do projeto com docs e hardening de versionamento"
```

## Fluxo de release para esta stack

1. Aplicar mudancas de codigo.
2. Atualizar docs tecnicas (`10-troubleshooting`, `11-release-review`, APIs e setup quando necessario).
3. Publicar deploy.
4. Executar checklist pre-push de segredos.
5. Versionar no GitHub.

## Pos-push (governanca)

- Ativar protecao de branch principal.
- Exigir pull request para alteracoes de producao.
- Revisar segredos do ambiente periodicamente.
- Manter este guia atualizado a cada novo risco identificado.
