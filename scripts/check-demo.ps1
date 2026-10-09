param([switch]$Preflight)
. (Join-Path $PSScriptRoot 'demo-common.ps1')

try {
    $config = Get-DemoConfig
    if ($Preflight) {
        $null = Test-DemoPrerequisites $config
        Write-Host 'Preflight passed. This confirms local configuration and database access; it does not call paid AI APIs.'
        exit 0
    }
    $failed = $false
    foreach ($service in @(
        @{ Name = 'Backend and MongoDB'; Url = "$($config.BackendUrl)/api/health" },
        @{ Name = 'Frontend'; Url = $config.FrontendUrl }
    )) {
        if (Test-DemoHttp $service.Url) { Write-Host "OK  $($service.Name)" }
        else { Write-Host "OFF $($service.Name)"; $failed = $true }
    }
    if (Test-DemoHttp "$($config.VideoUrl)/health") { Write-Host 'OK  Optional video review' }
    else { Write-Host 'OFF Optional video review' }
    try {
        $capabilities = Invoke-RestMethod -Uri "$($config.BackendUrl)/api/health/services" -TimeoutSec 3
        Write-Host 'Service configuration:'
        # The health API deliberately returns configuration status, never credentials.
        $capabilities | ConvertTo-Json -Depth 4 | Write-Host
    } catch { Write-Host 'Service configuration endpoint unavailable.' }
    Write-Host ''
    Write-Host 'Tracked launcher processes:'
    $records = @(Read-DemoState)
    if (-not $records.Count) { Write-Host 'None. The launcher will not stop servers started elsewhere.' }
    foreach ($record in $records) {
        $status = if (@(Get-DemoOwnedProcesses $record).Count) { 'running' } else { 'stale' }
        Write-Host "$($record.name): $status, PID $($record.pid)"
    }
    if ($failed) { exit 1 }
} catch {
    Write-Host "Demo check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
