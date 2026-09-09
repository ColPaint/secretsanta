import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function viteBase() {
  const fromEnv = process.env.VITE_BASE_URL
  if (!fromEnv) {
    return '/'
  }

  return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
}

export default defineConfig({
  base: viteBase(),
  plugins: [react()],
})
