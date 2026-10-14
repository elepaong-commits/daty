import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Sidebar } from './components/Sidebar'
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

// An expired session on any screen sends the user back to login; a lost couple back to setup.
function onApiError(error: Error) {
  if (!(error instanceof ApiError)) return
  if (error.status === 401) queryClient.setQueryData(keys.me, null)
  if (error.code === 'COUPLE_REQUIRED') queryClient.invalidateQueries({ queryKey: keys.me })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
})

/**
 * Phone-sized column; on wider screens it sits centered like the design frames. `wide` screens
 * (the app itself and login) take the whole window from the desktop breakpoint up.
 */
function Frame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`mx-auto flex h-dvh w-full max-w-[428px] flex-col overflow-hidden bg-cream pt-[env(safe-area-inset-top)] sm:shadow-card ${
        wide ? 'lg:max-w-none lg:flex-row lg:shadow-none' : ''
      }`}
    >
      {children}
    </div>
  )
}

function AppShell() {
  return (
    <MapsProvider>
      <Frame wide>
        <Sidebar />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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
  if (!me) return <Frame wide><AuthPage /></Frame>
  if (!me.couple) return <Frame><CoupleSetupPage /></Frame>
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* On desktop the place opens in the map's side column, so the map stays mounted around it. */}
        <Route element={<MapPage />}>
          <Route index />
          <Route path="places/:id" element={<PlaceDetailPage />} />
        </Route>
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="places/:id/edit" element={<PlaceEditPage />} />
        <Route path="albums" element={<AlbumsPage />} />
        <Route path="albums/:id" element={<AlbumDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <AuthGate />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </I18nProvider>
  )
}
