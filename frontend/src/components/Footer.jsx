import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="site-footer" id="contacto">
      <div>
        <strong>MEDISTOCK</strong>
        <p>Venta y gestión de insumos médicos para clientes B2C e instituciones B2B.</p>
      </div>
      <div>
        <strong>Contacto</strong>
        <p>contacto@medistock.cl</p>
        <p>+56 2 2000 0000</p>
      </div>
      <div>
        <strong>Horario</strong>
        <p>Lunes a viernes, 09:00 a 18:00.</p>
      </div>
      <div>
        <strong>Enlaces útiles</strong>
        <Link to="/catalogo">Catálogo</Link>
        <Link to="/mis-pedidos">Mis pedidos</Link>
        <Link to="/tracking">Tracking</Link>
      </div>
      <div>
        <strong>Políticas</strong>
        <p>Términos de uso y política de privacidad disponibles en sucursales.</p>
      </div>
    </footer>
  )
}
