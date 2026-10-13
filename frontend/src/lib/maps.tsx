import { APIProvider } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'
import { BOOT_LANG } from './i18n'

export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined

/** Loads the Maps JS API once for the whole app (map screen and place search share it). */
export function MapsProvider({ children }: { children: ReactNode }) {
  if (!MAPS_API_KEY) return children
  return (
    <APIProvider apiKey={MAPS_API_KEY} language={BOOT_LANG} region="KR">
      {children}
    </APIProvider>
  )
}
