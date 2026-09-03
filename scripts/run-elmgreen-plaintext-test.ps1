$ApiBase = "https://yzyipxvlsoxfphwobfkb.functions.supabase.co/golfapp-api"
$out = "scripts/elmgreen-flash-lite-plaintext-split-test.json"
$payload = @{
  action = "testCourseLookupPlainText"
  societyId = "global"
  data = @{
    model = "gemini-2.5-flash-lite"
    courseName = "Elmgreen Golf Club"
  }
} | ConvertTo-Json -Depth 6 -Compress
$body = "data=$([uri]::EscapeDataString($payload))"
try {
  $r = Invoke-WebRequest -Uri $ApiBase -Method Post -ContentType "application/x-www-form-urlencoded" -Body $body -UseBasicParsing -TimeoutSec 180
  $r.Content | Out-File -FilePath $out -Encoding utf8
  Write-Host $r.Content
} catch {
  $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
  $err = $reader.ReadToEnd()
  Write-Host $err
  $err | Out-File -FilePath $out -Encoding utf8
}
