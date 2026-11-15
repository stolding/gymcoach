param([string]$Out, [string]$List)
$Json = Get-Content -LiteralPath $List | Where-Object { $_.Trim() }
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$tmp = @()
$i = 0
foreach ($j in $Json) {
  $png = Join-Path $env:TEMP ("guide-slice-{0}.png" -f $i)
  node (Join-Path $PSScriptRoot 'guide-decode.mjs') $j $png | Out-Null
  $tmp += $png
  $i++
}
$imgs = foreach ($p in $tmp) { [System.Drawing.Image]::FromFile($p) }
$w = $imgs[0].Width
$h = 0
foreach ($im in $imgs) { $h += $im.Height }
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$y = 0
foreach ($im in $imgs) { $g.DrawImage($im, 0, $y); $y += $im.Height }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
foreach ($im in $imgs) { $im.Dispose() }
foreach ($p in $tmp) { Remove-Item $p -Force }
Write-Output "$Out ${w}x${h}"
