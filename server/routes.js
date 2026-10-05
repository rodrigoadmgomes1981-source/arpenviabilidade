// Rotas da API (um único roteador para caber no limite de funções da Vercel)
import { q, tx, httpError, faltando } from './db.js'
import {
  criarSessao,
  encerrarSessao,
  usuarioAtual,
  exigirUsuario,
  exigirAdmin,
  hashSenha,
  confereSenha,
  sugerirLogin,
  gerarSenha,
} from './auth.js'
import { diffViabilidade } from './diff.js'
import { gerarInsights } from './ia.js'
import { CONFIG_PADRAO } from '../src/lib/calc.js'

/* ------------------------------------------------------------------ */
/* Conversões linha -> JSON                                            */
/* ------------------------------------------------------------------ */
const usuarioJson = (u) => ({
  id: u.id,
  nome: u.nome,
  login: u.login,
  email: u.email || '',
  perfil: u.perfil,
  ativo: u.ativo,
  trocarSenha: u.trocar_senha,
  ultimoAcesso: u.ultimo_acesso,
  criadoEm: u.criado_em,
})

const clienteJson = (c) => ({
  id: c.id,
  nome: c.nome,
  setor: c.setor,
  telefone: c.telefone || '',
  contato: c.contato || '',
  createdAt: c.criado_em,
  updatedAt: c.atualizado_em,
})

function viabJson(r) {
  return {
    ...r.dados,
    id: r.id,
    numero: r.numero,
    clienteId: r.cliente_id,
    versao: r.versao,
    tipoMeta: r.tipo_meta,
    dataElaboracao: r.data_elaboracao,
    proposta: r.proposta_data ? { data: r.proposta_data, validade: r.proposta_validade } : null,
    emitidaEm: r.emitida_em,
    emitidaPorNome: r.emitida_por_nome,
    criadoPorNome: r.criado_por_nome,
    atualizadoPorNome: r.atualizado_por_nome,
    createdAt: r.criado_em,
    updatedAt: r.atualizado_em,
  }
}

const interacaoJson = (i) => ({
  id: i.id,
  clienteId: i.cliente_id,
  tipo: i.tipo,
  texto: i.texto,
  viabilidadeId: i.viabilidade_id,
  usuarioNome: i.usuario_nome,
  criadoEm: i.criado_em,
})

const logJson = (l) => ({
  id: String(l.id),
  acao: l.acao,
  detalhes: l.detalhes,
  usuarioNome: l.usuario_nome,
  criadoEm: l.criado_em,
})

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const ISO = /^\d{4}-\d{2}-\d{2}$/
const texto = (v, max = 500) => String(v ?? '').trim().slice(0, max)

function dadosViab(b) {
  return {
    impostos: b.impostos || {},
    despAdm: b.despAdm ?? '',
    margem: b.margem || {},
    itens: Array.isArray(b.itens)
      ? b.itens.slice(0, 200).map((i) => ({
          id: texto(i.id, 60),
          especialidade: texto(i.especialidade, 200),
          qualificacao: ['RQE', 'POS', 'LIVRE'].includes(i.qualificacao) ? i.qualificacao : 'LIVRE',
          horas: texto(i.horas, 20),
          valorHora: texto(i.valorHora, 20),
        }))
      : [],
    metas: Array.isArray(b.metas) ? b.metas.filter((m) => ['minima', 'mediana', 'maxima'].includes(m)) : ['minima'],
    observacoes: texto(b.observacoes, 4000),
  }
}

async function registrarLog(db, { entidade, entidadeId, acao, detalhes, usuario }) {
  await db(
    `INSERT INTO logs (entidade, entidade_id, acao, detalhes, usuario_id, usuario_nome)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [entidade, entidadeId, acao, detalhes ? JSON.stringify(detalhes) : null, usuario?.id || null, usuario?.nome || null],
  )
}

async function registrarInteracao(db, { clienteId, tipo, texto: t, viabilidadeId, usuario }) {
  const { rows } = await db(
    `INSERT INTO cliente_interacoes (cliente_id, tipo, texto, viabilidade_id, usuario_id, usuario_nome)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [clienteId, tipo, t, viabilidadeId || null, usuario?.id || null, usuario?.nome || null],
  )
  return rows[0]
}

