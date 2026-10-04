# Arpen · Viabilidade & Propostas (v2)

React + Vite no front, uma função da Vercel no back (`api/router.js`) e Postgres (Neon) como banco central.
Mesma estrutura do Banco de Talentos e da Educação Virtual.

## Publicar na Vercel (primeira vez)

1. **Neon:** crie um projeto em neon.tech e copie a *Pooled connection string*.
2. **GitHub:** suba esta pasta para um repositório.
3. **Vercel:** *Add New → Project*, importe o repositório (framework: Vite; os padrões já servem).
4. Em *Settings → Environment Variables*, cadastre:
   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a connection string do Neon |
   | `JWT_SECRET` | um texto aleatório com 32+ caracteres |
   | `ANTHROPIC_API_KEY` | chave da API do Claude (console.anthropic.com) – para os insights com IA |
   | `ANTHROPIC_MODEL` | opcional; padrão `claude-sonnet-5-5` |
5. Faça o deploy. As tabelas são criadas sozinhas no primeiro acesso.
6. Abra o endereço: a primeira tela pede para **criar o administrador**. Depois ele cria os demais usuários em *Usuários*.

## Rodar no computador

```bash
cp .env.example .env   # preencha DATABASE_URL e JWT_SECRET
npm install
npm run dev            # http://localhost:5173 (front + API no mesmo endereço)
```

## Perfis

| | Administrador | Operador |
|---|:-:|:-:|
| Dashboard | ✓ | |
| Clientes: cadastrar, abrir, observações, comparar propostas | ✓ | ✓ |
| Clientes: editar e excluir | ✓ | |
| Viabilidades: criar, editar, emitir proposta, Excel, log | ✓ | ✓ |
| Viabilidades: excluir | ✓ | |
| Especialidades, Usuários, Configurações | ✓ | |

Usuários são criados pelo administrador: o sistema gera o login (ex.: `maria.silva`) e uma senha provisória,
mostrada uma única vez. No primeiro acesso o usuário cria a própria senha. O administrador pode gerar nova senha
e desativar usuários.

## O que fica registrado

- **Log de cada viabilidade:** criação, cada edição (campo, valor antes e depois, versão), mudança de data/validade
  da proposta e cada emissão – sempre com usuário, data e hora.
- **Histórico do cliente:** observações digitadas pela equipe + eventos automáticos (cadastro, viabilidade elaborada,
  editada, proposta emitida).

## Estrutura

```
api/router.js        função única da Vercel (todas as rotas /api/*)
server/              rotas, autenticação, banco (schema automático), diff para logs, IA
src/                 aplicação React
vercel.json          rotas: /api → função; resto → index.html
```
