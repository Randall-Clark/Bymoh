$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsenNobWhha2J4Ymtkamh4cHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTE1MzMsImV4cCI6MjA5ODA2NzUzM30.y3GQMSnjIG9KMKT3kTPqclM0Ppd_7DT9jiNL9lWTSDM"
    "Content-Type" = "application/json"
}
$body = '{"phone": "+2290197557353"}'
Invoke-RestMethod -Method POST -Uri "https://zlzshmhakbxbkdjhxpyc.supabase.co/functions/v1/send-otp" -Headers $headers -Body $body