Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:DemoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script:DemoRuntime = Join-Path $script:DemoRoot 'test-results/demo'
$script:DemoStatePath = Join-Path $script:DemoRuntime 'processes.json'

function Enter-DemoLock {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($script:DemoRoot.ToLowerInvariant()))).Replace('-', '') }
    finally { $hash.Dispose() }
    $mutex = New-Object Threading.Mutex($false, "Local\CareerAiDemo-$key")
    try { $acquired = $mutex.WaitOne(30000) }
    catch [Threading.AbandonedMutexException] { $acquired = $true }
    if (-not $acquired) { $mutex.Dispose(); throw 'Another demo start or stop is still running. Wait for it to finish, then retry.' }
    return $mutex
}

function Exit-DemoLock {
    param([Threading.Mutex]$Mutex)
    $Mutex.ReleaseMutex()
    $Mutex.Dispose()
}

function Get-DemoEnv {
    param([string]$Path)
    $values = @{}
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in Get-Content -LiteralPath $Path) {
            if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
                $key = $Matches[1]
                $value = $Matches[2].Trim()
                if ($value -match '^"(.*)"\s*(?:#.*)?$') {
                    $value = $Matches[1]
                } elseif ($value -match "^'(.*)'\s*(?:#.*)?$") {
                    $value = $Matches[1]
                } else {
                    $value = ($value -replace '#.*$', '').Trim()
                }
                $values[$key] = $value
            }
        }
    }
    return $values
}

