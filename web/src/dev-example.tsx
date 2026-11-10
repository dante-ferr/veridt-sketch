import { lazy, Suspense } from 'react'

const ExampleFillButton = import.meta.env.DEV
  ? lazy(() => import('./dev/example-fill').then((module) => ({ default: module.ExampleFillButton })))
  : null

export function DevExampleFill({ onClick }: { onClick: () => void }) {
  if (!import.meta.env.DEV || !ExampleFillButton) return null
  const Button = ExampleFillButton
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 8px' }}>
      <Suspense fallback={null}>
        <Button onClick={onClick} />
      </Suspense>
    </div>
  )
}

export function loadDevSamples() {
  if (!import.meta.env.DEV) return Promise.resolve(null)
  return import('./dev/example-fill')
}
