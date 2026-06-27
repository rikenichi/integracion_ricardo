import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  crearProducto,
  ingresarProductoInventario,
  listarCategoriasAdmin,
  listarMarcasAdmin,
  listarProductosAdmin,
} from '../../services/api'
import './AdminProductosPage.css'

const ROLES_PERMITIDOS = ['admin', 'operador', 'analista']
const MODO_SIMPLE = 'simple'
const MODO_STOCK = 'stock'

const FORM_INICIAL = {
  sku: '',
  nombre: '',
  descripcion: '',
  valor_unitario: '',
  marca_id: '',
  categoria_ids: [],
  unidad_medida: 'unidad',
  largo_mm: '',
  ancho_mm: '',
  alto_mm: '',
  peso_mg: '',
  volumen_ml: '',
  registro_sanitario: '',
  imagen_url: '',
  requiere_receta: false,
  requiere_control_vencimiento: true,
  activo: true,
  es_caja: false,
  codigo_lote: '',
  fecha_elaboracion: '',
  fecha_vencimiento: '',
  sucursal_id: '',
  cantidad: '',
  stock_critico: '0',
  motivo: 'Ingreso inicial',
  observacion: '',
}

function obtenerLista(data) {
  return data?.results || data || []
}

function formatPrecio(valor) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(Number(valor || 0))
}

function extraerMensajeError(data) {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(extraerMensajeError).filter(Boolean).join(' ')

  const partes = Object.entries(data).map(([campo, valor]) => {
    const mensaje = extraerMensajeError(valor)
    return mensaje ? `${campo}: ${mensaje}` : ''
  })

  return partes.filter(Boolean).join(' ')
}

function mensajeErrorApi(error, fallback) {
  if (!error.response) return 'No fue posible conectar con el backend.'
  if (error.response.status === 403) return 'No tienes permisos para consultar esta informacion.'
  if (error.response.status === 404) return 'No se encontro informacion asociada.'
  if (error.response.status === 409) return extraerMensajeError(error.response.data) || fallback
  if (error.response.status === 500) return 'Error del servidor. Intenta nuevamente.'

  const mensaje = extraerMensajeError(error.response.data)
  if (/sucursal/i.test(mensaje) && /(no existe|invalid pk|does not exist|pk)/i.test(mensaje)) {
    return 'La sucursal indicada no existe.'
  }
  if (/categoria|categor/i.test(mensaje) && /(no existe|invalid pk|does not exist|pk)/i.test(mensaje)) {
    return 'Una de las categorias seleccionadas no existe.'
  }
  if (/lote/i.test(mensaje) && /(exist|unique|duplic)/i.test(mensaje)) {
    return 'El lote ya existe. El backend puede recuperarlo y sumar stock si corresponde.'
  }
  return mensaje || fallback
}

function numeroOpcional(valor) {
  if (valor === '' || valor === null || valor === undefined) return 0
  return Number(valor)
}

function obtenerFechaProducto(producto = {}) {
  return (
    producto.created_at ||
    producto.fecha_creacion ||
    producto.creado_en ||
    producto.created ||
    producto.fecha_registro ||
    null
  )
}

function ordenarProductosRecientes(productos = []) {
  return [...productos]
    .map((producto, index) => ({ producto, index }))
    .sort((a, b) => {
      const fechaA = obtenerFechaProducto(a.producto)
      const fechaB = obtenerFechaProducto(b.producto)

      if (fechaA || fechaB) {
        const tiempoA = fechaA ? new Date(fechaA).getTime() : 0
        const tiempoB = fechaB ? new Date(fechaB).getTime() : 0
        if (tiempoA !== tiempoB) return tiempoB - tiempoA
      }

      const idA = Number(a.producto.id)
      const idB = Number(b.producto.id)
      if (!Number.isNaN(idA) && !Number.isNaN(idB) && idA !== idB) {
        return idB - idA
      }

      return a.index - b.index
    })
    .map(({ producto }) => producto)
}

function normalizarProducto(producto = {}) {
  return {
    ...producto,
    sku: producto.sku || '-',
    marca_nombre: producto.marca?.nombre || producto.marca_nombre || '-',
    categorias_texto: (producto.categorias || [])
      .map((item) => item.categoria?.nombre || item.nombre)
      .filter(Boolean)
      .join(', '),
  }
}

