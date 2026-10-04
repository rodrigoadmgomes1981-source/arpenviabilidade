// Cliente HTTP da API (sessão por cookie)
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let onUnauthorized = () => {}
export const setOnUnauthorized = (fn) => (onUnauthorized = fn)

export async function api(method, path, body) {
  let r
  try {
    r = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.')
  }
  let data = null
  try {
    data = await r.json()
  } catch {
    /* resposta vazia */
  }
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/auth/')) onUnauthorized()
    throw new ApiError(r.status, data?.erro || `Erro ${r.status}`)
  }
  return data
}

export const get = (p) => api('GET', p)
export const post = (p, b = {}) => api('POST', p, b)
export const put = (p, b = {}) => api('PUT', p, b)
export const del = (p) => api('DELETE', p)
