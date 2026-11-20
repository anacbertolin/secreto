// Gravação de áudio no navegador para enviar pelo WhatsApp.
// Grava com o microfone (formato que o navegador souber) e converte para MP3,
// formato que a Meta aceita e que toca em qualquer celular.
import { Mp3Encoder } from "@breezystack/lamejs";

export interface Gravacao {
  parar: () => Promise<File>;
  cancelar: () => void;
}

/** Começa a gravar. Lança erro com mensagem em português se o microfone não estiver disponível. */
export async function gravarAudio(): Promise<Gravacao> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("Este navegador não grava áudio. Use o Google Chrome atualizado.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    throw new Error("Não foi possível usar o microfone. Permita o acesso ao microfone no navegador (ícone ao lado do endereço).");
  }
  const rec = new MediaRecorder(stream);
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  rec.start(250);
  const soltar = () => stream.getTracks().forEach((t) => t.stop());

  return {
    cancelar: () => { try { rec.stop(); } catch { /* já parado */ } soltar(); },
    parar: () => new Promise<File>((ok, falha) => {
      rec.onstop = async () => {
        soltar();
        try {
          const bruto = new Blob(partes, { type: rec.mimeType || "audio/webm" });
          ok(await paraMp3(bruto));
        } catch (e) {
          falha(e instanceof Error ? e : new Error("Não foi possível preparar o áudio."));
        }
      };
      rec.stop();
    }),
  };
}

/** Converte qualquer áudio que o navegador consiga tocar em MP3 (mono, 64 kbps). */
async function paraMp3(bruto: Blob): Promise<File> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let audio: AudioBuffer;
  try {
    audio = await ctx.decodeAudioData(await bruto.arrayBuffer());
  } finally {
    ctx.close().catch(() => undefined);
  }
  if (audio.duration < 0.5) throw new Error("O áudio ficou curto demais.");
  // Taxa que o MP3 aceita: se o microfone gravou em outra, converte para 44,1 kHz
  if (audio.sampleRate !== 48000 && audio.sampleRate !== 44100) {
    const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 44100), 44100);
    const src = off.createBufferSource();
    src.buffer = audio;
    src.connect(off.destination);
    src.start();
    audio = await off.startRendering();
  }

  // Mistura os canais em um só (mono)
  const n = audio.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / audio.numberOfChannels;
  }
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, mono[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }

  const enc = new Mp3Encoder(1, audio.sampleRate, 64);
  const pedacos: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const b = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (b.length) pedacos.push(new Uint8Array(b));
  }
  const fimBuf = enc.flush();
  if (fimBuf.length) pedacos.push(new Uint8Array(fimBuf));

  const agora = new Date();
  const nome = `audio-${agora.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.mp3`;
  return new File(pedacos as BlobPart[], nome, { type: "audio/mpeg" });
}
