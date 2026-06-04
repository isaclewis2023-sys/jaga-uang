import { LanguageProvider } from '@/hooks/useLanguage'
import AppShell from '@/components/AppShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AppShell>{children}</AppShell>
    </LanguageProvider>
  )
}
