"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, Pin, X, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { historyStore } from "@/lib/history-store";
import { getProPresenterAPI } from "@/lib/propresenter-api";
import { querySuggestions } from "@/search/engine";
import type { Suggestion as EngineSuggestion } from "@/types";

interface Suggestion {
  id: string;
  reference: string;
  text: string;
  confidence: number;
  themes: string[];
  translation: string;
  isPinned?: boolean;
}

interface SuggestionsStackProps {
  transcriptText?: string;
  onSendToStage?: (verse: Suggestion) => void;
  translation?: string;
  isProPresenterConnected?: boolean;
}

export function SuggestionsStack({
  transcriptText = "",
  onSendToStage,
  translation = "KJV",
  isProPresenterConnected = false,
}: SuggestionsStackProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pinnedSuggestions, setPinnedSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastTopRef = useRef<EngineSuggestion | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const fetchSuggestions = async () => {
      const trimmed = transcriptText.trim();
      
      if (!trimmed || trimmed.length < 10) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      try {
        const results = await querySuggestions({
          transcriptWindow: trimmed,
          translation,
          hysteresisPrev: lastTopRef.current || undefined,
          topK: 5,
        });

        if (results?.[0]) {
          lastTopRef.current = results[0];
        }

        const newSuggestions: Suggestion[] = results.map((r, index) => ({
          id: `${r.id}-${Date.now()}-${index}`,
          reference: r.ref,
          text: r.text,
          confidence: Math.round((r.confidence ?? 0) * 100),
          themes: r.themes ?? [],
          translation,
        }));

        setSuggestions(newSuggestions);

        // Log to history
        newSuggestions.forEach((s) => {
          historyStore.addEvent({
            verse: s.reference,
            text: s.text,
            action: "suggested",
            translation: s.translation,
            confidence: s.confidence,
          });
        });
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        toast.error("Failed to fetch verse suggestions");
      } finally {
        setIsLoading(false);
      }
    };

    timeout = setTimeout(fetchSuggestions, 800);
    return () => clearTimeout(timeout);
  }, [transcriptText, translation]);

  const handlePin = (suggestion: Suggestion) => {
    const isCurrentlyPinned = pinnedSuggestions.some((s) => s.reference === suggestion.reference);
    
    if (isCurrentlyPinned) {
      setPinnedSuggestions(pinnedSuggestions.filter((s) => s.reference !== suggestion.reference));
      toast.success(`${suggestion.reference} unpinned`);
    } else {
      setPinnedSuggestions([...pinnedSuggestions, { ...suggestion, isPinned: true }]);
      toast.success(`${suggestion.reference} pinned`);
    }
  };

  const handleSendToStage = async (suggestion: Suggestion) => {
    try {
      const api = getProPresenterAPI();
      const message = `${suggestion.reference}\n${suggestion.text}`;
      const result = await api.sendStageMessage(message);

      if (result.success) {
        historyStore.addEvent({
          verse: suggestion.reference,
          text: suggestion.text,
          action: "sent",
          translation: suggestion.translation,
          confidence: suggestion.confidence,
        });
        toast.success(`${suggestion.reference} sent to stage`);
        onSendToStage?.(suggestion);
      } else {
        toast.error(result.message || "Failed to send to stage");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to send stage message");
    }
  };

  const handleOpenVerse = async (suggestion: Suggestion) => {
    if (!isProPresenterConnected) {
      toast.error("ProPresenter not connected. Configure connection in the panel.");
      return;
    }

    try {
      const api = getProPresenterAPI();
      
      // Get saved library ID from config
      const savedConfig = localStorage.getItem("propresenter-config");
      const libraryId = savedConfig ? JSON.parse(savedConfig).libraryId : undefined;

      if (!libraryId) {
        toast.error("No Bible library selected. Please select one in ProPresenter panel.");
        return;
      }

      const result = await api.searchAndTriggerVerse(suggestion.reference, libraryId);

      historyStore.addEvent({
        verse: suggestion.reference,
        text: suggestion.text,
        action: "opened",
        translation: suggestion.translation,
        confidence: suggestion.confidence,
      });

      if (result.success) {
        toast.success(`${suggestion.reference} is now live in ProPresenter!`);
      } else {
        toast.warning(result.message || `Could not find ${suggestion.reference}`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to open verse in ProPresenter");
    }
  };

  const handleCopy = (suggestion: Suggestion) => {
    const text = `${suggestion.reference}\n${suggestion.text}`;
    navigator.clipboard.writeText(text);
    
    historyStore.addEvent({
      verse: suggestion.reference,
      text: suggestion.text,
      action: "copied",
      translation: suggestion.translation,
      confidence: suggestion.confidence,
    });
    
    toast.success(`${suggestion.reference} copied to clipboard`);
  };

  const getConfidenceBadgeStyle = (confidence: number) => {
    if (confidence >= 90) {
      return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40";
    }
    if (confidence >= 70) {
      return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40";
    }
    return "bg-muted text-muted-foreground border-border";
  };

  const allSuggestions = [
    ...pinnedSuggestions,
    ...suggestions.filter((s) => !pinnedSuggestions.some((p) => p.reference === s.reference)),
  ];

  return (
    <Card className="flex-1 flex flex-col max-h-[600px]">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Verse Suggestions</CardTitle>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {allSuggestions.length > 0 && (
            <Badge variant="secondary" className="text-xs font-medium">
              {allSuggestions.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-3 pr-2">
        {allSuggestions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-center text-sm max-w-xs">
              {isLoading 
                ? "Finding relevant verses..." 
                : "Suggestions will appear as the sermon is transcribed"}
            </p>
          </div>
        ) : (
          allSuggestions.map((suggestion) => {
            const isPinned = pinnedSuggestions.some((s) => s.reference === suggestion.reference);
            const unpinnedIndex = allSuggestions.indexOf(suggestion) - pinnedSuggestions.length + 1;
            const displayIndex = isPinned ? "★" : unpinnedIndex;

            return (
              <Card
                key={suggestion.id}
                className={`transition-all duration-200 hover:shadow-md ${
                  isPinned 
                    ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border shrink-0">
                        {displayIndex}
                      </kbd>
                      <h3 className="font-semibold text-base text-foreground truncate">
                        {suggestion.reference}
                      </h3>
                      {isPinned && (
                        <Pin className="h-4 w-4 text-primary fill-primary shrink-0" />
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`${getConfidenceBadgeStyle(suggestion.confidence)} shrink-0`}
                    >
                      {suggestion.confidence}%
                    </Badge>
                  </div>

                  {/* Verse Text */}
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {suggestion.text}
                  </p>

                  {/* Themes & Translation */}
                  {(suggestion.themes.length > 0 || suggestion.translation) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {suggestion.themes.slice(0, 3).map((theme) => (
                        <Badge 
                          key={theme} 
                          variant="outline" 
                          className="text-xs capitalize bg-background"
                        >
                          {theme}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {suggestion.translation}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 min-w-[120px] h-9"
                      onClick={() => handleSendToStage(suggestion)}
                      disabled={!isProPresenterConnected}
                      title={!isProPresenterConnected ? "ProPresenter not connected" : ""}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Stage Message</span>
                      <span className="sm:hidden">Stage</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 min-w-[100px] h-9 bg-primary hover:bg-primary/90"
                      onClick={() => handleOpenVerse(suggestion)}
                      disabled={!isProPresenterConnected}
                      title={!isProPresenterConnected ? "ProPresenter not connected" : "Open verse in Bible library"}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Open Bible
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3"
                      onClick={() => handleCopy(suggestion)}
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={isPinned ? "default" : "outline"}
                      className="h-9 px-3"
                      onClick={() => handlePin(suggestion)}
                      title={isPinned ? "Unpin" : "Pin"}
                    >
                      {isPinned ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}