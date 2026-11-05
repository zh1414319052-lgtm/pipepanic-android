param(
    [Parameter(Mandatory=$true)][string]$InputApk,
    [Parameter(Mandatory=$true)][string]$OutputApk,
    [Parameter(Mandatory=$true)][string]$Keystore,
    [string]$Alias = 'haoke-pipepanic-release',
    [string]$BuildTools = "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0"
)
$ErrorActionPreference='Stop'
# The operator resolves protected credentials into this child process only.
# Never put password values on the command line or in this source tree.
if (-not $env:PIPEPANIC_STORE_PASS -or -not $env:PIPEPANIC_KEY_PASS) { throw 'Set the protected signing credentials in process environment first.' }
if (Test-Path -LiteralPath $OutputApk) { throw 'Refuse to overwrite an existing signed package.' }
$aligned = $OutputApk + '.aligned.apk'
if (Test-Path -LiteralPath $aligned) { throw 'Choose an unused output path.' }
try {
    & "$BuildTools\zipalign.exe" -p 4 $InputApk $aligned
    if ($LASTEXITCODE) { throw 'Alignment failed.' }
    & "$BuildTools\apksigner.bat" sign --ks $Keystore --ks-key-alias $Alias --ks-pass env:PIPEPANIC_STORE_PASS --key-pass env:PIPEPANIC_KEY_PASS --out $OutputApk $aligned
    if ($LASTEXITCODE) { throw 'Signing failed.' }
    $verified = & "$BuildTools\apksigner.bat" verify --verbose --print-certs $OutputApk
    if ($LASTEXITCODE -or ($verified -join "`n") -notmatch '3f29b3611c7c94dec1f78193425d85210e20e351617529b61d4aee29704e25c5') { throw 'Unexpected release signature.' }
    $verified
    Get-FileHash -LiteralPath $OutputApk -Algorithm SHA256
} finally {
    [Environment]::SetEnvironmentVariable('PIPEPANIC_STORE_PASS',$null,'Process')
    [Environment]::SetEnvironmentVariable('PIPEPANIC_KEY_PASS',$null,'Process')
}
