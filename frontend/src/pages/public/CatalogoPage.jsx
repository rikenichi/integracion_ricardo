import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCategorias, obtenerProductosCompatibles } from '../../services/api'
import { useCarrito } from '../../context/CarritoContext'
import { useAuth } from '../../context/AuthContext'
import Footer from '../../components/Footer'
import { filtrarPorGrupo, obtenerGrupo } from '../../utils/gruposCatalogo'
import { puedeComprar, razonNoCompra } from '../../utils/permisos'
import { obtenerPrecioProducto } from '../../utils/format'
import './CatalogoPage.css'

function formatPrecio(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
}

const bannersCatalogo = [
  {
    titulo: 'Insumos medicos con stock conectado',
    texto: 'Consulta disponibilidad, agrega productos y confirma tu pedido desde un solo flujo.',
    badge: 'Catalogo integrado',
  },
  {
    titulo: 'Despacho cotizado antes del pago',
    texto: 'El checkout calcula cobertura logistica usando las sucursales con stock suficiente.',
    badge: 'Logistica real',
  },
  {
    titulo: 'Atencion para B2C y B2B',
    texto: 'Pacientes e instituciones comparten el mismo catalogo con precios y beneficios diferenciados.',
    badge: 'Clientes B2C/B2B',
  },
]

function getStockBadge(producto) {
  const disponible = Number(producto.stock_disponible || 0)
  if (disponible > 10) return { label: 'Disponible', clase: 'badge-success' }
  if (disponible > 0) return { label: 'Stock bajo', clase: 'badge-warning' }
  return { label: 'Sin stock', clase: 'badge-danger' }
}

export default function CatalogoPage() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [filtros, setFiltros] = useState({ search: '', categoria: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bannerActivo, setBannerActivo] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const grupoActivoId = searchParams.get('grupo')
  const grupoActivo = obtenerGrupo(grupoActivoId)
  const { agregarItem } = useCarrito()
  const { usuario } = useAuth()
  const esB2B = usuario?.rol === 'cliente_b2b'
  const usuarioPuedeComprar = puedeComprar(usuario)
  const mensajeNoCompra = razonNoCompra(usuario)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBannerActivo((actual) => (actual + 1) % bannersCatalogo.length)
    }, 5200)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    getCategorias().then(r => setCategorias(r.data.results || r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setFiltros(f => ({ ...f, search: searchParams.get('search') || '' }))
  }, [searchParams])

  // Productos filtrados localmente por grupo del navbar (si aplica).
  const productosVisibles = useMemo(() => {
    if (!grupoActivoId) return productos
    return filtrarPorGrupo(productos, grupoActivoId)
  }, [productos, grupoActivoId])

  const limpiarGrupo = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('grupo')
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = {}
    if (filtros.search) params.search = filtros.search
    if (filtros.categoria) params.categoria = filtros.categoria

    obtenerProductosCompatibles(params)
      .then(data => setProductos(data))
      .catch(() => setError('No se pudo cargar el catálogo.'))
      .finally(() => setLoading(false))
  }, [filtros])

  return (
    <>
      <div className="page-container">
      <section className="catalogo-hero" aria-label="Beneficios del catalogo MEDISTOCK">
        <div className="catalogo-hero-copy">
          <span className="catalogo-eyebrow">{bannersCatalogo[bannerActivo].badge}</span>
          <h1>{bannersCatalogo[bannerActivo].titulo}</h1>
          <p>{bannersCatalogo[bannerActivo].texto}</p>
          <div className="catalogo-hero-actions">
            <span>Pago seguro</span>
            <span>Stock por sucursal</span>
            <span>Despacho integrado</span>
          </div>
        </div>
        <div className="catalogo-hero-metrics">
          <div><strong>{productosVisibles.length}</strong><span>productos visibles</span></div>
          <div><strong>{categorias.length}</strong><span>categorias</span></div>
          <div><strong>{esB2B ? 'B2B' : 'B2C'}</strong><span>perfil de precio</span></div>
        </div>
        <div className="catalogo-dots" aria-hidden="true">
          {bannersCatalogo.map((banner, index) => (
            <button
              key={banner.titulo}
              className={index === bannerActivo ? 'activo' : ''}
              type="button"
              onClick={() => setBannerActivo(index)}
              aria-label={`Ver banner ${index + 1}`}
            />
          ))}
        </div>
      </section>

      <div className="catalogo-header">
        <h1 className="page-title">
          {grupoActivo ? (
            <>
              <span style={{ marginRight: 8 }}>{grupoActivo.icono}</span>
              {grupoActivo.label}
            </>
          ) : (
            'Catálogo de Productos'
          )}
        </h1>
        {esB2B && <span className="badge badge-info">Precios B2B institucional</span>}
      </div>

      {grupoActivo && (
        <div className="grupo-chip card">
          <div>
            <strong>{grupoActivo.label}</strong>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              {grupoActivo.descripcion} · {productosVisibles.length} producto{productosVisibles.length === 1 ? '' : 's'} encontrado{productosVisibles.length === 1 ? '' : 's'}.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={limpiarGrupo}>
            ✕ Ver todo el catálogo
          </button>
        </div>
      )}

      <div className="filtros card">
        <input
          type="text" placeholder="Buscar producto..."
          value={filtros.search}
          onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))}
        />
        <select
          value={filtros.categoria}
          onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : productosVisibles.length === 0 ? (
        <div className="text-center text-muted mt-3">
          {grupoActivo
            ? `No hay productos en ${grupoActivo.label} con los filtros actuales.`
            : 'No se encontraron productos.'}
        </div>
      ) : (
        <div className="grid-4">
          {productosVisibles.map(p => (
            <div key={p.id} className="producto-card card">
              {(() => {
                const stockBadge = getStockBadge(p)
                return (
                  <span className={`producto-stock-badge badge ${stockBadge.clase}`}>
                    {stockBadge.label}
                  </span>
                )
              })()}
              <div className="producto-img">
                {p.imagen_url
                  ? <img src={p.imagen_url} alt={p.nombre} />
                  : <span className="producto-icon">🏥</span>
                }
              </div>
              <div className="producto-body">
                <span className="producto-codigo text-muted">{p.codigo}</span>
                <h3 className="producto-nombre">{p.nombre}</h3>
                <p className="producto-categoria text-muted">
                  {p.tipo_producto || p.categoria_nombre}
                </p>
                <p className="producto-descripcion text-muted">
                  {p.detalle_uso || p.descripcion || 'Producto disponible para compra en Medistock.'}
                </p>
                <div className="producto-footer">
                  <div className="producto-precio">
                    {formatPrecio(obtenerPrecioProducto(p, esB2B))}
                    {esB2B && (
                      <span className="text-muted" style={{fontSize:'0.75rem', display:'block'}}>
                        + 10% descuento institucional
                      </span>
                    )}
                  </div>
                  <div className="producto-badges">
                    {p.requiere_receta && (
                      <span className="badge badge-warning">Requiere receta</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="producto-acciones">
                  <Link to={`/producto/${p.id}`} className="btn btn-secondary btn-sm">
                    Ver detalle
                  </Link>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => agregarItem(p)}
                    disabled={Number(p.stock_disponible || 0) <= 0 || !usuarioPuedeComprar}
                    title={!usuarioPuedeComprar ? mensajeNoCompra : ''}
                  >
                    Agregar
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      <Footer />
    </>
  )
}
