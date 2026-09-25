param(
  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\TradingDocksScannerBridge'),
  [string]$Dotnet = (Join-Path $env:LOCALAPPDATA 'TradingDocksBuild\dotnet\dotnet.exe')
)
$ErrorActionPreference = 'Stop'
# Read installed artifacts only. All test pairing, backend and recovery stores are
# synthetic; this does not connect to the installed process or its private state.
$exe = Join-Path $InstallDirectory 'TradingDocks.ScannerBridge.exe'
$core = Join-Path $InstallDirectory 'Core.dll'
$version = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
if ($version -ne '1.3.1+3269e252717817e7355617eef99244be1eeb80b9') { throw 'Unreviewed installed version; inspect its matching fixture contract first.' }
foreach ($file in @($exe, $core)) {
  if ((Get-AuthenticodeSignature -LiteralPath $file).Status -ne 'Valid') { throw 'Installed artifact signature is not valid.' }
}
if (Get-NetTCPConnection -LocalPort 47392 -State Listen -ErrorAction SilentlyContinue) { throw 'Isolated fixture port is already occupied.' }
$target = Join-Path $env:TEMP ('td-phase1m-installed-core-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $target | Out-Null
Copy-Item -LiteralPath $core -Destination (Join-Path $target 'Core.dll')
$hash = (Get-FileHash -LiteralPath $core).Hash
if ((Get-FileHash -LiteralPath (Join-Path $target 'Core.dll')).Hash -ne $hash) { throw 'Installed assembly copy mismatch.' }
$source = git show '3269e252:scanner-bridge/Tests/Program.cs'
if ($LASTEXITCODE -ne 0) { throw 'Reviewed matching fixtures unavailable.' }
# Keep the reviewed Windows TLS fixture's temporary key lifetime. EphemeralKeySet
# cannot serve this Schannel handshake. No certificate is installed into a store.
$source = $source -join "`n"
if ($env:TD_AGENT_PARITY_INPUT -and $env:TD_AGENT_PARITY_OUTPUT) {
  $source = $source.Replace('await RecoveryTests.Run(Check);', 'await RecoveryTests.Run(Check); InstalledAgentDownstream.Run();')
  if (-not $source.Contains('InstalledAgentDownstream.Run();')) { throw 'Installed parity injection anchor missing.' }
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'fixtures\InstalledAgentDownstream.cs') -Destination (Join-Path $target 'InstalledAgentDownstream.cs')
}
[IO.File]::WriteAllText((Join-Path $target 'Program.cs'), $source)
foreach ($name in @('ScanSnapTests.cs', 'InboxTests.cs', 'RecoveryTests.cs')) {
  $fixture = git show "3269e252:scanner-bridge/Tests/$name"
  if ($LASTEXITCODE -ne 0) { throw 'Required reviewed fixture missing.' }
  [IO.File]::WriteAllText((Join-Path $target $name), ($fixture -join "`n"))
}
@'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>enable</ImplicitUsings><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup>
  <ItemGroup><FrameworkReference Include="Microsoft.AspNetCore.App" /><Reference Include="Core"><HintPath>Core.dll</HintPath></Reference></ItemGroup>
</Project>
'@ | Set-Content -LiteralPath (Join-Path $target 'Evidence.csproj')
& $Dotnet run --project (Join-Path $target 'Evidence.csproj') --configuration Release
if ($LASTEXITCODE -ne 0) { throw 'Installed Core contract fixture failed.' }
if ((Get-FileHash -LiteralPath $core).Hash -ne $hash) { throw 'Installed assembly changed during inspection.' }
[pscustomobject]@{
  Version = $version; InstalledCoreSHA256 = $hash; FixtureDirectory = $target
  CaptureContract = 'PASS on installed assembly bytes with synthetic devices/stores'
  InventoryMutationParity = 'NOT CERTIFIED: installed agent has no inventory command RPC; cloud handoff is separate'
  LivePairingRestartHardware = 'NOT RUN'
} | ConvertTo-Json
