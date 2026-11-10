import { AppShell } from '@/components/layout/AppShell'
import { useSession } from '@/hooks/useSession'

export function AccountPage() {
  const session = useSession()
  return (
    <AppShell>
      <section className="panel">
        <h2>Minha conta</h2>
        <p>{session.fullName ? `Olá, ${session.fullName}.` : 'Carregando a sessão.'}</p>
        <p className="hint">Telefone, endereço e faturamento são pedidos na compra de créditos e ficam no serviço de pagamentos.</p>
      </section>
    </AppShell>
  )
}
