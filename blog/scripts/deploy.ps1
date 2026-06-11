# Deploy liu-stuff-blog to Cloudflare Workers + D1
# Run from repo root: powershell -File blog/scripts/deploy.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Step 1: Cloudflare login (complete OAuth in browser)"
npx wrangler login --browser=false
npx wrangler whoami

Write-Host "Step 2: Create D1 database (skip if database_id already in wrangler.jsonc)"
$dbJson = npx wrangler d1 create liu-stuff-blog-db 2>&1 | Out-String
Write-Host $dbJson
Write-Host "Paste the database_id into wrangler.jsonc, then press Enter"
Read-Host

Write-Host "Step 3: Apply schema to remote D1"
npx wrangler d1 execute liu-stuff-blog-db --remote --file=schema.sql -y

Write-Host "Step 4: Deploy Worker"
npx wrangler deploy

Write-Host "Step 5: Upload SECRET_KEY"
$secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$secret | npx wrangler secret put SECRET_KEY

Write-Host "Done. Open the workers.dev URL printed above."
