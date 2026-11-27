import { AudioBufferSource, BufferTarget, CanvasSource, Output, QUALITY_HIGH, WebMOutputFormat } from 'mediabunny'

/**
 * WebM con transparencia usando los codificadores del navegador.
 * No se usa ffmpeg: en ffmpeg.wasm, libvpx con canal alfa falla con "memory access out of bounds".
 */
export async function encodeTransparent(
  canvas: HTMLCanvasElement,
  audio: AudioBuffer | null,
  duration: number,
  fps: number,
  drawFrame: (time: number) => Promise<void>,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  if (!('VideoEncoder' in window) || (audio && !('AudioEncoder' in window))) {
    throw new Error('transparent')
  }

  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() })
  const video = new CanvasSource(canvas, { codec: 'vp9', bitrate: QUALITY_HIGH, alpha: 'keep' })
  const sound = audio && new AudioBufferSource({ codec: 'opus', bitrate: 96_000 })
  output.addVideoTrack(video, { frameRate: fps })
  if (sound) output.addAudioTrack(sound)
  await output.start()
  if (sound) await sound.add(audio)

  const total = Math.ceil(duration * fps)
  try {
    for (let index = 0; index < total; index++) {
      const time = index / fps
      await drawFrame(time)
      await video.add(time, Math.min(1 / fps, duration - time))
      onProgress((index + 1) / total)
    }
  } catch (error) {
    await output.cancel()
    throw error
  }

  await output.finalize()
  return new Blob([output.target.buffer!], { type: 'video/webm' })
}
