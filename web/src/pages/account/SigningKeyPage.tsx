import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import '@/pages/records/records.css'

export function SigningKeyPage() {
  const [pem, setPem] = useState('')
  useEffect(() => {
    api<{ publicKeyPem: string }>('/v1/capture/signing-key').then((body) => setPem(body.publicKeyPem)).catch(() => setPem(''))
  }, [])
  return (
    <main className="page">
      <h1>Chave pública do manifesto</h1>
      <pre className="key">{pem || 'Carregando a chave.'}</pre>
    </main>
  )
}
