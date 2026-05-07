/**
 * Streaming Chat Hook
 * Provides real-time AI chat functionality with streaming responses
 */

import { ref, onMounted, onUnmounted } from "vue";
import { AIChatService, StreamingChunk, ChatResponse } from "../services/ai/AIChatService";

export interface UseStreamingChatReturn {
  messages: any[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
  cancelStreaming: () => void;
}

export const useStreamingChat = (): UseStreamingChatReturn => {
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const aiService = ref<AIChatService | null>(null);

  const initializeService = () => {
    try {
      aiService.value = new AIChatService();
    } catch (err: any) {
      error.value = `Failed to initialize AI service: ${err.message}`;
    }
  };

  const sendMessage = async (message: string): Promise<void> => {
    if (!aiService.value || isLoading.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      // Add user message
      messages.value.push({
        id: Date.now().toString(),
        role: "user",
        content: message,
        timestamp: new Date(),
      });

      // Start streaming response
      await aiService.value.sendMessage(message, (chunk: StreamingChunk) => {
        // Handle streaming chunk
        const lastMessage = messages.value[messages.value.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          lastMessage.content += chunk.content;
        } else {
          messages.value.push({
            id: Date.now().toString(),
            role: "assistant",
            content: chunk.content,
            timestamp: new Date(),
          });
        }
      });
    } catch (err: any) {
      error.value = err.message || "Failed to send message";
    } finally {
      isLoading.value = false;
    }
  };

  const clearChat = () => {
    messages.value = [];
    error.value = null;
  };

  const cancelStreaming = () => {
    if (aiService.value) {
      aiService.value.cancelStreaming();
    }
    isLoading.value = false;
  };

  onMounted(() => {
    initializeService();
  });

  onUnmounted(() => {
    if (aiService.value) {
      aiService.value.cleanup();
    }
  });

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    cancelStreaming,
  };
};
