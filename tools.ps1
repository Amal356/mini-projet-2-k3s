Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$Projet = Join-Path $HOME 'mini-projet-2'
$global:NomCapture = $null

function Save-Img([string]$Nom) {
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  if (-not $img) { throw "Aucune image dans le presse-papiers : faites Win+Shift+S puis tapez Cap." }
  $dir = Join-Path $Projet 'docs\img'
  New-Item -ItemType Directory -Force $dir | Out-Null
  $img.Save((Join-Path $dir "$Nom.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Capture enregistree : docs\img\$Nom.png" -ForegroundColor Green
}

function Add-Etape {
  param(
    [Parameter(Mandatory, Position=0)][string]$Titre,
    [Parameter(Mandatory)][string]$Capture,
    [int]$Dernieres = 1,
    [string]$Commande,
    [string]$Explication
  )
  if (-not $Commande) { $Commande = ((Get-History -Count $Dernieres).CommandLine) -join "`n" }
  $f = '```'
  $l = @('', "### $Titre", '')
  if ($Explication) { $l += @($Explication, '') }
  $l += @("${f}powershell", $Commande, $f, '', "![$Titre](docs/img/$Capture.png)", '')
  Add-Content -Path (Join-Path $Projet 'README.md') -Value $l -Encoding UTF8
  $global:NomCapture = $Capture
  Write-Host "README.md mis a jour : $Titre" -ForegroundColor Green
}

function Add-Capture {
  param([Parameter(Mandatory, Position=0)][string]$Capture, [string]$Legende = 'Résultat')
  Add-Content -Path (Join-Path $Projet 'README.md') -Value @("![$Legende](docs/img/$Capture.png)", '') -Encoding UTF8
  $global:NomCapture = $Capture
}

function Cap {
  param([string]$Nom = $global:NomCapture)
  if (-not $Nom) { throw "Aucune etape en attente : lancez d'abord Add-Etape." }
  Save-Img $Nom
}
