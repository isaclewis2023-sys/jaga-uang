'use client'

import id from './id'
import en from './en'

export type Language = 'id' | 'en'

const translations = { id, en }

export function getT(lang: Language) {
  return translations[lang]
}

export { id as translationsId, en as translationsEn }
export default translations
