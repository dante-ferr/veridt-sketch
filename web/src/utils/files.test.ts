import { describe, expect, it } from 'vitest'
import { describeDataTypes, fileKindLabel, formatFileSize, summarizeFiles } from './files'

const video = { mediaType: 'video/webm' }
const png = { mediaType: 'image/png' }
const html = { mediaType: 'text/html' }

describe('files', () => {
  it('formats sizes in pt-BR', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(820_000)).toBe('820 KB')
    expect(formatFileSize(1_400_000)).toBe('1,4 MB')
    expect(formatFileSize(48_230_000)).toBe('48,2 MB')
  })

  it('labels file kinds', () => {
    expect(fileKindLabel('video/webm')).toBe('Vídeo')
    expect(fileKindLabel('image/png')).toBe('Imagem')
    expect(fileKindLabel('text/html')).toBe('HTML')
  })

  it('summarizes the captured files', () => {
    expect(summarizeFiles([video, png, png, png])).toBe('1 vídeo · 3 imagens')
    expect(summarizeFiles([png, html])).toBe('1 imagem · 1 HTML')
    expect(summarizeFiles([])).toBe('Nenhum arquivo')
  })

  it('describes the data types', () => {
    expect(describeDataTypes([video, png])).toBe('Vídeo de navegação e capturas de tela')
    expect(describeDataTypes([png, html])).toBe('Captura de tela e código HTML das páginas')
    expect(describeDataTypes([video, png, html])).toBe('Vídeo de navegação, capturas de tela e código HTML das páginas')
  })
})
