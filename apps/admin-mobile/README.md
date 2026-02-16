# Drogueria Renacer - Admin Mobile (Expo)

App movil solo para panel admin (roles `owner` y `staff`) usando React Native + Expo + TypeScript.

## Stack
- Expo SDK 54 + React Native 0.81 + TypeScript
- Navegacion: `@react-navigation/native` (stack + tabs)
- Estado: Zustand (`auth-store`, `sync-store`)
- Networking: Axios con timeout y manejo uniforme de errores
- Token seguro: `expo-secure-store`

## Alcance MVP implementado
- Login admin con JWT (`POST /auth/login`)
- Sesion persistente segura (`expo-secure-store`) y logout
- Campo de contrasena con ver/ocultar en login y usuarios
- Dashboard con estado API (`GET /health`) + metricas
- Alertas operativas in-app (pedido nuevo / stock bajo) con centro global en header
- Push notifications reales para app cerrada/background (pedido nuevo y stock bajo)
- Productos: listar/crear/editar/eliminar
- Pedidos: listar, filtrar por estado/fecha/busqueda, aceptar/rechazar/cancelar
- Pedidos: WhatsApp al cliente (automatico + boton manual por pedido)
- Ventas: consultar + registrar + limpiar (solo owner) con filtros por fecha/busqueda
- Resenas: consultar con busqueda + limpiar (solo owner)
- Usuarios: listar/crear/editar (solo owner)
- Exportacion CSV para productos, pedidos y ventas
- Sync manual global (boton `Sincronizar` en header)
- Auto-sync en foreground configurable (toggle en dashboard)
- Splash inicial con logo de Drogueria Renacer

## Endpoints usados
- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `POST /notifications/register`
- `POST /notifications/unregister`
- `GET /users`
- `POST /users`
- `PUT /users/:id`
- `GET /products`
- `POST /products`
- `PUT /products/:id`
- `PUT /products/external/:externalId`
- `DELETE /products/:id`
- `DELETE /products/external/:externalId`
- `GET /orders`
- `PUT /orders/:id/status`
- `PUT /orders/external/:externalId/status`
- `GET /sales`
- `POST /sales`
- `DELETE /sales`
- `GET /reviews`
- `DELETE /reviews`

## Configuracion de entorno
1. Copia `.env.example` a `.env`.
2. Ajusta:
   - `EXPO_PUBLIC_API_BASE_URL`
   - `EXPO_PUBLIC_API_TIMEOUT_MS`
   - `EXPO_PUBLIC_SESSION_IDLE_TIMEOUT_MS`
   - `EXPO_PUBLIC_AUTO_SYNC_INTERVAL_MS`
   - `EXPO_PUBLIC_EAS_PROJECT_ID` (requerido para push en Expo)

Si no defines variables, la app usa `https://drogueria-renacer.onrender.com` por defecto.

## Configuracion backend para push
Configura en `server/.env` o en Render:
- `PUSH_NOTIFY_ROLES=owner` (o `owner,staff`)
- `PUSH_LOW_STOCK_THRESHOLD=2`

## Estructura
```text
apps/admin-mobile
  src/
    api/
      client.ts
      modules/
    components/
    config/
    constants/
    features/
      auth/
      dashboard/
      products/
      orders/
      sales/
      users/
    navigation/
    store/
    types/
```

## Instalacion y ejecucion local
```bash
cd apps/admin-mobile
npm install
npm run typecheck
npm run start
```

## Arranque recomendado
- Red local:
```bash
npm run start:lan
```
- Si tu WiFi falla:
```bash
npm run start:tunnel
```
- Modo estable por USB (Dev Client):
```bash
npm run start:devclient
```
- Modo USB simplificado en Windows (recomendado):
```bash
npm run start:usb
```

## Probar en telefono con Expo Go
1. Instala **Expo Go** en Android/iOS.
2. Ejecuta:
```bash
cd apps/admin-mobile
npm run start
```
3. Escanea el QR en la terminal (Android) o en la camara/Expo Go (iOS).

## Build
- Android preview/dev:
```bash
cd apps/admin-mobile
npx expo run:android
```
- iOS local (solo macOS):
```bash
cd apps/admin-mobile
npx expo run:ios
```

## APK con EAS (instalable)
1. Login EAS (una sola vez por equipo):
```bash
cd apps/admin-mobile
npx eas-cli@latest login
```
2. Generar APK de prueba (perfil `preview`):
```bash
cd apps/admin-mobile
npm run build:apk:preview
```
3. Ver estado de builds Android:
```bash
cd apps/admin-mobile
npm run build:list
```
4. Descargar e instalar APK desde el enlace que entrega EAS al terminar.

Notas:
- `preview` genera `.apk` para instalar manualmente y probar en telefono real.
- `production` genera `.aab` para publicacion en Play Store.
- La configuracion de EAS queda en `apps/admin-mobile/eas.json`.

## Seguridad y estabilidad
- Token JWT solo en `expo-secure-store`.
- Auto logout en 401 por interceptor.
- Auto logout por inactividad al volver desde background (configurable por entorno).
- Validacion de estados permitidos de pedido en app:
  - `pendiente`, `aceptado`, `rechazado`, `cancelado`
- Proteccion de usuarios: no permite degradar el ultimo `owner` a `staff`.
- Push en backend se ejecuta en modo no bloqueante (si falla, no rompe pedidos/productos).

## Dev Client + USB (Android recomendado)
Flujo para mayor estabilidad (sin depender de tunnel):

1. Requisitos:
- Android Studio + Android SDK
- `adb` disponible en terminal (`adb version`)
- Telefono Android con `Depuracion USB` activada

2. Instalar cliente de desarrollo en el telefono (solo primera vez o cuando cambie nativo):
```bash
cd apps/admin-mobile
npm run android:devclient:usb
```
Usa este paso otra vez si cambias `app.json`, iconos, splash o plugins nativos.

3. Sesion diaria de desarrollo por USB:
```bash
cd apps/admin-mobile
npm run start:usb
```

4. Abrir app en el telefono:
- Abre manualmente el app `Drogueria Renacer Admin` (Dev Client) en tu Android.
- No necesitas QR para flujo USB.

## QA manual
- Ver `docs/manual-test-checklist.md`.
- Smoke run rapido en telefono: `docs/phone-smoke-run.md`.
- Guion demo interna: `docs/demo-script.md`.
- Checklist para presentacion interna: `docs/demo-ready-checklist.md`.

## Pendientes v2
- Ver `docs/v2-pending.md`.
