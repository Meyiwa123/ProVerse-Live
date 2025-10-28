"use client";

import { useEffect, useState, useCallback } from "react";
import { LiveTranscript } from "./components/live-transcript";
import { SuggestionsStack } from "./components/suggestions-stack";
import { HistoryPanel } from "./components/history-panel";
import { ProPresenterPanel } from "./components/propresenter-panel";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { initEngine } from "@/search/engine";
import { Footer } from "./components/footer";
import { HeroSection } from "./components/hero";
import { Header } from "./components/header";

function useBible(translation = "KJV") {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setReady(false);

        const [versesRes, embeddingsRes] = await Promise.all([
          fetch(`/${translation.toLowerCase()}.json`),
          fetch(`/${translation.toLowerCase()}-embeddings.json`),
        ]);
        if (!versesRes.ok) throw new Error(`Missing /${translation.toLowerCase()}.json in /public`);

        const verses = await versesRes.json();

        let embeddings: Float32Array[] = [];
        if (embeddingsRes.ok) {
          const embeddingsData = await embeddingsRes.json();
          embeddings = embeddingsData.map((arr: number[]) => new Float32Array(arr));
        }

        await initEngine(verses, embeddings);
        setReady(true);
      } catch (e: any) {
        setError(e?.message || "Failed to load Bible data");
        setReady(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [translation]);

  return { loading, error, ready };
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProPresenterConnected, setIsProPresenterConnected] = useState(false);
  const handleTranscript = useCallback((t: string) => setTranscript(t), []);

  const { loading, error, ready } = useBible("KJV");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      <Header />

      <main className="flex-1">
        <HeroSection />

        <div className="mx-auto w-full max-w-[95rem] px-4 sm:px-6 lg:px-8 pb-8">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            {/* LEFT: Transcript + Suggestions */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <LiveTranscript
                isListening={isListening}
                onToggleListening={() => setIsListening((v) => !v)}
                onTranscriptUpdate={handleTranscript}
              />

              {ready ? (
                <SuggestionsStack
                  transcriptText={transcript}
                  translation="KJV"
                  isProPresenterConnected={isProPresenterConnected}
                />
              ) : (
                <Card className="flex items-center justify-center bg-zinc-900/50 border-primary/20 backdrop-blur-sm">
                  <div className="text-center space-y-2 p-6">
                    {loading ? (
                      <>
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">Initializing search engine...</p>
                      </>
                    ) : (
                      <p className="text-sm text-zinc-500">Engine not ready</p>
                    )}
                  </div>
                </Card>
              )}
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <ProPresenterPanel onConnectionChange={setIsProPresenterConnected} />
              <HistoryPanel />
            </div>
          </div>

          {error && (
            <div className="mt-4">
              <Card className="p-4 bg-red-950/30 border-red-500/30 backdrop-blur-sm">
                <p className="text-sm text-red-400">{error}</p>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "#18181b",
            border: "1px solid rgba(249, 115, 22, 0.2)",
            color: "#fff",
          },
        }}
      />
    </div>
  );
}
