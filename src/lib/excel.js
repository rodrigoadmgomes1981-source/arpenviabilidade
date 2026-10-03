import ExcelJS from 'exceljs'
import logoUrl from '../assets/arpen-logo.png'
import { calcular, metasSelecionadas, nomeItem, METAS } from './calc'
import { fmtDataCurta } from './format'
import { saveFile } from './platform'

const NAVY = 'FF1A2640'
const GREEN = 'FF64CEAF'
const LIGHT = 'FFEAF8F3'
const BRL = '"R$" #,##0.00'
const PCT = '0.00%'

async function logoBase64() {
  try {
    if (String(logoUrl).startsWith('data:')) return String(logoUrl).split(',')[1]
    const buf = await (await fetch(logoUrl)).arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  } catch {
    return null
  }
}

async function addLogo(wb, ws, col = 1, row = 0) {
  const b64 = await logoBase64()
  if (!b64) return
  const id = wb.addImage({ base64: b64, extension: 'png' })
  ws.addImage(id, { tl: { col, row: row + 0.2 }, ext: { width: 170, height: 48 } })
}

function header(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
}
function band(row, color = LIGHT) {
  row.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }))
}
function borderAll(ws, r1, r2, c1, c2) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++)
      ws.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: 'FFD0D7E2' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7E2' } },
        left: { style: 'thin', color: { argb: 'FFD0D7E2' } },
        right: { style: 'thin', color: { argb: 'FFD0D7E2' } },
      }
}

function download(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  return saveFile(filename, blob)
}

const slug = (s) =>
  String(s || 'cliente')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

