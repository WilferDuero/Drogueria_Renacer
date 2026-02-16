# Checklist Demo Ready (Admin Mobile)

## 1) Entorno tecnico
- [ ] Telefono Android con bateria > 60%.
- [ ] Cable USB estable y `adb devices` en estado `device`.
- [ ] Dev Client instalado y actualizado (`npm run android:devclient:usb` si aplica).
- [ ] Metro levantado por USB fijo (`npm run start:usb`).

## 2) Estado de app
- [ ] Login `staff` y `owner` funcionando.
- [ ] API `online` en Dashboard.
- [ ] Sin errores visibles en consola Metro al iniciar.

## 3) Datos minimos para demo
- [ ] Al menos 2 productos con stock normal.
- [ ] Al menos 1 producto en stock bajo.
- [ ] Al menos 1 pedido `pendiente`.
- [ ] Al menos 1 pedido `aceptado` (para demo de cancelacion).
- [ ] Al menos 1 venta en historial.

## 4) Flujo de demostracion
- [ ] Dashboard + alertas operativas.
- [ ] Productos (buscar/editar/exportar).
- [ ] Pedidos (aceptar o rechazar + bloqueo anti doble accion).
- [ ] Ventas (filtro fecha + busqueda + exportar).
- [ ] Usuarios (owner) y Resenas (owner).

## 5) Cierre
- [ ] Logout correcto.
- [ ] Guardar capturas/video corto de evidencia.
