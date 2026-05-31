import { useState } from 'react'
import { Link } from 'react-router-dom'
import './ContactoPage.css'

const MOTIVOS = [
  { id: 'consulta', label: 'Consulta general' },
  { id: 'cotizacion', label: 'Solicitud de cotización' },
  { id: 'convenio', label: 'Convenios B2B / institucional' },
  { id: 'soporte', label: 'Soporte técnico de la plataforma' },
  { id: 'otro', label: 'Otro' },
]

const MENSAJES_STORAGE = 'medistock_mensajes_contacto'

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Estado inicial del formulario en blanco. Los datos personales viven en Mi Perfil,
// no se autocompletan acá para evitar confusión con la info personal del usuario.
const FORM_VACIO = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  motivo: 'consulta',
  mensaje: '',
  aceptaPolitica: false,
}

export default function ContactoPage() {
  const [form, setForm] = useState(FORM_VACIO)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)

  const actualizar = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [campo]: valor }))
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: null }))
  }

  const validar = () => {
    const errs = {}
    if (!form.nombre.trim()) errs.nombre = 'Ingresa tu nombre.'
    if (!form.apellido.trim()) errs.apellido = 'Ingresa tu apellido.'
    if (!form.email.trim()) errs.email = 'Ingresa tu correo electrónico.'
    else if (!emailValido(form.email)) errs.email = 'El formato del correo no es válido.'
    if (form.telefono && !/^[0-9+()\s-]{6,}$/.test(form.telefono)) {
      errs.telefono = 'Teléfono no válido.'
    }
    if (!form.mensaje.trim()) errs.mensaje = 'Escribe tu mensaje.'
    else if (form.mensaje.trim().length < 10) errs.mensaje = 'Tu mensaje debe tener al menos 10 caracteres.'
    if (!form.aceptaPolitica) errs.aceptaPolitica = 'Debes aceptar la política de privacidad.'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length > 0) {
      setErrores(errs)
      return
    }

    setEnviando(true)

    // Guardado local como histórico de mensajes (demo sin backend).
    try {
      const mensajes = JSON.parse(localStorage.getItem(MENSAJES_STORAGE) || '[]')
      mensajes.unshift({
        ...form,
        enviado_en: new Date().toISOString(),
      })
      localStorage.setItem(MENSAJES_STORAGE, JSON.stringify(mensajes.slice(0, 50)))
    } catch {
      /* almacenamiento opcional, ignorar */
    }

    // Abrir cliente de correo del usuario con el mensaje preformateado.
    const motivoLabel = MOTIVOS.find((m) => m.id === form.motivo)?.label || form.motivo
    const subject = `Contacto MEDISTOCK · ${motivoLabel}`
    const body =
      `Nombre: ${form.nombre} ${form.apellido}\n` +
      `Correo: ${form.email}\n` +
      `Teléfono: ${form.telefono || '(no informado)'}\n` +
      `Motivo: ${motivoLabel}\n\n` +
      `Mensaje:\n${form.mensaje}\n`

    try {
      window.location.href = `mailto:contacto@medistock.cl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    } catch {
      /* algunos entornos bloquean mailto */
    }

    // Pequeño delay para UX y reset
    setTimeout(() => {
      setEnviando(false)
      setExito(true)
      setForm(FORM_VACIO)
    }, 700)
  }

  return (
    <div className="page-container contacto-page">
      <div className="contacto-grid">
        <section className="contacto-info card">
          <h1 className="page-title" style={{ margin: 0 }}>Hablemos</h1>
          <p className="text-muted">
            Resolvemos consultas comerciales, soporte y convenios B2B en menos de 24 horas hábiles.
          </p>

          <div className="contacto-canal">
            <span className="contacto-icon">📞</span>
            <div>
              <strong>Mesa central</strong>
              <a href="tel:+56222221111">+56 2 2222 1111</a>
              <small>Lun a Vie · 9:00 – 19:00</small>
            </div>
          </div>

          <div className="contacto-canal">
            <span className="contacto-icon">✉️</span>
            <div>
              <strong>Correo comercial</strong>
              <a href="mailto:contacto@medistock.cl">contacto@medistock.cl</a>
              <small>Respuesta dentro de 24 hrs hábiles</small>
            </div>
          </div>

          <div className="contacto-canal">
            <span className="contacto-icon">🏥</span>
            <div>
              <strong>Convenios B2B / institucionales</strong>
              <a href="mailto:b2b@medistock.cl">b2b@medistock.cl</a>
              <small>Clínicas, consultas y hospitales</small>
            </div>
          </div>

          <div className="contacto-canal">
            <span className="contacto-icon">📍</span>
            <div>
              <strong>Casa matriz</strong>
              <span>Av. Providencia 1234, Providencia, Santiago</span>
              <small>5 centros de distribución a nivel nacional</small>
            </div>
          </div>
        </section>

        <section className="card">
          {exito ? (
            <div className="contacto-exito">
              <div className="contacto-exito-icon">✓</div>
              <h2>¡Mensaje enviado!</h2>
              <p className="text-muted">
                Recibimos tu solicitud. Te contactaremos al correo registrado dentro de 24 horas hábiles.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={() => setExito(false)}>
                  Enviar otro mensaje
                </button>
                <Link to="/" className="btn btn-secondary">Volver al inicio</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h2 style={{ marginBottom: 4 }}>Formulario de contacto</h2>
              <p className="text-muted" style={{ marginBottom: 16, fontSize: '0.9rem' }}>
                Completa el formulario y te responderemos a la brevedad.
              </p>

              <div className="contacto-row">
                <div className="form-group">
                  <label htmlFor="nombre">Nombre *</label>
                  <input
                    id="nombre"
                    type="text"
                    value={form.nombre}
                    onChange={actualizar('nombre')}
                    autoComplete="given-name"
                    required
                  />
                  {errores.nombre && <small className="contacto-error">{errores.nombre}</small>}
                </div>

                <div className="form-group">
                  <label htmlFor="apellido">Apellido *</label>
                  <input
                    id="apellido"
                    type="text"
                    value={form.apellido}
                    onChange={actualizar('apellido')}
                    autoComplete="family-name"
                    required
                  />
                  {errores.apellido && <small className="contacto-error">{errores.apellido}</small>}
                </div>
              </div>

              <div className="contacto-row">
                <div className="form-group">
                  <label htmlFor="email">Correo electrónico *</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={actualizar('email')}
                    autoComplete="email"
                    placeholder="tu@correo.cl"
                    required
                  />
                  {errores.email && <small className="contacto-error">{errores.email}</small>}
                </div>

                <div className="form-group">
                  <label htmlFor="telefono">Teléfono (opcional)</label>
                  <input
                    id="telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={actualizar('telefono')}
                    autoComplete="tel"
                    placeholder="+56 9 1234 5678"
                  />
                  {errores.telefono && <small className="contacto-error">{errores.telefono}</small>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="motivo">Motivo de contacto</label>
                <select id="motivo" value={form.motivo} onChange={actualizar('motivo')}>
                  {MOTIVOS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="mensaje">Mensaje *</label>
                <textarea
                  id="mensaje"
                  rows={7}
                  value={form.mensaje}
                  onChange={actualizar('mensaje')}
                  placeholder="Cuéntanos en qué te podemos ayudar…"
                  required
                />
                <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                  {form.mensaje.length} caracteres
                </small>
                {errores.mensaje && <small className="contacto-error">{errores.mensaje}</small>}
              </div>

              <label className="contacto-checkbox">
                <input
                  type="checkbox"
                  checked={form.aceptaPolitica}
                  onChange={actualizar('aceptaPolitica')}
                />
                <span>
                  Acepto la <Link to="/" onClick={(e) => e.preventDefault()}>política de privacidad</Link> y
                  el tratamiento de mis datos para esta consulta.
                </span>
              </label>
              {errores.aceptaPolitica && <small className="contacto-error">{errores.aceptaPolitica}</small>}

              <button type="submit" className="btn btn-primary btn-lg btn-block mt-2" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar mensaje'}
              </button>

              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 10, textAlign: 'center' }}>
                Al enviar abriremos tu cliente de correo con el mensaje preformateado a <strong>contacto@medistock.cl</strong>.
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
