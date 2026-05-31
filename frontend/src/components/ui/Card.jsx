/**
 * Tarjeta de superficie. Envuelve la clase global .card de index.css
 * con la posibilidad de cabecera/cuerpo opcionales.
 */
export default function Card({ children, className = '', padding = true, ...rest }) {
  const clases = ['card', className].filter(Boolean).join(' ')
  return (
    <div className={clases} style={!padding ? { padding: 0 } : undefined} {...rest}>
      {children}
    </div>
  )
}

Card.Header = function CardHeader({ titulo, descripcion, acciones }) {
  return (
    <div className="ui-card-header">
      <div>
        {titulo && <h2>{titulo}</h2>}
        {descripcion && <p className="text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="ui-card-header-acciones">{acciones}</div>}
    </div>
  )
}
