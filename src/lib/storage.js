// Banco interno (persistido no navegador via localStorage)
import { uid } from './format'
import { saveFile } from './platform'

const KEY = 'arpen-viabilidade-db-v1'

function empty() {
  return { clientes: [], viabilidades: [], especialidades: [], ocultas: [] }
}

export function loadDB() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const db = JSON.parse(raw)
    return {
      clientes: db.clientes || [],
      viabilidades: db.viabilidades || [],
      especialidades: db.especialidades || [],
      ocultas: db.ocultas || [],
    }
  } catch {
    return empty()
  }
}

export function saveDB(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch (e) {
    console.error('Falha ao salvar banco local', e)
  }
}

export function upsertCliente(db, cliente) {
  const now = new Date().toISOString()
  if (cliente.id) {
    return {
      ...db,
      clientes: db.clientes.map((c) => (c.id === cliente.id ? { ...c, ...cliente, updatedAt: now } : c)),
    }
  }
  return { ...db, clientes: [...db.clientes, { ...cliente, id: uid(), createdAt: now, updatedAt: now }] }
}

export function removeCliente(db, id) {
  return {
    ...db,
    clientes: db.clientes.filter((c) => c.id !== id),
    viabilidades: db.viabilidades.filter((v) => v.clienteId !== id),
  }
}

export function upsertViabilidade(db, viab) {
  const now = new Date().toISOString()
  const existing = viab.id && db.viabilidades.find((v) => v.id === viab.id)
  if (existing) {
    const saved = { ...viab, updatedAt: now, versao: (existing.versao || 1) + 1 }
    return { db: { ...db, viabilidades: db.viabilidades.map((v) => (v.id === viab.id ? saved : v)) }, saved }
  }
  const numero = (db.viabilidades.reduce((m, v) => Math.max(m, v.numero || 0), 0) || 0) + 1
  const saved = { ...viab, id: uid(), numero, createdAt: now, updatedAt: now, versao: 1 }
  return { db: { ...db, viabilidades: [...db.viabilidades, saved] }, saved }
}

export function removeViabilidade(db, id) {
  return { ...db, viabilidades: db.viabilidades.filter((v) => v.id !== id) }
}

export function exportBackup(db) {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
  return saveFile(`backup-viabilidade-${new Date().toISOString().slice(0, 10)}.json`, blob)
}

/* ---------------- Especialidades ---------------- */
const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export function existeEspecialidade(lista, nome, ignorarId) {
  return lista.some((e) => (!ignorarId || e.id !== ignorarId) && norm(e.nome) === norm(nome))
}

export function upsertEspecialidade(db, esp) {
  const now = new Date().toISOString()
  const nome = esp.nome.trim()
  if (esp.id) {
    return {
      ...db,
      especialidades: db.especialidades.map((e) => (e.id === esp.id ? { ...e, ...esp, nome, updatedAt: now } : e)),
    }
  }
  return {
    ...db,
    especialidades: [...db.especialidades, { ...esp, nome, id: uid(), createdAt: now, updatedAt: now }],
  }
}

export function removeEspecialidade(db, id) {
  return { ...db, especialidades: db.especialidades.filter((e) => e.id !== id) }
}

export function toggleOculta(db, nome) {
  const ocultas = db.ocultas.includes(nome) ? db.ocultas.filter((n) => n !== nome) : [...db.ocultas, nome]
  return { ...db, ocultas }
}

/** Atualiza só a data/validade da proposta, sem gerar nova versão da viabilidade */
export function salvarDadosProposta(db, id, proposta) {
  return {
    ...db,
    viabilidades: db.viabilidades.map((v) => (v.id === id ? { ...v, proposta: { ...v.proposta, ...proposta } } : v)),
  }
}
