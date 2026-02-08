# Backend remoto (Render) — pasos rapidos

Estos pasos dejan el backend accesible desde cualquier lugar.

1. Asegurate de tener el repo en GitHub (ya lo tienes).
2. Entra a Render y crea una cuenta.
3. Crea un **New Web Service** y conecta el repo.
4. Configuracion recomendada:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Render te dara una URL publica, por ejemplo:
   - `https://tu-api.onrender.com`
6. En el **admin**, usa el boton **⚙ API** y pega esa URL.
7. Activa la API cuando te lo pregunte.

Notas:
- En el plan gratis Render puede "dormir" el servicio si no hay trafico.
- Si la API demora al abrir, espera unos segundos y vuelve a intentar.

## Postgres en Render (persistente)

1. En Render crea un **Postgres** nuevo.
2. En el Web Service, agrega la variable `DATABASE_URL`.
   - Puedes pegar la **Internal Database URL** del Postgres.
3. Agrega estas variables de entorno (seguridad real):
   - `JWT_SECRET` = una clave larga y privada.
   - `ADMIN_USER` (opcional) = usuario dueño inicial.
   - `ADMIN_PASS` (opcional) = contraseña dueño inicial.
   - `ADMIN_ROLE` (opcional) = `owner`.
4. Vuelve a desplegar el servicio.

Notas:
- Si no hay `DATABASE_URL`, el backend usa SQLite local.
- Cuando actives Postgres por primera vez, la BD empieza vacía.
  Si necesitas migrar datos del SQLite local, dime y lo preparamos.
