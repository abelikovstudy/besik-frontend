$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previousApiUrl = $env:VITE_API_URL
$previousDemoMode = $env:VITE_DEMO_MODE

Push-Location -LiteralPath $projectRoot
try {
    $env:VITE_API_URL = '/api'
    $env:VITE_DEMO_MODE = 'false'
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed. No release was packaged.' }

    $artifactDir = Join-Path $projectRoot 'artifacts'
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression
    $zipPath = Join-Path $artifactDir 'besik-frontend.zip'
    $stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
    $archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $distRoot = (Resolve-Path -LiteralPath 'dist').Path
        Get-ChildItem -LiteralPath (Join-Path $distRoot 'client'), (Join-Path $distRoot 'server') -File -Recurse | ForEach-Object {
            $entryName = 'dist/' + $_.FullName.Substring($distRoot.Length + 1).Replace('\', '/')
            $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $inputStream = [System.IO.File]::OpenRead($_.FullName)
            $outputStream = $entry.Open()
            try { $inputStream.CopyTo($outputStream) }
            finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
        $releaseFiles = @{
            'package.json' = 'package.json'
            'package-lock.json' = 'package-lock.json'
            'server/index.mjs' = 'server/index.mjs'
            'Dockerfile' = 'deploy/vps/Dockerfile.frontend'
        }
        foreach ($entryName in $releaseFiles.Keys) {
            $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $inputStream = [System.IO.File]::OpenRead((Join-Path $projectRoot $releaseFiles[$entryName]))
            $outputStream = $entry.Open()
            try { $inputStream.CopyTo($outputStream) }
            finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    }
    finally { $archive.Dispose(); $stream.Dispose() }

    Copy-Item -LiteralPath 'deploy/vps/Caddyfile' -Destination (Join-Path $artifactDir 'Caddyfile.frontend')
    Copy-Item -LiteralPath 'deploy/vps/compose.vps.yml' -Destination (Join-Path $artifactDir 'compose.vps.frontend.yml')
    Write-Output "VPS files: $artifactDir"
}
finally {
    $env:VITE_API_URL = $previousApiUrl
    $env:VITE_DEMO_MODE = $previousDemoMode
    Pop-Location
}
