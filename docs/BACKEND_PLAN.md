# Plan inicial de backend (fase 1)

1. Stack recomendado
   - Backend: Node.js + Express.
   - Base de datos: SQLite al inicio, luego PostgreSQL.

2. Entidades principales
   - Productos
   - Pedidos
   - Ventas
   - Reseñas
   - Usuarios (admin)

3. Endpoints mínimos
   - `GET /products`
   - `POST /products` (admin)
   - `PUT /products/:id` (admin)
   - `DELETE /products/:id` (admin)
   - `POST /orders`
   - `GET /orders` (admin)
   - `PUT /orders/:id/status` (admin)
   - `POST /reviews`
   - `GET /reviews`

4. Autenticación
   - Login admin con contraseña cifrada (bcrypt).
   - Sesiones o JWT.

5. Migración desde localStorage
   - Exportar productos y pedidos actuales.
   - Importarlos a la base de datos.

6. Deploy
   - Backend en Render o Railway.
   - Base de datos en PostgreSQL cuando el proyecto crezca.
