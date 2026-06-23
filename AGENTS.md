# AGENTS.md

Este proyecto es una versión individual de **Medistock** para la asignatura **Integración de Plataformas**.

El objetivo es construir una versión funcional y controlada del sistema, priorizando un flujo completo demostrable:
catálogo → detalle de producto → carrito → checkout → pedido → pago/logística simulada o integrada.

---

## Estado actual del proyecto

### Backend

Backend propio en **Django + Django REST Framework**.

Actualmente desplegado en **Railway** con base de datos **MySQL Railway**.

Endpoints confirmados funcionando:

* `GET /api/inventory/catalogo/`
* `GET /api/inventory/public/productos/<codigo>/`
* `GET /api/inventory/public/categorias/`
* `POST /api/accounts/login/`
* `POST /api/accounts/login/refresh/`
* `GET /api/accounts/perfil/me/`
* `POST /api/accounts/logout/`

Notas importantes:

* El backend ya despliega correctamente en Railway.
* MySQL ya está conectado.
* Las migraciones ya funcionan.
* CORS ya permite consumir desde frontend local.
* No cambiar configuración de Railway, MySQL, CORS, `ALLOWED_HOSTS`, `wsgi.py`, `gunicorn` ni comandos de despliegue sin justificación explícita.

### Frontend

Frontend en **React + Vite**.

Actualmente consume el backend remoto de Railway.

El Home ya muestra productos reales desde:

* `/api/inventory/catalogo/`
* `/api/inventory/public/categorias/`

El frontend viene de una versión anterior más grande, por lo que puede contener rutas o servicios que todavía no existen en el backend individual.

---

## Reglas generales de trabajo

Trabajar siempre con cambios pequeños y controlados.

Antes de editar cualquier archivo:

1. Revisar el problema.
2. Proponer un plan breve.
3. Indicar qué archivos se tocarán.
4. Esperar confirmación si se tocarán más de 3 archivos.
5. No mezclar backend y frontend en una misma tarea salvo que se pida explícitamente.

Cada tarea debe terminar con un resumen breve:

* Archivos modificados.
* Qué se cambió.
* Cómo probarlo.
* Pendientes si existen.

---

## Restricciones

* No refactorizar todo el proyecto sin permiso.
* No instalar dependencias nuevas sin justificar.
* No eliminar funcionalidades existentes sin avisar.
* No tocar backend si la tarea solicitada es frontend.
* No tocar frontend si la tarea solicitada es backend.
* No modificar configuración de despliegue Railway si la tarea no lo requiere.
* No crear endpoints masivos “por si acaso”.
* No inventar integraciones reales si no hay credenciales o sandbox confirmado.
* No dejar datos mock si ya existe endpoint real funcionando.
* No duplicar archivos, servicios ni componentes.
* No romper rutas que ya responden 200.
* Mantener respuestas breves y orientadas a la tarea.
* Priorizar solución mínima funcional.

---

## Prioridades funcionales

La prioridad actual del proyecto es cerrar un flujo completo demostrable:

1. Home con productos reales.
2. Catálogo de productos.
3. Detalle de producto por código/SKU.
4. Agregar producto al carrito.
5. Carrito funcional.
6. Checkout básico.
7. Creación de pedido.
8. Pago simulado o Webpay sandbox si corresponde.
9. Logística/cotización simulada o integración externa acordada.
10. CRUD básico de productos en administración.
11. Pruebas unitarias mínimas.

---

## Correcciones visuales solicitadas por el profesor

Aplicar gradualmente:

* Mejorar diseño general.
* Habilitar recepción de receta médica cuando el producto lo requiera.
* Cambiar botones azules por una paleta verde/blanco coherente con Medistock.
* Usar imágenes de producto bien cuadradas o consistentes.
* Si no hay imagen, usar placeholder limpio con marca Medistock.
* Generar o mejorar logo de Medistock.
* Evitar que el index se vea vacío o “pelado”.
* Mantener precios en formato chileno.
* Validar campos cuando corresponda, incluyendo RUT si se usa.

---

## Backend

El backend debe mantenerse simple, propio y controlado.

Objetivo mínimo:

* Autenticación básica con JWT.
* Productos.
* Categorías.
* Detalle por código/SKU.
* Pedidos.
* Flujo de compra.
* Integración externa o simulada.
* Pago simulado o integración de pago si corresponde.
* Pruebas unitarias mínimas.

Reglas backend:

* Revisar modelos, serializers y vistas antes de agregar campos.
* No crear tablas nuevas si se puede resolver con campos existentes.
* Si se agrega un campo nuevo, crear migración.
* No modificar endpoints existentes que ya funcionan.
* Mantener compatibilidad con Railway y MySQL.
* Evitar endpoints innecesarios.
* Documentar cómo probar cada endpoint nuevo.

---

## Frontend

El frontend debe rescatar vistas útiles del proyecto anterior y adaptarlas al backend individual.

Objetivos:

* Mantener diseño funcional.
* Consumir endpoints reales.
* Limpiar dependencias del backend anterior.
* Adaptar rutas a la versión individual.
* Evitar errores por endpoints inexistentes.
* Manejar respuestas 401 sin romper vistas públicas.
* Manejar respuestas vacías sin romper la interfaz.

Reglas frontend:

* Antes de crear datos mock, revisar si existe endpoint real.
* Si un endpoint no existe, informar antes de modificar.
* Normalizar respuestas cuando sea necesario:

  * array directo: `[...]`
  * paginado: `{ results: [...] }`
  * objeto: `{ productos: [...] }`
* No cambiar diseño completo sin permiso.
* Priorizar que Home, Catálogo, Detalle y Carrito funcionen bien.

---

## Integraciones

Para la asignatura se consideran relevantes:

* API propia de productos.
* Pago Webpay, MercadoPago o simulación controlada.
* Logística Chilexpress, Shippo, tracking simulado o API acordada.

Reglas:

* No implementar una integración real sin credenciales o sandbox confirmado.
* Si no hay sandbox, crear flujo simulado pero presentable.
* El flujo debe ser demostrable en la presentación.
* Documentar claramente si una integración está en modo sandbox o simulada.

---

## Pruebas

Priorizar pruebas unitarias sobre cantidad de pruebas.

Casos sugeridos:

* Producto no puede tener precio negativo.
* Catálogo devuelve productos activos.
* Categorías públicas devuelven categorías únicas.
* Detalle de producto por código existente.
* Detalle de producto inexistente devuelve 404.
* Pedido no se crea con carrito vacío.
* Producto que requiere receta debe exigir receta en checkout.

---

## Forma esperada de respuesta

Para cada tarea, responder con:

1. Plan breve.
2. Archivos que se tocarán.
3. Cambios aplicados.
4. Cómo probar.
5. Pendientes.

Mantener los cambios pequeños y verificables.
