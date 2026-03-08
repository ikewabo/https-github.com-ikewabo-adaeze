export class AudioRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  async start(onData: (base64: string) => void) {
    this.context = new AudioContext({ sampleRate: 16000 });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.context.createMediaStreamSource(this.stream);

    const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input.length > 0) {
            const channelData = input[0];
            const pcm16 = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
            }
            this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `;
    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.context.audioWorklet.addModule(url);

    this.workletNode = new AudioWorkletNode(this.context, 'pcm-processor');
    this.workletNode.port.onmessage = (e) => {
      const buffer = e.data;
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
      }
      onData(btoa(binary));
    };

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.context.destination);
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

export class AudioPlayer {
  private context: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  init() {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: 24000 });
    }
  }

  play(base64: string) {
    if (!this.context) return;

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }

    const audioBuffer = this.context.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);

    const currentTime = this.context.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.1; // slight buffer
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    
    this.activeSources.push(source);
    source.onended = () => {
      this.activeSources = this.activeSources.filter(s => s !== source);
    };
  }

  stop() {
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
  }
}
