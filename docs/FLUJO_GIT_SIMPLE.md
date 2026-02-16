# Flujo Git Simple (Tienda + App + Backend)

## 1) Estado actual del proyecto
- Repositorio unico: `Drogueria_Renacer` (monorepo).
- Backend unico (Render): lo consumen tienda web y app movil admin.
- Fronts separados dentro del mismo proyecto:
  - Tienda/PWA: raiz (`js`, `admin.html`, etc.)
  - App movil admin: `apps/admin-mobile`

## 2) Flujo recomendado para cada cambio
```powershell
cd "c:\Users\Wilfer Duero\Desktop\Drogueria_Renacer - App-Movil"
git checkout main
git pull origin main
git checkout -b <tipo>/<modulo>-<resumen-corto>
```

## 3) Nombres de ramas (plantilla)
- Tienda web: `fix/store-carrito-total`
- App movil: `fix/admin-mobile-pedidos-filtro`
- Backend: `feat/backend-notificaciones-push`
- Documentacion: `docs/actualizar-manual-qa`

## 4) Commits profesionales (plantilla)
```powershell
git add .
git commit -m "fix(store): corregir total del carrito"
git commit -m "feat(admin-mobile): agregar filtro por fecha en pedidos"
git commit -m "fix(backend): validar telefono en /orders"
git commit -m "docs: actualizar checklist de pruebas"
```

## 5) Subir y abrir PR
```powershell
git push -u origin <tu-rama>
```
Luego en GitHub:
- `Compare & pull request`
- Revisar archivos cambiados
- `Create pull request`
- `Merge pull request`

## 6) Regla para no confundirte
- Si el error es solo visual en tienda: cambiar solo tienda.
- Si el error es solo visual en app movil: cambiar solo app movil.
- Si el error es de datos/API/logica (pedidos/stock/ventas): revisar backend y validar en ambos fronts.

## 7) Comandos rapidos de salud
```powershell
git status
git branch --show-current
git log --oneline -5
```
