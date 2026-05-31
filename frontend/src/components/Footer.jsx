import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="site-footer" id="contacto">
      <div>
        <strong>MEDISTOCK</strong>
        <p>Venta y gestion de insumos medicos para clientes B2C y B2B.</p>
      </div>
      <div>
        <strong>Contacto</strong>
        <p>Canal de soporte academico del prototipo.</p>
      </div>
      <div>
        <strong>Horario</strong>
        <p>Lunes a viernes, 09:00 a 18:00.</p>
      </div>
      <div>
        <strong>Enlaces utiles</strong>
        <Link to="/catalogo">Catalogo</Link>
        <Link to="/mis-pedidos">Mis pedidos</Link>
        <Link to="/tracking">Tracking</Link>
      </div>
      <div>
        <strong>Politicas</strong>
        <p>Informacion referencial para fines de demostracion.</p>
      </div>
    </footer>
  )
}
