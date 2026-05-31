/**
 * Etiqueta semántica reusable.
 *
 * variant: success | warning | danger | info | secondary
 *
 * Por compatibilidad con código legado, también acepta `clase` (alias).
 */
export default function Badge({ children, variant = 'secondary', clase, className = '' }) {
  const variante = clase ? clase.replace(/^badge-/, '') : variant
  return <span className={`badge badge-${variante} ${className}`.trim()}>{children}</span>
}
