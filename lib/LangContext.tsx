'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { type Lang, translations } from './i18n'

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  T: typeof translations['en']
  isRTL: boolean
}

const LangContext = createContext<LangContextType>({
  lang: 'he',
  setLang: () => {},
  T: translations['he'],
  isRTL: true,
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('he')
  return (
    <LangContext.Provider value={{ lang, setLang, T: translations[lang], isRTL: lang === 'he' }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
