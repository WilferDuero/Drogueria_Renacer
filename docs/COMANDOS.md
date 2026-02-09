# Comandos del Proyecto (Chuleta)

Guia rapida de los comandos que ya usamos y los que vamos a usar.

**1) PowerShell (Windows)**

Ver version de psql:
```powershell
psql --version
```

Actualizar variables de entorno en la consola actual:
```powershell
refreshenv
```

Entrar a PostgreSQL remoto (Render):
```powershell
$env:PGPASSWORD="TU_PASSWORD"
psql -h TU_HOST -U TU_USER TU_DB
```

Generar hash bcrypt para una clave:
```powershell
cd C:\Users\WilferDuero\Desktop\drogueria-renacer\server
node -e "const b=require('bcryptjs'); b.hash('TU_CLAVE',10).then(h=>console.log(h))"
```

Instalar dependencias del backend:
```powershell
cd C:\Users\WilferDuero\Desktop\drogueria-renacer\server
npm install
```

**2) PostgreSQL (psql)**

Ver usuarios:
```sql
SELECT id, username, role, createdAt FROM users;
```

Borrar usuarios (solo si quieres reiniciar logins):
```sql
TRUNCATE users RESTART IDENTITY;
```

Borrar productos (para quitar duplicados):
```sql
TRUNCATE products RESTART IDENTITY;
```

Actualizar clave del usuario:
```sql
UPDATE users
SET passwordhash = 'HASH_GENERADO'
WHERE username = 'USUARIO';
```

Salir de psql:
```sql
\q
```

**3) Git (subir cambios)**

Ver estado:
```powershell
git status -sb
```

Agregar cambios:
```powershell
git add ARCHIVO1 ARCHIVO2
```

Crear commit:
```powershell
git commit -m "Mensaje"
```

Subir al repo (actualiza Vercel/Render):
```powershell
git push
```

**4) Backend local**

Iniciar servidor local:
```powershell
cd C:\Users\WilferDuero\Desktop\drogueria-renacer\server
npm run dev
```

**5) Comandos en consola del navegador (F12)**

Forzar API remota en la tienda:
```js
localStorage.clear();
localStorage.setItem('API_BASE','https://drogueria-renacer.onrender.com');
localStorage.setItem('API_ENABLED','true');
location.reload();
```

Ver configuracion rapida:
```js
console.log({
  apiBase: localStorage.getItem('API_BASE'),
  apiEnabled: localStorage.getItem('API_ENABLED'),
  productsCount: typeof getProducts === 'function' ? getProducts().length : null
});
```

Probar API products:
```js
fetch('https://drogueria-renacer.onrender.com/products')
  .then(r => r.json())
  .then(d => console.log('API products:', d));
```

**6) Advertencias**

Usa TRUNCATE solo si estas seguro de borrar datos.
Nunca pegues comandos que no entiendas.
El JWT_SECRET solo va en Render (no se comparte).
