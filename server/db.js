// Conexão com o Postgres (Neon em produção) e criação automática das tabelas
import pg from 'pg'

// colunas DATE voltam como texto AAAA-MM-DD (sem fuso)
pg.types.setTypeParser(1082, (v) => v)

let pool
export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw httpError(500, 'DATABASE_URL não configurada no servidor')
    const local = /localhost|127\.0\.0\.1/.test(url)
    pool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

export async function q(text, params = []) {
  await ensureSchema()
  return getPool().query(text, params)
}

export async function tx(fn) {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const r = await fn((text, params = []) => client.query(text, params))
    await client.query('COMMIT')
    return r
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

export function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  login text NOT NULL UNIQUE,
  email text,
  senha_hash text NOT NULL,
  perfil text NOT NULL CHECK (perfil IN ('admin','operador')),
  ativo boolean NOT NULL DEFAULT true,
  trocar_senha boolean NOT NULL DEFAULT false,
  ultimo_acesso timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor text NOT NULL,
  telefone text,
  contato text,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cliente_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'observacao',
  texto text NOT NULL,
  viabilidade_id uuid,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nome text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interacoes_cliente ON cliente_interacoes(cliente_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS especialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS especialidades_ocultas (
  nome text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS viabilidade_numero_seq;

CREATE TABLE IF NOT EXISTS viabilidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE DEFAULT nextval('viabilidade_numero_seq'),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  tipo_meta text NOT NULL DEFAULT 'faixas',
  data_elaboracao date NOT NULL DEFAULT CURRENT_DATE,
  dados jsonb NOT NULL,
  proposta_data date,
  proposta_validade date,
  emitida_em timestamptz,
  emitida_por_nome text,
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_por_nome text,
  atualizado_por_nome text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_viab_cliente ON viabilidades(cliente_id);

CREATE TABLE IF NOT EXISTS logs (
  id bigserial PRIMARY KEY,
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL,
  detalhes jsonb,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nome text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_entidade ON logs(entidade, entidade_id, criado_em DESC);
`

let schemaPromise
export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = getPool()
      .query(SCHEMA)
      .catch((e) => {
        schemaPromise = null
        throw e
      })
  }
  return schemaPromise
}
