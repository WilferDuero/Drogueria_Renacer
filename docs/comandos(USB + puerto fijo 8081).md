# =============================
# Drogueria Renacer - Admin Mobile
# Comandos de trabajo (USB + puerto fijo 8081)
# =============================

# 0) Entrar al proyecto de la app mobile
cd "c:\Users\Wilfer Duero\Desktop\Drogueria_Renacer - App-Movil\apps\admin-mobile"

# 1) Instalar/actualizar Dev Client en el telefono (solo cuando cambias algo nativo: splash, icon, plugins)
# - Configura JAVA/ANDROID automaticamente
# - Verifica dispositivo ADB
# - Ejecuta build Android Dev Client
npm run android:devclient:usb

# 2) Inicio rapido diario (usa script interno y fija 8081)
# - Configura JAVA/ANDROID env de la sesion
# - Verifica dispositivo ADB
# - Hace adb reverse tcp:8081
# - Inicia Expo Dev Client en localhost:8081
npm run start:usb


# =============================
# Si 8081 esta ocupado (flujo de recuperacion)
# =============================

# 3) Matar el proceso que tenga tomado el puerto 8081
$pid8081 = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
if ($pid8081) { taskkill /PID $pid8081 /F }

# 4) Levantar ADB por ruta fija (sin depender del PATH)
C:\platform-tools\adb.exe start-server

# 5) Limpiar reverses viejos y dejar solo el de 8081
C:\platform-tools\adb.exe reverse --remove-all
C:\platform-tools\adb.exe reverse tcp:8081 tcp:8081

# 6) Iniciar Metro/Expo Dev Client forzado en 8081 y limpiar cache
npx expo start --dev-client --host localhost --port 8081 -c


# =============================
# Verificaciones utiles
# =============================

# Ver que el telefono esta en estado "device"
C:\platform-tools\adb.exe devices

# Ver que 8081 esta escuchando
Get-NetTCPConnection -LocalPort 8081 -State Listen

# =============================
# Flujo Git recomendado
# =============================

# Ver guia simple de ramas/commits/PR
# docs/FLUJO_GIT_SIMPLE.md


# =============================
# APK de prueba con EAS (instalable)
# =============================

# 7) Login en EAS (solo 1 vez)
cd "c:\Users\Wilfer Duero\Desktop\Drogueria_Renacer - App-Movil\apps\admin-mobile"
npx eas-cli@latest login

# 8) Crear APK de prueba (perfil preview)
# - Sube codigo y compila en la nube de Expo
# - Al final te da un link para descargar el APK
cd "c:\Users\Wilfer Duero\Desktop\Drogueria_Renacer - App-Movil\apps\admin-mobile"
npm run build:apk:preview

# 9) Ver los ultimos builds Android
cd "c:\Users\Wilfer Duero\Desktop\Drogueria_Renacer - App-Movil\apps\admin-mobile"
npm run build:list
