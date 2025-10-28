// lib/propresenter-api.ts - Enhanced with Bible search

interface ProPresenterConfig {
  host: string;
  port: number;
  libraryId?: string; // Optional: default Bible library ID
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  results?: any[];
}

interface LibraryItem {
  id: string;
  name: string;
  type: string;
}

class ProPresenterAPI {
  private config: ProPresenterConfig;

  constructor(config?: Partial<ProPresenterConfig>) {
    this.config = {
      host: config?.host || "localhost",
      port: config?.port || 50001,
    };
  }

  private get baseUrl(): string {
    return `http://${this.config.host}:${this.config.port}/v1`;
  }

  private async request<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || "Network request failed",
      };
    }
  }

  // Send stage message
  async sendStageMessage(message: string): Promise<ApiResponse> {
    return this.request("/stage/message", {
      method: "PUT",
      body: JSON.stringify({ message }),
    });
  }

  // Clear stage message
  async clearStageMessage(): Promise<ApiResponse> {
    return this.request("/stage/message", {
      method: "DELETE",
    });
  }

  // Get all libraries (includes Bible libraries)
  async getLibraries(): Promise<ApiResponse<LibraryItem[]>> {
    return this.request("/libraries");
  }

  // Search for a Bible verse in a specific library
  async searchLibrary(libraryId: string, query: string): Promise<ApiResponse> {
    try {
      // Get all presentations in the library
      const response = await this.request<LibraryItem[]>(`/library/${libraryId}`);
      
      if (!response.success || !response.data) {
        return { success: false, message: "Failed to fetch library contents" };
      }

      // Filter presentations matching the verse reference
      const normalizedQuery = query.toLowerCase().replace(/\s+/g, "");
      const matches = response.data.filter((item) => {
        const normalizedName = item.name.toLowerCase().replace(/\s+/g, "");
        return normalizedName.includes(normalizedQuery);
      });

      return {
        success: true,
        results: matches,
        message: matches.length > 0 
          ? `Found ${matches.length} match(es)` 
          : "No matches found",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || "Search failed",
      };
    }
  }

  // Trigger a presentation in a library
  async triggerLibraryPresentation(
    libraryId: string,
    presentationId: string,
    cueIndex: number = 0
  ): Promise<ApiResponse> {
    const endpoint = cueIndex > 0
      ? `/library/${libraryId}/${presentationId}/${cueIndex}/trigger`
      : `/library/${libraryId}/${presentationId}/trigger`;
    
    return this.request(endpoint);
  }

  // Search and trigger Bible verse (main function)
  async searchAndTriggerVerse(
    verseReference: string,
    libraryId?: string
  ): Promise<ApiResponse> {
    try {
      // If no library ID provided, try to find Bible library
      let targetLibraryId = libraryId;
      
      if (!targetLibraryId) {
        const librariesResponse = await this.getLibraries();
        if (!librariesResponse.success || !librariesResponse.data) {
          return { success: false, message: "Failed to get libraries" };
        }

        // Look for a library with "Bible" in the name
        const bibleLibrary = librariesResponse.data.find((lib) =>
          lib.name.toLowerCase().includes("bible")
        );

        if (!bibleLibrary) {
          return {
            success: false,
            message: "No Bible library found. Please configure a Bible library in ProPresenter.",
          };
        }

        targetLibraryId = bibleLibrary.id;
      }

      // Search for the verse
      const searchResponse = await this.searchLibrary(targetLibraryId, verseReference);
      
      if (!searchResponse.success || !searchResponse.results?.length) {
        return {
          success: false,
          message: `Verse "${verseReference}" not found in library`,
        };
      }

      // Trigger the first match
      const match = searchResponse.results[0];
      const triggerResponse = await this.triggerLibraryPresentation(
        targetLibraryId,
        match.id
      );

      if (triggerResponse.success) {
        return {
          success: true,
          message: `Successfully triggered ${match.name}`,
          data: match,
        };
      }

      return triggerResponse;
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || "Failed to search and trigger verse",
      };
    }
  }

  // Get current presentation
  async getCurrentPresentation(): Promise<ApiResponse> {
    return this.request("/presentation/active");
  }

  // Trigger next/previous slide in active presentation
  async nextSlide(): Promise<ApiResponse> {
    return this.request("/presentation/active/next/trigger");
  }

  async previousSlide(): Promise<ApiResponse> {
    return this.request("/presentation/active/previous/trigger");
  }

  // Update configuration
  updateConfig(config: Partial<ProPresenterConfig>) {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let apiInstance: ProPresenterAPI | null = null;

export function getProPresenterAPI(config?: Partial<ProPresenterConfig>): ProPresenterAPI {
  if (!apiInstance) {
    apiInstance = new ProPresenterAPI(config);
  } else if (config) {
    apiInstance.updateConfig(config);
  }
  return apiInstance;
}

export type { ProPresenterConfig, ApiResponse, LibraryItem };