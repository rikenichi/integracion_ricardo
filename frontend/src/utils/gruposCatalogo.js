/**
 * Agrupación lógica de categorías del backend en los 3 nodos visibles del navbar.
 *
 * Como las categorías reales del backend tienen nombres genéricos (categoria_test_*),
 * acá las agrupamos por intención comercial para que los links del navbar
 * "Medicamentos / Insumos médicos / Bienestar" devuelvan subconjuntos relevantes
 * del catálogo sin necesidad de tocar la BD.
 *
 * Si en el futuro el backend expone categorías reales con esos nombres,
 * basta con agregar el nombre al array correspondiente.
 */
export const GRUPOS_CATALOGO = {
  medicamentos: {
    label: 'Medicamentos',
    descripcion: 'Fármacos, principios activos y soluciones farmacéuticas.',
    icono: '💊',
    categorias: [
      'medicamentos',
      'farmacos',
      'fármacos',
      'categoria_test_1',
      'categoria_test_2',
      'categoria_test_3',
      'categoria_test_4',
    ],
  },
  insumos: {
    label: 'Insumos médicos',
    descripcion: 'Material clínico, descartables y dispositivos.',
    icono: '🩺',
    categorias: [
      'insumos',
      'insumos medicos',
      'insumos médicos',
      'cajas de envio',
      'categoria_test_5',
      'categoria_test_6',
      'categoria_test_7',
      'categoria_test_8',
    ],
  },
  bienestar: {
    label: 'Bienestar',
    descripcion: 'Cuidado personal, nutrición y vida saludable.',
    icono: '🌿',
    categorias: [
      'bienestar',
      'cuidado personal',
      'nutricion',
      'nutrición',
      'categoria_test_9',
      'categoria_test_10',
    ],
  },
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Devuelve la definición de un grupo por su id ('medicamentos' | 'insumos' | 'bienestar').
 */
export function obtenerGrupo(grupoId) {
  return GRUPOS_CATALOGO[grupoId] || null
}

/**
 * Filtra una lista de productos para devolver solo los que pertenecen al grupo dado.
 * El match es tolerante: ignora acentos y mayúsculas.
 */
export function filtrarPorGrupo(productos, grupoId) {
  const grupo = obtenerGrupo(grupoId)
  if (!grupo) return productos

  const setPermitido = new Set(grupo.categorias.map(normalizar))

  return productos.filter((p) => {
    const cat = normalizar(p.categoria_nombre || p.categoria || '')
    return setPermitido.has(cat)
  })
}
