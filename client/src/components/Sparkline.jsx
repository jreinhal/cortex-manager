function buildSparklinePath(values, width, height) {
  if (!Array.isArray(values) || values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : width
  return values
    .map((value, index) => {
      const x = step * index
      const y = height - ((value - min) / range) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function Sparkline({ values, stroke = '#38bdf8' }) {
  const width = 120
  const height = 36
  const path = buildSparklinePath(values, width, height)
  if (!path) {
    return <div className="text-[10px] text-slate-500">No data</div>
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
