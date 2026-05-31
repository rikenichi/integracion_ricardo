import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCarrito } from '../context/CarritoContext'
import { puedeComprar } from '../utils/permisos'
import './Navbar.css'

const ETIQUETAS_ROL = {
  admin: 'Administrador',
  cliente: 'Cliente',
  cliente_b2b: 'Cliente B2B',
  cliente_b2c: 'Paciente',
  ejecutivo: 'Ejecutivo',
  operador: 'Operador',
  analista: 'Analista',
  trabajador: 'Trabajador',
}

export default function Navbar() {
  const { usuario, cerrarSesion } = useAuth()
  const { totalItems } = useCarrito()
  const navigate = useNavigate()
  const location = useLocation()
  const usuarioPuedeComprar = puedeComprar(usuario)

  // Compara ruta + query string. Se usa para que /catalogo?grupo=medicamentos
  // y /catalogo?grupo=insumos sean considerados secciones distintas.
  const rutaActual = location.pathname + location.search
  const navClass = (to) => `category-nav-link${rutaActual === to ? ' nav-activo' : ''}`

  const handleLogout = async () => {
    await cerrarSesion()
    navigate('/login')
  }

  const handleSearch = (event) => {
    event.preventDefault()
    const query = new FormData(event.currentTarget).get('search')?.toString().trim()
    navigate(query ? `/catalogo?search=${encodeURIComponent(query)}` : '/catalogo')
  }

  const nombreUsuario = usuario?.first_name || usuario?.username || usuario?.datos?.first_name ||
    usuario?.datos?.usuario?.username || 'Usuario'

  return (
    <header className="site-header">
      <div className="topbar">
        <span>Despacho a todo Chile</span>
        <span>Pago seguro con Webpay Plus</span>
        <span>Stock actualizado en tiempo real</span>
        <span>Atencion para pacientes y clinicas</span>
      </div>

      <div className="main-header">
        <Link to="/" className="header-brand">
          <span className="brand-mark">M</span>
          <span>
            <strong>MEDISTOCK</strong>
            <small>Farmacia e insumos medicos</small>
          </span>
        </Link>

        <form className="header-search" onSubmit={handleSearch}>
          <input name="search" type="search" placeholder="Buscar medicamentos, insumos o bienestar" />
          <button type="submit">Buscar</button>
        </form>

        <div className="header-actions">
          {usuario ? (
            <>
              <Link to="/perfil" className="quick-link">
                <span>{nombreUsuario}</span>
                <small>{ETIQUETAS_ROL[usuario.rol] || usuario.rol}</small>
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
            </>
          ) : (
            <>
              <Link to="/login" className="quick-link">
                <span>Usuario</span>
                <small>Iniciar sesion</small>
              </Link>
              <Link to="/registro" className="register-link">Crear cuenta</Link>
            </>
          )}

          {usuarioPuedeComprar && (
            <Link to="/carrito" className="cart-link">
              <span>Carrito</span>
              {totalItems > 0 && <strong>{totalItems}</strong>}
            </Link>
          )}
        </div>
      </div>

      <nav className="category-nav">
        <Link to="/" className={navClass('/')}>Inicio</Link>
        {usuarioPuedeComprar && (
          <>
            <Link to="/catalogo?search=ofertas" className={navClass('/catalogo?search=ofertas')}>Ofertas</Link>
            <Link to="/catalogo?grupo=medicamentos" className={navClass('/catalogo?grupo=medicamentos')}>Medicamentos</Link>
            <Link to="/catalogo?grupo=insumos" className={navClass('/catalogo?grupo=insumos')}>Insumos médicos</Link>
            <Link to="/catalogo?grupo=bienestar" className={navClass('/catalogo?grupo=bienestar')}>Bienestar</Link>
          </>
        )}
        <Link to="/contacto" className={navClass('/contacto')}>Contacto</Link>
        {usuario && <Link to="/panel" className={navClass('/panel')}>Mi Panel</Link>}
        {usuario && <Link to="/perfil" className={navClass('/perfil')}>Mi Perfil</Link>}
      </nav>
    </header>
  )
}
