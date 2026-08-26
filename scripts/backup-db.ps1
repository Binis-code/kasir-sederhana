# Backup database Kios Nusa POS dari container Docker kasir-mysql.
# Pemakaian:  pnpm db:backup   (atau)   powershell -File scripts\backup-db.ps1
# Output    : backups/kios_nusa-YYYYMMDD-HHmmss.sql  | retensi 14 hari
$ErrorActionPreference = "Stop"

$container = "kasir-mysql"
$user = "kios"
$password = "kios123"
$database = "kios_nusa"
$retentionDays = 14

$dir = Join-Path $PSScriptRoot "..\backups"
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

docker inspect --format "{{.State.Health.Status}}" $container *> $null
if ($LASTEXITCODE -ne 0) { throw "Container '$container' tidak jalan. Nyalakan Docker Desktop lalu 'docker compose up -d'." }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $dir "$database-$stamp.sql"

# Redireksi via cmd agar file ASCII murni (bukan UTF-16 khas PowerShell)
cmd /c "docker exec $container mysqldump -u$user -p$password --single-transaction --routines --triggers $database > `"$file`" 2>NUL"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $file) -or ((Get-Item $file).Length -lt 1000)) {
  throw "mysqldump gagal - cek status container."
}

$cutoff = (Get-Date).AddDays(-$retentionDays)
Get-ChildItem -LiteralPath $dir -Filter "$database-*.sql" |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName; "hapus backup kadaluarsa: $($_.Name)" }

"Backup OK: $file ($([math]::Round((Get-Item $file).Length/1KB,1)) KB)"
