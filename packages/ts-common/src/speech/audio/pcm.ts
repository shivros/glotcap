export type PcmRecorder = {
  context: AudioContext
  sampleRate: number
  start: () => Promise<void>
  stop: () => void
}

type PcmRecorderOptions = {
  sampleRate?: number
  onAudio: (audio: ArrayBuffer, frameCount: number) => void
  onError?: (error: Error) => void
  bufferSize?: number
}

const workletSource = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options && options.processorOptions ? options.processorOptions : {};
    const targetSampleRate =
      typeof opts.targetSampleRate === "number" && Number.isFinite(opts.targetSampleRate) && opts.targetSampleRate > 0
        ? opts.targetSampleRate
        : sampleRate;
    this.targetSampleRate = targetSampleRate;
    this.sourceSampleRate = sampleRate;
    this.rateRatio = this.sourceSampleRate / this.targetSampleRate;
    this.sourceIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const channel = input[0];
    if (!channel) {
      return true;
    }

    if (this.rateRatio <= 1) {
      const output = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, channel[i] || 0));
        output[i] = sample < 0 ? sample * 32768 : sample * 32767;
      }
      this.port.postMessage({ pcm: output.buffer, frameCount: output.length }, [
        output.buffer,
      ]);
      return true;
    }

    const available = channel.length - this.sourceIndex;
    const outputLength = Math.max(0, Math.ceil(available / this.rateRatio));
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i += 1) {
      const idx = Math.floor(this.sourceIndex);
      const frac = this.sourceIndex - idx;
      const sampleA = channel[idx] || 0;
      const sampleB =
        idx + 1 < channel.length ? channel[idx + 1] : sampleA;
      const sample = sampleA + (sampleB - sampleA) * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      output[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      this.sourceIndex += this.rateRatio;
    }

    this.sourceIndex -= channel.length;

    this.port.postMessage({ pcm: output.buffer, frameCount: output.length }, [
      output.buffer,
    ]);
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
`

const resolveAudioContext = (sampleRate?: number) => {
  type WindowWithAudioContext = Omit<typeof window, 'AudioContext'> & {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  const windowWithAudioContext = window as WindowWithAudioContext
  const AudioContextCtor =
    windowWithAudioContext.AudioContext ??
    windowWithAudioContext.webkitAudioContext
  if (!AudioContextCtor) {
    throw new Error('AudioContext is not supported in this browser.')
  }

  try {
    return new AudioContextCtor(sampleRate ? { sampleRate } : undefined)
  } catch {
    return new AudioContextCtor()
  }
}

const resolveStreamSampleRate = (stream: MediaStream): number | undefined => {
  const [track] = stream.getAudioTracks()
  if (!track || typeof track.getSettings !== 'function') {
    return undefined
  }
  const settings = track.getSettings()
  const sampleRate = settings.sampleRate
  return typeof sampleRate === 'number' && Number.isFinite(sampleRate)
    ? sampleRate
    : undefined
}

const resolveTargetSampleRate = (
  targetSampleRate: number | undefined,
  contextSampleRate: number,
): number =>
  typeof targetSampleRate === 'number' &&
  Number.isFinite(targetSampleRate) &&
  targetSampleRate > 0 &&
  targetSampleRate <= contextSampleRate
    ? targetSampleRate
    : contextSampleRate

export const createPcmRecorder = (
  stream: MediaStream,
  options: PcmRecorderOptions,
): PcmRecorder => {
  const streamSampleRate = resolveStreamSampleRate(stream)
  const context = resolveAudioContext(streamSampleRate)
  const targetSampleRate = resolveTargetSampleRate(
    options.sampleRate,
    context.sampleRate,
  )
  const source = context.createMediaStreamSource(stream)
  const gain = context.createGain()
  gain.gain.value = 0

  let stopped = false
  let node: AudioWorkletNode | null = null
  let moduleLoaded = false
  let workletUrl: string | null = null
  let initializing: Promise<void> | null = null

  const ensureWorklet = async () => {
    if (moduleLoaded) {
      return
    }
    if (typeof AudioWorkletNode === 'undefined') {
      throw new Error('AudioWorklet is not supported in this browser.')
    }

    if (!initializing) {
      initializing = (async () => {
        workletUrl = URL.createObjectURL(
          new Blob([workletSource], { type: 'application/javascript' }),
        )
        try {
          await context.audioWorklet.addModule(workletUrl)
          moduleLoaded = true
        } finally {
          if (workletUrl) {
            URL.revokeObjectURL(workletUrl)
            workletUrl = null
          }
        }
      })()
    }

    await initializing
  }

  const connectGraph = async () => {
    await ensureWorklet()
    if (node) {
      return
    }

    node = new AudioWorkletNode(context, 'pcm-capture', {
      processorOptions: {
        targetSampleRate,
      },
    })
    node.port.onmessage = (event) => {
      const payload = event.data as { pcm: ArrayBuffer; frameCount: number }
      if (!(payload.pcm instanceof ArrayBuffer)) {
        return
      }
      try {
        options.onAudio(payload.pcm, payload.frameCount)
      } catch (err) {
        options.onError?.(
          err instanceof Error ? err : new Error('Audio capture error'),
        )
      }
    }
    node.port.onmessageerror = () => {
      options.onError?.(new Error('Audio capture error'))
    }

    source.connect(node)
    node.connect(gain)
    gain.connect(context.destination)
  }

  return {
    context,
    sampleRate: targetSampleRate,
    start: async () => {
      if (stopped) {
        return
      }
      await connectGraph()
      if (context.state !== 'running') {
        await context.resume()
      }
    },
    stop: () => {
      if (stopped) {
        return
      }
      stopped = true
      try {
        source.disconnect()
        if (node) {
          node.disconnect()
          node.port.onmessage = null
          node.port.onmessageerror = null
          node = null
        }
        gain.disconnect()
      } catch {
        // Ignore disconnect errors.
      }
    },
  }
}
