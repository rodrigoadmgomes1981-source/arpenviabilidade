import logo from '../assets/arpen-logo.png'

const INFO = {
  DATABASE_URL: {
    titulo: 'Banco de dados (Neon)',
    como: 'No painel do Neon, abra o projeto → Connection Details → copie a “Pooled connection string” (começa com postgresql://).',
    exemplo: 'postgresql://usuario:senha@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  },
  JWT_SECRET: {
    titulo: 'Segredo das sessões',
    como: 'Qualquer texto aleatório com 32 caracteres ou mais. Não precisa guardar; só não compartilhe.',
    exemplo: 'arpen-viab-7f3K9qLm2Xc8Vw1Rt6Yb4Np0Hs5Jd',
  },
}

/** Tela mostrada quando o servidor ainda não tem as variáveis de ambiente obrigatórias */
export default function ConfigPendente({ faltando }) {
  const local = /localhost|127\.0\.0\.1/.test(location.hostname)
  return (
    <div className="login-wrap">
      <div className="login-card setup-guide">
        <img src={logo} alt="Arpen" className="login-logo" />
        <h1>Falta configurar o servidor</h1>
        <p className="muted">
          O sistema está no ar, mas ainda não sabe onde fica o banco de dados. Cadastre {faltando.length > 1 ? 'as variáveis' : 'a variável'} abaixo e
          recarregue a página.
        </p>
        {faltando.map((k) => (
          <div key={k} className="env-item">
            <code>{k}</code>
            <strong>{INFO[k]?.titulo}</strong>
            <span className="tiny muted">{INFO[k]?.como}</span>
            <span className="tiny">Exemplo: <code className="ex">{INFO[k]?.exemplo}</code></span>
          </div>
        ))}
        {local ? (
          <ol className="steps">
            <li>Na pasta do projeto, copie <code>.env.example</code> para <code>.env</code>.</li>
            <li>Preencha os valores no arquivo <code>.env</code>.</li>
            <li>Pare e rode de novo <code>npm run dev</code>.</li>
          </ol>
        ) : (
          <ol className="steps">
            <li>Na Vercel, abra o projeto → <strong>Settings → Environment Variables</strong>.</li>
            <li>Adicione cada variável com o nome exato acima, marcando Production, Preview e Development.</li>
            <li>
              Vá em <strong>Deployments</strong>, clique nos três pontos do último deploy e escolha <strong>Redeploy</strong>.
              Variáveis novas só valem depois de um novo deploy.
            </li>
          </ol>
        )}
        <button className="btn primary full" onClick={() => location.reload()}>
          Já configurei, recarregar
        </button>
      </div>
    </div>
  )
}
