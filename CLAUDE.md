# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Medistock** — E-commerce de insumos médicos para la asignatura Integración de Plataformas. Backend Django + Frontend React. El backend está desplegado en **Railway** con MySQL.

---

## Comandos esenciales

### Backend (Django)
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # http://localhost:8000
python manage.py test             # correr todos los tests
python manage.py test accounts    # test de una app específica
```

Variables de entorno necesarias (ver `backend/.env.example`): `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 con proxy a localhost:8000
npm run build
npm run preview
```

El frontend apunta a `/api` (ruta relativa) y Vite la proxea a `http://localhost:8000`. Configurar en `.env.development` con `VITE_API_URL=/api`.

---

## Arquitectura general

### Backend (`backend/`)

Proyecto Django estándar con tres apps propias:

- **`accounts/`** — Modelos: `PerfilCliente`, `DireccionEntrega`, `Pedido`, `EnvioPedido`, `DocumentoTributario`. Vistas para auth JWT, perfil, pedidos y pago Webpay.
- **`inventory/`** — Modelos de productos, categorías, marcas, lotes, movimientos y traslados de inventario.
- **`locations/`** — Regiones/comunas (desde JSONs estáticos en `locations/data/`) y cotización Chilexpress.

Todos los endpoints están definidos directamente en `medistock_backend/urls.py` (sin routers DRF), bajo el prefijo `/api/`.

Auth: JWT vía `djangorestframework-simplejwt`. El permiso por defecto es `AllowAny`; los endpoints privados usan `IsAuthenticated` individualmente. Integración de pago con `transbank-sdk`.

### Frontend (`frontend/src/`)

React 18 + React Router v6 + Axios. Sin TypeScript, sin Redux. Estado global vía Context API.

**Contextos:**
- `AuthContext` — JWT, perfil, rol resuelto en frontend, login/logout. Persiste en `localStorage`.
- `CarritoContext` — Items, tipo despacho, cálculo IVA (19%), descuento B2B. Persiste en `localStorage`.

**Servicios:**
- `services/api.js` — Única instancia Axios. Tiene interceptor de request (Bearer token) e interceptor de response (refresh automático en 401, logout silencioso si falla). Todos los endpoints del sistema se llaman desde aquí. Algunos retornan `respuestaDemo()` (mock) mientras el backend no expone esa ruta.

**Routing (`App.jsx`):**
- Rutas públicas directas.
- `<RutaProtegida>` — requiere autenticación.
- `<RutaSoloCompradores>` — requiere autenticación + rol con permiso de compra.

**Roles resueltos en frontend** (`AuthContext.resolverRolFrontend()`): `admin`, `cliente_b2c`, `cliente_b2b`, `ejecutivo`, `operador`, `analista`, `trabajador`. Roles que pueden comprar definidos en `utils/permisos.js`.

**Capa cosmética del catálogo:** Los SKUs del backend son genéricos (`SKU-TEST-1`, …). `utils/catalogoEnriquecido.js` los mapea a nombres reales (Paracetamol, etc.) y se aplica en `normalizarProducto()` dentro de `api.js`. `utils/gruposCatalogo.js` agrupa categorías en tres nodos de navbar.

**Cotización de envío:** No está persistida en el backend (`Pedido` no tiene campo `costo_envio`). `ConfirmacionPedidoPage` cotiza con Chilexpress y guarda el resultado en `localStorage` vía `utils/cotizacionStorage.js`. `ResultadoPagoPage` y `PedidoDetallePage` lo leen desde ahí.

### Páginas organizadas en `pages/`
- `public/` — Home, Catálogo, Detalle, Contacto
- `auth/` — Login, Registro, Perfil
- `client/` — Carrito, Confirmación, Resultado de pago, Webpay, Tracking, Comprobante DTE
- `admin/` — Panel, Dashboard analista, Compras proveedor, Traslados, Integraciones, Conciliación pagos, Convenios, Guías despacho, Aprobaciones B2B, Admin productos/trabajadores

---

## Restricciones importantes

- **No tocar** configuración Railway, MySQL, CORS, `ALLOWED_HOSTS`, `wsgi.py`, `gunicorn` salvo que la tarea lo requiera explícitamente.
- **No modificar** endpoints existentes que ya responden 200.
- **No mezclar** cambios backend/frontend en una misma tarea salvo pedido explícito.
- Si se toca más de 3 archivos, proponer plan y esperar confirmación.
- Antes de crear mocks, verificar si existe endpoint real funcionando.
- Si se agrega campo nuevo al modelo, crear la migración.
