param(
  [string]$Device = ""
)

$ErrorActionPreference = "Stop"

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adbCandidates = @(
  (Join-Path $sdkRoot "platform-tools\adb.exe"),
  "C:\platform-tools\adb.exe"
)

if (-not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
  throw "No se encontro Java en '$javaHome'. Verifica Android Studio."
}

if (-not (Test-Path $sdkRoot)) {
  throw "No se encontro Android SDK en '$sdkRoot'."
}

$adb = $adbCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $adb) {
  throw "No se encontro adb.exe. Instala Android Platform-Tools."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:Path = "$javaHome\bin;$sdkRoot\platform-tools;C:\platform-tools;$env:Path"

Write-Host "JAVA_HOME: $env:JAVA_HOME"
Write-Host "ANDROID_HOME: $env:ANDROID_HOME"
Write-Host "ADB: $adb"

& $adb start-server | Out-Null
$deviceLines = & $adb devices
$connectedDevices = $deviceLines | Where-Object { $_ -match "\tdevice$" }
if (-not $connectedDevices) {
  throw "No hay dispositivos en estado 'device'. Revisa cable/depuracion USB."
}

if ($Device) {
  Write-Host "Usando dispositivo: $Device"
  npx expo run:android --device $Device
  exit $LASTEXITCODE
}

Write-Host "Dispositivos detectados:"
$connectedDevices | ForEach-Object {
  $deviceId = ($_ -split "\s+")[0]
  Write-Host " - $deviceId"
}

npx expo run:android --device
