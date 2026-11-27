import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

let loading: Promise<FFmpeg> | null = null

/** El núcleo pesa unos 30 MB: se baja recién la primera vez que hace falta. */
function getFFmpeg() {
  loading ??= (async () => {
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({ coreURL, wasmURL })
    return ffmpeg
  })().catch((error) => {
    loading = null
    throw error
  })
  return loading
}

export async function runFFmpeg(
  files: Record<string, Uint8Array>,
  args: string[],
  output: string,
  type: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  signal?.throwIfAborted()
  // ffmpeg no se puede interrumpir: para cancelar hay que cerrar su worker.
  const abort = () => {
    ffmpeg.terminate()
    loading = null
  }
  signal?.addEventListener('abort', abort)
  const progress = ({ progress }: { progress: number }) => onProgress?.(Math.min(1, Math.max(0, progress)))
  ffmpeg.on('progress', progress)
  // Las últimas líneas de ffmpeg se muestran en la consola si algo falla.
  const lines: string[] = []
  const log = ({ message }: { message: string }) => {
    lines.push(message)
    if (lines.length > 25) lines.shift()
  }
  ffmpeg.on('log', log)
  try {
    // writeFile transfiere el buffer al worker, por eso se le pasa una copia.
    for (const [name, data] of Object.entries(files)) await ffmpeg.writeFile(name, data.slice())
    if ((await ffmpeg.exec([...args, output])) !== 0) throw new Error('ffmpeg')
    const data = (await ffmpeg.readFile(output)) as Uint8Array
    for (const name of [...Object.keys(files), output]) await ffmpeg.deleteFile(name)
    return new Blob([data.slice()], { type })
  } catch (error) {
    signal?.throwIfAborted()
    // Después de una falla la instancia puede quedar inutilizable.
    console.error(`ffmpeg ${args.join(' ')}\n${lines.join('\n')}`, error)
    ffmpeg.terminate()
    loading = null
    throw error instanceof Error ? error : new Error('ffmpeg')
  } finally {
    signal?.removeEventListener('abort', abort)
    ffmpeg.off('progress', progress)
    ffmpeg.off('log', log)
  }
}