function Get-DemoConfig {
    $backend = Get-DemoEnv (Join-Path $script:DemoRoot 'backend/.env')
    $frontend = Get-DemoEnv (Join-Path $script:DemoRoot 'frontend/.env.local')
    foreach ($name in @('PORT', 'MONGO_URI', 'JWT_SECRET', 'AI_PROVIDER', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GROQ_API_KEYS', 'INTEGRITY_SERVICE_URL', 'UPLOADS_DIR', 'JUDGE0_URL')) {
        $inherited = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($inherited) { $backend[$name] = $inherited }
    }
    $backendPort = 5000
    if ($backend['PORT']) {
        if (-not [int]::TryParse($backend['PORT'], [ref]$backendPort) -or $backendPort -lt 1 -or $backendPort -gt 65535) {
            throw 'PORT in the backend configuration must be a valid port number.'
        }
    }
    $uploads = Join-Path $script:DemoRoot 'backend/uploads'
    if ($backend['UPLOADS_DIR']) {
        if ([IO.Path]::IsPathRooted($backend['UPLOADS_DIR'])) { $uploads = $backend['UPLOADS_DIR'] }
        else { $uploads = Join-Path (Join-Path $script:DemoRoot 'backend') $backend['UPLOADS_DIR'] }
    }
    $videoPort = 8001
    if ($backend['INTEGRITY_SERVICE_URL']) {
        $videoUrl = $null
        if (-not [Uri]::TryCreate($backend['INTEGRITY_SERVICE_URL'], [UriKind]::Absolute, [ref]$videoUrl)) {
            throw 'INTEGRITY_SERVICE_URL must be an absolute HTTP URL.'
        }
        if ($videoUrl.Scheme -ne 'http' -or $videoUrl.Host -notin @('localhost', '127.0.0.1')) {
            throw 'This local demo launcher expects INTEGRITY_SERVICE_URL on localhost or 127.0.0.1 over HTTP.'
        }
        $videoPort = $videoUrl.Port
    }
    return @{
        Backend = $backend; Frontend = $frontend; BackendPort = $backendPort
        BackendUrl = "http://127.0.0.1:$backendPort"; FrontendUrl = 'http://localhost:3000'
        VideoPort = $videoPort; VideoUrl = "http://127.0.0.1:$videoPort"
        RecordingsDir = Join-Path ([IO.Path]::GetFullPath($uploads)) 'recordings'
    }
}

function Read-DemoState {
    if (-not (Test-Path -LiteralPath $script:DemoStatePath)) { return @() }
    try {
        $state = Get-Content -LiteralPath $script:DemoStatePath -Raw | ConvertFrom-Json
        if ($state.root -ne $script:DemoRoot) { throw 'The process file belongs to another folder.' }
        return @($state.processes)
    } catch {
        throw 'Cannot read test-results/demo/processes.json. No existing processes have been stopped. Check that file before continuing.'
    }
}

function Save-DemoState {
    param([object[]]$Processes)
    New-Item -ItemType Directory -Path $script:DemoRuntime -Force | Out-Null
    $state = @{ root = $script:DemoRoot; processes = @($Processes) } | ConvertTo-Json -Depth 5
    $temporary = Join-Path $script:DemoRuntime ('processes-' + [Guid]::NewGuid().ToString('N') + '.json')
    Set-Content -LiteralPath $temporary -Value $state -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $script:DemoStatePath -Force
}

function Get-DemoProcess {
    param([object]$Record)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($Record.pid)" -ErrorAction SilentlyContinue
    if (-not $process) { return $null }
    if ($process.CreationDate.ToUniversalTime().Ticks.ToString() -ne $Record.createdUtcTicks) { return $null }
    if (-not $process.ExecutablePath -or [IO.Path]::GetFullPath($process.ExecutablePath) -ne $Record.executable) { return $null }
    $marker = switch ($Record.name) {
        'backend' { Join-Path $script:DemoRoot 'backend/src/server.js' }
        'frontend' { Join-Path $script:DemoRoot 'frontend/node_modules/next/dist/bin/next' }
        'video-review' { Join-Path $script:DemoRoot 'integrity-service/.venv/Scripts/python.exe' }
        default { return $null }
    }
    if (-not $process.CommandLine -or $process.CommandLine.IndexOf($marker, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return $null }
    return $process
}

function Get-DemoOwnedProcesses {
    param([object]$Record)
    $rootProcess = Get-DemoProcess $Record
    if ($rootProcess) { $rootProcess }
    if ($Record.PSObject.Properties['children']) {
        foreach ($child in @($Record.children)) {
            $childProcess = Get-DemoProcess $child
            if ($childProcess) { $childProcess }
        }
    }
}

function Update-DemoChildren {
    param([object]$Record)
    $children = @()
    if ($Record.PSObject.Properties['children']) { $children = @($Record.children | Where-Object { Get-DemoProcess $_ }) }
    $rootProcess = Get-DemoProcess $Record
    if ($rootProcess) {
        # Windows virtualenv python.exe delegates to an interpreter child. Record
        # that child's identity while its verified parent is still running.
        foreach ($process in @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($Record.pid)")) {
            if (-not $process.ExecutablePath -or $process.CreationDate -lt $rootProcess.CreationDate) { continue }
            $child = [pscustomobject]@{ name = $Record.name; pid = $process.ProcessId; executable = [IO.Path]::GetFullPath($process.ExecutablePath); createdUtcTicks = $process.CreationDate.ToUniversalTime().Ticks.ToString() }
            if ((Get-DemoProcess $child) -and -not @($children | Where-Object pid -eq $child.pid).Count) { $children += $child }
        }
    }
    $Record | Add-Member -NotePropertyName children -NotePropertyValue @($children) -Force
}

function Get-DemoPortOwner {
    param([int]$Port)
    return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Test-DemoHttp {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return ($response.StatusCode -eq 200)
    } catch { return $false }
}

function Wait-DemoReady {
    param([string]$Name, [string]$Url, [object]$Record, [int]$Seconds = 45)
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (-not @(Get-DemoOwnedProcesses $Record).Count) { throw "$Name stopped during startup. Read its stderr log in test-results/demo." }
        if (Test-DemoHttp $Url) { return }
        Start-Sleep -Milliseconds 700
    }
    throw "$Name did not become ready within $Seconds seconds. Read its logs in test-results/demo."
}

function Test-DemoPrerequisites {
    param([hashtable]$Config)
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js is missing. Install Node.js 22 or newer, then open a new terminal.' }
    $version = (& $node.Source --version).Trim()
    if ([int]($version.TrimStart('v').Split('.')[0]) -lt 22) { throw 'This project requires Node.js 22 or newer.' }
    foreach ($dependency in @('backend/node_modules/mongoose/package.json', 'frontend/node_modules/next/dist/bin/next')) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:DemoRoot $dependency))) {
            throw 'Dependencies are missing. Run npm ci separately in backend and frontend, then retry.'
        }
    }
    if (-not $Config.Backend['MONGO_URI'] -or -not $Config.Backend['JWT_SECRET']) {
        throw 'Configure MONGO_URI and JWT_SECRET in backend/.env before starting.'
    }
    $provider = $Config.Backend['AI_PROVIDER']
    if (-not $provider) { $provider = if ($Config.Backend['GEMINI_API_KEY']) { 'gemini' } else { 'groq' } }
    if ($provider -eq 'gemini' -and -not $Config.Backend['GEMINI_API_KEY']) { throw 'Gemini is selected but GEMINI_API_KEY is missing in backend/.env.' }
    if ($provider -eq 'groq' -and -not $Config.Backend['GROQ_API_KEY'] -and -not $Config.Backend['GROQ_API_KEYS']) { throw 'Groq is selected but its API key is missing in backend/.env.' }
    if ($provider -notin @('gemini', 'groq')) { throw 'AI_PROVIDER must be gemini or groq.' }
    if ($Config.Frontend['NEXT_PUBLIC_API_URL']) {
        $apiUrl = $null
        if (-not [Uri]::TryCreate($Config.Frontend['NEXT_PUBLIC_API_URL'], [UriKind]::Absolute, [ref]$apiUrl) -or $apiUrl.Host -notin @('localhost', '127.0.0.1') -or $apiUrl.Port -ne $Config.BackendPort) {
            throw 'Set frontend/.env.local NEXT_PUBLIC_API_URL to the local backend URL, then rebuild the frontend.'
        }
    } elseif ($Config.BackendPort -ne 5000) {
        throw 'A custom backend port requires NEXT_PUBLIC_API_URL in frontend/.env.local and a fresh frontend build.'
    }
    Write-Host "Node $version; $provider configuration present. Checking MongoDB..."
    $probe = @'
