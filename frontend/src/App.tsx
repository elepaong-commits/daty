import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, type ReactNode } from 'react'
import { m } from 'motion/react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Sidebar } from './components/Sidebar'
import { I18nProvider } from './components/I18nProvider'
import { MotionProvider } from './components/MotionProvider'
import { ThemeProvider } from './components/ThemeProvider'
import { QueryState } from './components/Field'
import { MapPage } from './features/map/MapPage'
import { PlaceDetailPage } from './features/places/PlaceDetailPage'
import { ApiError } from './lib/api'
import { MapsProvider } from './lib/maps'
import { useMotionPreset } from './lib/motion'
import { useIsDesktop } from './lib/useIsDesktop'
import { keys, useMe } from './lib/queries'
import { useTheme } from './lib/theme'

// The map (and the place column inside it) is the home screen and loads up front; the other
// screens, and login/setup that a signed-in user never sees, load when first opened.
const AuthPage = lazy(() => import('./features/auth/AuthPage').then((m) => ({ default: m.AuthPage })))
const CoupleSetupPage = lazy(() => import('./features/auth/CoupleSetupPage').then((m) => ({ default: m.CoupleSetupPage })))
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const AlbumsPage = lazy(() => import('./features/albums/AlbumsPage').then((m) => ({ default: m.AlbumsPage })))
const AlbumDetailPage = lazy(() => import('./features/albums/AlbumDetailPage').then((m) => ({ default: m.AlbumDetailPage })))
const ThemePickerPage = lazy(() => import('./features/theme/ThemePickerPage').then((m) => ({ default: m.ThemePickerPage })))
const PlaceEditPage = lazy(() => import('./features/places/PlaceEditPage').then((m) => ({ default: m.PlaceEditPage })))

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

/**
 * The routed screen, easing in whenever the screen changes. On desktop a place opens inside the map
 * screen's column, so the map and its places count as one screen there and the map isn't redrawn.
 */
function Screen() {
  const { pathname } = useLocation()
  const isDesktop = useIsDesktop()
  const { screen } = useMotionPreset()
  const key = isDesktop && /^\/(places\/[^/]+)?$/.test(pathname) ? '/' : pathname
  return (
    <m.div key={key} {...screen} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <Outlet />
    </m.div>
  )
}

function AppShell() {
  return (
    <MapsProvider>
      <Frame wide>
        <Sidebar />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <Suspense fallback={<QueryState isLoading error={null} />}>
            <Screen />
          </Suspense>
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
  const loading = <QueryState isLoading error={null} />
  if (!me) return <Frame wide><Suspense fallback={loading}><AuthPage /></Suspense></Frame>
  if (!me.couple) return <Frame><Suspense fallback={loading}><CoupleSetupPage /></Suspense></Frame>
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

/** A device that hasn't picked a design yet starts on the design picker, before login. */
function ThemeGate({ children }: { children: ReactNode }) {
  const { chosen } = useTheme()
  if (chosen) return children
  return (
    <Suspense fallback={null}>
      <ThemePickerPage />
    </Suspense>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MotionProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <ThemeGate>
                  <AuthGate />
                </ThemeGate>
              </ErrorBoundary>
            </BrowserRouter>
          </MotionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
