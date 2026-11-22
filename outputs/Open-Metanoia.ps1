$exe = Join-Path $PSScriptRoot 'Metanoia V2.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Metanoia V2.exe is missing from this folder.' }
Start-Process -FilePath $exe
