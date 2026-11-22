$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$secure = Read-Host 'Paste your Notion integration secret (input hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = $null
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if ([string]::IsNullOrWhiteSpace($token)) { throw 'No token entered.' }
    $plain = [Text.Encoding]::UTF8.GetBytes($token)
    $encrypted = [Security.Cryptography.ProtectedData]::Protect(
        $plain, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $directory = Join-Path $env:LOCALAPPDATA 'Metanoia'
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $path = Join-Path $directory 'notion-token.bin'
    [IO.File]::WriteAllBytes($path, $encrypted)
    Write-Output 'Notion credential saved for this Windows account.'
}
finally {
    if ($plain) { [Array]::Clear($plain, 0, $plain.Length) }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $token = $null
}
