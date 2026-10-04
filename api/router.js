// Função única da Vercel: todas as rotas /api/* chegam aqui (ver vercel.json)
import { handle } from '../server/routes.js'

export default function handler(req, res) {
  return handle(req, res)
}
