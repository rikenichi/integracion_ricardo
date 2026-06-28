import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './GuiasDespachoPage.css'

const ROLES_INTERNOS = ['admin', 'operador', 'analista']

export default function GuiasDespachoPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const autorizado = ROLES_INTERNOS.includes(usuario?.rol)

  if (!autorizado) {
    return (
      <div className="page-container guias-page">
        <div className="guias-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card guias-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista esta disponible solo para roles internos de logistica y analisis.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container guias-page">
      <div className="guias-header">
        <div>
          <p className="guias-kicker">Despacho administrativo</p>
          <h1 className="page-title">Guias de despacho <span className="demo-chip">Módulo documental</span></h1>
          <p className="text-muted">
            Consulta administrativa para documentación de despacho y respaldo logístico.
          </p>
        </div>
        <div className="guias-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
      </div>

      <section className="card guias-pendiente">
        <h2>Documentación de despacho</h2>
        <p className="text-muted">
          La documentación de despacho se mantiene como respaldo administrativo del proceso logístico. El seguimiento operativo del pedido está disponible desde el detalle de cada pedido.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/panel')}>
          Volver al panel
        </button>
      </section>
    </div>
  )
}
