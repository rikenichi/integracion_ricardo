import { createContext, useContext, useState, useEffect } from 'react'
import {
  getPerfil,
  login as apiLogin,
  logout as apiLogout,
  actualizarPerfil as apiActualizarPerfil,
} from '../services/api'

const AuthContext = createContext(null)

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function extraerGrupos(usuarioData = {}) {
  const grupos = usuarioData.grupos || usuarioData.groups || []
  return grupos
    .map((grupo) => (typeof grupo === 'string' ? grupo : grupo?.name))
    .filter(Boolean)
}

function contieneAlguno(valores, terminos) {
  return valores.some((valor) => {
    const normalizado = normalizarTexto(valor)
    return terminos.some((termino) => normalizado.includes(termino))
  })
}

function decodificarJwt(token) {
  try {
    const payload = token?.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

function perfilDesdeToken(accessToken) {
  const claims = decodificarJwt(accessToken) || {}
  const nombreCompleto = String(claims.full_name || '').trim()
  const [firstName = '', ...apellidos] = nombreCompleto.split(' ').filter(Boolean)
  const grupos = claims.grupos || []

  let rolBackend = String(claims.rol || claims.role || claims.tipo_usuario || '').toUpperCase() || 'TOKEN'
  const tipoCliente = String(claims.tipo_cliente || claims.tipoCliente || '').toUpperCase()
  if (contieneAlguno(grupos, ['administrador', 'admin'])) rolBackend = 'ADMINISTRADOR'
  else if (contieneAlguno(grupos, ['ejecutivo', 'ventas'])) rolBackend = 'EJECUTIVO'
  else if (contieneAlguno(grupos, ['operador', 'logistica'])) rolBackend = 'OPERADOR'
  else if (contieneAlguno(grupos, ['analista', 'finanzas'])) rolBackend = 'ANALISTA'
  else if (tipoCliente || rolBackend.includes('CLIENTE')) rolBackend = 'CLIENTE'

  return {
    rol: normalizarTexto(rolBackend),
    rol_backend: rolBackend,
    datos: {
      tipo_cliente: tipoCliente || null,
      usuario: {
        id: claims.user_id || null,
        username: claims.username || '',
        email: claims.email || '',
        first_name: firstName,
        last_name: apellidos.join(' '),
        grupos,
        is_staff: false,
      },
    },
  }
}

function perfilDesdeLoginResponse(data, accessToken) {
  const candidatos = [
    data?.perfil,
    data?.profile,
    data?.usuario,
    data?.user,
    data,
  ].filter(Boolean)

  const candidato = candidatos.find((item) =>
    item?.datos
    || item?.rol
    || item?.Rol
    || item?.tipo_cliente
    || item?.tipo_usuario
    || item?.groups
    || item?.grupos
  )

  if (!candidato || candidato.access || candidato.refresh) {
    return perfilDesdeToken(accessToken)
  }

  if (candidato.datos || candidato.rol || candidato.Rol) {
    return candidato
  }

  return {
    rol: candidato.tipo_usuario || candidato.rol || 'CLIENTE',
    datos: {
      tipo_cliente: candidato.tipo_cliente || null,
      usuario: candidato,
    },
  }
}

function leerUsuarioGuardado() {
  try {
    const raw = localStorage.getItem('usuario')
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem('usuario')
    return null
  }
}

function guardarUsuario(usuarioPerfil) {
  localStorage.setItem('usuario', JSON.stringify(usuarioPerfil))
}

function resolverRolFrontend(perfil) {
  const rolBackend = String(perfil?.rol || perfil?.Rol || '').toUpperCase()
  const datos = perfil?.datos || {}

  if (rolBackend === 'CLIENTE') {
    const tipoCliente = String(datos.tipo_cliente || '').toUpperCase()
    if (tipoCliente === 'INSTITUCIONAL') return 'cliente_b2b'
    if (tipoCliente === 'PARTICULAR') return 'cliente_b2c'
    return 'cliente'
  }

  const usuarioData = datos.usuario || datos
  const grupos = extraerGrupos(usuarioData)
  const cargo = datos.cargo || ''
  const referencias = [...grupos, cargo]

  if (usuarioData.is_staff || contieneAlguno(referencias, ['admin', 'administrador'])) {
    return 'admin'
  }
  if (contieneAlguno(referencias, ['ejecutivo', 'ventas'])) return 'ejecutivo'
  if (contieneAlguno(referencias, ['operador', 'logistica'])) return 'operador'
  if (contieneAlguno(referencias, ['analista', 'finanzas'])) return 'analista'
  if (rolBackend === 'TRABAJADOR') return 'trabajador'

  return normalizarTexto(rolBackend) || 'usuario'
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  const normalizarPerfil = (res) => {
    const data = res?.data ?? res
    const perfil = data?.datos ? data : (data?.data ?? data)
    const datos = perfil?.datos || {}
    const usuarioData = datos.usuario || datos
    const grupos = extraerGrupos(usuarioData)

    return {
      rol: resolverRolFrontend(perfil),
      rol_backend: perfil?.rol || perfil?.Rol || null,
      datos,
      id: usuarioData.id || datos.id || null,
      username: usuarioData.username || datos.username || datos.email || '',
      email: usuarioData.email || datos.email || '',
      first_name: usuarioData.first_name || datos.first_name || '',
      last_name: usuarioData.last_name || datos.last_name || '',
      rut: datos.rut || usuarioData.rut || '',
      telefono: datos.telefono || usuarioData.telefono || '',
      tipo_cliente: datos.tipo_cliente || null,
      institucion: datos.institucion || null,
      nombre_institucion: datos.nombre_institucion || datos.institucion_nombre || null,
      grupos,
      is_staff: Boolean(usuarioData.is_staff),
    }
  }

  const recuperarSesionMinima = (accessToken) => {
    const usuarioGuardado = leerUsuarioGuardado()
    if (usuarioGuardado) return usuarioGuardado
    return normalizarPerfil(perfilDesdeToken(accessToken))
  }

  useEffect(() => {
    let activo = true
    const init = async () => {
      const access = localStorage.getItem('access_token')
      const refresh = localStorage.getItem('refresh_token')
      if (!access) {
        localStorage.removeItem('usuario')
        if (!refresh) localStorage.removeItem('refresh_token')
        if (activo) setCargando(false)
        return
      }
      try {
        const perfil = await getPerfil()
        const usuarioPerfil = normalizarPerfil(perfil)
        guardarUsuario(usuarioPerfil)
        if (activo) setUsuario(usuarioPerfil)
      } catch (error) {
        const status = error.response?.status

        if (status === 404) {
          const usuarioPerfil = recuperarSesionMinima(access)
          guardarUsuario(usuarioPerfil)
          if (activo) setUsuario(usuarioPerfil)
          return
        }

        if (status === 401 || status === 403 || !refresh) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('usuario')
          if (activo) setUsuario(null)
          return
        }

        const usuarioPerfil = recuperarSesionMinima(access)
        guardarUsuario(usuarioPerfil)
        if (activo) setUsuario(usuarioPerfil)
      } finally {
        if (activo) setCargando(false)
      }
    }
    init()
    return () => { activo = false }
  }, [])

  const iniciarSesion = async (username, password) => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('usuario')
    setUsuario(null)

    const { data } = await apiLogin(username, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    let perfil
    try {
      perfil = await getPerfil()
    } catch (error) {
      if (error.response?.status !== 404) throw error
      perfil = perfilDesdeLoginResponse(data, data.access)
    }
    const usuarioPerfil = normalizarPerfil(perfil)
    guardarUsuario(usuarioPerfil)
    setUsuario(usuarioPerfil)
    return usuarioPerfil
  }

  const cerrarSesion = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await apiLogout(refresh)
    } catch { /* ignorar error al hacer logout */ }
    localStorage.clear()
    setUsuario(null)
  }

  const refrescarPerfil = async () => {
    const access = localStorage.getItem('access_token')
    let usuarioPerfil

    try {
      const perfil = await getPerfil()
      usuarioPerfil = normalizarPerfil(perfil)
    } catch (error) {
      if (error.response?.status !== 404) throw error
      usuarioPerfil = recuperarSesionMinima(access)
    }

    guardarUsuario(usuarioPerfil)
    setUsuario(usuarioPerfil)
    return usuarioPerfil
  }

  const actualizarPerfilUsuario = async (datos) => {
    await apiActualizarPerfil(datos)
    return refrescarPerfil()
  }

  return (
    <AuthContext.Provider value={{
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      refrescarPerfil,
      actualizarPerfilUsuario,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
