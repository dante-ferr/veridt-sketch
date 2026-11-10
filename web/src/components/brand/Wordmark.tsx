import logoUrl from '@/assets/veridt-logo.svg'
import './Wordmark.css'

export function Wordmark() {
  return (
    <span className="wordmark">
      <img className="mark" src={logoUrl} alt="" />
      <span className="mark-name">Veridt</span>
    </span>
  )
}
