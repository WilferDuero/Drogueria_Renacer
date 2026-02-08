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
6. En la tienda o admin, usa el boton **⚙ API** y pega esa URL.
7. Activa la API cuando te lo pregunte.

Notas:
- En el plan gratis Render puede "dormir" el servicio si no hay trafico.
- Si la API demora al abrir, espera unos segundos y vuelve a intentar.
