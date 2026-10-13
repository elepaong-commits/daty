import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { I18nProvider } from './components/I18nProvider'
import { QueryState } from './components/Field'
import { AlbumDetailPage } from './features/albums/AlbumDetailPage'
import { AlbumsPage } from './features/albums/AlbumsPage'
import { AuthPage } from './features/auth/AuthPage'
import { CoupleSetupPage } from './features/auth/CoupleSetupPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { MapPage } from './features/map/MapPage'
import { PlaceDetailPage } from './features/places/PlaceDetailPage'
import { PlaceEditPage } from './features/places/PlaceEditPage'
import { ApiError } from './lib/api'
import { MapsProvider } from './lib/maps'
import { keys, useMe } from './lib/queries'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
  queryCache: new QueryCache({
    // An expired session on any screen sends the user back to login; a lost couple back to setup.
    onError: (error) => {
      if (!(error instanceof ApiError)) return
      if (error.status === 401) queryClient.setQueryData(keys.me, null)
      if (error.code === 'COUPLE_REQUIRED') queryClient.invalidateQueries({ queryKey: keys.me })
    },
  }),
})

/** Phone-sized column; on wider screens it sits centered like the design frames. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[428px] flex-col overflow-hidden bg-cream pt-[env(safe-area-inset-top)] sm:shadow-card">
      {children}
    </div>
  )
}

function AppShell() {
  return (
    <MapsProvider>
      <Frame>
        <main className="relative flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
        <BottomNav />
      </Frame>
    </MapsProvider>
  )
}

/** Login → couple setup → app, depending on who is signed in. */
function AuthGate() {
  const { data: me, isLoading, error } = useMe()
  if (isLoading || error) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center">
          <QueryState isLoading={isLoading} error={error} />
        </div>
      </Frame>
    )
  }
  if (!me) return <Frame><AuthPage /></Frame>
  if (!me.couple) return <Frame><CoupleSetupPage /></Frame>
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<MapPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="places/:id" element={<PlaceDetailPage />} />
        <Route path="places/:id/edit" element={<PlaceEditPage />} />
        <Route path="albums" element={<AlbumsPage />} />
        <Route path="albums/:id" element={<AlbumDetailPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthGate />
        </BrowserRouter>
      </QueryClientProvider>
    </I18nProvider>
  )
}
