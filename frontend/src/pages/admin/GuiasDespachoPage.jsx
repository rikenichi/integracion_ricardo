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
          <h1 className="page-title">Guias de despacho <span className="demo-chip">Pendiente backend</span></h1>
          <p className="text-muted">
            No hay endpoint real expuesto para listar o administrar guias de despacho. El tracking operativo sigue disponible por pedido.
          </p>
        </div>
        <div className="guias-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
      </div>

      <section className="card guias-pendiente">
        <h2>Modulo documental pendiente</h2>
        <p className="text-muted">
          Para evitar datos inventados, esta pantalla no muestra guias simuladas. Cuando el backend exponga una URL real para documentos de despacho, se podra conectar aqui.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/panel')}>
          Volver al panel
        </button>
      </section>
    </div>
  )
}