/* ---------------- Aba Proposta (modelo da planilha) ---------------- */
async function sheetProposta(wb, viab, cliente, calc) {
  const ws = wb.addWorksheet('Proposta', { views: [{ showGridLines: false }] })
  const metas = metasSelecionadas(viab)
  const nMetas = metas.length
  ws.columns = [{ width: 3 }, { width: 52 }, ...metas.map(() => ({ width: 20 }))]
  await addLogo(wb, ws, 1, 0)
  ws.getRow(1).height = 22
  ws.getRow(2).height = 22
  ws.getRow(3).height = 10

  const lastCol = 2 + nMetas
  ws.mergeCells(4, 2, 4, lastCol)
  const t = ws.getCell(4, 2)
  t.value = 'PROPOSTA COMERCIAL – GESTÃO DE SERVIÇOS MÉDICOS'
  t.font = { bold: true, size: 14, color: { argb: NAVY } }

  const info = [
    ['Cliente', cliente?.nome],
    ['Setor do hospital', cliente?.setor],
    ['Contato', [cliente?.contato, cliente?.telefone].filter(Boolean).join(' – ')],
    ['Proposta nº', `${String(viab.numero || '').padStart(4, '0')} (v${viab.versao || 1})`],
    ['Data', fmtDataCurta(viab.updatedAt || new Date().toISOString())],
  ]
  let r = 5
  for (const [k, v] of info) {
    ws.getCell(r, 2).value = `${k}: ${v || '—'}`
    ws.getCell(r, 2).font = { color: { argb: 'FF44506A' } }
    r++
  }
  r++

  // Cabeçalho (igual aba "proposta": Descrição | Meta Mínima | Meta Mediana | Meta Máxima)
  const hr = r
  ws.getCell(hr, 2).value = 'Descrição'
  metas.forEach((m, i) => (ws.getCell(hr, 3 + i).value = m.label))
  for (let c = 2; c <= lastCol; c++) header(ws.getCell(hr, c))
  ws.getRow(hr).height = 24
  r++

  // 1. Custos Operacionais
  const r1 = r
  ws.getCell(r, 2).value = '1. Custos Operacionais - Serviços Médicos'
  ws.getCell(r, 2).font = { bold: true }
  metas.forEach((m, i) => {
    const c = ws.getCell(r, 3 + i)
    c.value = calc.custoTotal
    c.numFmt = BRL
    c.font = { bold: true }
  })
  band(ws.getRow(r))
  r++
  for (const it of calc.itens) {
    ws.getCell(r, 2).value = `   • ${nomeItem(it)} – ${it.horasN.toLocaleString('pt-BR')} h`
    ws.getCell(r, 2).font = { color: { argb: 'FF5B6478' }, size: 10 }
    metas.forEach((m, i) => {
      const c = ws.getCell(r, 3 + i)
      c.value = it.custo
      c.numFmt = BRL
      c.font = { color: { argb: 'FF5B6478' }, size: 10 }
    })
    r++
  }
  r++
  // 2. Taxas e Impostos
  const r2 = r
  ws.getCell(r, 2).value = `2. Taxas e Impostos (${calc.taxPct.toLocaleString('pt-BR')}%)`
  ws.getCell(r, 2).font = { bold: true }
  metas.forEach((m, i) => {
    const c = ws.getCell(r, 3 + i)
    c.value = calc.metas[m.key].impostos
    c.numFmt = BRL
    c.font = { bold: true }
  })
  band(ws.getRow(r))
  r += 2
  // Custo Total
  const rct = r
  ws.getCell(r, 2).value = 'Custo Total'
  ws.getCell(r, 2).font = { bold: true }
  metas.forEach((m, i) => {
    const col = ws.getColumn(3 + i).letter
    const c = ws.getCell(r, 3 + i)
    c.value = { formula: `${col}${r1}+${col}${r2}`, result: calc.custoTotal + calc.metas[m.key].impostos }
    c.numFmt = BRL
    c.font = { bold: true }
  })
  r += 2
  // 3. Taxa adm e lucro
  const r3 = r
  ws.getCell(r, 2).value = '3. Taxa de administração e lucro'
  ws.getCell(r, 2).font = { bold: true }
  metas.forEach((m, i) => {
    const c = ws.getCell(r, 3 + i)
    c.value = calc.metas[m.key].taxaAdmLucro
    c.numFmt = BRL
    c.font = { bold: true }
  })
  band(ws.getRow(r))
  r += 2
  // Valor Total Mensal
  ws.getCell(r, 2).value = 'Valor Total Mensal'
  metas.forEach((m, i) => {
    const col = ws.getColumn(3 + i).letter
    const c = ws.getCell(r, 3 + i)
    c.value = { formula: `${col}${rct}+${col}${r3}`, result: calc.metas[m.key].faturamento }
    c.numFmt = BRL
  })
  for (let c = 2; c <= lastCol; c++) {
    const cell = ws.getCell(r, c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  }
  ws.getRow(r).height = 22
  borderAll(ws, hr, r, 2, lastCol)
  r += 2

  // Valor hora faturado por especialidade
  ws.getCell(r, 2).value = 'Valor hora por especialidade'
  ws.getCell(r, 2).font = { bold: true, color: { argb: NAVY } }
  r++
  const h2 = r
  ws.getCell(r, 2).value = 'Especialidade'
  metas.forEach((m, i) => (ws.getCell(r, 3 + i).value = m.label))
  for (let c = 2; c <= lastCol; c++) header(ws.getCell(r, c))
  r++
  calc.itens.forEach((it, idx) => {
    ws.getCell(r, 2).value = `${nomeItem(it)} – ${it.horasN.toLocaleString('pt-BR')} h/mês`
    metas.forEach((m, i) => {
      const c = ws.getCell(r, 3 + i)
      c.value = calc.metas[m.key].linhas[idx].valorHoraFaturar
      c.numFmt = BRL
    })
    r++
  })
  borderAll(ws, h2, r - 1, 2, lastCol)
  r++
  if (viab.observacoes) {
    ws.getCell(r, 2).value = `Observações: ${viab.observacoes}`
    ws.getCell(r, 2).alignment = { wrapText: true }
    r++
  }
  ws.getCell(r, 2).value = 'Valores mensais. Proposta válida por 30 dias.'
  ws.getCell(r, 2).font = { italic: true, size: 9, color: { argb: 'FF8A93A6' } }
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
}

/* ---------------- Aba Viabilidade (memória de cálculo) ---------------- */
async function sheetViabilidade(wb, viab, cliente, calc) {
  const ws = wb.addWorksheet('Viabilidade', { views: [{ showGridLines: false }] })
  ws.columns = [
    { width: 3 }, { width: 40 }, { width: 14 }, { width: 10 }, { width: 14 },
    { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 },
  ]
  await addLogo(wb, ws, 1, 0)
  ws.getRow(1).height = 22
  ws.getRow(2).height = 22
  let r = 4
  ws.getCell(r, 2).value = 'ESTUDO DE VIABILIDADE'
  ws.getCell(r, 2).font = { bold: true, size: 14, color: { argb: NAVY } }
  r++
  const info = [
    ['Cliente', cliente?.nome],
    ['Setor do hospital', cliente?.setor],
    ['Telefone', cliente?.telefone],
    ['Contato', cliente?.contato],
    ['Nº / versão', `${String(viab.numero || '').padStart(4, '0')} / v${viab.versao || 1}`],
    ['Atualizado em', fmtDataCurta(viab.updatedAt)],
  ]
  for (const [k, v] of info) {
    ws.getCell(r, 2).value = k
    ws.getCell(r, 2).font = { bold: true }
    ws.getCell(r, 3).value = v || '—'
    r++
  }
  r++

  // Impostos
  ws.getCell(r, 2).value = 'Tributos'
  ws.getCell(r, 3).value = 'Alíquota'
  header(ws.getCell(r, 2))
  header(ws.getCell(r, 3))
  const ti = r + 1
  r++
  for (const imp of calc.metas.minima.impostosDet) {
    ws.getCell(r, 2).value = imp.label
    ws.getCell(r, 3).value = imp.aliquota / 100
    ws.getCell(r, 3).numFmt = PCT
    r++
  }
  ws.getCell(r, 2).value = 'Total tributos'
  ws.getCell(r, 2).font = { bold: true }
  ws.getCell(r, 3).value = { formula: `SUM(C${ti}:C${r - 1})`, result: calc.taxPct / 100 }
  ws.getCell(r, 3).numFmt = PCT
  ws.getCell(r, 3).font = { bold: true }
  borderAll(ws, ti - 1, r, 2, 3)
  r += 2

  ws.getCell(r, 2).value = 'Despesas administrativas (R$/mês)'
  ws.getCell(r, 2).font = { bold: true }
  ws.getCell(r, 3).value = calc.despAdm
  ws.getCell(r, 3).numFmt = BRL
  r += 2

  ws.getCell(r, 2).value = 'Faixas de margem'
  header(ws.getCell(r, 2))
  header(ws.getCell(r, 3))
  ws.getCell(r, 3).value = 'Margem'
  const fm = r
  r++
  for (const m of METAS) {
    ws.getCell(r, 2).value = m.label
    ws.getCell(r, 3).value = calc.faixas[m.key] / 100
    ws.getCell(r, 3).numFmt = PCT
    r++
  }
  ws.getCell(r, 2).value = `Variação entre faixas: ${viab.margem.variacao} ${viab.margem.modo === 'mult' ? '(multiplicador)' : 'p.p.'}`
  ws.getCell(r, 2).font = { italic: true, size: 9 }
  borderAll(ws, fm, r - 1, 2, 3)
  r += 2

  // Resumo por meta
  const metas = metasSelecionadas(viab)
  ws.getCell(r, 2).value = 'Resumo'
  metas.forEach((m, i) => (ws.getCell(r, 3 + i * 2).value = m.label))
  header(ws.getCell(r, 2))
  metas.forEach((m, i) => {
    ws.mergeCells(r, 3 + i * 2, r, 4 + i * 2)
    header(ws.getCell(r, 3 + i * 2))
  })
  const rs = r
  r++
  const linhasResumo = [
    ['FATURAMENTO', (k) => calc.metas[k].faturamento],
    ['( - ) Tributos', (k) => calc.metas[k].impostos],
    ['( - ) Custo serviços prestados', () => calc.custoTotal],
    ['( - ) Despesas administrativas', () => calc.despAdm],
    ['RESULTADO (lucro)', (k) => calc.metas[k].lucro],
  ]
  for (const [label, fn] of linhasResumo) {
    ws.getCell(r, 2).value = label
    metas.forEach((m, i) => {
      ws.mergeCells(r, 3 + i * 2, r, 4 + i * 2)
      const c = ws.getCell(r, 3 + i * 2)
      c.value = fn(m.key)
      c.numFmt = BRL
    })
    r++
  }
  ws.getCell(r, 2).value = 'Margem'
  metas.forEach((m, i) => {
    ws.mergeCells(r, 3 + i * 2, r, 4 + i * 2)
    const c = ws.getCell(r, 3 + i * 2)
    c.value = calc.metas[m.key].margemReal / 100
    c.numFmt = PCT
  })
  ws.getRow(rs + 1).font = { bold: true }
  ws.getRow(r - 1).font = { bold: true }
  borderAll(ws, rs, r, 2, 2 + metas.length * 2)
  r += 2

  // Detalhe por especialidade, uma tabela por meta
  for (const m of metas) {
    const mc = calc.metas[m.key]
    ws.getCell(r, 2).value = `${m.label} – margem ${mc.margemPct.toLocaleString('pt-BR')}%`
    ws.getCell(r, 2).font = { bold: true, color: { argb: NAVY }, size: 12 }
    r++
    const cols = ['Profissional', 'Titulação', 'Horas', 'Valor hora a pagar', 'Custo total', 'Valor hora a faturar', 'Faturamento total', 'Resultado bruto']
    cols.forEach((h, i) => {
      ws.getCell(r, 2 + i).value = h
      header(ws.getCell(r, 2 + i))
    })
    ws.getRow(r).height = 30
    const start = r + 1
    r++
    calc.itens.forEach((it, idx) => {
      const ln = mc.linhas[idx]
      ws.getCell(r, 2).value = it.especialidade
      ws.getCell(r, 3).value = it.qualificacao === 'RQE' ? 'Com RQE' : it.qualificacao === 'POS' ? 'Com Pós' : '—'
      ws.getCell(r, 4).value = it.horasN
      ws.getCell(r, 5).value = it.valorHoraN
      ws.getCell(r, 6).value = { formula: `D${r}*E${r}`, result: it.custo }
      ws.getCell(r, 7).value = ln.valorHoraFaturar
      ws.getCell(r, 8).value = { formula: `D${r}*G${r}`, result: ln.faturamento }
      ws.getCell(r, 9).value = { formula: `H${r}-F${r}`, result: ln.faturamento - it.custo }
      ;[5, 6, 7, 8, 9].forEach((c) => (ws.getCell(r, c).numFmt = BRL))
      r++
    })
    ws.getCell(r, 2).value = 'TOTAL'
    ws.getCell(r, 4).value = { formula: `SUM(D${start}:D${r - 1})`, result: calc.totalHoras }
    ws.getCell(r, 6).value = { formula: `SUM(F${start}:F${r - 1})`, result: calc.custoTotal }
    ws.getCell(r, 8).value = { formula: `SUM(H${start}:H${r - 1})`, result: mc.faturamento }
    ws.getCell(r, 9).value = { formula: `SUM(I${start}:I${r - 1})`, result: mc.faturamento - calc.custoTotal }
    ;[6, 8, 9].forEach((c) => (ws.getCell(r, c).numFmt = BRL))
    ws.getRow(r).font = { bold: true }
    band(ws.getRow(r), 'FFD9F3EA')
    borderAll(ws, start - 1, r, 2, 9)
    r += 2
  }
  if (viab.observacoes) {
    ws.getCell(r, 2).value = `Observações: ${viab.observacoes}`
  }
}

export async function exportarViabilidadeExcel(viab, cliente) {
  const calc = calcular(viab)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Arpen – Viabilidade'
  wb.created = new Date()
  await sheetViabilidade(wb, viab, cliente, calc)
  await sheetProposta(wb, viab, cliente, calc)
  const buf = await wb.xlsx.writeBuffer()
  await download(buf, `Viabilidade_${slug(cliente?.nome)}_${String(viab.numero || '').padStart(4, '0')}_v${viab.versao || 1}.xlsx`)
}

export async function exportarPropostaExcel(viab, cliente) {
  const calc = calcular(viab)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Arpen – Proposta'
  await sheetProposta(wb, viab, cliente, calc)
  const buf = await wb.xlsx.writeBuffer()
  await download(buf, `Proposta_${slug(cliente?.nome)}_${String(viab.numero || '').padStart(4, '0')}.xlsx`)
}

export { GREEN }
