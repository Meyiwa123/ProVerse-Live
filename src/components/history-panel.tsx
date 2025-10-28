"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2 } from "lucide-react";
import { historyStore, type HistoryEvent } from "@/lib/history-store";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type HistoryFilter = "all" | "suggested" | "sent" | "copied" | "opened";

const FILTER_OPTIONS: HistoryFilter[] = ["all", "suggested", "sent", "copied", "opened"];

export function HistoryPanel() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [history, setHistory] = useState<HistoryEvent[]>([]);

  useEffect(() => {
    const load = () => setHistory(historyStore.getHistory(filter));
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [filter]);

  const handleExport = () => {
    try {
      const csv = historyStore.exportToCSV();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verse-listener-history-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("History exported to CSV");
    } catch {
      toast.error("Failed to export history");
    }
  };

  const handleClear = () => {
    try {
      historyStore.clear();
      setHistory([]);
      toast.success("History cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const actionVariant = (action: string) => {
    switch (action) {
      case "sent":
        return "default";
      case "suggested":
        return "secondary";
      default:
        return "outline";
    }
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  return (
    <Card className="flex-1 flex flex-col max-h-[600px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">History</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={handleExport}
            disabled={history.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-destructive hover:text-destructive"
                disabled={history.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all history items. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClear}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        {/* Filters */}
        <div className="shrink-0 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="h-8"
            >
              {capitalize(f)}
            </Button>
          ))}
        </div>

        {/* History list */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm text-center">No history items yet</p>
            </div>
          ) : (
            history.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{event.time}</span>
                  <span className="font-medium text-sm text-foreground truncate">{event.verse}</span>
                  <Badge variant={actionVariant(event.action)} className="text-xs shrink-0">
                    {event.action}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {event.confidence && (
                    <span className="text-xs text-muted-foreground font-mono">{event.confidence}%</span>
                  )}
                  <span className="text-xs text-muted-foreground">{event.translation}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
