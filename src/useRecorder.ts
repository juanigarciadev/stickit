import { useEffect, useRef, useState } from 'react'

export const MAX_SECONDS = 60
/** Barras de la onda en vivo y cada cuántos milisegundos se agrega una. */
export const LIVE_BARS = 44
const TICK = 80

export function useRecorder(onDone: (blob: Blob) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false)
  const [levels, setLevels] = useState<number[]>([])
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const timeout = useRef(0)

  const stop = () => {
    window.clearTimeout(timeout.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const next = new MediaRecorder(stream)

      // El analizador mide el volumen del micrófono para dibujar la onda mientras se graba.
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const began = performance.now()
      setLevels([])
      setSeconds(0)
      const meter = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples)
        const peak = samples.reduce((highest, sample) => Math.max(highest, Math.abs(sample)), 0)
        setLevels((previous) => [...previous.slice(1 - LIVE_BARS), peak])
        setSeconds((performance.now() - began) / 1000)
      }, TICK)

      next.ondataavailable = (event) => chunks.push(event.data)
      next.onstop = () => {
        window.clearInterval(meter)
        void context.close()
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        onDone(new Blob(chunks, { type: next.mimeType }))
      }
      recorder.current = next
      next.start()
      setRecording(true)
      timeout.current = window.setTimeout(stop, MAX_SECONDS * 1000)
    } catch {
      onError('mic')
    }
  }

  useEffect(() => stop, [])

  return { recording, levels, seconds, start, stop }
}
