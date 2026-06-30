import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerProductosCompatibles } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useCarrito } from '../../context/CarritoContext'
import { puedeComprar, razonNoCompra } from '../../utils/permisos'
import { resolverImagenProducto } from '../../utils/imagenProducto'
import Footer from '../../components/Footer'
import './HomePage.css'

const heroSlides = [
  {
    eyebrow: 'E-commerce médico',
    title: 'Compra medicamentos e insumos médicos en línea',
    text: 'Encuentra productos para pacientes, hogares, clínicas e instituciones con una experiencia simple y conectada.',
    cta: 'Ver catálogo',
    ctaTo: '/catalogo',
    secondary: 'Crear cuenta',
    secondaryTo: '/registro',
    tone: 'slide-compra',
    imagen: '/images/banners/banner-institucional.png',
  },
  {
    eyebrow: 'Despacho integrado',
    title: 'Cotiza tu despacho antes de pagar',
    text: 'Revisa costos y disponibilidad logística durante la confirmación del pedido, antes de iniciar el pago.',
    cta: 'Armar pedido',
    ctaTo: '/catalogo',
    secondary: 'Ver carrito',
    secondaryTo: '/carrito',
    tone: 'slide-despacho',
    imagen: '/images/banners/banner-despacho.png',
  },
  {
    eyebrow: 'Pago seguro',
    title: 'Paga con seguridad usando Webpay Plus',
    text: 'Inicia el pago desde tu pedido y recibe confirmación inmediata para continuar el seguimiento.',
    cta: 'Comprar ahora',
    ctaTo: '/catalogo',
    secondary: 'Mis pedidos',
    secondaryTo: '/mis-pedidos',
    tone: 'slide-webpay',
    imagen: '/images/banners/banner-pago-seguro.png',
  },
  {
    eyebrow: 'Stock actualizado',
    title: 'Inventario visible para pacientes y clínicas',
    text: 'Consulta disponibilidad, precios y datos de producto desde el catálogo conectado en tiempo real.',
    cta: 'Explorar stock',
    ctaTo: '/catalogo',
    secondary: 'Mi panel',
    secondaryTo: '/panel',
    tone: 'slide-stock',
    imagen: '/images/banners/banner-stock.png',
  },
]

const beneficios = [
  { titulo: 'Despacho integrado', texto: 'Cotiza tu envio antes de pagar y sigue tu pedido desde tracking.' },
  { titulo: 'Pagos seguros', texto: 'Flujo conectado a Webpay Plus para compras B2C y B2B.' },
  { titulo: 'Inventario conectado', texto: 'Productos, stock y precios consumidos desde el backend.' },
]

const categoriasVisuales = [
  { titulo: 'Jeringas', texto: 'Insumos de aplicación clínica', busqueda: 'jeringa', icono: 'J', clase: 'cat-jeringas' },
  { titulo: 'Guantes', texto: 'Protección clínica y quirúrgica', busqueda: 'guantes', icono: 'G', clase: 'cat-guantes' },
  { titulo: 'Gasas y compresas', texto: 'Curaciones y primeros auxilios', busqueda: 'gasa', icono: 'C', clase: 'cat-gasas' },
  { titulo: 'Insumos médicos', texto: 'Uso profesional y domiciliario', busqueda: 'insumo', icono: 'M', clase: 'cat-insumos' },
  { titulo: 'Suplementos', texto: 'Bienestar y apoyo nutricional', busqueda: 'suplemento', icono: 'S', clase: 'cat-suplementos' },
  { titulo: 'Cuidado de heridas', texto: 'Apósitos y tratamiento tópico', busqueda: 'herida', icono: 'H', clase: 'cat-heridas' },
]

const descuentosDemo = [12, 18, 15, 20, 10, 16, 14, 22]

function formatearPrecio(valor) {
  const numero = Number(valor || 0)
  return `$${numero.toLocaleString('es-CL')}`
}

function obtenerPrecioProducto(producto, esB2B) {
  return Number(esB2B ? producto.precio_b2b : producto.precio_b2c) || 0
}

function obtenerStock(producto) {
  return Number(producto.stock_disponible ?? producto.stock ?? 0)
}

