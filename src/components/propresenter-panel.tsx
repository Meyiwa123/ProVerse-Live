"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, ChevronDown, ChevronUp, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getProPresenterAPI, type ProPresenterConfig } from "@/lib/propresenter-api";

interface ProPresenterPanelProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function ProPresenterPanel({ onConnectionChange }: ProPresenterPanelProps) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("50001");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [version, setVersion] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");

  // Load saved config
  useEffect(() => {
    const savedConfig = localStorage.getItem("propresenter-config");
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setHost(config.host || "localhost");
        setPort(config.port || "50001");
        setSelectedLibrary(config.libraryId || "");
      } catch (error) {
        console.error("Failed to load saved config:", error);
      }
    }
  }, []);

  // Auto-connect on mount if config exists
  useEffect(() => {
    const savedConfig = localStorage.getItem("propresenter-config");
    if (savedConfig) {
      handleTestConnection();
    }
  }, []);

  const handleTestConnection = async () => {
    setIsConnecting(true);

    const config: ProPresenterConfig = { 
      host, 
      port: parseInt(port) 
    };
    
    const api = getProPresenterAPI(config);

    try {
      // Test connection by fetching version
      const versionResponse = await fetch(`http://${host}:${port}/version`);
      
      if (!versionResponse.ok) {
        throw new Error(`HTTP ${versionResponse.status}`);
      }

      const versionData = await versionResponse.json();
      const versionString = versionData.name || versionData.platform || "Unknown";
      
      setVersion(versionString);
      setIsConnected(true);
      onConnectionChange?.(true);

      // Fetch libraries
      const librariesResponse = await api.getLibraries();
      if (librariesResponse.success && librariesResponse.data) {
        setLibraries(librariesResponse.data);
        
        // Auto-select Bible library if not selected
        if (!selectedLibrary) {
          const bibleLib = librariesResponse.data.find((lib: any) =>
            lib.name.toLowerCase().includes("bible")
          );
          if (bibleLib) {
            setSelectedLibrary(bibleLib.id);
          }
        }
      }

      // Save config
      const configToSave = { host, port, libraryId: selectedLibrary };
      localStorage.setItem("propresenter-config", JSON.stringify(configToSave));

      toast.success(`Connected to ProPresenter ${versionString}`);
    } catch (error: any) {
      setIsConnected(false);
      setVersion("");
      onConnectionChange?.(false);
      toast.error(error?.message || "Failed to connect to ProPresenter");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setVersion("");
    setLibraries([]);
    onConnectionChange?.(false);
    toast.info("Disconnected from ProPresenter");
  };

  const saveLibrarySelection = (libraryId: string) => {
    setSelectedLibrary(libraryId);
    const savedConfig = localStorage.getItem("propresenter-config");
    const config = savedConfig ? JSON.parse(savedConfig) : {};
    config.libraryId = libraryId;
    localStorage.setItem("propresenter-config", JSON.stringify(config));
    toast.success("Bible library selected");
  };

  return (
    <Card className="h-full flex flex-col bg-zinc-900 border-zinc-700 min-h-[400px] max-h-[400px]">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl font-semibold text-white">ProPresenter</CardTitle>
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-zinc-500" />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="h-8 text-zinc-300 hover:text-white hover:bg-zinc-800"
        >
          {showSettings ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 overflow-y-auto py-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-white">Connection Status</span>
            {isConnected && version && (
              <span className="text-xs text-zinc-400">{version}</span>
            )}
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={isConnected ? "bg-green-600 text-white" : "bg-zinc-700 text-zinc-300"}
          >
            {isConnected ? "● Connected" : "○ Disconnected"}
          </Badge>
        </div>

        {/* Connection Settings */}
        {showSettings && (
          <div className="space-y-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="host" className="text-sm text-white">
                  Host / IP Address
                </Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost or 192.168.1.100"
                  className="h-10 bg-zinc-900 border-zinc-600 text-white placeholder:text-zinc-500"
                  disabled={isConnected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port" className="text-sm text-white">
                  Port
                </Label>
                <Input
                  id="port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="50001"
                  className="h-10 bg-zinc-900 border-zinc-600 text-white placeholder:text-zinc-500"
                  disabled={isConnected}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <Button
                  onClick={handleTestConnection}
                  className="flex-1 h-10 bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="mr-2 h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="flex-1 h-10 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                >
                  <WifiOff className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              )}
            </div>

            {!isConnected && (
              <p className="text-xs text-zinc-400">
                Enable Network in ProPresenter → Preferences → Network
              </p>
            )}
          </div>
        )}

        {/* Bible Library Selection */}
        {isConnected && libraries.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-white">Bible Library</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {libraries.map((library) => (
                <button
                  key={library.id}
                  onClick={() => saveLibrarySelection(library.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedLibrary === library.id
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-orange-500/50 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{library.name}</span>
                    {selectedLibrary === library.id && (
                      <Badge className="bg-orange-600 text-white text-xs">
                        Selected
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {isConnected && libraries.length === 0 && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-400">
              No libraries found. Please add a Bible library in ProPresenter.
            </p>
          </div>
        )}

        {!isConnected && !showSettings && (
          <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg text-center">
            <Settings className="h-8 w-8 mx-auto mb-2 text-zinc-500" />
            <p className="text-sm text-zinc-400">
              Click settings to configure ProPresenter connection
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}