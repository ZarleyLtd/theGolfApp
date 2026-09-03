$ApiBase = "https://yzyipxvlsoxfphwobfkb.functions.supabase.co/golfapp-api"
$outPath = "scripts/elmgreen-top6-plaintext-split-test.json"
$DelaySec = 8

$settings = Invoke-RestMethod -Uri ($ApiBase + "?action=getAppSettings&key=ai_models")
$priority = @($settings.value.priority)
if (-not $priority -or $priority.Count -eq 0) { $priority = @($settings.defaultPriority) }
$top6 = @($priority | Select-Object -First 6)

Write-Host "Testing $($top6.Count) models for Elmgreen Golf Club (split PARS/INDEXES plain text)`n"

$results = @()
$i = 0
foreach ($modelId in $top6) {
  $i++
  Write-Host "[$i/$($top6.Count)] $modelId ..."
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
      model = $modelId
      ok = [bool]$j.ok
      parseOk = [bool]$j.parseOk
      dataValid = [bool]$j.dataValid
      hasGrounding = [bool]$j.hasGrounding
      ms = $j.ms
      error = $j.error
      validation = $j.validation
      data = $j.data
      rawPreview = $j.rawPreview
      webSearchQueries = $j.webSearchQueries
    }
    if ($j.ok) {
      Write-Host "  OK ($($j.ms)ms) pars=$($j.data.pars -join ',') indexes=$($j.data.indexes -join ',')"
    } else {
      Write-Host "  FAIL ($($j.ms)ms): $($j.error)"
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
    $entry = [ordered]@{
      model = $modelId
      ok = $false
      parseOk = $false
      dataValid = $false
      hasGrounding = $false
      ms = $sw.ElapsedMilliseconds
      error = $msg
      validation = $null
      data = $null
      rawPreview = ""
      webSearchQueries = @()
    }
    Write-Host "  FAIL ($($sw.ElapsedMilliseconds)ms): $msg"
  }
  $results += $entry
  if ($i -lt $top6.Count) { Start-Sleep -Seconds $DelaySec }
}

$summary = [ordered]@{
  courseName = "Elmgreen Golf Club"
  format = "labeled_plain_text_split_lists"
  testedAt = (Get-Date).ToString("o")
  modelsFromSettings = $top6
  results = $results
}
($summary | ConvertTo-Json -Depth 8) | Out-File -FilePath $outPath -Encoding utf8

Write-Host "`n=== SUMMARY ==="
$ok = @($results | Where-Object { $_.ok })
$fail = @($results | Where-Object { -not $_.ok })
Write-Host "OK ($($ok.Count)): $($ok.model -join ', ')"
Write-Host "FAIL ($($fail.Count)):"
foreach ($f in $fail) { Write-Host "  $($f.model): $($f.error)" }
Write-Host "`nWrote $outPath"
