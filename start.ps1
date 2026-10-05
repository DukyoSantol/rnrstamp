$p = Start-Process -FilePath "$PSScriptRoot\rnr_v2.exe" -PassThru -WindowStyle Hidden
Write-Host "RNR running on http://localhost:3001 (PID: $($p.Id))"