# 💊 Droguería Renacer — Sistema Web de Ventas y Gestión Comercial

Plataforma de software desarrollada para digitalizar procesos comerciales de una droguería, integrando una tienda web, un backend con API REST y una aplicación móvil administrativa.

El proyecto permite gestionar información de productos, pedidos, ventas, usuarios y notificaciones mediante diferentes componentes tecnológicos.

## 🚀 Características principales

### 🌐 Tienda web
- Catálogo de productos organizado por categorías.
- Visualización de productos, precios y disponibilidad.
- Carrito de compras.
- Registro de pedidos.
- Interfaz adaptada para la consulta de productos desde el navegador.

### ⚙️ Backend y API REST
- Gestión de productos e inventario.
- Registro y administración de pedidos.
- Actualización de estados de pedidos.
- Registro y consulta de ventas.
- Administración de usuarios y roles.
- Gestión de reseñas de clientes.
- Paginación de productos.
- Comunicación con bases de datos PostgreSQL y SQLite.

### 🔐 Autenticación y seguridad
- Autenticación mediante JSON Web Tokens (JWT).
- Protección de contraseñas utilizando bcryptjs.
- Roles de usuario `owner` y `staff`.
- Protección de rutas que requieren autenticación.
- Restricción de operaciones administrativas según el rol.
- Configuración mediante variables de entorno.
- Limitación de intentos fallidos de inicio de sesión.

### 📱 Aplicación móvil administrativa

Aplicación desarrollada con React Native, Expo y TypeScript.

Su código está organizado en módulos para:

- Autenticación.
- Panel administrativo.
- Productos e inventario.
- Pedidos.
- Ventas.
- Reseñas.
- Usuarios.
- Notificaciones.

### 🔔 Notificaciones y alertas

El backend incluye lógica para generar notificaciones push mediante Expo cuando:

- Se registra un nuevo pedido pendiente.
- Se crea un producto con existencias bajas.
- Las existencias de determinados productos disminuyen hasta el umbral configurado.

La aplicación móvil incluye componentes para registrar dispositivos, gestionar permisos y procesar notificaciones.

El funcionamiento completo de estas características en dispositivos reales requiere pruebas de integración.

---

## 🛠️ Tecnologías utilizadas

### Frontend web
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express 5
- JavaScript
- PostgreSQL
- SQLite
- JSON Web Tokens (JWT)
- bcryptjs
- CORS
- dotenv

### Aplicación móvil
- React Native
- React
- Expo SDK 54
- TypeScript
- React Navigation
- Axios
- Zustand
- Expo Notifications
- Expo SecureStore

### Herramientas
- Git
- GitHub
- Visual Studio Code
- EAS Build

---

## 🏗️ Arquitectura del proyecto

El sistema está dividido en tres componentes principales:

**1. Tienda web:** proporciona una interfaz para consultar productos y realizar pedidos.

**2. Backend:** administra las operaciones comerciales mediante una API REST y permite trabajar con PostgreSQL o SQLite.

**3. Aplicación móvil:** contiene módulos administrativos e integración con los servicios del backend.

Esta separación permite organizar el desarrollo de las interfaces, la lógica de negocio y el almacenamiento de información.

---

## 📂 Estructura del repositorio

```text
Drogueria_Renacer/
│
├── apps/
│   └── admin-mobile/
│       ├── assets/
│       ├── docs/
│       ├── plugins/
│       ├── scripts/
│       ├── src/
│       │   ├── api/
│       │   ├── components/
│       │   ├── config/
│       │   ├── constants/
│       │   ├── features/
│       │   ├── lib/
│       │   ├── navigation/
│       │   ├── store/
│       │   └── types/
│       ├── App.tsx
│       ├── app.json
│       ├── eas.json
│       └── package.json
│
├── assets/
├── docs/
├── js/
│
├── server/
│   ├── .env.example
│   ├── db.js
│   ├── index.js
│   └── package.json
│
├── admin.html
├── admin_login.html
├── index.html
├── style.css
└── README.md
```

---

## 🗄️ Bases de datos

El backend permite utilizar dos motores de bases de datos:

**SQLite:** se utiliza de manera predeterminada cuando no está definida la variable `DATABASE_URL`.

**PostgreSQL:** se utiliza cuando existe una cadena de conexión configurada mediante `DATABASE_URL`.

El código incluye estructuras para almacenar:

- Productos.
- Pedidos.
- Ventas.
- Usuarios.
- Reseñas.
- Dispositivos registrados para notificaciones.

También implementa consultas parametrizadas y operaciones para consultar, insertar y actualizar registros.

---

## 🌐 Demostración web

🔗 **[Visitar Droguería Renacer](https://drogueria-renacer.vercel.app/)**

El enlace corresponde a la versión web desplegada mediante Vercel.

La disponibilidad de la demostración y las funcionalidades que dependen del backend pueden variar según la configuración de los servicios.

---

## 📌 Estado del proyecto

Proyecto de desarrollo de software creado como propuesta tecnológica para las necesidades comerciales de una droguería.

El repositorio contiene componentes web, backend y una aplicación móvil administrativa.

**No fue implementado como sistema comercial operativo en la droguería.** Algunas funcionalidades requieren pruebas adicionales para confirmar su funcionamiento completo en un entorno de producción.

Este proyecto es independiente de mi aplicación de escritorio para el control de inventario y fechas de vencimiento de medicamentos, que sí ha sido utilizada en un entorno real.

---

## 🎯 Objetivos de desarrollo

Este proyecto me permitió trabajar en diferentes áreas del desarrollo de software:

- Diseño de APIs REST.
- Programación backend con Node.js y Express.
- Gestión de bases de datos relacionales.
- Desarrollo de interfaces web.
- Desarrollo móvil con React Native y Expo.
- Implementación de autenticación y autorización.
- Integración entre aplicaciones y servicios.
- Organización modular del código.
- Uso de Git y GitHub para el control de versiones.

---

## 👨‍💻 Desarrollador

**Wilfer Edisson Duero Mateus**

Técnico Laboral en Programación de Software.

Interesado en el desarrollo de aplicaciones web, backend y soluciones de software que permitan resolver problemas reales.

💻 **GitHub:** [WilferDuero](https://github.com/WilferDuero)

💼 **LinkedIn:** [Wilfer Duero](https://www.linkedin.com/in/wilfer-duero)

---

⭐ Este repositorio forma parte de mi portafolio personal de desarrollo de software.
