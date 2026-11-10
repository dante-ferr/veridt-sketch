import { useState } from 'react'
import { billingSample, registrationSample } from './sample-data'

export { billingSample, registrationSample }

export function ExampleFillButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? '#143f3c' : '#c5ced6'}`,
        borderRadius: 6,
        background: hover ? '#f7f5ef' : 'transparent',
        color: hover ? '#143f3c' : '#5c6770',
        padding: '4px 10px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Preencher exemplo
    </button>
  )
}
