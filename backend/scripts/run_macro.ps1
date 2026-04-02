param(
  [Parameter(Mandatory=$true)][string]$WorkbookPath,
  [Parameter(Mandatory=$true)][string]$MacroName,
  [Parameter(Mandatory=$true)][string]$OutputPath
)

$excel = $null
$workbook = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $workbook = $excel.Workbooks.Open($WorkbookPath)

  # Macro can be module macro or workbook-level macro.
  $excel.Run($MacroName)

  # 52 = xlOpenXMLWorkbookMacroEnabled (.xlsm)
  $workbook.SaveAs($OutputPath, 52)
  Write-Output "Macro execution completed."
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  if ($workbook -ne $null) {
    $workbook.Close($true)
  }

  if ($excel -ne $null) {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
