$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

Write-Host "=========================================="
Write-Host "Product dashboard - one click update"
Write-Host "=========================================="
Write-Host ""

$scriptPath = Join-Path $root ".codex-analysis\build_dashboard.py"
if (-not (Test-Path -LiteralPath $scriptPath)) {
  Write-Host "Missing generator script: .codex-analysis\build_dashboard.py" -ForegroundColor Red
  exit 1
}

$pythonCandidates = @(
  (Join-Path $root "runtime\python\python.exe"),
  "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
)

$pythonExe = $null
foreach ($candidate in $pythonCandidates) {
  if (Test-Path -LiteralPath $candidate) {
    $pythonExe = $candidate
    break
  }
}

if (-not $pythonExe) {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { $pythonExe = $cmd.Source }
}
if (-not $pythonExe) {
  $cmd = Get-Command py -ErrorAction SilentlyContinue
  if ($cmd) { $pythonExe = $cmd.Source }
}

if (-not $pythonExe) {
  Write-Host "Python was not found. Please install Python 3 or put portable Python at runtime\python\python.exe." -ForegroundColor Red
  exit 1
}

Write-Host "Reading data files and rebuilding dashboard..."
Write-Host ""

& $pythonExe $scriptPath
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Update failed. Please check the data files in the data folder:" -ForegroundColor Red
  Write-Host "1. Product performance ASIN workbook, file name starts with: 产品表现ASIN"
  Write-Host "2. 售卖产品-数据源.xlsx"
  Write-Host "3. BD活动表.xlsx"
  exit $LASTEXITCODE
}

$outputDir = Join-Path $root "outputs"
$dashboardFile = Get-ChildItem -LiteralPath $outputDir -Filter "*.html" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $dashboardFile) {
  Write-Host "Dashboard was generated but output file was not found." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Update complete. Opening dashboard..."
Start-Process -FilePath $dashboardFile.FullName
