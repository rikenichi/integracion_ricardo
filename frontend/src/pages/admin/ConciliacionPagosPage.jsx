import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  actualizarConciliacionPago,
  obtenerConciliacionesPago,
} from '../../services/api'
import './ConciliacionPagosPage.css'

const ROLES_PERMITIDOS = ['admin', 'analista']

const ESTADOS = {
  pendiente: { label: 'Pendiente', clase: 'badge-warning' },
  conciliado: { label: 'Conciliado', clase: 'badge-success' },
  diferencia_monto: { label: 'Diferencia de monto', clase: 'badge-info' },
  rechazado: { label: 'Rechazado', clase: 'badge-danger' },
}

function formatFecha(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrecio(valor) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(valor || 0)
}

function obtenerLista(data) {
  return data?.results || data || []
}

function getEstado(estado) {
  return ESTADOS[estado] || { label: estado || 'Sin estado', clase: 'badge-secondary' }
}

export default function ConciliacionPagosPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [conciliaciones, setConciliaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actualizandoId, setActualizandoId] = useState(null)

  const autorizado = ROLES_PERMITIDOS.includes(usuario?.rol)

  const cargarDatos = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await obtenerConciliacionesPago()
      setConciliaciones(obtenerLista(data))
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudieron cargar las conciliaciones de pago.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  const cambiarEstado = async (id, estado_conciliacion) => {
    setActualizandoId(id)
    setError('')
    try {
      const respuesta = await actualizarConciliacionPago(id, { estado_conciliacion })
      if (respuesta?.demo) {
        setConciliaciones((items) =>
          items.map((item) => Number(item.id) === Number(id)
            ? {
              ...item,
              estado_conciliacion,
              actualizado_en: respuesta.data.actualizado_en,
              observacion: 'Estado demo local; el pago real no fue modificado.',
            }
            : item
          )
        )
      } else {
        await cargarDatos()
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo actualizar la conciliación.')
    } finally {
      setActualizandoId(null)
    }
  }

  if (!autorizado) {
    return (
      <div className="page-container conciliacion-page">
        <div className="conciliacion-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card conciliacion-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista está disponible solo para administración y análisis financiero.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container conciliacion-page">
      <div className="conciliacion-header">
        <div>
          <p className="conciliacion-kicker">Finanzas internas</p>
          <h1 className="page-title">Conciliación de pagos <span className="demo-chip">Pagos reales</span></h1>
          <p className="text-muted">
            Lista pagos reales desde backend; las marcas de conciliacion son locales porque no hay endpoint financiero persistente.
          </p>
        </div>
        <div className="conciliacion-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          <button className="btn btn-primary" onClick={cargarDatos} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : (
        <section className="tabla-container card">
          <div className="conciliacion-section-header">
            <h2>Conciliaciones registradas</h2>
            <span>{conciliaciones.length} registros</span>
          </div>
          {conciliaciones.length === 0 ? (
            <p className="text-muted conciliacion-empty">No hay pagos reales disponibles para revisar.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pago</th>
                  <th>Monto</th>
                  <th>Estado pago</th>
                  <th>Método</th>
                  <th>Analista</th>
                  <th>Fecha conciliación</th>
                  <th>Estado conciliación</th>
                  <th>Observación</th>
                  <th>Creada</th>
                  <th>Actualizada</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {conciliaciones.map(conciliacion => {
                  const estado = getEstado(conciliacion.estado_conciliacion)
                  const bloqueado = actualizandoId === conciliacion.id
                  return (
                    <tr key={conciliacion.id}>
                      <td>#{conciliacion.id}</td>
                      <td>#{conciliacion.pago}</td>
                      <td>{formatPrecio(conciliacion.pago_monto)}</td>
                      <td>{conciliacion.pago_estado || '-'}</td>
                      <td>{conciliacion.pago_metodo || '-'}</td>
                      <td>{conciliacion.analista_username || '-'}</td>
                      <td>{formatFecha(conciliacion.fecha_conciliacion)}</td>
                      <td><span className={`badge ${estado.clase}`}>{estado.label}</span></td>
                      <td>{conciliacion.observacion || '-'}</td>
                      <td>{formatFecha(conciliacion.creado_en)}</td>
                      <td>{formatFecha(conciliacion.actualizado_en)}</td>
                      <td>
                        <div className="conciliacion-acciones">
                          <button className="btn btn-success btn-sm" disabled={bloqueado || conciliacion.estado_conciliacion === 'conciliado'} onClick={() => cambiarEstado(conciliacion.id, 'conciliado')}>
                            Marcar conciliado
                          </button>
                          <button className="btn btn-secondary btn-sm" disabled={bloqueado || conciliacion.estado_conciliacion === 'diferencia_monto'} onClick={() => cambiarEstado(conciliacion.id, 'diferencia_monto')}>
                            Diferencia de monto
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={bloqueado || conciliacion.estado_conciliacion === 'rechazado'} onClick={() => cambiarEstado(conciliacion.id, 'rechazado')}>
                            Marcar rechazado
                          </button>
                          <button className="btn btn-secondary btn-sm" disabled={bloqueado || conciliacion.estado_conciliacion === 'pendiente'} onClick={() => cambiarEstado(conciliacion.id, 'pendiente')}>
                            Marcar pendiente
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
