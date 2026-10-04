// Sessão por cookie httpOnly com JWT assinado
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { q, httpError } from './db.js'

const COOKIE = 'arpen_sessao'
const DIAS = 7

function secret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 16) throw httpError(500, 'JWT_SECRET não configurado (mínimo 16 caracteres)')
  return new TextEncoder().encode(s)
}

export const hashSenha = (senha) => bcrypt.hash(senha, 10)
export const confereSenha = (senha, hash) => bcrypt.compare(senha, hash)

export async function criarSessao(res, usuario) {
  const token = await new SignJWT({ sub: usuario.id, perfil: usuario.perfil })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(secret())
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${DIAS * 86400}${secure}`,
  )
}

export function encerrarSessao(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`)
}

function lerCookie(req, nome) {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === nome) return decodeURIComponent(v.join('='))
  }
  return null
}

/** Usuário logado (ou null). Sempre relê do banco para refletir perfil/ativo atuais. */
export async function usuarioAtual(req) {
  const token = lerCookie(req, COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    const { rows } = await q(
      'SELECT id, nome, login, email, perfil, ativo, trocar_senha FROM usuarios WHERE id = $1',
      [payload.sub],
    )
    const u = rows[0]
    if (!u || !u.ativo) return null
    return u
  } catch {
    return null
  }
}

export async function exigirUsuario(req) {
  const u = await usuarioAtual(req)
  if (!u) throw httpError(401, 'Sessão expirada. Entre novamente.')
  return u
}

export async function exigirAdmin(req) {
  const u = await exigirUsuario(req)
  if (u.perfil !== 'admin') throw httpError(403, 'Apenas administradores podem fazer isso.')
  return u
}

/** Gera login a partir do nome: "Maria da Silva" -> "maria.silva" */
export function sugerirLogin(nome) {
  const partes = String(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((p) => p && !['da', 'de', 'do', 'das', 'dos', 'e'].includes(p))
  if (!partes.length) return 'usuario'
  return partes.length === 1 ? partes[0] : `${partes[0]}.${partes[partes.length - 1]}`
}

/** Senha aleatória legível (sem caracteres ambíguos) */
export function gerarSenha(tam = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(tam)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}
