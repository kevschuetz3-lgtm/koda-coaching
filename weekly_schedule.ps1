# Weekly Koda Schedule Generator
# Runs every Wednesday at 7am via Task Scheduler
# Invokes Claude Code to generate next week's schedule and email it

$ErrorActionPreference = "Stop"

# Log file for debugging
$logFile = "C:\Users\kevsc\Desktop\Claude\koda-coaching\schedule_cron.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Add-Content -Path $logFile -Value "[$timestamp] Starting weekly schedule generation..."

# Calculate next Monday's date (the upcoming week)
$today = Get-Date
$daysUntilMonday = (8 - [int]$today.DayOfWeek) % 7
if ($daysUntilMonday -eq 0) { $daysUntilMonday = 7 }
$nextMonday = $today.AddDays($daysUntilMonday).ToString("yyyy-MM-dd")

Add-Content -Path $logFile -Value "[$timestamp] Generating schedule for week of $nextMonday"

# Set PATH to include npm global bin
$env:PATH = "C:\Users\kevsc\AppData\Roaming\npm;$env:PATH"

# Run Claude Code in non-interactive mode with the generate-schedule prompt
$prompt = @"
Run /generate-schedule for the week of $nextMonday. After generating the schedule and all exports (HTML, PDF, Excel), send an email with the finalized schedule to kodaironview@gmail.com and riley.mcnamara@comcast.net. Attach the PDF and Excel files to the email.
"@

try {
    $result = claude --print "$prompt" 2>&1
    Add-Content -Path $logFile -Value "[$timestamp] Claude output: $result"
    Add-Content -Path $logFile -Value "[$timestamp] Schedule generation completed successfully."
} catch {
    Add-Content -Path $logFile -Value "[$timestamp] ERROR: $_"
}
