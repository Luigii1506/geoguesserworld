import { Fragment } from 'react'

// Mini-renderizador para los textos importados: **negrita** y [enlaces](url).
// Suficiente para los tips de Plonk It sin arrastrar una librería entera.

function renderInline(text: string, keyBase: string) {
  const parts: React.ReactNode[] = []
  // divide por enlaces y negritas conservando el orden
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] && m[2]) {
      parts.push(
        <a key={`${keyBase}-${i++}`} href={m[2]} target="_blank" rel="noreferrer">
          {m[1]}
        </a>,
      )
    } else if (m[3]) {
      parts.push(<strong key={`${keyBase}-${i++}`}>{m[3]}</strong>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function Markdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim())
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ marginBottom: i === paragraphs.length - 1 ? 0 : '0.6em' }}>
          {renderInline(p, `p${i}`).map((node, j) => (
            <Fragment key={j}>{node}</Fragment>
          ))}
        </p>
      ))}
    </>
  )
}
