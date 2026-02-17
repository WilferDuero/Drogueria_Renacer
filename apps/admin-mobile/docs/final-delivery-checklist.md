# Cierre Final MVP (Owner + Staff)

Objetivo: validar en telefono Android que el MVP admin esta listo para presentacion.

## 1) Pre-check tecnico (hecho)
- [x] `npm run typecheck`
- [x] `npx expo-doctor`
- [x] Push de pedidos llega al telefono.
- [x] Campana sin duplicados por pedido.
- [x] Stock bajo configurado en `<= 3`.

## 2) Prueba rapida con usuario staff (10-15 min)
- [ ] Login staff correcto.
- [ ] Dashboard carga y permite `Sincronizar`.
- [ ] Productos: listar, buscar, editar stock.
- [ ] Pedidos: listar, buscar, filtrar por estado.
- [ ] Pedido pendiente: `Aceptar`, `Rechazar`, `Cancelar` (si aplica).
- [ ] Ventas: crear venta manual valida y ver en historial.
- [ ] Resenas: listar.
- [ ] Verificar que `Usuarios` no aparece para staff.
- [ ] Logout.

## 3) Prueba rapida con usuario owner (10-15 min)
- [ ] Login owner correcto.
- [ ] Usuarios: listar, crear staff, editar rol/clave.
- [ ] Resenas: borrar una resena.
- [ ] Ventas: borrar ventas (owner).
- [ ] Confirmar que no hay errores de permisos en acciones owner.

## 4) Flujo critico negocio (obligatorio)
- [ ] Crear pedido desde tienda y confirmar:
  - [ ] llega push al telefono (app en segundo plano/cerrada)
  - [ ] aparece 1 alerta en campana (sin duplicado)
  - [ ] pedido aparece una sola vez en lista
- [ ] Aceptacion total:
  - [ ] descuenta stock
  - [ ] crea venta
  - [ ] abre WhatsApp cliente
- [ ] Aceptacion parcial:
  - [ ] venta solo por items aceptados
  - [ ] stock solo de items aceptados
  - [ ] WhatsApp parcial correcto
- [ ] Rechazo total:
  - [ ] no descuenta stock
  - [ ] no crea venta
- [ ] Cancelacion de aceptado:
  - [ ] revierte stock
  - [ ] estado final `cancelado`

## 5) Criterio de salida
Se considera listo para presentacion si:
- [ ] no hay errores bloqueantes en login/pedidos/ventas/usuarios
- [ ] push funciona en telefono real
- [ ] no hay duplicados de alerta por un mismo pedido
- [ ] flujo pedido-stock-venta pasa completo

## 6) Registro corto de evidencias
- Fecha:
- Dispositivo:
- Version APK:
- Usuario staff probado:
- Usuario owner probado:
- Resultado final: `PASS` / `FAIL`
- Hallazgos:
