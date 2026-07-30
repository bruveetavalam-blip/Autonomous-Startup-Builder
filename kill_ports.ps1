param(
    [int[]]$Ports = @(8000, 8001)
)

$ErrorActionPreference = "Continue"

foreach ($port in $Ports) {
    Write-Host "Checking port $port..."

    $listeners = netstat -ano -p tcp |
        Select-String -Pattern ":$port\s" |
        Where-Object { $_.ToString() -match "LISTENING" }

    if (-not $listeners) {
        Write-Host "Port $port is already free."
        continue
    }

    foreach ($listener in $listeners) {
        $parts = $listener.ToString().Trim() -split "\s+"
        if ($parts.Count -lt 5) {
            continue
        }

        $processId = [int]$parts[4]
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        $name = if ($process) { $process.ProcessName } else { "unknown" }

        Write-Host "Stopping PID $processId ($name) on port $port..."
        taskkill /PID $processId /F | Out-Host
    }
}

Start-Sleep -Seconds 1

foreach ($port in $Ports) {
    $stillListening = netstat -ano -p tcp |
        Select-String -Pattern ":$port\s" |
        Where-Object { $_.ToString() -match "LISTENING" }

    if ($stillListening) {
        Write-Warning "Port $port is still busy. Run PowerShell as Administrator and execute this script again."
        $stillListening | ForEach-Object { Write-Host $_.ToString() }
    } else {
        Write-Host "Port $port is free."
    }
}
