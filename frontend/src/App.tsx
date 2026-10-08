import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { AlbumsPage } from './features/albums/AlbumsPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { MapPage } from './features/map/MapPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

/** Phone-sized column; on wider screens it sits centered like the design frames. */
function AppShell() {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[428px] flex-col overflow-hidden bg-cream pt-[env(safe-area-inset-top)] sm:shadow-card">
      <main className="relative flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<MapPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="albums" element={<AlbumsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
