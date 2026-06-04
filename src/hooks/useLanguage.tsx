'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getT, Language } from '@/lib/i18n'

interface LanguageContextType {
  lang: Language
  setLang: (l: Language) => void
  t: ReturnType<typeof getT>
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('id')

  useEffect(() => {
    const saved = localStorage.getItem('jaga-uang-lang') as Language | null
    if (saved === 'id' || saved === 'en') setLangState(saved)
  }, [])

  const setLang = (l: Language) => {
    setLangState(l)
    localStorage.setItem('jaga-uang-lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: getT(lang) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
