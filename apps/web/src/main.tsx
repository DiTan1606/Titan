import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MascotPreview } from './dev/MascotPreview'
import { lockPageScroll } from './lib/keyboardLock'

// iOS Safari bỏ qua user-scalable=no, nên chặn cử chỉ pinch-zoom trực tiếp
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
}

lockPageScroll()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {import.meta.env.DEV && location.search.includes('preview=mascot') ? <MascotPreview /> : <App />}
    </QueryClientProvider>
  </StrictMode>,
)
