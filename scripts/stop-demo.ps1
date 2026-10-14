. (Join-Path $PSScriptRoot 'demo-common.ps1')

$demoLock = $null
try {
    $demoLock = Enter-DemoLock
    $records = @(Read-DemoState)
    foreach ($record in $records) {
        Update-DemoChildren $record
        $processes = @(Get-DemoOwnedProcesses $record)
        if ($processes.Count) {
            # Stop verified interpreter children before their launcher parent.
            [array]::Reverse($processes)
            foreach ($process in $processes) {
                if (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue) { Stop-Process -Id $process.ProcessId -ErrorAction Stop }
            }
            Write-Host "$($record.name) stopped."
        } else {
            Write-Host "$($record.name) is no longer running with the recorded identity. No process was stopped for this entry."
        }
    }
    Save-DemoState @()
    Write-Host 'Demo services stopped. MongoDB, saved data, recordings, and other applications were preserved.'
} catch {
    Write-Host "Demo stop failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($demoLock) { Exit-DemoLock $demoLock }
}
