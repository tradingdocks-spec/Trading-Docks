param([string]$Dotnet = 'dotnet')
$ErrorActionPreference = 'Stop'
$artifacts = Join-Path $PSScriptRoot 'artifacts'
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
& $Dotnet publish (Join-Path $PSScriptRoot 'Windows/Windows.csproj') -c Release -r win-x64 --self-contained true -o (Join-Path $artifacts 'payload')
if ($LASTEXITCODE -ne 0) { throw 'Bridge publish failed' }
Compress-Archive -Path (Join-Path $artifacts 'payload/*') -DestinationPath (Join-Path $artifacts 'payload.zip') -Force
& $Dotnet publish (Join-Path $PSScriptRoot 'Installer/Installer.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $artifacts 'installer')
if ($LASTEXITCODE -ne 0) { throw 'Installer publish failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $artifacts 'installer/TradingDocks.ScannerBridge.Setup.exe') | Format-List