function obtenerBadgeStock(producto) {
  const stock = obtenerStock(producto)

  if (stock <= 0) return { label: 'Sin stock', className: 'stock-out' }
  if (stock <= 10) return { label: 'Stock bajo', className: 'stock-low' }
  return { label: 'Disponible', className: 'stock-ok' }
}

function crearOfertaVisual(producto, index, esB2B) {
  const precioActual = obtenerPrecioProducto(producto, esB2B)
  const descuento = descuentosDemo[index % descuentosDemo.length]
  const precioAnterior = precioActual > 0 ? Math.round(precioActual / (1 - descuento / 100)) : 0

  return { descuento, precioActual, precioAnterior }
}

export default function HomePage() {
  const { usuario } = useAuth()
  const { agregarItem } = useCarrito()
  const usuarioPuedeComprar = puedeComprar(usuario)
  const mensajeNoCompra = razonNoCompra(usuario)
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [slideActivo, setSlideActivo] = useState(0)

  const esB2B =
    usuario?.tipo_usuario === 'B2B' ||
    usuario?.role === 'cliente_b2b' ||
    usuario?.rol === 'cliente_b2b' ||
    usuario?.rol === 'ejecutivo'

  useEffect(() => {
    let activo = true
    setLoading(true)

    obtenerProductosCompatibles()
      .then((data) => {
        if (!activo) return
        const productosApi = Array.isArray(data) ? data : []
        setProductos(productosApi.slice(0, 8))
        setError('')
      })
      .catch(() => {
        if (!activo) return
        setError('No pudimos cargar los productos destacados en este momento.')
        setProductos([])
      })
      .finally(() => {
        if (activo) setLoading(false)
      })

    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideActivo((actual) => (actual + 1) % heroSlides.length)
    }, 4500)

    return () => window.clearInterval(timer)
  }, [])

  const ofertasVisuales = useMemo(() => productos.slice(0, 8), [productos])

  const cambiarSlide = (direccion) => {
    setSlideActivo((actual) => (actual + direccion + heroSlides.length) % heroSlides.length)
  }

  return (
    <main className="home-page">
      <section className="home-hero-carousel" aria-label="Promociones principales">
        <div className="home-hero-stage">
          {heroSlides.map((slide, index) => (
            <article
              key={slide.title}
              className={`home-hero-slide ${slide.tone} ${slideActivo === index ? 'activo' : ''}`}
              aria-hidden={slideActivo !== index}
            >
              <div className="home-hero-copy">
                <span className="home-hero-eyebrow">{slide.eyebrow}</span>
                <h1>{slide.title}</h1>
                <p>{slide.text}</p>
                <div className="home-hero-actions">
                  <Link className="btn-primary" to={slide.ctaTo}>
                    {slide.cta}
                  </Link>
                  <Link className="btn-secondary" to={slide.secondaryTo}>
                    {slide.secondary}
                  </Link>
                </div>
              </div>

              <div className="home-hero-visual" aria-hidden="true">
                {slide.imagen ? (
                  <img
                    src={slide.imagen}
                    alt=""
                    className="hero-banner-img"
                    onError={e => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="hero-product-pack" style={slide.imagen ? {display:'none'} : {}}>
                  <span className="hero-pack-pill">Medistock</span>
                  <div className="hero-pack-box">
                    <span className="hero-pack-cross">+</span>
                    <strong>Salud conectada</strong>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <button className="hero-arrow hero-arrow-prev" type="button" onClick={() => cambiarSlide(-1)} aria-label="Slide anterior">
          {'<'}
        </button>
        <button className="hero-arrow hero-arrow-next" type="button" onClick={() => cambiarSlide(1)} aria-label="Slide siguiente">
          {'>'}
        </button>

        <div className="hero-dots" aria-label="Seleccionar slide">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              className={slideActivo === index ? 'activo' : ''}
              onClick={() => setSlideActivo(index)}
              aria-label={`Mostrar slide ${index + 1}`}
              aria-current={slideActivo === index ? 'true' : undefined}
            />
          ))}
        </div>
      </section>

      <section className="home-section home-products-section">
        <div className="section-heading">
          <h2>Productos destacados</h2>
        </div>

        {loading && <div className="home-state">Cargando productos destacados...</div>}
        {!loading && error && <div className="home-state error">{error}</div>}
        {!loading && !error && productos.length === 0 && (
          <div className="home-state">No hay productos destacados disponibles por ahora.</div>
        )}

        {!loading && !error && productos.length > 0 && (
          <div className="home-products-grid">
            {productos.map((producto, index) => {
              const precio = obtenerPrecioProducto(producto, esB2B)
              const stockBadge = obtenerBadgeStock(producto)
              const sinStock = obtenerStock(producto) <= 0

              return (
                <article className="home-product-card" key={producto.id} style={{ animationDelay: `${index * 45}ms` }}>
                  <div className="product-image-placeholder">
                    <img
                      src={resolverImagenProducto(producto)}
                      alt={producto.nombre}
                      style={{width:'100%',height:'100%',objectFit:'contain'}}
                      onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
                    />
                    <span style={{display:'none'}}>{producto.categoria?.nombre?.slice(0, 1) || 'M'}</span>
                  </div>
                  <div className="product-card-body">
                    <div className="product-card-meta">
                      <span>{producto.categoria?.nombre || 'Insumo medico'}</span>
                      <span className={`stock-badge ${stockBadge.className}`}>{stockBadge.label}</span>
                    </div>
                    <h3>{producto.nombre}</h3>
                    <p className="product-card-description">
                      {producto.descripcion || 'Producto medico disponible en catalogo Medistock.'}
                    </p>
                    <div className="product-card-price">
                      <strong>{formatearPrecio(precio)}</strong>
                    </div>
                  </div>
                  <div className="product-card-actions">
                    <Link className="btn-outline" to={`/producto/${producto.id}`}>
                      Ver detalle
                    </Link>
                    <button
                      type="button"
                      onClick={() => agregarItem(producto)}
                      disabled={sinStock || !usuarioPuedeComprar}
                      title={!usuarioPuedeComprar ? mensajeNoCompra : ''}
                    >
                      Agregar
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="home-section home-categories-section">
        <div className="section-heading">
          <h2>Categorias para encontrar rapido</h2>
        </div>

        <div className="home-categories-grid">
          {categoriasVisuales.map((categoria) => (
            <Link
              key={categoria.titulo}
              className={`home-category-card ${categoria.clase}`}
              to={`/catalogo?search=${encodeURIComponent(categoria.busqueda)}`}
            >
              <span className="category-icon">{categoria.icono}</span>
              <strong>{categoria.titulo}</strong>
              <small>{categoria.texto}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section home-offers-section">
        <div className="section-heading offers-heading">
          <div>
            <h2>Promoción destacada</h2>
          </div>
          <Link className="btn-outline" to="/ofertas">
            Ver todas las ofertas
          </Link>
        </div>

        <div className="home-offers-track" aria-label="Oferta destacada">
          <article className="home-offer-card">
            <span className="offer-badge">-17%</span>
            <div className="offer-image">
              <img
                src={resolverImagenProducto({ nombre: 'Guantes clínicos' })}
                alt="Guantes clínicos"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
              />
              <span style={{ display: 'none' }}>G</span>
            </div>
            <div className="offer-content">
              <small>Insumos clínicos</small>
              <h3>Guantes clínicos</h3>
              <div className="offer-prices">
                <span>{formatearPrecio(5990)}</span>
                <strong>{formatearPrecio(4990)}</strong>
              </div>
            </div>
            <Link className="btn-outline" to="/catalogo">
              Ver en catálogo
            </Link>
          </article>
        </div>
      </section>

      <section className="home-benefits" aria-label="Beneficios Medistock">
        {beneficios.map((beneficio) => (
          <article key={beneficio.titulo}>
            <strong>{beneficio.titulo}</strong>
            <p>{beneficio.texto}</p>
          </article>
        ))}
      </section>

      <section className="home-platform-banner">
        <div>
          <span>Plataforma integrada</span>
          <h2>Tecnología conectada para distribución médica</h2>
          <p>
            Pedidos, pagos, convenios B2B y logística en una sola plataforma.
          </p>
        </div>
        <Link to="/panel">Ir a mi panel</Link>
      </section>

      <Footer />
    </main>
  )
}
