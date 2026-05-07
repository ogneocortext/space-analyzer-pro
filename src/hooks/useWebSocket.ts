import { ref, onMounted, onUnmounted } from "vue";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => void;
  reconnect: () => void;
}

export const useWebSocket = (url: string): UseWebSocketReturn => {
  const isConnected = ref(false);
  const lastMessage = ref<WebSocketMessage | null>(null);
  const ws = ref<WebSocket | null>(null);

  const connect = () => {
    try {
      ws.value = new WebSocket(url);

      ws.value.onopen = () => {
        isConnected.value = true;
      };

      ws.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          lastMessage.value = message;
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.value.onclose = () => {
        isConnected.value = false;
      };

      ws.value.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnected.value = false;
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
    }
  };

  const reconnect = () => {
    if (ws.value) {
      ws.value.close();
    }
    connect();
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    if (ws.value) {
      ws.value.close();
    }
  });

  return {
    isConnected,
    lastMessage,
    sendMessage,
    reconnect,
  };
};
