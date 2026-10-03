// Detecta se o app está rodando como página publicada no Claude (artifact)
export const isArtifact = () => typeof window !== 'undefined' && typeof window.claude?.use === 'function'

/** Salva um arquivo: usa o recurso de downloads do Claude quando publicado; senão, download normal do navegador. */
export async function saveFile(filename, blob) {
  if (isArtifact()) {
    const downloads = await window.claude.use('downloads')
    if (!downloads) throw new Error('Download indisponível nesta visualização')
    try {
      await downloads.save({ filename, data: blob })
    } catch (e) {
      if (e?.code === 'declined') return
      throw e
    }
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
