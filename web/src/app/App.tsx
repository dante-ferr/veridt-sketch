import { Navigate, Route, Routes } from 'react-router-dom'
import { AccountPage } from '@/pages/account/AccountPage'
import { SigningKeyPage } from '@/pages/account/SigningKeyPage'
import { ConfirmEmailPage } from '@/pages/auth/ConfirmEmailPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { BillingPage } from '@/pages/credits/BillingPage'
import { CreditsPage } from '@/pages/credits/CreditsPage'
import { PaymentPage } from '@/pages/credits/PaymentPage'
import { CaptureProgressPage } from '@/pages/records/CaptureProgressPage'
import { NewRecordPage } from '@/pages/records/NewRecordPage'
import { RecordDetailPage } from '@/pages/records/RecordDetailPage'
import { RecordsPage } from '@/pages/records/RecordsPage'
import { VideoSessionPage } from '@/pages/records/VideoSessionPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/confirm" element={<ConfirmEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/home" element={<Navigate to="/records" replace />} />
      <Route path="/records" element={<RecordsPage />} />
      <Route path="/records/new" element={<NewRecordPage />} />
      <Route path="/records/:id" element={<RecordDetailPage />} />
      <Route path="/captures/:id" element={<CaptureProgressPage />} />
      <Route path="/captures/:id/session" element={<VideoSessionPage />} />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/credits/billing" element={<BillingPage />} />
      <Route path="/credits/orders/:id" element={<PaymentPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/capture/signing-key" element={<SigningKeyPage />} />
    </Routes>
  )
}