const num4 = (n) => String(n).padStart(4, '0')

async function lerConfig() {
  const { rows } = await q(`SELECT valor FROM configuracoes WHERE chave = 'geral'`)
  return { ...CONFIG_PADRAO, ...(rows[0]?.valor || {}) }
}

async function loginDisponivel(base) {
  let login = base
  for (let i = 2; i < 500; i++) {
    const { rowCount } = await q('SELECT 1 FROM usuarios WHERE login = $1', [login])
    if (!rowCount) return login
    login = `${base}${i}`
  }
  throw httpError(409, 'Não foi possível gerar um login livre')
}

/* ------------------------------------------------------------------ */
/* Rotas                                                               */
/* ------------------------------------------------------------------ */
const rotas = []
const rota = (method, path, fn) => {
  const keys = []
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$')
  rotas.push({ method, re, keys, fn })
}

/* ---------- Autenticação ---------- */
rota('GET', '/api/auth/status', async ({ req }) => {
  const falta = faltando()
  if (falta.length) return { configuracaoPendente: falta }
  const { rows } = await q('SELECT count(*)::int AS n FROM usuarios')
  const u = await usuarioAtual(req)
  return { precisaConfigurar: rows[0].n === 0, usuario: u ? usuarioJson(u) : null }
})

rota('POST', '/api/auth/setup', async ({ body, res }) => {
  const falta = faltando()
  if (falta.length) throw httpError(503, `Configure no servidor antes de continuar: ${falta.join(', ')}`)
  const nome = texto(body.nome, 120)
  const login = texto(body.login, 60).toLowerCase()
  const senha = String(body.senha || '')
  if (!nome || !login) throw httpError(400, 'Informe nome e login')
  if (senha.length < 8) throw httpError(400, 'A senha precisa ter pelo menos 8 caracteres')
  const u = await tx(async (db) => {
    await db('LOCK TABLE usuarios IN EXCLUSIVE MODE')
    const { rows: c } = await db('SELECT count(*)::int AS n FROM usuarios')
    if (c[0].n > 0) throw httpError(409, 'O sistema já foi configurado')
    const { rows } = await db(
      `INSERT INTO usuarios (nome, login, email, senha_hash, perfil) VALUES ($1,$2,$3,$4,'admin') RETURNING *`,
      [nome, login, texto(body.email, 160) || null, await hashSenha(senha)],
    )
    return rows[0]
  })
  await criarSessao(res, u)
  return { usuario: usuarioJson(u) }
})

rota('POST', '/api/auth/login', async ({ body, res }) => {
  const login = texto(body.login, 160).toLowerCase()
  const { rows } = await q('SELECT * FROM usuarios WHERE lower(login) = $1 OR lower(email) = $1 LIMIT 1', [login])
  const u = rows[0]
  if (!u || !(await confereSenha(String(body.senha || ''), u.senha_hash)))
    throw httpError(401, 'Login ou senha incorretos')
  if (!u.ativo) throw httpError(403, 'Usuário desativado. Fale com o administrador.')
  await q('UPDATE usuarios SET ultimo_acesso = now() WHERE id = $1', [u.id])
  await criarSessao(res, u)
  return { usuario: usuarioJson(u) }
})

rota('POST', '/api/auth/logout', async ({ res }) => {
  encerrarSessao(res)
  return { ok: true }
})

rota('POST', '/api/auth/senha', async ({ req, body }) => {
  const u = await exigirUsuario(req)
  const nova = String(body.nova || '')
  if (nova.length < 8) throw httpError(400, 'A nova senha precisa ter pelo menos 8 caracteres')
  const { rows } = await q('SELECT senha_hash FROM usuarios WHERE id = $1', [u.id])
  if (!(await confereSenha(String(body.atual || ''), rows[0].senha_hash)))
    throw httpError(400, 'Senha atual incorreta')
  await q('UPDATE usuarios SET senha_hash = $1, trocar_senha = false WHERE id = $2', [await hashSenha(nova), u.id])
  return { ok: true }
})

