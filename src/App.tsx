import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AudioRecorder, AudioPlayer } from './lib/audio';
import { SYSTEM_INSTRUCTION } from './lib/prompt';
import { Phone, PhoneOff, Loader2, Volume2, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type CallState = 'idle' | 'connecting' | 'connected' | 'error';

export default function App() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    audioRecorderRef.current = new AudioRecorder();
    audioPlayerRef.current = new AudioPlayer();
    return () => {
      endCall();
    };
  }, []);

  const startCall = async () => {
    try {
      setCallState('connecting');
      setErrorMsg(null);
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      audioPlayerRef.current?.init();

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: async () => {
            setCallState('connected');
            await audioRecorderRef.current?.start((base64Data) => {
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              audioPlayerRef.current?.play(base64Audio);
            }
            
            if (message.serverContent?.interrupted) {
              audioPlayerRef.current?.stop();
              setIsSpeaking(false);
            }
            
            if (message.serverContent?.turnComplete) {
              setIsSpeaking(false);
            }
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            setErrorMsg("Connection error occurred. Please try again.");
            endCall();
          },
          onclose: () => {
            endCall();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, // Kore has a warm, professional tone
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
      
      sessionRef.current = sessionPromise;
      
    } catch (err) {
      console.error("Failed to start call:", err);
      setErrorMsg("Failed to access microphone or connect to server.");
      setCallState('idle');
    }
  };

  const endCall = () => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
        try {
          session.close();
        } catch (e) {}
      });
      sessionRef.current = null;
    }
    audioRecorderRef.current?.stop();
    audioPlayerRef.current?.stop();
    setCallState('idle');
    setIsSpeaking(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-amber-500/30 flex flex-col">
      {/* Header */}
      <header className="w-full p-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-sm flex items-center justify-center">
            <span className="font-bold text-black text-lg">S</span>
          </div>
          <span className="font-semibold tracking-wide text-lg">SquaredTech LTD</span>
        </div>
        <div className="text-xs uppercase tracking-widest text-white/50">
          Lagos, Nigeria
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="z-10 flex flex-col items-center max-w-md w-full">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">
              Speak with <span className="font-medium text-amber-500">Adaeze</span>
            </h1>
            <p className="text-white/60 text-sm md:text-base leading-relaxed">
              Your AI voice receptionist for premium real estate inquiries, property tours, and investment advisory.
            </p>
          </div>

          {/* Call Interface */}
          <div className="relative w-full aspect-square max-w-[320px] flex items-center justify-center mb-12">
            {/* Ripples when connected */}
            <AnimatePresence>
              {callState === 'connected' && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full border border-amber-500/30"
                  />
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
                    className="absolute inset-0 rounded-full border border-amber-500/20"
                  />
                </>
              )}
            </AnimatePresence>

            {/* Main Avatar/Status Circle */}
            <motion.div 
              className={`relative z-10 w-48 h-48 rounded-full flex flex-col items-center justify-center transition-colors duration-500 ${
                callState === 'connected' 
                  ? isSpeaking 
                    ? 'bg-amber-500/20 border-amber-500/50' 
                    : 'bg-white/5 border-white/10'
                  : 'bg-white/5 border-white/10'
              } border backdrop-blur-md`}
              animate={{
                scale: isSpeaking ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: isSpeaking ? Infinity : 0,
                ease: "easeInOut"
              }}
            >
              {callState === 'idle' && (
                <div className="flex flex-col items-center text-white/40">
                  <Mic className="w-8 h-8 mb-2" />
                  <span className="text-xs uppercase tracking-widest font-medium">Ready</span>
                </div>
              )}
              
              {callState === 'connecting' && (
                <div className="flex flex-col items-center text-amber-500">
                  <Loader2 className="w-8 h-8 mb-2 animate-spin" />
                  <span className="text-xs uppercase tracking-widest font-medium">Connecting</span>
                </div>
              )}
              
              {callState === 'connected' && (
                <div className={`flex flex-col items-center ${isSpeaking ? 'text-amber-500' : 'text-white/80'}`}>
                  {isSpeaking ? (
                    <Volume2 className="w-10 h-10 mb-2" />
                  ) : (
                    <Mic className="w-10 h-10 mb-2" />
                  )}
                  <span className="text-xs uppercase tracking-widest font-medium">
                    {isSpeaking ? 'Adaeze Speaking' : 'Listening...'}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-4 w-full">
            {callState === 'idle' || callState === 'error' ? (
              <button
                onClick={startCall}
                className="w-full py-4 rounded-full bg-white text-black font-medium text-lg flex items-center justify-center gap-2 hover:bg-amber-500 hover:text-white transition-all duration-300"
              >
                <Phone className="w-5 h-5" />
                Start Conversation
              </button>
            ) : (
              <button
                onClick={endCall}
                className="w-full py-4 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-medium text-lg flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all duration-300"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </button>
            )}
            
            {errorMsg && (
              <p className="text-red-400 text-sm text-center mt-2">{errorMsg}</p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center border-t border-white/5">
        <p className="text-xs text-white/30 uppercase tracking-widest">
          Powered by Gemini Live API
        </p>
      </footer>
    </div>
  );
}
