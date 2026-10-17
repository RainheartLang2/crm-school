$base = 'http://localhost:3100'
$global:failed = 0
function Check($name, $cond) {
  if ($cond) { Write-Output "PASS: $name" }
  else { Write-Output "FAIL: $name"; $global:failed++ }
}

$dbfile = Join-Path $env:TEMP ("crm-test-" + [guid]::NewGuid().ToString() + ".db")
$env:DB_FILE = $dbfile
$env:PORT = '3100'
$proc = Start-Process node -ArgumentList 'app.js' -WorkingDirectory 'c:\Users\86\crm-school' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

try {
  # --- Admin session ---
  $sAdmin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $loginResp = Invoke-WebRequest -Uri "$base/login" -Method POST -Body @{ login = 'Admin'; password = 'Test' } -WebSession $sAdmin -UseBasicParsing
  Check 'Admin login works' ($loginResp.BaseResponse.ResponseUri.AbsolutePath -eq '/clients')

  $accPage = Invoke-WebRequest -Uri "$base/accounts" -WebSession $sAdmin -UseBasicParsing
  Check 'Admin can view /accounts' ($accPage.StatusCode -eq 200 -and $accPage.Content -match 'Управление аккаунтами')

  $newPage = Invoke-WebRequest -Uri "$base/accounts/new" -WebSession $sAdmin -UseBasicParsing
  Check 'Create form has teacher option' ($newPage.Content -match 'value="teacher"' -and $newPage.Content -match 'Преподаватель')

  # Create a teacher account as admin
  Invoke-WebRequest -Uri "$base/accounts" -Method POST -Body @{ login = 'Teacher1'; password = 'pw'; role = 'teacher' } -WebSession $sAdmin -UseBasicParsing | Out-Null
  $accPage2 = Invoke-WebRequest -Uri "$base/accounts" -WebSession $sAdmin -UseBasicParsing
  Check 'Teacher account created and listed with label' ($accPage2.Content -match 'Teacher1' -and $accPage2.Content -match 'Преподаватель')
  $teacherId = [regex]::Match($accPage2.Content, 'Teacher1[\s\S]*?/accounts/(\d+)/edit').Groups[1].Value
  Check 'Teacher account id resolved' ($teacherId -ne '')

  $editPage = Invoke-WebRequest -Uri "$base/accounts/$teacherId/edit" -WebSession $sAdmin -UseBasicParsing
  Check 'Edit form shows teacher role selected' ($editPage.Content -match '<option value="teacher" selected')

  # Admin edits the teacher account (change password), role stays teacher
  Invoke-WebRequest -Uri "$base/accounts/$teacherId" -Method POST -Body @{ login = 'Teacher1'; password = 'pw2'; role = 'teacher' } -WebSession $sAdmin -UseBasicParsing | Out-Null

  # Invalid role falls back to user
  Invoke-WebRequest -Uri "$base/accounts" -Method POST -Body @{ login = 'Rogue'; password = 'x'; role = 'superadmin' } -WebSession $sAdmin -UseBasicParsing | Out-Null
  $accPage3 = Invoke-WebRequest -Uri "$base/accounts" -WebSession $sAdmin -UseBasicParsing
  Check 'Invalid role falls back to user' ($accPage3.Content -match 'Rogue[\s\S]*?Пользователь')

  # --- Teacher session ---
  $sT = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $tLogin = Invoke-WebRequest -Uri "$base/login" -Method POST -Body @{ login = 'Teacher1'; password = 'pw2' } -WebSession $sT -UseBasicParsing
  Check 'Teacher login works (new password applied)' ($tLogin.BaseResponse.ResponseUri.AbsolutePath -eq '/clients')

  $tAcc = Invoke-WebRequest -Uri "$base/accounts" -WebSession $sT -UseBasicParsing
  Check 'Teacher cannot view /accounts (redirected)' ($tAcc.BaseResponse.ResponseUri.AbsolutePath -eq '/clients' -and $tAcc.Content -notmatch 'Управление аккаунтами')
  $tEdit = Invoke-WebRequest -Uri "$base/accounts/$teacherId/edit" -WebSession $sT -UseBasicParsing
  Check 'Teacher cannot open account edit form' ($tEdit.BaseResponse.ResponseUri.AbsolutePath -eq '/clients')
  $tNew = Invoke-WebRequest -Uri "$base/accounts/new" -WebSession $sT -UseBasicParsing
  Check 'Teacher cannot open create-account form' ($tNew.BaseResponse.ResponseUri.AbsolutePath -eq '/clients')

  # Teacher mutation attempts - all must be blocked
  Invoke-WebRequest -Uri "$base/accounts/$teacherId/delete" -Method POST -WebSession $sT -UseBasicParsing | Out-Null
  $accPage4 = Invoke-WebRequest -Uri "$base/accounts" -WebSession $sAdmin -UseBasicParsing
  Check 'Teacher cannot delete accounts' ($accPage4.Content -match 'Teacher1')

  Invoke-WebRequest -Uri "$base/accounts" -Method POST -Body @{ login = 'Hacker'; password = 'x'; role = 'admin' } -WebSession $sT -UseBasicParsing | Out-Null
  $accPage5 = Invoke-WebRequest -Uri "$base/accounts" -WebSession $sAdmin -UseBasicParsing
  Check 'Teacher cannot create accounts' ($accPage5.Content -notmatch 'Hacker')

  Invoke-WebRequest -Uri "$base/accounts/$teacherId" -Method POST -Body @{ login = 'Teacher1'; password = ''; role = 'admin' } -WebSession $sT -UseBasicParsing | Out-Null
  $accPage6 = Invoke-WebRequest -Uri "$base/accounts" -WebSession $sAdmin -UseBasicParsing
  Check 'Teacher cannot change roles (still teacher)' ($accPage6.Content -match 'Teacher1[\s\S]*?Преподаватель')

  # Teacher can still use the rest of the app; accounts nav hidden
  $tClients = Invoke-WebRequest -Uri "$base/clients" -WebSession $sT -UseBasicParsing
  Check 'Teacher can view /clients' ($tClients.StatusCode -eq 200 -and $tClients.Content -match 'Клиенты')
  Check 'Accounts nav link hidden for teacher' ($tClients.Content -notmatch '/accounts" class="nav-item')
  $tCourses = Invoke-WebRequest -Uri "$base/courses" -WebSession $sT -UseBasicParsing
  Check 'Teacher can view /courses' ($tCourses.StatusCode -eq 200)

  $aClients = Invoke-WebRequest -Uri "$base/clients" -WebSession $sAdmin -UseBasicParsing
  Check 'Accounts nav link visible for admin' ($aClients.Content -match '/accounts" class="nav-item')

  # Not logged in
  $anon = Invoke-WebRequest -Uri "$base/accounts" -UseBasicParsing
  Check 'Anonymous redirected to /login' ($anon.BaseResponse.ResponseUri.AbsolutePath -eq '/login')
}
finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Remove-Item ($dbfile) -Force -ErrorAction SilentlyContinue
  Remove-Item ($dbfile + '-wal') -Force -ErrorAction SilentlyContinue
  Remove-Item ($dbfile + '-shm') -Force -ErrorAction SilentlyContinue
}

if ($global:failed -gt 0) { Write-Output "RESULT: $global:failed FAILED"; exit 1 }
Write-Output 'RESULT: ALL PASSED'

