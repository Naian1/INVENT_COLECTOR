param(
  [string]$ProjectRef = "tcxaktsleilbdgxcstqo",
  [switch]$LinkProject
)

$ErrorActionPreference = "Stop"

Write-Host "Usando projeto: $ProjectRef" -ForegroundColor Cyan
Write-Host "Se nao estiver logado no Supabase CLI, execute: npx supabase login" -ForegroundColor Yellow

if ($LinkProject) {
  npx supabase link --project-ref $ProjectRef
}

npx supabase functions deploy inventory-admin --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy inventory-matrix --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy inventory-core --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy inventory-print --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy collector-impressoras --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy collector-telemetria --project-ref $ProjectRef --no-verify-jwt

Write-Host "Deploy das Edge Functions concluido para o projeto $ProjectRef" -ForegroundColor Green
