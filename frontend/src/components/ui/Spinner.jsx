/**
 * Spinner basado en la clase global .spinner de index.css.
 *
 * Props:
 *   - inline: usar variante compacta para botones / textos
 *   - label:  texto accesible para lectores de pantalla
 */
export default function Spinner({ inline = false, label = 'Cargando…', className = '' }) {
  const clases = [inline ? 'spinner spinner-inline' : 'spinner', className].filter(Boolean).join(' ')
  return <div className={clases} role="status" aria-label={label} />
}
