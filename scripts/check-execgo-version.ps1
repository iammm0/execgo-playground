param(
  [string]$Repo = "iammm0/execgo",
  [string]$VersionLockPath = "./shared/execgo.version.lock.json",
  [int]$TimeoutSec = 10,
  [switch]$UpdateLock,
  [switch]$FailOnCheckError
)

$ErrorActionPreference = "Stop"

function Invoke-GitHubJson([string]$Uri, [int]$TimeoutSec) {
  $headers = @{
    "User-Agent" = "execgo-playground-version-check"
    "Accept"     = "application/vnd.github+json"
  }
  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers -TimeoutSec $TimeoutSec
}

function Get-LatestExecGoRef([string]$Repo, [int]$TimeoutSec) {
  $releaseUri = "https://api.github.com/repos/$Repo/releases/latest"
  try {
    $release = Invoke-GitHubJson -Uri $releaseUri -TimeoutSec $TimeoutSec
    if ($release -and $release.tag_name) {
      return [pscustomobject]@{
        channel      = "release"
        version      = [string]$release.tag_name
        source       = "releases/latest"
        upstream_url = [string]$release.html_url
        published_at = [string]$release.published_at
      }
    }
  } catch {
    $msg = $_.Exception.Message
    if ($msg -notmatch "404") {
      throw
    }
  }

  $tagsUri = "https://api.github.com/repos/$Repo/tags?per_page=1"
  $tags = Invoke-GitHubJson -Uri $tagsUri -TimeoutSec $TimeoutSec
  $firstTag = $null
  if ($tags -is [System.Array]) {
    $firstTag = $tags | Select-Object -First 1
  } elseif ($tags) {
    $firstTag = $tags
  }

  if ($firstTag -and $firstTag.name) {
    $tag = [string]$firstTag.name
    return [pscustomobject]@{
      channel      = "tag"
      version      = $tag
      source       = "tags"
      upstream_url = "https://github.com/$Repo/releases/tag/$tag"
      published_at = ""
    }
  }

  $commitUri = "https://api.github.com/repos/$Repo/commits/main"
  $commit = Invoke-GitHubJson -Uri $commitUri -TimeoutSec $TimeoutSec
  if (-not $commit -or -not $commit.sha) {
    throw "could not resolve latest ref from releases/tags/commits for $Repo"
  }

  return [pscustomobject]@{
    channel      = "commit"
    version      = [string]$commit.sha
    source       = "commits/main"
    upstream_url = [string]$commit.html_url
    published_at = [string]$commit.commit.committer.date
  }
}

function Load-Lock([string]$Path) {
  if (-not (Test-Path $Path)) {
    return $null
  }

  $raw = Get-Content -Path $Path -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  return $raw | ConvertFrom-Json
}

function Save-Lock([string]$Path, [string]$Repo, $Ref) {
  $lock = [pscustomobject]@{
    repo                = $Repo
    channel             = [string]$Ref.channel
    version             = [string]$Ref.version
    source              = [string]$Ref.source
    observed_at_utc     = (Get-Date).ToUniversalTime().ToString("o")
    upstream_published  = [string]$Ref.published_at
    upstream_release_url = [string]$Ref.upstream_url
  }

  $dir = Split-Path -Parent $Path
  if ($dir) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $lock | ConvertTo-Json -Depth 5 | Set-Content -Path $Path -Encoding UTF8
}

try {
  $latestRef = Get-LatestExecGoRef -Repo $Repo -TimeoutSec $TimeoutSec
  $lock = Load-Lock -Path $VersionLockPath

  Write-Host "[execgo-check] repo: $Repo"
  Write-Host "[execgo-check] latest upstream ref: $($latestRef.channel) $($latestRef.version)"
  if ($latestRef.upstream_url) {
    Write-Host "[execgo-check] details: $($latestRef.upstream_url)"
  }

  if ($lock) {
    Write-Host "[execgo-check] baseline lock   : $($lock.channel) $($lock.version)"
  } else {
    Write-Warning "[execgo-check] lock file not found at $VersionLockPath"
  }

  $isSame = $false
  if ($lock) {
    $isSame = (($lock.channel -eq $latestRef.channel) -and ($lock.version -eq $latestRef.version))
  }

  if ($isSame) {
    Write-Host "[execgo-check] no newer upstream version detected."
  } else {
    Write-Warning "[execgo-check] new upstream update detected."
    Write-Warning "[execgo-check] please evaluate and try integrating latest execgo capabilities."
    Write-Host "[execgo-check] after adoption, run: pwsh ./scripts/check-execgo-version.ps1 -UpdateLock"
  }

  if ($UpdateLock) {
    Save-Lock -Path $VersionLockPath -Repo $Repo -Ref $latestRef
    Write-Host "[execgo-check] lock updated: $VersionLockPath"
  }
} catch {
  if ($FailOnCheckError) {
    throw
  }
  Write-Warning "[execgo-check] skipped due to check error: $($_.Exception.Message)"
}
