import { Wordmark } from '@/components/brand/Wordmark'

/** Brand heading shown at the top of every authentication screen. */
export function AuthBrandLockup() {
  return (
    <h1 className="brand-lockup">
      <Wordmark />
    </h1>
  )
}
