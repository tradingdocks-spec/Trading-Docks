param(
    [Parameter(Mandatory=$true)]
    [string]$RepositoryUrl
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing Trading Docks Git repository..." -ForegroundColor Cyan

if (Test-Path ".git") {
    Remove-Item ".git" -Recurse -Force
}

git init
git branch -M main
git add .
git commit -m "Trading Docks clean master backup"
git remote add origin $RepositoryUrl
git push -u origin main --force

Write-Host ""
Write-Host "Trading Docks has been backed up to GitHub." -ForegroundColor Green
Write-Host "The remote main branch now contains only this clean master project." -ForegroundColor Green
