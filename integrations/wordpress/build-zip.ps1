# Rebuild the installable WordPress plugin ZIP after editing files under
# integrations/wordpress/olyxee-tracking/.
#
# Produces artifacts/olyxee-admin/public/olyxee-tracking.zip with a single
# top-level "olyxee-tracking/" folder and FORWARD-SLASH entry names (WordPress
# rejects the back-slash paths that PowerShell's Compress-Archive emits on
# Windows PowerShell 5.1 — so we build the archive entry-by-entry instead).
#
# Usage:  powershell -File integrations/wordpress/build-zip.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot                          # integrations/wordpress (no trailing slash)
$src  = Join-Path $root "olyxee-tracking"
$dest = Join-Path $root "..\..\artifacts\olyxee-admin\public\olyxee-tracking.zip"
$dest = [System.IO.Path]::GetFullPath($dest)

if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }

$fs  = [System.IO.File]::Open($dest, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
$bs  = [char]92   # backslash
$fw  = [char]47   # forward slash
foreach ($f in (Get-ChildItem -LiteralPath $src -Recurse -File)) {
	$rel   = $f.FullName.Substring($root.Length + 1).Replace($bs, $fw)
	$entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
	$es    = $entry.Open()
	$bytes = [System.IO.File]::ReadAllBytes($f.FullName)
	$es.Write($bytes, 0, $bytes.Length)
	$es.Close()
}
$zip.Dispose()
$fs.Close()
Write-Output ("Wrote " + $dest + " (" + (Get-Item $dest).Length + " bytes)")
