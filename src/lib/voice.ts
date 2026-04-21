import { toast } from "sonner";

// Web Speech API не входит в стандартные типы TypeScript — объявляем как any
type RecognitionCtor = new () => any;

declare global {
  interface Window {
    webkitSpeechRecognition?: RecognitionCtor;
    SpeechRecognition?: RecognitionCtor;
  }
}

const sanitizeSpeech = (text: string) => text.replace(/[*_#`>\-]/g, "").replace(/\s+/g, " ").trim();

export const getSpeechRecognition = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const supportsSpeechRecognition = () => !!getSpeechRecognition();

export const requestMicrophoneAccess = async () => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
};

const waitForVoices = async () => {
  if (!("speechSynthesis" in window)) return [] as SpeechSynthesisVoice[];
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 250);
    const handler = () => {
      window.clearTimeout(timeout);
      synth.removeEventListener("voiceschanged", handler);
      resolve();
    };
    synth.addEventListener("voiceschanged", handler, { once: true });
  });

  voices = synth.getVoices();
  return voices;
};

const pickVoice = (voices: SpeechSynthesisVoice[]) =>
  voices.find((voice) => voice.lang?.toLowerCase().startsWith("ru")) ||
  voices.find((voice) => voice.lang?.toLowerCase().startsWith("kk")) ||
  voices[0] ||
  null;

export const primeSpeech = async () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  await waitForVoices();
};

export const speakText = async (text: string) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    toast.error("Озвучка не поддерживается в этом браузере");
    return false;
  }

  const content = sanitizeSpeech(text);
  if (!content) return false;

  const synth = window.speechSynthesis;
  const voices = await waitForVoices();

  return await new Promise<boolean>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(content);
    const voice = pickVoice(voices);
    utterance.lang = voice?.lang || "ru-RU";
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);

    synth.cancel();
    synth.resume();
    synth.speak(utterance);
  });
};
