const MAPA_IMAGENES = {
  'paracetamol 500': '/images/productos/paracetamol-500.jpg',
  'paracetamol 500 mg': '/images/productos/paracetamol-500.jpg',
  'paracetamol 250': '/images/productos/paracetamol-250.jpg',
  'paracetamol 250 mg': '/images/productos/paracetamol-250.jpg',
  'guantes clínicos': '/images/productos/guantes-clinicos.jpg',
  'guantes clinicos': '/images/productos/guantes-clinicos.jpg',
  'gasas estériles': '/images/productos/gasas-esteriles.jpg',
  'gasas esteriles': '/images/productos/gasas-esteriles.jpg',
}

const DEFAULT = '/images/productos/default-medico.jpg'

export function resolverImagenProducto(producto) {
  if (producto?.imagen_url) return producto.imagen_url
  if (producto?.imagen) return producto.imagen
  const clave = String(producto?.nombre || '').toLowerCase().trim()
  for (const [patron, ruta] of Object.entries(MAPA_IMAGENES)) {
    if (clave.includes(patron)) return ruta
  }
  return DEFAULT
}
