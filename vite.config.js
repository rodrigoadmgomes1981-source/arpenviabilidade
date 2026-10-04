import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Em desenvolvimento, `npm run dev` também atende /api usando o mesmo código da Vercel
function apiDev() {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()
        try {
          const { handle } = await server.ssrLoadModule('/server/routes.js')
          await handle(req, res)
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), apiDev()],
    build: { chunkSizeWarningLimit: 1500 },
  }
})
