import { Navigate, Route, Routes } from 'react-router-dom'
import { BillingPage, CreditsPage, PaymentPage } from './credits'
import { AccountPage, CaptureProgressPage, NewRecordPage, RecordDetailPage, RecordsPage, SigningKeyPage, VideoSessionPage } from './evidence'
import { ConfirmEmailPage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages'

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
