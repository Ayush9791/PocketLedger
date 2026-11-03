$ErrorActionPreference = 'Stop'
$keystore = Join-Path (Get-Location) 'pocketledger-upload.jks'
if (Test-Path $keystore) { throw "Keystore already exists at $keystore. Do not overwrite it." }
$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) { throw 'keytool not found. Install a JDK and add its bin folder to PATH.' }
Write-Host 'Create the PocketLedger Android signing key. Store passwords in a password manager.'
& keytool -genkeypair -v -keystore $keystore -alias pocketledger -storetype JKS -keyalg RSA -keysize 4096 -validity 10000
if ($LASTEXITCODE -ne 0) { throw 'keytool failed.' }
Write-Host "Created $keystore. Back it up offline. Never commit or share this file."