/* ---------- Carga inicial ---------- */
rota('GET', '/api/bootstrap', async ({ req }) => {
  const u = await exigirUsuario(req)
  const [cl, vi, es, oc, cfg] = await Promise.all([
    q('SELECT * FROM clientes ORDER BY nome'),
    q('SELECT * FROM viabilidades ORDER BY atualizado_em DESC'),
    q('SELECT * FROM especialidades ORDER BY nome'),
    q('SELECT nome FROM especialidades_ocultas'),
    lerConfig(),
  ])
  let usuarios = []
  if (u.perfil === 'admin') {
    usuarios = (await q('SELECT * FROM usuarios ORDER BY nome')).rows.map(usuarioJson)
  }
  return {
    usuario: usuarioJson(u),
    clientes: cl.rows.map(clienteJson),
    viabilidades: vi.rows.map(viabJson),
    especialidades: es.rows.map((e) => ({ id: e.id, nome: e.nome, descricao: e.descricao || '' })),
    ocultas: oc.rows.map((o) => o.nome),
    config: cfg,
    usuarios,
  }
})

/* ---------- Clientes ---------- */
rota('POST', '/api/clientes', async ({ req, body }) => {
  const u = await exigirUsuario(req)
  const nome = texto(body.nome, 200)
  const setor = texto(body.setor, 200)
  if (!nome || !setor) throw httpError(400, 'Informe nome e setor do hospital')
  return tx(async (db) => {
    const { rows } = await db(
      `INSERT INTO clientes (nome, setor, telefone, contato, criado_por) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nome, setor, texto(body.telefone, 40), texto(body.contato, 200), u.id],
    )
    await registrarInteracao(db, { clienteId: rows[0].id, tipo: 'sistema', texto: 'Cliente cadastrado', usuario: u })
    return clienteJson(rows[0])
  })
})

rota('PUT', '/api/clientes/:id', async ({ req, body, params }) => {
  const u = await exigirAdmin(req)
  const nome = texto(body.nome, 200)
  const setor = texto(body.setor, 200)
  if (!nome || !setor) throw httpError(400, 'Informe nome e setor do hospital')
  return tx(async (db) => {
    const { rows } = await db(
      `UPDATE clientes SET nome=$1, setor=$2, telefone=$3, contato=$4, atualizado_em=now() WHERE id=$5 RETURNING *`,
      [nome, setor, texto(body.telefone, 40), texto(body.contato, 200), params.id],
    )
    if (!rows[0]) throw httpError(404, 'Cliente não encontrado')
    await registrarInteracao(db, { clienteId: params.id, tipo: 'sistema', texto: 'Dados do cliente atualizados', usuario: u })
    return clienteJson(rows[0])
  })
})

rota('DELETE', '/api/clientes/:id', async ({ req, params }) => {
  const u = await exigirAdmin(req)
  const { rows } = await q('DELETE FROM clientes WHERE id = $1 RETURNING nome', [params.id])
  if (rows[0]) await registrarLog(q, { entidade: 'cliente', entidadeId: params.id, acao: 'excluido', detalhes: { nome: rows[0].nome }, usuario: u })
  return { ok: true }
})

rota('GET', '/api/clientes/:id/interacoes', async ({ req, params }) => {
  await exigirUsuario(req)
  const { rows } = await q(
    'SELECT * FROM cliente_interacoes WHERE cliente_id = $1 ORDER BY criado_em DESC LIMIT 500',
    [params.id],
  )
  return rows.map(interacaoJson)
})

rota('POST', '/api/clientes/:id/interacoes', async ({ req, params, body }) => {
  const u = await exigirUsuario(req)
  const t = texto(body.texto, 4000)
  if (!t) throw httpError(400, 'Escreva a observação')
  const { rowCount } = await q('SELECT 1 FROM clientes WHERE id = $1', [params.id])
  if (!rowCount) throw httpError(404, 'Cliente não encontrado')
  const row = await registrarInteracao(q, { clienteId: params.id, tipo: 'observacao', texto: t, usuario: u })
  return interacaoJson(row)
})

/* ---------- Viabilidades ---------- */
rota('POST', '/api/viabilidades', async ({ req, body }) => {
  const u = await exigirUsuario(req)
  const { rowCount } = await q('SELECT 1 FROM clientes WHERE id = $1', [body.clienteId])
  if (!rowCount) throw httpError(400, 'Cliente inválido')
  const tipo = body.tipoMeta === 'unica' ? 'unica' : 'faixas'
  const dataElab = ISO.test(body.dataElaboracao || '') ? body.dataElaboracao : null
  return tx(async (db) => {
    const { rows } = await db(
      `INSERT INTO viabilidades (cliente_id, tipo_meta, data_elaboracao, dados, criado_por, criado_por_nome, atualizado_por_nome)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$6) RETURNING *`,
      [body.clienteId, tipo, dataElab, JSON.stringify(dadosViab(body)), u.id, u.nome],
    )
    const v = rows[0]
    await registrarLog(db, { entidade: 'viabilidade', entidadeId: v.id, acao: 'criada', detalhes: { versao: 1 }, usuario: u })
    await registrarInteracao(db, {
      clienteId: v.cliente_id,
      tipo: 'sistema',
      texto: `Viabilidade nº ${num4(v.numero)} elaborada`,
      viabilidadeId: v.id,
      usuario: u,
    })
    return viabJson(v)
  })
})

rota('PUT', '/api/viabilidades/:id', async ({ req, body, params }) => {
  const u = await exigirUsuario(req)
  return tx(async (db) => {
    const { rows: old } = await db('SELECT * FROM viabilidades WHERE id = $1 FOR UPDATE', [params.id])
    if (!old[0]) throw httpError(404, 'Viabilidade não encontrada')
    const antes = viabJson(old[0])
    const tipo = body.tipoMeta === 'unica' ? 'unica' : 'faixas'
    const dataElab = ISO.test(body.dataElaboracao || '') ? body.dataElaboracao : antes.dataElaboracao
    const dados = dadosViab(body)
    const mudancas = diffViabilidade(antes, { ...dados, tipoMeta: tipo, dataElaboracao: dataElab })
    if (!mudancas.length) return viabJson(old[0])
    const { rows } = await db(
      `UPDATE viabilidades SET tipo_meta=$1, data_elaboracao=$2, dados=$3, versao=versao+1,
         atualizado_por_nome=$4, atualizado_em=now() WHERE id=$5 RETURNING *`,
      [tipo, dataElab, JSON.stringify(dados), u.nome, params.id],
    )
    const v = rows[0]
    await registrarLog(db, { entidade: 'viabilidade', entidadeId: v.id, acao: 'editada', detalhes: { versao: v.versao, mudancas }, usuario: u })
    await registrarInteracao(db, {
      clienteId: v.cliente_id,
      tipo: 'sistema',
      texto: `Viabilidade nº ${num4(v.numero)} editada (v${v.versao}): ${mudancas.length} alteração(ões)`,
      viabilidadeId: v.id,
      usuario: u,
    })
    return viabJson(v)
  })
})

rota('DELETE', '/api/viabilidades/:id', async ({ req, params }) => {
  const u = await exigirAdmin(req)
  return tx(async (db) => {
    const { rows } = await db('DELETE FROM viabilidades WHERE id = $1 RETURNING numero, cliente_id', [params.id])
    if (rows[0]) {
      await registrarLog(db, { entidade: 'viabilidade', entidadeId: params.id, acao: 'excluida', detalhes: { numero: rows[0].numero }, usuario: u })
      await registrarInteracao(db, { clienteId: rows[0].cliente_id, tipo: 'sistema', texto: `Viabilidade nº ${num4(rows[0].numero)} excluída`, usuario: u })
    }
    return { ok: true }
  })
})

rota('PUT', '/api/viabilidades/:id/proposta', async ({ req, body, params }) => {
  const u = await exigirUsuario(req)
  const { data, validade } = body
  if (!ISO.test(data || '') || !ISO.test(validade || '')) throw httpError(400, 'Datas inválidas')
  return tx(async (db) => {
    const { rows: old } = await db('SELECT * FROM viabilidades WHERE id = $1 FOR UPDATE', [params.id])
    const o = old[0]
    if (!o) throw httpError(404, 'Viabilidade não encontrada')
    if (data < o.data_elaboracao) throw httpError(400, 'A data da proposta não pode ser anterior à data de elaboração')
    if (validade < data) throw httpError(400, 'A validade não pode ser anterior à data da proposta')
    if (o.proposta_data === data && o.proposta_validade === validade) return viabJson(o)
    const { rows } = await db(
      'UPDATE viabilidades SET proposta_data=$1, proposta_validade=$2 WHERE id=$3 RETURNING *',
      [data, validade, params.id],
    )
    const mudancas = []
    if (o.proposta_data !== data) mudancas.push({ campo: 'Data da proposta', de: o.proposta_data, para: data, tipo: 'data' })
    if (o.proposta_validade !== validade) mudancas.push({ campo: 'Validade', de: o.proposta_validade, para: validade, tipo: 'data' })
    await registrarLog(db, { entidade: 'viabilidade', entidadeId: params.id, acao: 'proposta_alterada', detalhes: { mudancas }, usuario: u })
    return viabJson(rows[0])
  })
})

rota('POST', '/api/viabilidades/:id/emitir', async ({ req, params }) => {
  const u = await exigirUsuario(req)
  return tx(async (db) => {
    const { rows: old } = await db('SELECT * FROM viabilidades WHERE id = $1 FOR UPDATE', [params.id])
    const o = old[0]
    if (!o) throw httpError(404, 'Viabilidade não encontrada')
    if (!o.proposta_data) throw httpError(400, 'Defina a data e a validade da proposta antes de emitir')
    const { rows } = await db(
      'UPDATE viabilidades SET emitida_em = now(), emitida_por_nome = $1 WHERE id = $2 RETURNING *',
      [u.nome, params.id],
    )
    const v = rows[0]
    const reemissao = Boolean(o.emitida_em)
    await registrarLog(db, {
      entidade: 'viabilidade',
      entidadeId: v.id,
      acao: reemissao ? 'proposta_reemitida' : 'proposta_emitida',
      detalhes: { versao: v.versao, data: v.proposta_data, validade: v.proposta_validade },
      usuario: u,
    })
    await registrarInteracao(db, {
      clienteId: v.cliente_id,
      tipo: 'sistema',
      texto: `Proposta nº ${num4(v.numero)} (v${v.versao}) ${reemissao ? 'reemitida' : 'emitida'} – válida até ${v.proposta_validade.split('-').reverse().join('/')}`,
      viabilidadeId: v.id,
      usuario: u,
    })
    return viabJson(v)
  })
})

rota('GET', '/api/viabilidades/:id/logs', async ({ req, params }) => {
  await exigirUsuario(req)
  const { rows } = await q(
    `SELECT * FROM logs WHERE entidade = 'viabilidade' AND entidade_id = $1 ORDER BY criado_em DESC, id DESC`,
    [params.id],
  )
  return rows.map(logJson)
})

/* ---------- Especialidades (admin) ---------- */
rota('POST', '/api/especialidades', async ({ req, body }) => {
  const u = await exigirUsuario(req)
  // operador pode cadastrar a partir da viabilidade apenas quando for admin
  if (u.perfil !== 'admin') throw httpError(403, 'Apenas administradores cadastram especialidades')
  const nome = texto(body.nome, 200)
  if (!nome) throw httpError(400, 'Informe o nome')
  try {
    const { rows } = await q(
      'INSERT INTO especialidades (nome, descricao) VALUES ($1,$2) RETURNING *',
      [nome, texto(body.descricao, 500)],
    )
    return { id: rows[0].id, nome: rows[0].nome, descricao: rows[0].descricao || '' }
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'Já existe uma especialidade com esse nome')
    throw e
  }
})

rota('PUT', '/api/especialidades/:id', async ({ req, body, params }) => {
  await exigirAdmin(req)
  const nome = texto(body.nome, 200)
  if (!nome) throw httpError(400, 'Informe o nome')
  return tx(async (db) => {
    const { rows: old } = await db('SELECT nome FROM especialidades WHERE id = $1', [params.id])
    if (!old[0]) throw httpError(404, 'Especialidade não encontrada')
    const { rows } = await db(
      'UPDATE especialidades SET nome=$1, descricao=$2, atualizado_em=now() WHERE id=$3 RETURNING *',
      [nome, texto(body.descricao, 500), params.id],
    )
    await db('UPDATE especialidades_ocultas SET nome = $1 WHERE nome = $2', [nome, old[0].nome])
    return { id: rows[0].id, nome: rows[0].nome, descricao: rows[0].descricao || '' }
  }).catch((e) => {
    if (e.code === '23505') throw httpError(409, 'Já existe uma especialidade com esse nome')
    throw e
  })
})

rota('DELETE', '/api/especialidades/:id', async ({ req, params }) => {
  await exigirAdmin(req)
  const { rows } = await q('DELETE FROM especialidades WHERE id = $1 RETURNING nome', [params.id])
  if (rows[0]) await q('DELETE FROM especialidades_ocultas WHERE nome = $1', [rows[0].nome])
  return { ok: true }
})

rota('POST', '/api/especialidades/ocultas', async ({ req, body }) => {
  await exigirAdmin(req)
  const nome = texto(body.nome, 200)
  if (body.oculta) await q('INSERT INTO especialidades_ocultas (nome) VALUES ($1) ON CONFLICT DO NOTHING', [nome])
  else await q('DELETE FROM especialidades_ocultas WHERE nome = $1', [nome])
  return (await q('SELECT nome FROM especialidades_ocultas')).rows.map((r) => r.nome)
})

/* ---------- Configurações (admin) ---------- */
rota('PUT', '/api/config', async ({ req, body }) => {
  const u = await exigirAdmin(req)
  const atual = await lerConfig()
  const novo = {
    impostos: { ...atual.impostos, ...(body.impostos || {}) },
    variacao: texto(body.variacao ?? atual.variacao, 10),
    modo: body.modo === 'mult' ? 'mult' : 'pp',
    validadeDias: Math.max(1, Math.min(365, parseInt(body.validadeDias ?? atual.validadeDias, 10) || 30)),
  }
  await q(
    `INSERT INTO configuracoes (chave, valor) VALUES ('geral', $1)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`,
    [JSON.stringify(novo)],
  )
  await registrarLog(q, { entidade: 'config', entidadeId: null, acao: 'alterada', detalhes: novo, usuario: u })
  return novo
})

/* ---------- Usuários (admin) ---------- */
rota('POST', '/api/usuarios', async ({ req, body }) => {
  const admin = await exigirAdmin(req)
  const nome = texto(body.nome, 120)
  if (!nome) throw httpError(400, 'Informe o nome')
  const perfil = body.perfil === 'admin' ? 'admin' : 'operador'
  const base = texto(body.login, 60).toLowerCase().replace(/[^a-z0-9._-]/g, '') || sugerirLogin(nome)
  const login = body.login ? base : await loginDisponivel(base)
  const senha = gerarSenha()
  try {
    const { rows } = await q(
      `INSERT INTO usuarios (nome, login, email, senha_hash, perfil, trocar_senha)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
      [nome, login, texto(body.email, 160) || null, await hashSenha(senha), perfil],
    )
    await registrarLog(q, { entidade: 'usuario', entidadeId: rows[0].id, acao: 'criado', detalhes: { login, perfil }, usuario: admin })
    return { usuario: usuarioJson(rows[0]), senha }
  } catch (e) {
    if (e.code === '23505') throw httpError(409, `O login "${login}" já está em uso`)
    throw e
  }
})

