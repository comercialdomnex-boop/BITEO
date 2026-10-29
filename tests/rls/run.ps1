# =============================================================================
# BITEO — ETAPAS 7C e 8.2A.2 — run.ps1
# Roda a suíte de testes de RLS/segurança (+ RPC create_first_store) nos DOIS cenarios:
#   1. REAL      -> banco local como esta hoje (sem os grants base)
#   2. COM GRANTS -> com 11_grants.sql aplicado (estado que as migrations
#                    pressupoem apos o supabase db push)
# Cada cenario e uma transacao propria que termina em ROLLBACK: nada e
# migrado, nada e persistido, o frontend nao participa.
# =============================================================================
[CmdletBinding()]
param(
  [switch]$KeepProbeUser,
  [string]$LogPath = (Join-Path $PSScriptRoot 'last_run.log'),
  [string]$Container = 'supabase_db_Biteo'
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$utf8 = [System.Text.UTF8Encoding]::new($false)

$parteComum  = @('00_harness.sql', '10_fixtures.sql')
$parteTestes = @(
  '20_1_privilegios_perfis_isolamento.sql',
  '20_2_matriz.sql',
  '20_3_escalada_attendant.sql',
  '20_4_insert_estado_negadas_anon.sql',
  '20_5_create_first_store.sql'
)

function Read-Part([string]$nome) {
  [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot $nome), $utf8)
}

function New-SuiteScript([string]$cenario, [bool]$comGrants) {
  $sb = [System.Text.StringBuilder]::new()
  [void]$sb.AppendLine('begin;')
  foreach ($f in $parteComum) { [void]$sb.AppendLine((Read-Part $f)) }
  if ($comGrants) { [void]$sb.AppendLine((Read-Part '11_grants.sql')) }
  [void]$sb.AppendLine("\echo ============================================================")
  [void]$sb.AppendLine("\echo CENARIO: $cenario")
  [void]$sb.AppendLine("\echo ============================================================")
  [void]$sb.AppendLine('\o /dev/null')
  [void]$sb.AppendLine("select set_config('rls_check.cenario', '$cenario', false);")
  foreach ($f in $parteTestes) { [void]$sb.AppendLine((Read-Part $f)) }
  [void]$sb.AppendLine('\o')
  [void]$sb.AppendLine("\echo ---- RELATORIO DO CENARIO: $cenario ----")
  [void]$sb.AppendLine('\pset format unaligned')
  [void]$sb.AppendLine('\pset tuples_only on')
  [void]$sb.AppendLine('\pset footer off')
  [void]$sb.AppendLine('select * from rls_check.report();')
  [void]$sb.AppendLine('rollback;')
  return $sb.ToString()
}

function Invoke-Psql([string]$script, [string]$arquivo) {
  $local = Join-Path ([System.IO.Path]::GetTempPath()) $arquivo
  [System.IO.File]::WriteAllText($local, $script, $utf8)
  docker cp $local "${Container}:/tmp/$arquivo"
  if ($LASTEXITCODE -ne 0) { throw "docker cp falhou para $arquivo" }
  $out = & docker exec $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/$arquivo" 2>&1
  $code = $LASTEXITCODE
  $linhas = @($out | ForEach-Object { $_.ToString() })
  $linhas | Tee-Object -FilePath $LogPath -Append | Write-Host
  if ($code -ne 0) { throw "psql terminou com codigo $code em $arquivo (veja $LogPath)" }
}

# --- cabecalho do log --------------------------------------------------------
@(
  "BITEO — ETAPAS 7C + 8.2A.2 — suíte RLS — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  ''
) | Set-Content -LiteralPath $LogPath -Encoding utf8

# --- cenario 1: REAL ---------------------------------------------------------
Write-Host '>> executando cenario REAL (sem grants base)'
Invoke-Psql (New-SuiteScript -cenario 'REAL' -comGrants $false) 'rls_real.sql'
Write-Host '>> cenario REAL concluido'
Write-Host ''

# --- cenario 2: COM GRANTS ---------------------------------------------------
Write-Host '>> executando cenario COM GRANTS (estado pressuposto pelas migrations)'
Invoke-Psql (New-SuiteScript -cenario 'COM GRANTS' -comGrants $true) 'rls_com_grants.sql'
Write-Host '>> cenario COM GRANTS concluido'
Write-Host ''

# --- limpeza: usuario probe criado nas exploracoes da 7C ---------------------
if (-not $KeepProbeUser) {
  Write-Host '>> removendo usuario probe rls.probe@biteo.dev'
  & docker exec $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "delete from public.profiles where id = '300499c0-a168-4f9b-844a-d439b61821ed'; delete from auth.users where id = '300499c0-a168-4f9b-844a-d439b61821ed';" 2>&1 | Write-Host
  if ($LASTEXITCODE -ne 0) { throw 'falha ao remover o usuario probe' }
}

Write-Host ''
Write-Host "Log completo: $LogPath"
