$ApiBase = "https://yzyipxvlsoxfphwobfkb.functions.supabase.co/golfapp-api"
$outPath = "scripts/elmgreen-all-order-plaintext-split-test.json"
$DelaySec = 6

$settings = Invoke-RestMethod -Uri ($ApiBase + "?action=getAppSettings&key=ai_models")
$priority = @($settings.value.priority)
if (-not $priority -or $priority.Count -eq 0) { $priority = @($settings.defaultPriority) }

Write-Host "Testing $($priority.Count) models from AI Model Order for Elmgreen Golf Club`n"

$results = @()
$i = 0
foreach ($modelId in $priority) {
  $i++
  Write-Host "[$i/$($priority.Count)] $modelId ..."
  $payload = @{
    action = "testCourseLookupPlainText"
    societyId = "global"
    data = @{
      model = $modelId
      courseName = "Elmgreen Golf Club"
    }
  } | ConvertTo-Json -Depth 6 -Compress
  $body = "data=$([uri]::EscapeDataString($payload))"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $ApiBase -Method Post -ContentType "application/x-www-form-urlencoded" -Body $body -UseBasicParsing -TimeoutSec 180
    $sw.Stop()
    $j = $r.Content | ConvertFrom-Json
    $entry = [ordered]@{
      rank = $i
      model = $modelId
      ok = [bool]$j.ok
      parseOk = [bool]$j.parseOk
      dataValid = [bool]$j.dataValid
      hasGrounding = [bool]$j.hasGrounding
      ms = $j.ms
      error = $j.error
      validation = $j.validation
      pars = if ($j.data) { $j.data.pars } else { $null }
      indexes = if ($j.data) { $j.data.indexes } else { $null }
      website = if ($j.data) { $j.data.website } else { $null }
      clubName = if ($j.data) { $j.data.clubName } else { $null }
      rawPreview = $j.rawPreview
      webSearchQueries = $j.webSearchQueries
    }
    if ($j.ok) {
      Write-Host "  OK ($($j.ms)ms) grounding=$($j.hasGrounding)"
    } else {
      $shortErr = if ($j.error) { $j.error } else { "unknown" }
      if ($shortErr.Length -gt 140) { $shortErr = $shortErr.Substring(0, 137) + "..." }
      Write-Host "  FAIL ($($j.ms)ms): $shortErr"
    }
  } catch {
    $sw.Stop()
    $errBody = ""
    if ($_.Exception.Response) {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      $errBody = $reader.ReadToEnd()
    }
    $msg = if ($errBody) { $errBody } else { $_.Exception.Message }
    try {
      $ej = $msg | ConvertFrom-Json
      if ($ej.error) { $msg = $ej.error }
    } catch {}
    $shortErr = $msg
    if ($shortErr.Length -gt 140) { $shortErr = $shortErr.Substring(0, 137) + "..." }
    $entry = [ordered]@{
      rank = $i
      model = $modelId
      ok = $false
      parseOk = $false
      dataValid = $false
      hasGrounding = $false
      ms = $sw.ElapsedMilliseconds
      error = $msg
      validation = $null
      pars = $null
      indexes = $null
      website = $null
      clubName = $null
      rawPreview = ""
      webSearchQueries = @()
    }
    Write-Host "  FAIL ($($sw.ElapsedMilliseconds)ms): $shortErr"
  }
  $results += $entry
  if ($i -lt $priority.Count) { Start-Sleep -Seconds $DelaySec }
}

$summary = [ordered]@{
  courseName = "Elmgreen Golf Club"
  format = "labeled_plain_text_split_lists"
  testedAt = (Get-Date).ToString("o")
  modelsFromSettings = $priority
  results = $results
}
($summary | ConvertTo-Json -Depth 8) | Out-File -FilePath $outPath -Encoding utf8

Write-Host "`n=== OK ==="
@($results | Where-Object { $_.ok }) | ForEach-Object {
  Write-Host ("#{0} {1} ({2}ms) website={3}" -f $_.rank, $_.model, $_.ms, $_.website)
}
Write-Host "`n=== FAIL ==="
@($results | Where-Object { -not $_.ok }) | ForEach-Object {
  $e = $_.error
  if ($e -and $e.Length -gt 100) { $e = $e.Substring(0, 97) + "..." }
  Write-Host ("#{0} {1}: {2}" -f $_.rank, $_.model, $e)
}
Write-Host "`nWrote $outPath"