rota('PUT', '/api/usuarios/:id', async ({ req, body, params }) => {
  const admin = await exigirAdmin(req)
  const perfil = body.perfil === 'admin' ? 'admin' : 'operador'
  const ativo = body.ativo !== false
  if (params.id === admin.id && (perfil !== 'admin' || !ativo))
    throw httpError(400, 'Você não pode remover o seu próprio acesso de administrador')
  if (perfil !== 'admin' || !ativo) {
    const { rows } = await q(
      `SELECT count(*)::int AS n FROM usuarios WHERE perfil='admin' AND ativo AND id <> $1`,
      [params.id],
    )
    if (rows[0].n === 0) throw httpError(400, 'O sistema precisa de pelo menos um administrador ativo')
  }
  const { rows } = await q(
    'UPDATE usuarios SET nome=$1, email=$2, perfil=$3, ativo=$4 WHERE id=$5 RETURNING *',
    [texto(body.nome, 120), texto(body.email, 160) || null, perfil, ativo, params.id],
  )
  if (!rows[0]) throw httpError(404, 'Usuário não encontrado')
  await registrarLog(q, { entidade: 'usuario', entidadeId: params.id, acao: 'alterado', detalhes: { perfil, ativo }, usuario: admin })
  return usuarioJson(rows[0])
})

