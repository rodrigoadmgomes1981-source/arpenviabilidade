// Especialidades médicas reconhecidas pelo CFM
// (Resolução CFM nº 2.330/2023 e atualizações – 55 especialidades)
export const ESPECIALIDADES_CFM = [
  'Acupuntura',
  'Alergia e Imunologia',
  'Anestesiologia',
  'Angiologia',
  'Cardiologia',
  'Cirurgia Cardiovascular',
  'Cirurgia da Mão',
  'Cirurgia de Cabeça e Pescoço',
  'Cirurgia do Aparelho Digestivo',
  'Cirurgia Geral',
  'Cirurgia Oncológica',
  'Cirurgia Pediátrica',
  'Cirurgia Plástica',
  'Cirurgia Torácica',
  'Cirurgia Vascular',
  'Clínica Médica',
  'Coloproctologia',
  'Dermatologia',
  'Endocrinologia e Metabologia',
  'Endoscopia',
  'Gastroenterologia',
  'Genética Médica',
  'Geriatria',
  'Ginecologia e Obstetrícia',
  'Hematologia e Hemoterapia',
  'Homeopatia',
  'Infectologia',
  'Mastologia',
  'Medicina de Emergência',
  'Medicina de Família e Comunidade',
  'Medicina do Trabalho',
  'Medicina de Tráfego',
  'Medicina Esportiva',
  'Medicina Física e Reabilitação',
  'Medicina Intensiva',
  'Medicina Legal e Perícia Médica',
  'Medicina Nuclear',
  'Medicina Preventiva e Social',
  'Nefrologia',
  'Neurocirurgia',
  'Neurologia',
  'Nutrologia',
  'Oftalmologia',
  'Oncologia Clínica',
  'Ortopedia e Traumatologia',
  'Otorrinolaringologia',
  'Patologia',
  'Patologia Clínica/Medicina Laboratorial',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Radiologia e Diagnóstico por Imagem',
  'Radioterapia',
  'Reumatologia',
  'Urologia',
]

export const QUALIFICACOES = {
  RQE: 'Com RQE',
  POS: 'Com Pós',
  LIVRE: 'Sem titulação',
}

/**
 * Catálogo usado no sistema: especialidades do CFM + cadastradas pelo usuário,
 * sem as que foram ocultadas. Cada item: { nome, origem: 'CFM' | 'PROPRIA', valorRef? }
 */
export function catalogoEspecialidades(db, { incluirOcultas = false } = {}) {
  const ocultas = new Set(db.ocultas || [])
  const lista = [
    ...ESPECIALIDADES_CFM.map((nome) => ({ nome, origem: 'CFM' })),
    ...(db.especialidades || []).map((e) => ({ ...e, origem: 'PROPRIA' })),
  ]
  return lista
    .filter((e) => incluirOcultas || !ocultas.has(e.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

const normNome = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Já existe uma especialidade com esse nome (ignorando acentos e maiúsculas)? */
export function existeEspecialidade(lista, nome, ignorarId) {
  return lista.some((e) => (!ignorarId || e.id !== ignorarId) && normNome(e.nome) === normNome(nome))
}
