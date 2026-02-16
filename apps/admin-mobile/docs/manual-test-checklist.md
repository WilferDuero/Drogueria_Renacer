# Checklist Manual MVP Admin Mobile

## 1. Login y sesion
- [ ] Al abrir app en frio, splash muestra logo de Drogueria Renacer.
- [ ] Login con usuario valido `owner`.
- [ ] Login con usuario valido `staff`.
- [ ] Login con credenciales invalidas muestra error.
- [ ] Campo de contrasena permite ver/ocultar.
- [ ] Cerrar app y reabrir: sesion se restaura con token guardado.
- [ ] Logout limpia sesion y vuelve a login.

## 2. Dashboard y sync
- [ ] `GET /health` refleja estado online/offline.
- [ ] Boton `Sincronizar` recarga metricas.
- [ ] Toggle `Auto-sync` activa/desactiva sincronizacion periodica.
- [ ] Dashboard actualiza conteos de productos/pedidos/ventas.
- [ ] Dashboard muestra alertas in-app cuando suben pedidos pendientes.
- [ ] Dashboard muestra alertas in-app cuando aumenta stock bajo.

## 3. Productos
- [ ] Listar productos.
- [ ] Buscar por nombre/categoria/descripcion.
- [ ] Crear producto (campos minimos y completos).
- [ ] Editar producto existente.
- [ ] Eliminar producto.
- [ ] Validar oferta activa y precios oferta.

## 4. Pedidos
- [ ] Listar pedidos.
- [ ] Filtrar por estado (`all`, `pendiente`, `aceptado`, `rechazado`, `cancelado`).
- [ ] Filtrar por fecha (`Hoy`, `7 dias`, `Rango`).
- [ ] Buscar pedido por ref/cliente/telefono/direccion.
- [ ] Cambiar pedido `pendiente` a `aceptado`.
- [ ] Cambiar pedido `pendiente` a `rechazado`.
- [ ] Cambiar pedido `aceptado` a `cancelado`.
- [ ] Validar que no se envian estados fuera de enum.
- [ ] Validar que badge de estado no se superpone con `Ext ID` en header del pedido.

## 5. Ventas
- [ ] Listar ventas.
- [ ] Filtrar ventas por fecha (`Hoy`, `Mes`, `Rango`).
- [ ] Registrar venta manual con total > 0.
- [ ] Registrar venta con `itemsJson` valido.
- [ ] Intentar `itemsJson` invalido y validar manejo de error.
- [ ] `owner` puede ejecutar borrado masivo (`DELETE /sales`).
- [ ] `staff` no ve accion de borrado masivo.

## 6. Usuarios (solo owner)
- [ ] `owner` puede listar usuarios.
- [ ] `owner` puede crear usuario `staff`.
- [ ] `owner` puede editar username.
- [ ] `owner` puede editar rol.
- [ ] `owner` puede resetear clave.
- [ ] `staff` no puede ver tab de usuarios.

## 7. Resiliencia basica
- [ ] Simular API caida: mostrar errores sin crashear app.
- [ ] Acciones simultaneas: botones muestran estado loading.
- [ ] Accion critica en pedidos bloquea doble ejecucion mientras procesa.
- [ ] Reiniciar app luego de error y validar continuidad.

## 8. Resenas
- [ ] Listar resenas en tab `Resenas`.
- [ ] Buscar resenas por nombre/telefono/comentario.
- [ ] `owner` puede borrar resenas (`DELETE /reviews`).
- [ ] `staff` no ve boton de borrado masivo.

## 9. Exportaciones CSV
- [ ] Exportar productos con filtros aplicados.
- [ ] Exportar pedidos con filtro actual.
- [ ] Exportar ventas con filtro de busqueda aplicado.
- [ ] Validar apertura del CSV en Google Sheets/Excel.

## 10. Flujo critico Pedidos-Stock-Ventas (obligatorio)

### Caso A: Aceptacion total de pedido pendiente
- [ ] Abrir un pedido `pendiente` con al menos 1 item.
- [ ] Dejar todos los items en estado aceptado y presionar `Aceptar`.
- [ ] Resultado esperado:
  - Pedido pasa a `aceptado`.
  - Se descuenta stock de los productos aceptados.
  - Se crea registro en `Ventas` por el total aceptado.
  - Se abre WhatsApp del cliente con mensaje de pedido aceptado.

### Caso B: Aceptacion parcial por item
- [ ] En pedido `pendiente`, marcar al menos 1 item como rechazado.
- [ ] Presionar `Aceptar`.
- [ ] Resultado esperado:
  - Pedido pasa a `aceptado`.
  - Se muestra indicador `parcial`.
  - Solo se descuenta stock de items aceptados.
  - Venta registrada con total solo de items aceptados.
  - Se abre WhatsApp del cliente con detalle parcial (aceptados/rechazados).

### Caso C: Rechazo total
- [ ] En pedido `pendiente`, usar `Rechazar`.
- [ ] Resultado esperado:
  - Pedido pasa a `rechazado`.
  - No cambia stock.
  - No se crea venta.
  - Se abre WhatsApp del cliente con estado rechazado.

### Caso D: Cancelacion de pedido aceptado
- [ ] Tomar un pedido `aceptado`.
- [ ] Presionar `Cancelar (revertir stock)`.
- [ ] Resultado esperado:
  - Pedido pasa a `cancelado`.
  - Stock vuelve al valor previo de la aceptacion.
  - Trazabilidad muestra cancelacion con fecha.
  - Se abre WhatsApp del cliente con estado cancelado.

### Caso E: Stock insuficiente
- [ ] Forzar un pedido donde cantidad supere stock disponible.
- [ ] Presionar `Aceptar`.
- [ ] Resultado esperado:
  - Se muestra alerta de stock insuficiente.
  - Pedido no cambia de estado.
  - No se toca stock.
  - No se crea venta.
