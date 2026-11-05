$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = Split-Path $PSScriptRoot -Parent
$master = [System.Drawing.Image]::FromFile((Join-Path $project 'art\icon\pipepanic-icon-master.png'))
try {
    $sizes = @{ mdpi=48; hdpi=72; xhdpi=96; xxhdpi=144; xxxhdpi=192 }
    foreach ($density in $sizes.Keys) {
        $folder = Join-Path $project "app\src\main\res\mipmap-$density"
        [System.IO.Directory]::CreateDirectory($folder) | Out-Null
        $size = $sizes[$density]
        $bitmap = [System.Drawing.Bitmap]::new($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($master, 0, 0, $size, $size)
            $bitmap.Save((Join-Path $folder 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
    # Export a high resolution foreground for Android adaptive masks. The full-bleed
    # source already has an intentionally generous safe area; inset 9dp avoids cropping.
    $folder = Join-Path $project 'app\src\main\res\drawable-nodpi'
    [System.IO.Directory]::CreateDirectory($folder) | Out-Null
    $bitmap = [System.Drawing.Bitmap]::new(432,432)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($master,0,0,432,432)
        $bitmap.Save((Join-Path $folder 'launcher_art.png'),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
} finally { $master.Dispose() }
