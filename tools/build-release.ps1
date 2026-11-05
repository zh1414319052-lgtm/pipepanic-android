param([string]$BuildDirectory)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
if (-not $BuildDirectory) { $BuildDirectory = Join-Path $env:TEMP ('PipePanic-build-' + [guid]::NewGuid().ToString('N')) }
$target = [System.IO.Path]::GetFullPath($BuildDirectory)
if ($target -match '[^\x00-\x7F]') { throw 'Use an ASCII-only build directory for Windows Java test classpaths.' }
if (Test-Path -LiteralPath $target) { throw 'Choose a new build directory so removed sources cannot survive in a stale mirror.' }
New-Item -ItemType Directory -Path $target | Out-Null
& robocopy.exe $project $target /E /XD .git .gradle build node_modules art /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw 'Could not prepare build inputs.' }
Push-Location $project
try { & node --test tests/*.cjs; if ($LASTEXITCODE) { throw 'Game tests failed.' } } finally { Pop-Location }
Push-Location $target
try {
    & .\gradlew.bat :app:testReleaseUnitTest :app:assembleRelease --console=plain
    if ($LASTEXITCODE) { throw 'Android tests/build failed.' }
    Write-Output (Join-Path $target 'app\build\outputs\apk\release\app-release-unsigned.apk')
} finally { Pop-Location }
