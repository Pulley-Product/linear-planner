// Shared design system components

const AV_BG = ['#dbeafe','#dcfce7','#fef9c3','#fee2e2','#ede9fe','#cffafe','#ffedd5','#fce7f3']
const AV_FG = ['#1d4ed8','#166534','#854d0e','#991b1b','#5b21b6','#0e7490','#9a3412','#9d174d']

export const SEG = ['#3b82f6','#22c55e','#eab308','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

export const ini = n => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

export const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '–'

export function Avatar({ name, i, sz = 30 }) {
  return (
    <div style={{
      width: sz, height: sz, borderRadius: '50%',
      background: AV_BG[i % AV_BG.length], color: AV_FG[i % AV_FG.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontSize: sz * 0.35, fontWeight: 500, flexShrink: 0,
    }}>
      {ini(name)}
    </div>
  )
}

export function Btn({ children, onClick, disabled, danger }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer', border: 'none',
      background: danger ? '#e63946' : '#1a1a2e', color: 'white',
      opacity: disabled ? 0.35 : 1, fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}

export function GBtn({ children, onClick, sm }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: sm ? '6px 12px' : '9px 16px',
      borderRadius: sm ? 6 : 8, fontSize: sm ? 12 : 13, fontWeight: 500,
      cursor: 'pointer', background: 'transparent', color: '#5a5a72',
      border: '1.5px solid #dddcd5', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

export function Card({ children, style }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #dddcd5', borderRadius: 12,
      padding: 22, marginBottom: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function Row({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
      {children}
    </div>
  )
}

export function H1({ children }) {
  return (
    <h1 style={{ fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 6 }}>
      {children}
    </h1>
  )
}

export function R({ children }) {
  return <span style={{ color: '#e63946' }}>{children}</span>
}

export function Sub({ children }) {
  return <p style={{ color: '#5a5a72', marginBottom: 20, fontSize: 13, fontWeight: 300 }}>{children}</p>
}

export function Err({ children }) {
  return (
    <div style={{
      color: '#e63946', fontFamily: 'monospace', fontSize: 12, marginBottom: 14,
      padding: '9px 13px', background: 'rgba(230,57,70,0.08)',
      borderRadius: 6, border: '1px solid rgba(230,57,70,0.2)',
    }}>
      {children}
    </div>
  )
}

export function SecTitle({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{
        fontFamily: 'monospace', fontSize: 9, color: '#9a9a9e',
        textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: '#dddcd5' }} />
    </div>
  )
}

export function Check({ checked }) {
  return (
    <div style={{
      width: 17, height: 17, borderRadius: 4,
      border: `2px solid ${checked ? '#1a1a2e' : '#c8c7be'}`,
      background: checked ? '#1a1a2e' : 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: 'white', flexShrink: 0,
    }}>
      {checked ? '✓' : ''}
    </div>
  )
}

export function Radio({ checked }) {
  return (
    <div style={{
      width: 17, height: 17, borderRadius: '50%',
      border: `2px solid ${checked ? '#1a1a2e' : '#c8c7be'}`,
      background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {checked && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a1a2e' }} />}
    </div>
  )
}

export function SaveDot({ state }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'monospace', fontSize: 11, color: '#9a9a9e',
      padding: '4px 11px', background: '#f0efe9', borderRadius: 20, border: '1px solid #dddcd5',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: state === 'saving' ? '#f4a261' : '#2d6a4f',
      }} />
      {state === 'saving' ? 'Saving…' : 'Saved'}
    </div>
  )
}

export const inpS = {
  background: '#f0efe9', border: '1.5px solid #dddcd5', color: '#1a1a2e',
  fontFamily: 'monospace', fontSize: 13, padding: '9px 13px',
  borderRadius: 8, outline: 'none', width: '100%',
}

export const pickRowStyle = sel => ({
  display: 'flex', alignItems: 'center', gap: 12,
  background: sel ? 'white' : '#f0efe9',
  border: `1.5px solid ${sel ? '#1a1a2e' : '#dddcd5'}`,
  borderRadius: 8, padding: '13px 15px', marginBottom: 8, cursor: 'pointer',
  boxShadow: sel ? '0 0 0 3px rgba(26,26,46,0.05)' : 'none',
})
