$ErrorActionPreference = 'Stop'

$patterns = @(
    '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----\\n[A-Za-z0-9+/]{40,}',
    'SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["''][^"'']+["'']',
    'FIREBASE_PRIVATE_KEY\s*[:=]\s*["'']-----BEGIN'
)

$trackedFiles = git ls-files
$violations = @()

foreach ($file in $trackedFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
    $content = Get-Content -Raw -LiteralPath $file -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }

    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            $violations += "${file}: matched prohibited secret pattern"
            break
        }
    }
}

if ($violations.Count -gt 0) {
    $violations | Write-Error
    exit 1
}

Write-Output 'Secret scan passed.'
