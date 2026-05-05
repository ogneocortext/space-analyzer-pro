/**
 * Streaming Chat Hook
 * Provides real-time AI chat functionality with streaming responses
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { AIChatService, StreamingChunk, ChatResponse } from "../services/ai/AIChatService";

export interface UseStreamingChatReturn {
  messages: any[];
  sendMessage: (content: string, context?: any) => Promise<void>;
  isStreaming: boolean;
  isTyping: boolean;
  clearMessages: () => void;
  aiStatus: any;
}

export const useStreamingChat = (): UseStreamingChatReturn => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [aiStatus, setAIStatus] = useState<any>(null);

  const chatService = AIChatService.getInstance();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear any existing connection when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (content: string, context?: any) => {
      if (!content.trim() || isStreaming) return;

      // Add user message immediately
      const userMessage = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      setIsStreaming(true);

      try {
        // Cancel any existing request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        // Send streaming message
        await chatService.sendMessageStreaming(
          content,
          context,
          {
            enableSelfLearning: true,
            enableOllama: true,
            analysisDepth: "comprehensive",
            modelPreference: "auto",
          },
          // Handle streaming chunks
          (chunk: StreamingChunk) => {
            switch (chunk.type) {
              case "start":
                console.warn(`🚀 Streaming started with model: ${chunk.model}`);
                setAIStatus({
                  model: chunk.model,
                  stage: chunk.stage,
                  streaming: true,
                });
                break;

              case "content":
                // Add assistant message content as it streams
                setMessages((prev) => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.role === "assistant") {
                    // Update existing assistant message
                    return prev.map((msg, index) =>
                      index === prev.length - 1
                        ? { ...msg, content: (msg.content || "") + (chunk.content || "") }
                        : msg
                    );
                  } else {
                    // Add new assistant message
                    return [
                      ...prev,
                      {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: chunk.content || "",
                        timestamp: new Date(),
                        model: chunk.model,
                        isStreaming: true,
                      },
                    ];
                  }
                });
                break;

              case "end":
                // Finalize the streaming response
                setIsStreaming(false);
                setIsTyping(false);
                setAIStatus((prev) => ({ ...prev, streaming: false }));

                // Update the last message with final metadata
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.role === "assistant" && msg.isStreaming
                      ? {
                          ...msg,
                          content: msg.content,
                          confidence: chunk.confidence,
                          improvement: chunk.improvement,
                          isStreaming: false,
                          completed: true,
                        }
                      : msg
                  )
                );
                break;
            }
          },
          // Handle completion
          (response: ChatResponse) => {
            setIsStreaming(false);
            setIsTyping(false);
            setAIStatus({
              model: response.metadata.modelUsed,
              stage: response.response.workflowStage,
              streaming: false,
              confidence: response.response.confidence,
            });

            // Add final AI response
            setMessages((prev) => {
              const filtered = prev.filter((msg) => !msg.isStreaming);
              return [
                ...filtered,
                {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: response.response.summary,
                  timestamp: new Date(),
                  model: response.metadata.modelUsed,
                  confidence: response.response.confidence,
                  recommendations: response.response.recommendations,
                  workflowStage: response.response.workflowStage,
                  completed: true,
                },
              ];
            });
          }
        );
      } catch (error) {
        console.error("❌ Streaming chat failed:", error);
        setIsTyping(false);
        setIsStreaming(false);

        // Enhanced error handling with user-friendly messages
        let errorMessage = "An unexpected error occurred";
        if (error instanceof Error) {
          if (error.message.includes("fetch")) {
            errorMessage = "Network error - please check your connection";
          } else if (error.message.includes("timeout")) {
            errorMessage = "Request timed out - please try again";
          } else if (error.message.includes("404")) {
            errorMessage = "AI service not available";
          } else if (error.message.includes("500")) {
            errorMessage = "AI service error - please try again later";
          } else {
            errorMessage = error.message;
          }
        }

        setAIStatus({
          error: errorMessage,
          streaming: false,
          stage: "error",
        });

        // Add error message to chat for user feedback
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `❌ ${errorMessage}. Please try again or contact support if the issue persists.`,
            timestamp: new Date(),
            isError: true,
            completed: true,
          },
        ]);
      }
    },
    [chatService]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setAIStatus(null);
  }, []);

  return {
    messages,
    sendMessage,
    isStreaming,
    isTyping,
    clearMessages,
    aiStatus,
  };
};
