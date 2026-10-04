// Estado global carregado do servidor + ações que gravam na API
import { useCallback, useMemo, useState } from 'react'
import { get, post, put, del } from './api'

const vazio = { clientes: [], viabilidades: [], especialidades: [], ocultas: [], config: null, usuarios: [] }

const upsert = (lista, item) =>
  lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [item, ...lista]

export function useStore() {
  const [db, setDb] = useState(vazio)
  const [carregado, setCarregado] = useState(false)

  const carregar = useCallback(async () => {
    const d = await get('/bootstrap')
    setDb({
      clientes: d.clientes,
      viabilidades: d.viabilidades,
      especialidades: d.especialidades,
      ocultas: d.ocultas,
      config: d.config,
      usuarios: d.usuarios,
    })
    setCarregado(true)
    return d
  }, [])

  const limpar = useCallback(() => {
    setDb(vazio)
    setCarregado(false)
  }, [])

  const acoes = useMemo(
    () => ({
      carregar,
      limpar,
      /* clientes */
      async salvarCliente(c) {
        const r = c.id ? await put(`/clientes/${c.id}`, c) : await post('/clientes', c)
        setDb((d) => ({ ...d, clientes: upsert(d.clientes, r).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }))
        return r
      },
      async excluirCliente(id) {
        await del(`/clientes/${id}`)
        setDb((d) => ({
          ...d,
          clientes: d.clientes.filter((c) => c.id !== id),
          viabilidades: d.viabilidades.filter((v) => v.clienteId !== id),
        }))
      },
      interacoes: (clienteId) => get(`/clientes/${clienteId}/interacoes`),
      addObservacao: (clienteId, texto) => post(`/clientes/${clienteId}/interacoes`, { texto }),
      /* viabilidades */
      async salvarViabilidade(v) {
        const r = v.id ? await put(`/viabilidades/${v.id}`, v) : await post('/viabilidades', v)
        setDb((d) => ({ ...d, viabilidades: upsert(d.viabilidades, r) }))
        return r
      },
      async excluirViabilidade(id) {
        await del(`/viabilidades/${id}`)
        setDb((d) => ({ ...d, viabilidades: d.viabilidades.filter((v) => v.id !== id) }))
      },
      async salvarProposta(id, dados) {
        const r = await put(`/viabilidades/${id}/proposta`, dados)
        setDb((d) => ({ ...d, viabilidades: upsert(d.viabilidades, r) }))
        return r
      },
      async emitirProposta(id) {
        const r = await post(`/viabilidades/${id}/emitir`)
        setDb((d) => ({ ...d, viabilidades: upsert(d.viabilidades, r) }))
        return r
      },
      logs: (id) => get(`/viabilidades/${id}/logs`),
      comparar: (ids) => post('/ia/comparar', { ids }),
      /* especialidades */
      async salvarEspecialidade(e) {
        const r = e.id ? await put(`/especialidades/${e.id}`, e) : await post('/especialidades', e)
        setDb((d) => {
          const antigo = d.especialidades.find((x) => x.id === r.id)
          const ocultas = antigo && antigo.nome !== r.nome ? d.ocultas.map((n) => (n === antigo.nome ? r.nome : n)) : d.ocultas
          return { ...d, ocultas, especialidades: upsert(d.especialidades, r).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }
        })
        return r
      },
      async excluirEspecialidade(id) {
        await del(`/especialidades/${id}`)
        setDb((d) => {
          const e = d.especialidades.find((x) => x.id === id)
          return {
            ...d,
            especialidades: d.especialidades.filter((x) => x.id !== id),
            ocultas: d.ocultas.filter((n) => n !== e?.nome),
          }
        })
      },
      async ocultar(nome, oculta) {
        const ocultas = await post('/especialidades/ocultas', { nome, oculta })
        setDb((d) => ({ ...d, ocultas }))
      },
      /* configurações */
      async salvarConfig(cfg) {
        const config = await put('/config', cfg)
        setDb((d) => ({ ...d, config }))
        return config
      },
      /* usuários */
      async criarUsuario(u) {
        const r = await post('/usuarios', u)
        setDb((d) => ({ ...d, usuarios: upsert(d.usuarios, r.usuario) }))
        return r
      },
      async atualizarUsuario(u) {
        const r = await put(`/usuarios/${u.id}`, u)
        setDb((d) => ({ ...d, usuarios: upsert(d.usuarios, r) }))
        return r
      },
      async resetarSenha(id) {
        const r = await post(`/usuarios/${id}/resetar-senha`)
        setDb((d) => ({ ...d, usuarios: upsert(d.usuarios, r.usuario) }))
        return r
      },
      trocarMinhaSenha: (atual, nova) => post('/auth/senha', { atual, nova }),
    }),
    [carregar, limpar],
  )

  return { db, carregado, acoes }
}
