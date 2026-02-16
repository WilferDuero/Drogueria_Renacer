# Guion Demo Interna (Admin Mobile)

## Objetivo
Mostrar en 8-12 minutos que la app admin movil cubre operaciones criticas sin tocar backend.

## Preparacion previa
1. Ejecutar:
```bash
cd apps/admin-mobile
npm install
npm run typecheck
npm run start:usb
```
2. Abrir app `Drogueria Renacer Admin` (Dev Client) en el telefono por USB.
3. Tener 2 usuarios de prueba:
   - `staff`
   - `owner`

## Flujo recomendado de demo
1. **Login staff**
   - Entrar con usuario `staff`.
   - Mostrar persistencia: cerrar/reabrir app y mantiene sesion.

2. **Dashboard**
   - Mostrar estado API (`/health`).
   - Mostrar metricas (pedidos pendientes, stock bajo, ingresos, etc.).
   - Mostrar toggle de `Auto-sync` y timestamp de ultima auto-sync.
   - Ejecutar `Sincronizar`.
   - Mostrar alertas operativas in-app (pedido nuevo / stock bajo).

3. **Productos**
   - Buscar producto.
   - Crear producto de prueba.
   - Editar stock/oferta.
   - Exportar CSV filtrado.
   - Eliminar producto de prueba.

4. **Pedidos (flujo critico)**
   - Abrir pedido pendiente.
   - Marcar aceptacion parcial por item.
   - Aceptar pedido (descuenta stock y registra venta).
   - Mostrar badge parcial y resumen de aceptados/rechazados.
   - Cancelar pedido aceptado (reversion de stock).
   - Exportar CSV.
   - Mostrar que cuando una accion critica esta en curso, se bloquean otras acciones para evitar doble ejecucion.

5. **Ventas**
   - Ver venta generada por pedido.
   - Filtrar por fecha (`Hoy`, `Mes`, `Rango`) y buscar por cliente/ref.
   - Ver detalle de items.
   - Exportar CSV.

6. **Resenas**
   - Listar resenas.

7. **Login owner**
   - Cerrar sesion e iniciar con owner.
   - Mostrar tab `Usuarios`.
   - Crear/editar usuario.
   - (Opcional) borrar ventas/resenas para limpieza.

## Mensaje de cierre sugerido
- "La app movil admin ya cubre login seguro, pedidos criticos con control de stock, ventas, productos, usuarios owner, resenas, alertas in-app, sync manual y exportaciones CSV."