rota('POST', '/api/usuarios/:id/resetar-senha', async ({ req, params }) => {
  const admin = await exigirAdmin(req)
  const senha = gerarSenha()
  const { rows } = await q(
    'UPDATE usuarios SET senha_hash=$1, trocar_senha=true WHERE id=$2 RETURNING *',
    [await hashSenha(senha), params.id],
  )
  if (!rows[0]) throw httpError(404, 'Usuário não encontrado')
  await registrarLog(q, { entidade: 'usuario', entidadeId: params.id, acao: 'senha_resetada', usuario: admin })
  return { usuario: usuarioJson(rows[0]), senha }
})

/* ---------- IA: comparar propostas ---------- */
rota('POST', '/api/ia/comparar', async ({ req, body }) => {
  await exigirUsuario(req)
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 6) : []
  if (ids.length < 2) throw httpError(400, 'Selecione pelo menos duas propostas para comparar')
  const { rows } = await q('SELECT * FROM viabilidades WHERE id = ANY($1::uuid[]) ORDER BY numero', [ids])
  if (rows.length < 2) throw httpError(404, 'Propostas não encontradas')
  const { rows: cl } = await q('SELECT * FROM clientes WHERE id = $1', [rows[0].cliente_id])
  const { rows: obs } = await q(
    `SELECT texto, criado_em FROM cliente_interacoes WHERE cliente_id = $1 AND tipo = 'observacao'
     ORDER BY criado_em DESC LIMIT 15`,
    [rows[0].cliente_id],
  )
  return gerarInsights({ cliente: cl[0], viabilidades: rows.map(viabJson), observacoes: obs })
})

/* ------------------------------------------------------------------ */
/* Despacho                                                            */
/* ------------------------------------------------------------------ */
async function lerCorpo(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString() || '{}')
    return req.body || {}
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString()
  return raw ? JSON.parse(raw) : {}
}

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x')
  const path = url.pathname
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  try {
    const r = rotas.find((x) => x.method === req.method && x.re.test(path))
    if (!r) throw httpError(404, 'Rota não encontrada')
    const m = path.match(r.re)
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await lerCorpo(req) : {}
    const out = await r.fn({ req, res, body, params, query: url.searchParams })
    res.statusCode = 200
    res.end(JSON.stringify(out ?? {}))
  } catch (e) {
    const status = e.status || (e.code === '22P02' ? 400 : 500)
    if (status >= 500) console.error(e)
    res.statusCode = status
    res.end(JSON.stringify({ erro: status >= 500 && !e.status ? `Erro no servidor: ${e.message}` : e.message }))
  }
}
