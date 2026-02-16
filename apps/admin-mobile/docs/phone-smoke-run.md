# Prueba Guiada en Telefono (Smoke Run)

## Datos de ejecucion
- Fecha:
- Dispositivo:
- Red usada (WiFi/4G):
- Usuario probado (`staff` / `owner`):

## Arranque recomendado (USB + Dev Client)
1. En terminal:
```bash
cd apps/admin-mobile
npm run start:usb
```
2. Abrir app `Drogueria Renacer Admin` en el telefono.
3. En Metro presionar `r` para recargar cuando hagas cambios.

## Pasos
1. Abrir app desde Dev Client (o Expo Go si aplica).
   - Verificar splash con logo de Drogueria Renacer.
2. Login con credenciales validas.
   - Probar ver/ocultar en campo de contrasena.
3. Verificar Dashboard:
   - API online
   - metricas visibles
   - alertas operativas in-app visibles
   - auto-sync activado y ultima auto-sync actualizada
4. Productos:
   - crear
   - editar
   - eliminar
   - exportar CSV
5. Pedidos:
   - filtrar
   - filtrar por fecha (`Hoy`, `7 dias`, `Rango`)
   - aceptar/rechazar/cancelar
   - verificar resumen parcial cuando aplique
    - validar bloqueo de doble accion critica (mientras procesa un pedido)
   - exportar CSV
6. Ventas:
   - registrar venta
   - filtrar por fecha (`Hoy`, `Mes`, `Rango`)
   - buscar
   - expandir detalle
   - exportar CSV
7. Resenas:
   - listar
   - borrar (solo owner)
8. Usuarios (solo owner):
   - listar
   - crear
   - editar rol/clave
9. Cerrar sesion y reingresar.

## Chequeos criticos extra (pedidos)
- Aceptacion total: cambia estado, descuenta stock, crea venta.
- Aceptacion parcial: estado `aceptado` + badge `parcial`, venta solo por items aceptados.
- Rechazo: no descuenta stock ni crea venta.
- Cancelacion: revierte stock y marca trazabilidad local.
- Boton `WhatsApp cliente`: abre mensaje segun estado actual del pedido.

## Resultado
- Estado final: `PASS` / `FAIL`
- Errores encontrados:
- Evidencia (capturas/logs):
