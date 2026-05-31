# MEDISTOCK — Frontend

E-commerce y panel de gestión para **MEDISTOCK**, distribuidora de insumos médicos en Chile. Esta app es el frontend principal del sistema: cubre catálogo público, carrito, checkout con Webpay, paneles operativos por rol (administrador, ejecutivo, operador, analista) y portal de cliente B2B/B2C.

Es **una de dos apps frontend** del repositorio. La otra, [`../farmaciaCruzAmarilla/`](../farmaciaCruzAmarilla/), es una vitrina externa que consume el mismo API público.

---

## Tabla de contenidos

- [Stack](#stack)
- [Cómo correr](#cómo-correr)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Arquitectura](#arquitectura)
- [Roles y permisos](#roles-y-permisos)
- [Páginas](#páginas)
- [Endpoints consumidos](#endpoints-consumidos)
- [Patrones y convenciones](#patrones-y-convenciones)
- [Capa cosmética del catálogo](#capa-cosmética-del-catálogo)
- [Cómo agregar una nueva página](#cómo-agregar-una-nueva-página)
- [Troubleshooting](#troubleshooting)

---

## Stack

- **React 18** + **Vite 5** (HMR, ESM nativo)
- **React Router v6** (rutas anidadas, guards de auth/rol)
- **Axios** con interceptor para JWT + refresh automático
- **Downshift** para combobox accesibles (selección de región/comuna)
- **CSS plano** con variables (`:root { --color-* }`) — sin frameworks UI

No usamos TypeScript ni state managers externos (Redux, Zustand). El estado global se resuelve con **Context API**.

---

## Cómo correr

```bash
cd medistockFrontEnd
npm install
npm run dev
```

App disponible en **http://localhost:5173**.

Requiere el backend de Django corriendo en `http://localhost:8000` (o configurable, ver [variables de entorno](#variables-de-entorno)).

### Scripts disponibles
| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción → `dist/` |
| `npm run preview` | Servir el build localmente |

---

## Variables de entorno

Definidas en `.env.development`:

```
VITE_API_URL=/api
```

`VITE_API_URL=/api` hace que axios apunte a la ruta relativa `/api/*`, y Vite la proxea a `http://localhost:8000` (ver `vite.config.js`). Esto evita problemas de CORS en desarrollo.

Para **producción** (deploy en AWS), sobreescribir:
```
VITE_API_URL=https://api-medistock.example.com/api
```

---

## Estructura del proyecto

```
medistockFrontEnd/
├── index.html
├── package.json
├── vite.config.js          # Proxy /api → localhost:8000
├── .env.development        # VITE_API_URL=/api
└── src/
    ├── main.jsx            # Entrypoint React
    ├── App.jsx             # Router + guards (RutaProtegida, RutaSoloCompradores)
    ├── index.css           # Variables CSS globales + clases base (btn, card, badge, alert, ...)
    │
    ├── components/         # Componentes compartidos UI
    │   ├── Navbar.jsx      # Header con búsqueda, carrito, menú
    │   └── Footer.jsx
    │
    ├── context/            # Estado global
    │   ├── AuthContext.jsx   # JWT, perfil, login/logout, rol
    │   └── CarritoContext.jsx # Items + tipo despacho + cálculo IVA + permisos
    │
    ├── services/           # Cliente HTTP
    │   └── api.js          # Axios + interceptors + endpoints + normalizadores
    │
    ├── utils/              # Helpers puros
    │   ├── permisos.js              # puedeComprar(rol), razonNoCompra(rol)
    │   ├── gruposCatalogo.js        # Mapeo categorías → grupos navbar (medicamentos/insumos/bienestar)
    │   ├── catalogoEnriquecido.js   # Mapeo SKU → nombre real (Paracetamol, etc.) + dosis + uso
    │   └── cotizacionStorage.js     # Persiste cotización Chilexpress por pedido en localStorage
    │
    └── pages/              # Vistas por ruta, cada una con su .jsx + .css
        ├── HomePage / CatalogoPage / ProductoDetallePage
        ├── CarritoPage / ConfirmacionPedidoPage / ResultadoPagoPage / WebpayResultadoPage
        ├── LoginPage / RegistroPage / PerfilPage / ContactoPage
        ├── PanelPage              # Hub del trabajador (pedidos, pagos, despachos, DTE, inventario)
        ├── DashboardAnalistaPage  # Métricas y KPIs financieros
        ├── PedidoDetallePage / TrackingPage / ComprobanteDtePage
        └── ComprasProveedorPage / TrasladosInventarioPage / IntegracionesPage /
            ConciliacionPagosPage / ConveniosInstitucionalesPage / GuiasDespachoPage /
            AprobacionesB2BPage
```

---

## Arquitectura

### Routing
Definido en `App.jsx`. Tres tipos de ruta:

1. **Públicas** — Inicio, Catálogo, Detalle de producto, Contacto, Login, Registro.
2. **`RutaProtegida`** — Requiere usuario autenticado, redirige a `/login` si no.
3. **`RutaSoloCompradores`** — Requiere usuario autenticado **y** rol con permiso de compra (ver [permisos](#roles-y-permisos)). Redirige a `/panel` si no.

```jsx
<Route path="/carrito" element={<RutaSoloCompradores><CarritoPage /></RutaSoloCompradores>} />
<Route path="/panel"   element={<RutaProtegida><PanelPage /></RutaProtegida>} />
```

### Estado global

- **`AuthContext`** mantiene `usuario`, `cargando`, y expone `iniciarSesion`, `cerrarSesion`, `refrescarPerfil`, `actualizarPerfilUsuario`. Persiste el JWT en `localStorage` (`access_token`, `refresh_token`, `usuario`).

- **`CarritoContext`** mantiene `items` y `tipoDespacho` (con persistencia en `localStorage`), y expone `agregarItem`, `quitarItem`, `actualizarCantidad`, `vaciarCarrito`, `calcularResumen` (que devuelve subtotal, descuento institucional, IVA 19%, despacho y total).

### Servicios HTTP
`services/api.js` exporta una instancia axios con:

- **Request interceptor**: agrega `Authorization: Bearer <access_token>` automáticamente (salvo rutas de login).
- **Response interceptor**: si recibe 401 y hay `refresh_token`, intenta refrescar y reintenta el request. Si falla, limpia el storage.
- **Normalizadores**: `normalizarProducto`, `normalizarRespuestaPedido`, `normalizarInventarioResumen` — convierten respuestas del backend a estructuras uniformes para el frontend.
- **Mocks demo**: algunos endpoints (convenios, DTE, aprobaciones B2B) devuelven `respuestaDemo()` mientras el backend no expone esas rutas en la URL pública.

---

## Roles y permisos

Roles que maneja el sistema (resueltos en `AuthContext.resolverRolFrontend()`):

| Rol interno | Etiqueta UI | Origen |
|---|---|---|
| `admin` | Administrador | `is_staff=True` o grupo "admin" |
| `cliente_b2c` | Paciente | rol=CLIENTE, tipo_cliente=PARTICULAR |
| `cliente_b2b` | Cliente B2B | rol=CLIENTE, tipo_cliente=INSTITUCIONAL |
| `ejecutivo` | Ejecutivo | grupo "ejecutivo"/"ventas" |
| `operador` | Operador | grupo "operador"/"logistica" |
| `analista` | Analista | grupo o cargo "analista"/"finanzas" |
| `trabajador` | Trabajador | rol=TRABAJADOR sin match más específico |

### Quién puede comprar
Centralizado en `utils/permisos.js`:

```js
const ROLES_PUEDEN_COMPRAR = new Set([
  'cliente', 'cliente_b2c', 'cliente_b2b',
  'admin', 'ejecutivo',
])
```

**Excluidos explícitamente:** `analista`, `operador`, `trabajador`. Para esos roles:
- El icono Carrito y las pestañas comerciales del navbar se ocultan
- Las rutas `/carrito`, `/confirmar-pedido`, `/resultado-pago/:id` redirigen a `/panel`
- El botón "Agregar" en Catálogo/Home/Detalle queda `disabled` con tooltip explicativo
- `CarritoContext.agregarItem` rechaza con `console.warn` cualquier llamada programática

### Quién accede al panel financiero
`DashboardAnalistaPage` está disponible para `analista` y `admin`. La condición se evalúa en `PanelPage.jsx` (`ROLES_DASHBOARD_ANALISTA`).

---

## Páginas

### Públicas
| Ruta | Página | Descripción |
|---|---|---|
| `/` | HomePage | Hero rotativo, beneficios, categorías, productos destacados |
| `/catalogo` | CatalogoPage | Listado con búsqueda, filtros por categoría/grupo, ordenamiento |
| `/producto/:codigo` | ProductoDetallePage | Ficha del producto + stock por sucursal + agregar al carrito |
| `/contacto` | ContactoPage | Formulario con motivos + envío vía `mailto:` |
| `/login` | LoginPage | JWT + accesos rápidos demo (solo en `import.meta.env.DEV`) |
| `/registro` | RegistroPage | Alta de cliente particular o institucional |
| `/webpay/resultado` | WebpayResultadoPage | Retorno de Transbank (sin auth) |

### Solo autenticados
| Ruta | Página | Visible para |
|---|---|---|
| `/panel` | PanelPage | Todos los roles (contenido cambia según rol) |
| `/perfil` | PerfilPage | Todos. Lee `getPerfil()`, soporta cliente y trabajador |
| `/pedidos/:id` | PedidoDetallePage | Dueño del pedido + admin/ejecutivo |
| `/tracking/:despachoId` | TrackingPage | Dueño del pedido + roles operativos |
| `/dte/:id/comprobante` | ComprobanteDtePage | Cliente, admin, analista |

### Solo compradores (clientes / admin / ejecutivo)
| Ruta | Página |
|---|---|
| `/carrito` | CarritoPage (selector despacho domicilio/retiro, desglose IVA, descuento B2B; envío se cotiza en el siguiente paso) |
| `/confirmar-pedido` | ConfirmacionPedidoPage |
| `/resultado-pago/:pedidoId` | ResultadoPagoPage |

### Sub-páginas del panel
Cada una protegida por matrices de rol declaradas en `PanelPage.jsx`:

| Ruta | Roles |
|---|---|
| `/panel/compras-proveedor` | admin, operador, analista |
| `/panel/traslados-inventario` | admin, operador, analista |
| `/panel/integraciones` | admin, operador, analista |
| `/panel/conciliacion-pagos` | admin, analista |
| `/panel/convenios-institucionales` | admin, ejecutivo, analista |
| `/panel/guias-despacho` | admin, operador, analista |
| `/panel/aprobaciones-b2b` | admin, ejecutivo, analista |
| `/panel/dashboard-analista` | admin, analista |

---

## Endpoints consumidos

Definidos como funciones en `services/api.js`. Base URL: `import.meta.env.VITE_API_URL`.

| Módulo backend | Endpoint clave | Uso en frontend |
|---|---|---|
| **Auth** | `POST /accounts/login/`, `POST /accounts/login/refresh/`, `GET /accounts/perfil/me/`, `POST /accounts/registro/cliente/` | LoginPage, RegistroPage, AuthContext |
| **Productos** | `GET /inventory/catalogo/`, `GET /inventory/public/productos/:codigo/`, `GET /inventory/public/categorias/` | HomePage, CatalogoPage, ProductoDetallePage |
| **Inventario** | `GET /inventory/inventarios/`, `GET /inventory/lotes/`, `GET /inventory/movimientos/` | PanelPage tab Inventario, DashboardAnalistaPage |
| **Pedidos** | `POST /orders/pedidos/`, `GET /orders/pedidos/mis-pedidos/`, `GET /orders/pedidos/todos/`, `POST /orders/pedidos/:id/aprobar/` | ConfirmacionPedidoPage, PanelPage, PedidoDetallePage |
| **Pagos / Webpay** | `POST /payments/webpay/iniciar/`, `GET /payments/webpay/commit/`, `GET /payments/mis-pagos/` | ResultadoPagoPage, WebpayResultadoPage |
| **Logística** | `GET /logistics/envios/:pedidoId/tracking/`, `POST /logistics/cotizar/` | TrackingPage, ConfirmacionPedidoPage |
| **Ubicaciones** | `GET /locations/regions/`, `GET /locations/comunas/` | RegistroPage, PerfilPage |

Algunas funciones (`obtenerConveniosInstitucionales`, `obtenerDocumentosTributarios`, `obtenerAprobacionesB2B`, etc.) usan `respuestaDemo()` con data mockeada en frontend mientras el backend no expone esas URLs públicamente. Cuando el backend agregue las rutas reales, basta con reemplazar la implementación dentro de `api.js`.

---

## Patrones y convenciones

### Estructura de página
Cada página vive en `pages/` con dos archivos:
- `NombrePage.jsx` — lógica + JSX
- `NombrePage.css` — estilos scoped al markup de esa página

Imports recomendados al inicio:
```jsx
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fn } from '../services/api'
import './NombrePage.css'
```

### Clases CSS compartidas
Definidas en `index.css`:
- **Layout**: `.page-container`, `.flex-between`, `.grid-4`, `.section-title`
- **Botones**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`, `.btn-sm`, `.btn-lg`, `.btn-block`
- **Cards / superficies**: `.card`, `.alert`, `.alert-error|success|info|warning`
- **Badges**: `.badge`, `.badge-success|warning|danger|info|secondary`
- **Forms**: `.form-group`, `.field`, `.spinner`

### Validación de permisos (4 capas)
Para evitar que un rol no autorizado dispare acciones reservadas:

1. **Navbar** oculta enlaces (`{usuarioPuedeComprar && <Link ... />}`)
2. **Rutas** con `RutaSoloCompradores` redirigen
3. **UI de página** deshabilita botones (`disabled={!usuarioPuedeComprar}`) con tooltip
4. **Estado** (`CarritoContext.agregarItem`) verifica y rechaza con `console.warn`

### Manejo de errores HTTP
- 401 → interceptor de axios intenta refresh; si falla, logout silencioso
- Otros → cada página atrapa con try/catch y muestra `<div className="alert alert-error">`

### Formato chileno
- Precios: `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })`
- Fechas: `toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })`
- IVA: 19% incluido en precio del producto (constante `IVA` en `CarritoContext.jsx`)
- Costo de despacho: **no hardcoded**. Se cotiza con Chilexpress en `ConfirmacionPedidoPage` según comuna + peso real del pedido

---

## Capa cosmética del catálogo

Los productos del backend tienen SKUs genéricos (`SKU-TEST-1`, …). Para que la UI muestre nombres reales sin tocar la BD, hay dos módulos en `utils/`:

### `gruposCatalogo.js`
Agrupa las categorías reales del backend en los 3 nodos del navbar:
- **Medicamentos** ← categoria_test_1..4
- **Insumos médicos** ← categoria_test_5..8
- **Bienestar** ← categoria_test_9..10

Match tolerante (ignora acentos/case). Si el backend luego agrega categorías reales como "Medicamentos", basta con que el nombre coincida y se incluyen automáticamente.

### `catalogoEnriquecido.js`
Mapeo `SKU → { nombre, dosis, tipo, uso }`. Se aplica al final de `normalizarProducto()` en `api.js`, sobrescribiendo nombre y descripción. También usa `nombreEnriquecido(sku, fallback)` en las tablas de inventario.

Ejemplo:
```js
'SKU-TEST-1': {
  nombre: 'Paracetamol',
  dosis: '500mg',
  tipo: 'Medicamento · Analgésico',
  uso: 'Analgésico y antipirético básico…',
}
```

Si el backend en el futuro devuelve los nombres reales, basta con borrar la entrada del mapeo correspondiente y el normalizador usará lo que venga del backend.

---

## Flujo del costo de despacho (cotización Chilexpress)

El costo de envío **no está hardcoded** en el frontend. El flujo real es:

1. **`CarritoPage`** muestra al cliente la opción "A domicilio" o "Retiro en sucursal".
   - Si elige domicilio, no se muestra monto: dice *"Cotización Chilexpress al confirmar"*.
   - El total visible en el carrito es `subtotal − descuento` (sin envío).

2. **`ConfirmacionPedidoPage`** (checkout) hace la cotización real:
   - Toma la dirección registrada del usuario (comuna + región).
   - Itera por las sucursales con stock suficiente para el pedido completo.
   - Por cada sucursal candidata, llama a `cotizarDespacho()` → `POST /logistics/cotizar/` con:
     ```js
     { sucursal_id, county_code_destino, productos: [{ peso_mg, largo_mm, ancho_mm, alto_mm, cantidad, valor_unitario }] }
     ```
   - El backend usa `py3dbp` para embalar el pedido en cajas y consulta el API real de Chilexpress.
   - La respuesta trae `servicios_disponibles` (EXPRESS, PRIORITARIO, etc.) con precio real por cada uno.
   - El frontend muestra el desplegable de servicios y auto-selecciona el más barato.

3. **Al confirmar el pedido**, el frontend llama `crearPedido()` y, **apenas el backend responde con `pedido.id`**, guarda en `localStorage` (vía `utils/cotizacionStorage.js`):
   ```js
   {
     costo: 5661,
     servicio: 'EXPRESS',
     codigo: 3,
     peso_kg: '0.53',
     destino: 'Providencia, Region Metropolitana',
     total_con_envio: 7141
   }
   ```
   El backend **no** tiene un campo `costo_envio` en el modelo Pedido, por eso la persistencia frontend es necesaria.

4. **`ResultadoPagoPage` y `PedidoDetallePage`** leen `obtenerCotizacionPedido(pedidoId)` y muestran:
   - Línea "Envío (Chilexpress EXPRESS) — $5.661"
   - Total a pagar real: `pedido.total + costo_envio`
   - Detalle peso final, código servicio y destino

5. El **monto que se envía al pasarela de pago** (Webpay/simulado) es `totalConEnvio` — el cliente paga el monto correcto.

**Limitación conocida**: cuando el backend agregue un campo `costo_envio` al modelo Pedido, este storage local puede eliminarse. La lógica de lectura ya hace fallback: si `pedido.costo_envio` viene del backend, se usa ese; si no, se usa el guardado en localStorage.

---

## Cómo agregar una nueva página

1. Crea `src/pages/MiNuevaPage.jsx` y `MiNuevaPage.css`
2. Registra la ruta en `App.jsx`:
   ```jsx
   import MiNuevaPage from './pages/MiNuevaPage'
   // ...
   <Route path="/mi-nueva-ruta" element={<RutaProtegida><MiNuevaPage /></RutaProtegida>} />
   ```
3. Si requiere un nuevo endpoint, agrégalo a `services/api.js` como función exportada:
   ```js
   export const obtenerCosa = (id) => api.get(`/cosas/${id}/`)
   ```
4. Si necesitas restringir por rol, usa `utils/permisos.js` o agrega un nuevo guard tipo `RutaSoloAdmin`.
5. Si quieres que aparezca como enlace en el panel, agrega un botón en `panel-acciones-rapidas` dentro de `PanelPage.jsx` con la matriz de roles correspondiente.

---

## Troubleshooting

### "Credenciales incorrectas" en login aunque sean correctas
Verifica que axios use el proxy de Vite (no la URL absoluta). El archivo `.env.development` debe existir con `VITE_API_URL=/api`. Sin eso, axios va directo a `http://localhost:8000` y CORS rechaza la conexión, lo cual el frontend traduce como "credenciales incorrectas".

### El panel del analista muestra "Sin permisos"
El backend rechaza al rol Analista en algunos endpoints de pedidos/pagos. Es un tema de `permission_classes` en los viewsets del backend, no del frontend.

### HMR no actualiza después de cambios
- Verifica que no hay errores en la consola del terminal donde corre `npm run dev`
- Recarga la pestaña con `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
- Si persiste, detén el dev server y vuelve a correrlo

### Productos sin imagen muestran iniciales gigantes
Es el comportamiento por diseño cuando `imagen_url` viene `null` desde el backend. Para cargar imágenes reales hay que llenarlas en la BD vía endpoint (responsabilidad del backend).

---

## Proyecto hermano: Farmacia Cruz Amarilla

En `../farmaciaCruzAmarilla/` hay una segunda app frontend, conceptualmente independiente. Simula una farmacia externa que **consume el API público de MEDISTOCK** como si fuera un cliente B2B. Sirve para demostrar que el API es reutilizable por terceros. Ver su propio README.

| Aspecto | MEDISTOCK (este) | Cruz Amarilla |
|---|---|---|
| Puerto dev | 5173 | 5174 |
| Auth | Sí (JWT) | No |
| Carrito | Sí | No |
| Endpoints | Públicos + privados | Solo públicos |
| Identidad visual | Azul corporativo | Amarillo cálido |