export default function AdminProductosPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [marcas, setMarcas] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [modoCreacion, setModoCreacion] = useState(MODO_SIMPLE)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [erroresForm, setErroresForm] = useState({})

  const rol = String(usuario?.rol || '').toLowerCase()
  const autorizado = ROLES_PERMITIDOS.includes(rol)
  const esModoStock = modoCreacion === MODO_STOCK

  const productosNormalizados = useMemo(
    () => productos.map(normalizarProducto),
    [productos],
  )

  const cargarDatos = async () => {
    setLoading(true)
    setError('')
    try {
      const [productosR, categoriasR, marcasR] = await Promise.all([
        listarProductosAdmin(),
        listarCategoriasAdmin(),
        listarMarcasAdmin(),
      ])
      setProductos(ordenarProductosRecientes(obtenerLista(productosR.data)))
      setCategorias(obtenerLista(categoriasR.data))
      setMarcas(obtenerLista(marcasR.data))
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudieron cargar los datos de productos.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  const setCampo = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }))
    if (erroresForm[campo]) {
      setErroresForm((actual) => ({ ...actual, [campo]: '' }))
    }
    if (error) setError('')
    if (exito) setExito('')
  }

  const setCategoriasSeleccionadas = (event) => {
    const seleccionadas = Array.from(event.target.selectedOptions).map((option) => option.value)
    setCampo('categoria_ids', seleccionadas)
  }

  const cambiarModo = (modo) => {
    setModoCreacion(modo)
    setErroresForm({})
    setError('')
    setExito('')
  }

  const validar = () => {
    const errores = {}
    if (!form.sku.trim()) errores.sku = 'El SKU es obligatorio.'
    if (!form.nombre.trim()) errores.nombre = 'El nombre es obligatorio.'
    if (form.valor_unitario === '' || Number(form.valor_unitario) <= 0) {
      errores.valor_unitario = 'El valor unitario debe ser mayor a 0.'
    }

    if (esModoStock) {
      if (!form.categoria_ids.length) errores.categoria_ids = 'Selecciona al menos una categoria.'
      if (form.requiere_control_vencimiento && !form.codigo_lote.trim()) {
        errores.codigo_lote = 'El codigo de lote es obligatorio cuando se controla vencimiento.'
      }
      if (!form.sucursal_id || Number(form.sucursal_id) <= 0) {
        errores.sucursal_id = 'La sucursal es obligatoria y debe existir.'
      }
      if (!form.cantidad || Number(form.cantidad) <= 0) {
        errores.cantidad = 'La cantidad inicial debe ser mayor a 0.'
      }
      if (form.stock_critico === '' || Number(form.stock_critico) < 0) {
        errores.stock_critico = 'El stock critico debe ser mayor o igual a 0.'
      }
      if (form.requiere_control_vencimiento && !form.fecha_vencimiento) {
        errores.fecha_vencimiento = 'La fecha de vencimiento es obligatoria si controla vencimiento.'
      }
      if (form.fecha_elaboracion && form.fecha_vencimiento) {
        const elaboracion = new Date(`${form.fecha_elaboracion}T00:00:00`)
        const vencimiento = new Date(`${form.fecha_vencimiento}T00:00:00`)
        if (vencimiento <= elaboracion) {
          errores.fecha_vencimiento = 'La fecha de vencimiento debe ser posterior a la elaboracion.'
        }
      }
    }

    return errores
  }

  const construirPayloadSimple = () => ({
    sku: form.sku.trim(),
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    valor_unitario: Number(form.valor_unitario || 0),
    marca_id: form.marca_id ? Number(form.marca_id) : null,
    unidad_medida: form.unidad_medida.trim() || 'unidad',
    largo_mm: numeroOpcional(form.largo_mm),
    ancho_mm: numeroOpcional(form.ancho_mm),
    alto_mm: numeroOpcional(form.alto_mm),
    peso_mg: numeroOpcional(form.peso_mg),
    volumen_ml: numeroOpcional(form.volumen_ml),
    requiere_control_vencimiento: Boolean(form.requiere_control_vencimiento),
    registro_sanitario: form.registro_sanitario.trim(),
    imagen_url: form.imagen_url.trim(),
    requiere_receta: Boolean(form.requiere_receta),
    activo: Boolean(form.activo),
    es_caja: Boolean(form.es_caja),
  })

  const construirPayloadIngreso = () => {
    const payload = {
      sku: form.sku.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      valor_unitario: Number(form.valor_unitario),
      categoria_ids: form.categoria_ids.map(Number),
      unidad_medida: form.unidad_medida.trim() || 'unidad',
      largo_mm: numeroOpcional(form.largo_mm),
      ancho_mm: numeroOpcional(form.ancho_mm),
      alto_mm: numeroOpcional(form.alto_mm),
      peso_mg: numeroOpcional(form.peso_mg),
      volumen_ml: numeroOpcional(form.volumen_ml),
      requiere_control_vencimiento: Boolean(form.requiere_control_vencimiento),
      registro_sanitario: form.registro_sanitario.trim(),
      imagen_url: form.imagen_url.trim(),
      requiere_receta: Boolean(form.requiere_receta),
      es_caja: Boolean(form.es_caja),
      codigo_lote: form.codigo_lote.trim(),
      fecha_elaboracion: form.fecha_elaboracion || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      sucursal_id: Number(form.sucursal_id),
      cantidad: Number(form.cantidad),
      stock_critico: Number(form.stock_critico || 0),
      motivo: form.motivo.trim() || 'Ingreso inicial',
      observacion: form.observacion.trim(),
    }

    if (form.marca_id) payload.marca_id = Number(form.marca_id)
    return payload
  }

  const limpiarFormulario = () => {
    setForm(FORM_INICIAL)
    setErroresForm({})
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setExito('')

    const errores = validar()
    setErroresForm(errores)
    if (Object.keys(errores).length > 0) return

    setGuardando(true)
    try {
      if (esModoStock) {
        await ingresarProductoInventario(construirPayloadIngreso())
        setExito('Producto ingresado correctamente con lote, inventario y movimiento de entrada.')
      } else {
        await crearProducto(construirPayloadSimple())
        setExito('Producto creado correctamente. Si no tiene stock, aparecera como sin stock en catalogo.')
      }
      limpiarFormulario()
      setMostrarForm(false)
      await cargarDatos()
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo crear el producto. Revisa los campos obligatorios.'))
    } finally {
      setGuardando(false)
    }
  }

  if (!autorizado) {
    return (
      <div className="page-container admin-productos-page">
        <div className="admin-productos-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card admin-productos-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista esta disponible solo para roles internos autorizados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container admin-productos-page">
      <div className="admin-productos-header">
        <div>
          <p className="admin-productos-kicker">Inventario administrativo</p>
          <h1 className="page-title">Gestion de productos</h1>
          <p className="text-muted">
            Crea productos simples o ingresa productos con lote, inventario y movimiento inicial.
          </p>
        </div>
        <div className="admin-productos-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          <button className="btn btn-primary" onClick={() => setMostrarForm((valor) => !valor)}>
            {mostrarForm ? 'Cerrar formulario' : 'Nuevo producto'}
          </button>
          <button className="btn btn-secondary" onClick={cargarDatos} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {exito && <div className="alert alert-success">{exito}</div>}

      {mostrarForm && (
        <section className="card admin-productos-form-card">
          <div className="admin-productos-section-header">
            <h2>Nuevo producto</h2>
            <span>{esModoStock ? 'Ingreso con stock inicial' : 'Producto simple'}</span>
          </div>

          <div className="admin-productos-mode-selector">
            <button
              type="button"
              className={`admin-productos-mode-btn ${modoCreacion === MODO_SIMPLE ? 'is-active' : ''}`}
              onClick={() => cambiarModo(MODO_SIMPLE)}
            >
              Producto simple
            </button>
            <button
              type="button"
              className={`admin-productos-mode-btn ${modoCreacion === MODO_STOCK ? 'is-active' : ''}`}
              onClick={() => cambiarModo(MODO_STOCK)}
            >
              Producto con stock inicial
            </button>
          </div>

          <form className="admin-productos-form" onSubmit={handleSubmit}>
            <div className="admin-productos-subheader">
              <h3>Datos del producto</h3>
              <p>{esModoStock ? 'Se crea o recupera por SKU.' : 'Alta simple sin lote ni stock inicial.'}</p>
            </div>

            <label>
              SKU *
              <input value={form.sku} onChange={(e) => setCampo('sku', e.target.value)} placeholder="MED-001" />
              {erroresForm.sku && <small>{erroresForm.sku}</small>}
            </label>
            <label>
              Nombre *
              <input value={form.nombre} onChange={(e) => setCampo('nombre', e.target.value)} placeholder="Guantes nitrilo" />
              {erroresForm.nombre && <small>{erroresForm.nombre}</small>}
            </label>
            <label>
              Valor unitario *
              <input type="number" min="0" value={form.valor_unitario} onChange={(e) => setCampo('valor_unitario', e.target.value)} />
              {erroresForm.valor_unitario && <small>{erroresForm.valor_unitario}</small>}
            </label>
            <label>
              Marca
              <select value={form.marca_id} onChange={(e) => setCampo('marca_id', e.target.value)}>
                <option value="">Sin marca</option>
                {marcas.map((marca) => (
                  <option key={marca.id} value={marca.id}>{marca.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              {esModoStock ? 'Categorias *' : 'Categorias'}
              <select
                multiple={esModoStock}
                value={esModoStock ? form.categoria_ids : (form.categoria_ids[0] || '')}
                onChange={setCategoriasSeleccionadas}
              >
                {!esModoStock && <option value="">Sin categoria asociada</option>}
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                ))}
              </select>
              <small>
                {esModoStock
                  ? 'Usa Ctrl/Cmd para seleccionar mas de una categoria.'
                  : 'Solo se enviaran al usar ingreso con stock inicial.'}
              </small>
              {erroresForm.categoria_ids && <small>{erroresForm.categoria_ids}</small>}
            </label>
            <label>
              Unidad de medida
              <input value={form.unidad_medida} onChange={(e) => setCampo('unidad_medida', e.target.value)} />
            </label>
            <label className="admin-productos-form-wide">
              Descripcion
              <textarea rows="3" value={form.descripcion} onChange={(e) => setCampo('descripcion', e.target.value)} />
            </label>
            <label>
              Largo mm
              <input type="number" min="0" value={form.largo_mm} onChange={(e) => setCampo('largo_mm', e.target.value)} />
            </label>
            <label>
              Ancho mm
              <input type="number" min="0" value={form.ancho_mm} onChange={(e) => setCampo('ancho_mm', e.target.value)} />
            </label>
            <label>
              Alto mm
              <input type="number" min="0" value={form.alto_mm} onChange={(e) => setCampo('alto_mm', e.target.value)} />
            </label>
            <label>
              Peso mg
              <input type="number" min="0" value={form.peso_mg} onChange={(e) => setCampo('peso_mg', e.target.value)} />
            </label>
            <label>
              Volumen ml
              <input type="number" min="0" value={form.volumen_ml} onChange={(e) => setCampo('volumen_ml', e.target.value)} />
            </label>
            <label>
              Registro sanitario
              <input value={form.registro_sanitario} onChange={(e) => setCampo('registro_sanitario', e.target.value)} placeholder="ISP-XXXX-XXXX" />
            </label>
            <label className="admin-productos-form-wide">
              URL imagen
              <input
                type="url"
                value={form.imagen_url}
                onChange={(e) => setCampo('imagen_url', e.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="admin-productos-checks">
              <label>
                <input type="checkbox" checked={form.requiere_receta} onChange={(e) => setCampo('requiere_receta', e.target.checked)} />
                Requiere receta medica
              </label>
              <label>
                <input type="checkbox" checked={form.requiere_control_vencimiento} onChange={(e) => setCampo('requiere_control_vencimiento', e.target.checked)} />
                Control vencimiento
              </label>
              <label>
                <input type="checkbox" checked={form.activo} disabled={esModoStock} onChange={(e) => setCampo('activo', e.target.checked)} />
                Activo
              </label>
              <label>
                <input type="checkbox" checked={form.es_caja} onChange={(e) => setCampo('es_caja', e.target.checked)} />
                Es caja
              </label>
            </div>

            {esModoStock && (
              <>
                {form.requiere_control_vencimiento && (
                  <>
                    <div className="admin-productos-subheader">
                      <h3>Datos del lote</h3>
                      <p>Si el lote ya existe para el SKU, el backend puede recuperarlo y sumar stock.</p>
                    </div>
                    <label>
                      Codigo lote *
                      <input value={form.codigo_lote} onChange={(e) => setCampo('codigo_lote', e.target.value)} placeholder="L-2025-001" />
                      {erroresForm.codigo_lote && <small>{erroresForm.codigo_lote}</small>}
                    </label>
                    <label>
                      Fecha elaboracion
                      <input type="date" value={form.fecha_elaboracion} onChange={(e) => setCampo('fecha_elaboracion', e.target.value)} />
                    </label>
                    <label>
                      Fecha vencimiento
                      <input type="date" value={form.fecha_vencimiento} onChange={(e) => setCampo('fecha_vencimiento', e.target.value)} />
                      {erroresForm.fecha_vencimiento && <small>{erroresForm.fecha_vencimiento}</small>}
                    </label>
                  </>
                )}

                <div className="admin-productos-subheader">
                  <h3>Datos de inventario</h3>
                  <p>La sucursal debe corresponder a una sucursal existente.</p>
                </div>
                <label>
                  Sucursal ID *
                  <input type="number" min="1" value={form.sucursal_id} onChange={(e) => setCampo('sucursal_id', e.target.value)} />
                  <small>Debe corresponder a una sucursal existente.</small>
                  {erroresForm.sucursal_id && <small>{erroresForm.sucursal_id}</small>}
                </label>
                <label>
                  Cantidad inicial *
                  <input type="number" min="1" value={form.cantidad} onChange={(e) => setCampo('cantidad', e.target.value)} />
                  {erroresForm.cantidad && <small>{erroresForm.cantidad}</small>}
                </label>
                <label>
                  Stock critico *
                  <input type="number" min="0" value={form.stock_critico} onChange={(e) => setCampo('stock_critico', e.target.value)} />
                  {erroresForm.stock_critico && <small>{erroresForm.stock_critico}</small>}
                </label>
                <label>
                  Motivo
                  <input value={form.motivo} onChange={(e) => setCampo('motivo', e.target.value)} />
                </label>
                <label className="admin-productos-form-wide">
                  Observacion
                  <textarea rows="2" value={form.observacion} onChange={(e) => setCampo('observacion', e.target.value)} />
                </label>
              </>
            )}

            <div className="admin-productos-actions">
              <button type="button" className="btn btn-secondary" onClick={limpiarFormulario}>
                Limpiar
              </button>
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? 'Guardando...' : (esModoStock ? 'Ingresar producto con stock' : 'Crear producto')}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="spinner" />
      ) : (
        <section className="tabla-container card">
          <div className="admin-productos-section-header">
            <h2>Productos existentes</h2>
            <span>{productosNormalizados.length} productos</span>
          </div>
          {productosNormalizados.length === 0 ? (
            <p className="text-muted admin-productos-empty">No hay productos registrados.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Marca</th>
                  <th>Categorias</th>
                  <th>Precio</th>
                  <th>Unidad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {productosNormalizados.map((producto) => (
                  <tr key={producto.id}>
                    <td><span className="mono-value">{producto.sku}</span></td>
                    <td>
                      <strong>{producto.nombre}</strong>
                      {producto.descripcion && (
                        <>
                          <br />
                          <span className="text-muted">{producto.descripcion}</span>
                        </>
                      )}
                    </td>
                    <td>{producto.marca_nombre}</td>
                    <td>{producto.categorias_texto || '-'}</td>
                    <td>{formatPrecio(producto.valor_unitario)}</td>
                    <td>{producto.unidad_medida || '-'}</td>
                    <td>
                      <span className={`badge ${producto.activo ? 'badge-success' : 'badge-secondary'}`}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
