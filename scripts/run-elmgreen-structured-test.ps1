$ApiBase = "https://yzyipxvlsoxfphwobfkb.functions.supabase.co/golfapp-api"
$payload = @{
  action = "testCourseLookupFormats"
  societyId = "global"
  data = @{
    model = "gemini-2.5-flash-lite"
    courseName = "Elmgreen Golf Club"
  }
} | ConvertTo-Json -Depth 6 -Compress
$body = "data=$([uri]::EscapeDataString($payload))"
try {
  $r = Invoke-WebRequest -Uri $ApiBase -Method Post -ContentType "application/x-www-form-urlencoded" -Body $body -UseBasicParsing -TimeoutSec 180
  $r.Content | Out-File -FilePath "scripts/elmgreen-flash-lite-structured-test.json" -Encoding utf8
  Write-Host $r.Content
} catch {
  $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
  $err = $reader.ReadToEnd()
  Write-Host $err
  $err | Out-File -FilePath "scripts/elmgreen-flash-lite-structured-test.json" -Encoding utf8
}
