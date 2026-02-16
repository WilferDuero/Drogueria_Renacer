# Orden de Ejecucion QA - Admin Mobile MVP

Usa este orden para validar rapido y evitar repetir pasos.
Checklist detallado base: `apps/admin-mobile/docs/manual-test-checklist.md`.

## A. Pasada corta (15-25 min)

1. Login y sesion
- [ ] Login `owner` OK.
- [ ] Logout y login `staff` OK.
- [ ] Error visible con credenciales invalidas.

2. Dashboard y conectividad
- [ ] Estado API visible (`online/offline`).
- [ ] `Sincronizar` actualiza datos.
- [ ] Pull-to-refresh funciona.

3. Productos (flujo minimo)
- [ ] Crear producto simple.
- [ ] Editar producto.
- [ ] Stock rapido (`+1`, `-1`, `Agotar`).

4. Pedidos (flujo critico minimo)
- [ ] Pedido `pendiente` -> `aceptado`.
- [ ] Pedido `pendiente` -> `rechazado`.
- [ ] Pedido `aceptado` -> `cancelado` (revertir stock).

5. Ventas
- [ ] Registrar venta asistida (sin JSON).
- [ ] Historial carga y filtros basicos funcionan.
- [ ] `owner` ve `CSV por vendedor`.

6. Reseñas y usuarios
- [ ] Reseñas listan y buscan.
- [ ] `owner` ve `Usuarios`, `staff` no.

## B. Pasada completa (35-60 min)

1. Ejecutar secciones 1 a 10 de `manual-test-checklist.md` en orden:
- [ ] `1. Login y sesion`
- [ ] `2. Dashboard y sync`
- [ ] `3. Productos`
- [ ] `4. Pedidos`
- [ ] `5. Ventas`
- [ ] `6. Usuarios (solo owner)`
- [ ] `7. Resiliencia basica`
- [ ] `8. Resenas`
- [ ] `9. Exportaciones CSV`
- [ ] `10. Flujo critico Pedidos-Stock-Ventas`

2. Push al final (para no contaminar pruebas funcionales)
- [ ] `2.1 Push (app cerrada/background)` de `manual-test-checklist.md`.

## C. Criterio de cierre del MVP

- [ ] Sin bloqueos en flujos criticos (`Pedidos/Stock/Ventas`).
- [ ] Sin errores funcionales en rol `owner`.
- [ ] Sin errores funcionales en rol `staff`.
- [ ] Exportaciones CSV abren correctamente.
- [ ] Sin crashes en Android durante la corrida completa.

## D. Registro rapido por corrida

Fecha:
Responsable:
Build/branch:
Resultado:
- [ ] Aprobado
- [ ] Aprobado con observaciones
- [ ] Rechazado

Observaciones:

