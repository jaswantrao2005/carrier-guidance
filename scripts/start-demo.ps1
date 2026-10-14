param(
    [switch]$Rebuild,
    [switch]$WithoutVideoReview,
    [switch]$OpenBrowser,
    [switch]$CheckOnly
)
. (Join-Path $PSScriptRoot 'demo-common.ps1')

$demoLock = $null
try {
    $demoLock = Enter-DemoLock
    $config = Get-DemoConfig
    $node = Test-DemoPrerequisites $config
    if ($CheckOnly) {
        Write-Host 'Preflight passed. No application servers were started.'
        exit 0
    }
    $records = @(Read-DemoState | Where-Object { @(Get-DemoOwnedProcesses $_).Count })
    foreach ($record in $records) { Update-DemoChildren $record }
    Save-DemoState $records
    $buildId = Join-Path $script:DemoRoot 'frontend/.next/BUILD_ID'
    if ($Rebuild -and @($records | Where-Object name -eq 'frontend').Count) {
        throw 'Stop the demo before rebuilding: powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1'
    }
    if ($Rebuild -or -not (Test-Path -LiteralPath $buildId)) {
        Write-Host 'Building the production frontend. This can take a few minutes...'
        Push-Location (Join-Path $script:DemoRoot 'frontend')
        try {
            & $node (Join-Path $script:DemoRoot 'frontend/node_modules/next/dist/bin/next') build
            if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed. Application startup has stopped.' }
        } finally { Pop-Location }
    }
    $python = Join-Path $script:DemoRoot 'integrity-service/.venv/Scripts/python.exe'
    $model = Join-Path $script:DemoRoot 'integrity-service/models/blaze_face_short_range.tflite'
    $videoEnabled = -not $WithoutVideoReview -and (Test-Path -LiteralPath $python) -and (Test-Path -LiteralPath $model)
    $services = @()
    if ($videoEnabled) {
        $services += @{ Name = 'video-review'; Port = $config.VideoPort; Url = "$($config.VideoUrl)/health"; Executable = $python; Args = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', $config.VideoPort.ToString()); Directory = Join-Path $script:DemoRoot 'integrity-service'; Environment = @{ RECORDINGS_DIR = $config.RecordingsDir } }
    } elseif (-not $WithoutVideoReview) {
        Write-Warning 'Optional video review is unavailable because the Python virtual environment or model is missing. The interview and recording features can still run.'
    }
    $backendEnvironment = @{}
    if ($videoEnabled) { $backendEnvironment['INTEGRITY_SERVICE_URL'] = $config.VideoUrl }
    $services += @{ Name = 'backend'; Port = $config.BackendPort; Url = "$($config.BackendUrl)/api/health"; Executable = $node; Args = @((Join-Path $script:DemoRoot 'backend/src/server.js')); Directory = Join-Path $script:DemoRoot 'backend'; Environment = $backendEnvironment }
    $services += @{ Name = 'frontend'; Port = 3000; Url = $config.FrontendUrl; Executable = $node; Args = @((Join-Path $script:DemoRoot 'frontend/node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', '3000'); Directory = Join-Path $script:DemoRoot 'frontend'; Environment = @{} }
    foreach ($service in $services) {
        $record = @($records | Where-Object name -eq $service.Name) | Select-Object -First 1
        $portOwners = @(Get-DemoPortOwner $service.Port)
        $ownedPids = @()
        if ($record) { $ownedPids = @(Get-DemoOwnedProcesses $record | Select-Object -ExpandProperty ProcessId) }
        if ($portOwners.Count -and @($portOwners | Where-Object { $_ -notin $ownedPids }).Count) {
            throw "Port $($service.Port) is already occupied by a process this launcher did not start. Close that server yourself or use check-demo.ps1 to inspect readiness."
        }
    }
    foreach ($service in $services) {
        $record = @($records | Where-Object name -eq $service.Name) | Select-Object -First 1
        if ($record) {
            Wait-DemoReady $service.Name $service.Url $record
            Write-Host "$($service.Name) is already running."
            continue
        }
        if (@(Get-DemoPortOwner $service.Port).Count) {
            throw "Port $($service.Port) is already occupied by a process this launcher did not start. Close that server yourself or use check-demo.ps1 to inspect readiness."
        }
        $record = Start-DemoProcess $service.Name $service.Executable $service.Args $service.Directory $service.Environment
        $records += $record
        Save-DemoState $records
        Wait-DemoReady $service.Name $service.Url $record
        Update-DemoChildren $record
        Save-DemoState $records
        Write-Host "$($service.Name) is ready."
    }
    Write-Host ''
    Write-Host "Demo ready: $($config.FrontendUrl)"
    Write-Host 'Logs and process records: test-results/demo/'
    Write-Host 'The backend evaluation worker runs with the backend. MongoDB and uploads persist after stopping.'
    if ($OpenBrowser) { Start-Process $config.FrontendUrl }
} catch {
    Write-Host "Demo startup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Any services already started remain tracked. Run scripts/stop-demo.ps1 to stop them safely.'
    exit 1
} finally {
    if ($demoLock) { Exit-DemoLock $demoLock }
}