const path = require('node:path');
const root = process.argv[1];
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env') });
const mongoose = require(path.join(root, 'node_modules/mongoose'));
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.db.admin().ping();
    console.log('MongoDB connection verified.');
  } catch { console.error('MongoDB connection failed. Check MONGO_URI and that MongoDB is running.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
'@
    & $node.Source -e $probe (Join-Path $script:DemoRoot 'backend') 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'MongoDB preflight failed. No application servers were started.' }
    Write-Host 'MongoDB connection verified.'
    return $node.Source
}

function Start-DemoProcess {
    param([string]$Name, [string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory, [hashtable]$Environment = @{})
    New-Item -ItemType Directory -Path $script:DemoRuntime -Force | Out-Null
    $previous = @{}
    try {
        foreach ($environmentName in $Environment.Keys) {
            $previous[$environmentName] = [Environment]::GetEnvironmentVariable($environmentName, 'Process')
            [Environment]::SetEnvironmentVariable($environmentName, $Environment[$environmentName], 'Process')
        }
        $quoted = @($Arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' })
        $started = Start-Process -FilePath $Executable -ArgumentList $quoted -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $script:DemoRuntime "$Name.stdout.log") `
            -RedirectStandardError (Join-Path $script:DemoRuntime "$Name.stderr.log")
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($started.Id)"
        if (-not $process) { throw "$Name exited before it could be registered. Read its stderr log." }
        return [pscustomobject]@{ name = $Name; pid = $started.Id; executable = [IO.Path]::GetFullPath($process.ExecutablePath); createdUtcTicks = $process.CreationDate.ToUniversalTime().Ticks.ToString() }
    } finally {
        foreach ($environmentName in $Environment.Keys) { [Environment]::SetEnvironmentVariable($environmentName, $previous[$environmentName], 'Process') }
    }
}
