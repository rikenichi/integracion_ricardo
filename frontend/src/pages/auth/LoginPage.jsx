import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './LoginPage.css'

const ES_DESARROLLO = import.meta.env.DEV

const USUARIOS_DEMO = ES_DESARROLLO
  ? [
      // DEMO LOCAL: accesos rapidos solo para desarrollo; Vite los elimina del build de produccion.
      { label: 'Admin', username: import.meta.env.VITE_DEMO_ADMIN_USER || 'admin', password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || '' },
      { label: 'Clinica B2B', username: import.meta.env.VITE_DEMO_B2B_USER || 'clinica_baviera', password: import.meta.env.VITE_DEMO_B2B_PASSWORD || '' },
      { label: 'Paciente B2C', username: import.meta.env.VITE_DEMO_B2C_USER || 'paciente_gomez', password: import.meta.env.VITE_DEMO_B2C_PASSWORD || '' },
      { label: 'Ejecutivo', username: import.meta.env.VITE_DEMO_EJECUTIVO_USER || 'ejecutivo_ventas', password: import.meta.env.VITE_DEMO_EJECUTIVO_PASSWORD || '' },
      { label: 'Operador', username: import.meta.env.VITE_DEMO_OPERADOR_USER || 'operador_logistica', password: import.meta.env.VITE_DEMO_OPERADOR_PASSWORD || '' },
      { label: 'Analista', username: import.meta.env.VITE_DEMO_ANALISTA_USER || 'analista_finanzas', password: import.meta.env.VITE_DEMO_ANALISTA_PASSWORD || '' },
    ]
  : []

const ROLES_PANEL = ['admin', 'ejecutivo', 'operador', 'analista', 'trabajador']

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const usuario = await iniciarSesion(username, password)
      navigate(ROLES_PANEL.includes(usuario.rol) ? '/panel' : '/catalogo')
    } catch (err) {
      setError('Credenciales incorrectas. Verifica tu usuario y contrasena.')
    } finally {
      setLoading(false)
    }
  }

  const loginRapido = (u) => {
    setUsername(u.username)
    setPassword(u.password)
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-header">
          <span className="login-logo">+</span>
          <h1>MEDISTOCK</h1>
          <p className="text-muted">Distribuidora de Insumos Clinicos</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text" value={username} required autoFocus
              onChange={e => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
            />
          </div>
          <div className="form-group">
            <label>Contrasena</label>
            <div className="password-field">
              <input
                type={mostrarPassword ? 'text' : 'password'} value={password} required
                onChange={e => setPassword(e.target.value)}
                placeholder="********"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setMostrarPassword(prev => !prev)}
                aria-label={mostrarPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                aria-pressed={mostrarPassword}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M12 5C7 5 3.3 8.1 2 12c1.3 3.9 5 7 10 7s8.7-3.1 10-7c-1.3-3.9-5-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar sesion'}
          </button>
        </form>

        {ES_DESARROLLO && (
          <div className="demo-section">
            <p className="demo-title">Usuarios de prueba (demo local)</p>
            <div className="demo-btns">
              {USUARIOS_DEMO.map(u => (
                <button key={u.username} className="btn btn-secondary btn-sm"
                  onClick={() => loginRapido(u)}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-2 text-center text-muted" style={{ fontSize: '0.8rem' }}>
          <Link to="/catalogo">Ver catalogo sin iniciar sesion</Link>
        </p>
        <p className="mt-1 text-center text-muted" style={{ fontSize: '0.8rem' }}>
          No tienes cuenta? <Link to="/registro">Crear cuenta MEDISTOCK</Link>
        </p>
      </div>
    </div>
  )
}
