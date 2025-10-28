"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pause, Play, Mic, AudioWaveform } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LiveTranscriptProps {
  isListening: boolean;
  onToggleListening: () => void;
  onTranscriptUpdate?: (text: string) => void;
  /** optional: raw audio frames if you run external ASR (when stream mode is ON) */
  onAudioData?: (buf: Int16Array) => void;
}

interface TranscriptLine {
  text: string;
  time: string;
  isFinal: boolean;
}

type Mode = "browser" | "stream";

export function LiveTranscript({
  isListening,
  onToggleListening,
  onTranscriptUpdate,
  onAudioData,
}: LiveTranscriptProps) {
  const [partialText, setPartialText] = useState("");
  const [finalizedLines, setFinalizedLines] = useState<TranscriptLine[]>([]);
  const [latency, setLatency] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [mode, setMode] = useState<Mode>("browser");

  // devices
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);

  // audio stream (for stream mode)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);

  // speech recognition
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  // ==== helpers ====
  const nowTime = () =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const pushFinal = (txt: string) => {
    const t = nowTime();
    setFinalizedLines((prev) => [{ text: txt.trim(), time: t, isFinal: true }, ...prev,]);
  };

  // 🔧 Notify parent AFTER render: avoids “Cannot update App while rendering LiveTranscript”
  useEffect(() => {
    if (!onTranscriptUpdate) return;
    const full = finalizedLines.map((l) => l.text).join(" ");
    onTranscriptUpdate(full);
  }, [finalizedLines, onTranscriptUpdate]);

  // ==== load devices ====
  useEffect(() => {
    let canceled = false;

    async function loadDevices() {
      try {
        // Request permission so enumerateDevices returns labels
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        if (canceled) return;
        const inputs = devs.filter((d) => d.kind === "audioinput");
        setDevices(inputs);
        if (!selectedDeviceId && inputs[0]) setSelectedDeviceId(inputs[0].deviceId);
      } catch {
        toast("Audio permission needed", {
          description: "Allow microphone access to select an input device (e.g., Scarlett).",
        });
      }
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      loadDevices();
      navigator.mediaDevices.addEventListener?.("devicechange", loadDevices);
    }

    return () => {
      canceled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==== Browser (Web Speech API) mode ====
  useEffect(() => {
    if (mode !== "browser") return;

    const SpeechRecognition =
      (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;

    if (!SpeechRecognition) {
      setIsSupported(false);
      toast("Speech Recognition Not Supported", {
        description: "Use the Stream mode with your ASR or try Chrome/Edge.",
      });
      return;
    } else {
      setIsSupported(true);
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const endTime = Date.now();
      setLatency(endTime - startTimeRef.current);

      let interim = "";
      const finals: string[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const alt = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finals.push(alt);
        else interim += alt;
      }

      if (interim) {
        setPartialText(interim);
        startTimeRef.current = Date.now();
      }

      if (finals.length) {
        finals.forEach((f) => pushFinal(f));
        setPartialText("");
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        toast("No Speech Detected", { description: "Check your input and try again." });
      } else if (event.error === "not-allowed") {
        toast("Microphone Access Denied", { description: "Allow mic access to use speech recognition." });
      } else {
        toast("Recognition Error", { description: `Error: ${event.error}` });
      }
    };

    recognition.onend = () => {
      if (isListening && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ==== Stream mode (selected device -> PCM frames) ====
  useEffect(() => {
    if (mode !== "stream") return;

    async function startStream() {
      try {
        stopStream(); // cleanup first

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
        });
        mediaStreamRef.current = stream;

        const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(2048, 1, 1);
        proc.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const buf = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          onAudioData?.(buf);
        };
        source.connect(proc);
        proc.connect(ctx.destination); // keep graph alive
        workletNodeRef.current = proc;
      } catch (err: any) {
        toast("Audio Input Error", {
          description: err?.message || "Failed to access the selected device.",
        });
      }
    }

    if (isListening) startStream();

    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isListening, selectedDeviceId, onAudioData]);

  function stopStream() {
    try {
      workletNodeRef.current && (workletNodeRef.current.disconnect(), (workletNodeRef.current = null));
      audioCtxRef.current && (audioCtxRef.current.close(), (audioCtxRef.current = null));
      mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop());
      mediaStreamRef.current = null;
    } catch {
      /* ignore */
    }
  }

  // ==== start/stop by isListening ====
  useEffect(() => {
    if (mode === "browser") {
      if (!recognitionRef.current) return;
      if (isListening) {
        try {
          recognitionRef.current.start();
          startTimeRef.current = Date.now();
          toast("Listening Started", { description: "Browser recognition active." });
        } catch (e: any) {
          if (!/already started/i.test(e?.message || "")) {
            toast("Failed to Start", { description: "Could not start recognition." });
          }
        }
      } else {
        try {
          recognitionRef.current.stop();
          setPartialText("");
          toast("Listening Paused", { description: "Recognition paused." });
        } catch {
          /* ignore */
        }
      }
    } else {
      // stream mode handled by its own effect
      if (!isListening) {
        stopStream();
        toast("Stream Paused", { description: "Audio capture paused." });
      } else {
        toast("Stream Listening", {
          description: "Capturing from selected input (send audio to your ASR).",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, mode]);

  return (
    <Card className="flex-1 flex flex-col min-h-[400px] max-h-[400px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <span className="truncate">Live Transcript</span>
          {isListening && <Mic className="h-5 w-5 text-primary animate-pulse shrink-0" />}
        </CardTitle>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 pr-2 border-r border-white/10 shrink-0">
            <Label htmlFor="mode" className="text-xs">
              Stream
            </Label>
            <Switch id="mode" checked={mode === "stream"} onCheckedChange={(v) => setMode(v ? "stream" : "browser")} />
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {mode === "stream" ? "Custom Input" : "Browser Recognition"}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger className="h-9 w-full truncate">
                <SelectValue placeholder="Select input (e.g., Scarlett)" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label || "Audio input"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground hidden lg:block min-w-0">
            {isListening && latency > 0 && mode === "browser" && (
              <span className="text-xs">
                Latency: <span className="font-mono font-medium text-foreground">{latency}ms</span>
              </span>
            )}
          </div>

          <div className="w-full md:w-auto shrink-0">
            <Button onClick={onToggleListening} size="lg" className="w-full md:w-auto md:min-w-[140px] h-11" disabled={!isSupported && mode === "browser"}>
              {isListening ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Partial (streaming) text */}
        {isListening && partialText && mode === "browser" && (
          <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary/30 animate-pulse-subtle">
            <p className="font-mono text-lg text-foreground italic">{partialText}</p>
          </div>
        )}

        {/* Scrollable transcript list */}
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {finalizedLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <AudioWaveform className="h-12 w-12 opacity-60" />
              <p className="text-center text-base">
                {mode === "browser"
                  ? 'Click "Resume" to start browser recognition'
                  : 'Click "Resume" to start capturing from the selected input (send to your ASR)'}
              </p>
            </div>
          ) : (
            finalizedLines.map((line, i) => (
              <div key={i} className="flex gap-3 text-sm p-2 rounded hover:bg-muted/50 transition-colors">
                <span className="font-mono text-muted-foreground shrink-0 text-xs">{line.time}</span>
                <p className="text-foreground leading-relaxed">{line.text}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
