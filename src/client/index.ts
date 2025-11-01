type JSONRPCMessage =
  | {
      id: number;
      method: string;
      params?: unknown;
    }
  | {
      method: string;
      params?: unknown;
    };

const wsUrlInput = document.querySelector<HTMLInputElement>("#ws-url")!;
const connectBtn = document.querySelector<HTMLButtonElement>("#connect")!;
const disconnectBtn = document.querySelector<HTMLButtonElement>("#disconnect")!;
const startConversationBtn =
  document.querySelector<HTMLButtonElement>("#start-conversation")!;
const messageForm = document.querySelector<HTMLFormElement>("#message-form")!;
const messageInput = document.querySelector<HTMLInputElement>("#message-input")!;
const sendBtn = document.querySelector<HTMLButtonElement>("#send")!;
const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const chatLogEl = document.querySelector<HTMLDivElement>("#chat-log")!;
const wsLogEl = document.querySelector<HTMLDivElement>("#ws-log")!;
const panelsEl = document.querySelector<HTMLDivElement>(".panels")!;
const dividerEl = document.querySelector<HTMLDivElement>("#divider")!;
const chatPanelEl = document.querySelector<HTMLDivElement>(".chat-panel")!;

let socket: WebSocket | null = null;
let nextId = 0;
let conversationId: string | null = null;
let subscriptionId: string | null = null;
let initialized = false;

const nowLabel = () => new Date().toLocaleTimeString();

const appendWsLog = (text: string, variant: "incoming" | "outgoing" | "meta") => {
  const entry = document.createElement("div");
  entry.className = `ws-entry ws-entry--${variant}`;
  entry.textContent = `[${nowLabel()}] ${text}`;
  wsLogEl.appendChild(entry);
  wsLogEl.scrollTop = wsLogEl.scrollHeight;
};

const appendChatMessage = (
  speaker: string,
  message: string,
  variant: "user" | "assistant",
) => {
  const entry = document.createElement("div");
  entry.className = `chat-entry chat-entry--${variant}`;

  const meta = document.createElement("div");
  meta.className = "chat-entry__meta";
  const speakerSpan = document.createElement("span");
  speakerSpan.textContent = speaker;
  const timeSpan = document.createElement("span");
  timeSpan.textContent = nowLabel();
  meta.append(speakerSpan, timeSpan);

  const body = document.createElement("p");
  body.className = "chat-entry__body";
  body.textContent = message;

  entry.append(meta, body);
  chatLogEl.appendChild(entry);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
};

const resetConversationState = () => {
  conversationId = null;
  subscriptionId = null;
  messageInput.value = "";
  messageInput.disabled = true;
  sendBtn.disabled = true;
  if (chatLogEl.childElementCount > 0) {
    chatLogEl.textContent = "";
  }
};

const setUiState = (state: "disconnected" | "connected" | "ready") => {
  switch (state) {
    case "disconnected": {
      statusEl.textContent = "Disconnected";
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      startConversationBtn.disabled = true;
      resetConversationState();
      break;
    }
    case "connected": {
      statusEl.textContent = "Connected – awaiting initialization";
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      startConversationBtn.disabled = true;
      resetConversationState();
      break;
    }
    case "ready": {
      statusEl.textContent = conversationId
        ? `Conversation ${conversationId}`
        : "Connected";
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      startConversationBtn.disabled = false;
      messageInput.disabled = !conversationId;
      sendBtn.disabled = !conversationId;
      break;
    }
  }
};

const safeSend = (payload: JSONRPCMessage) => {
  if (!socket) {
    appendWsLog("Cannot send message: not connected", "meta");
    return;
  }
  const json = JSON.stringify(payload);
  appendWsLog(`→ ${json}`, "outgoing");
  socket.send(json);
};

const handleAgentEvent = (value: any) => {
  if (value.method === "codex/event/agent_message") {
    const text = value.params?.msg?.message ?? "";
    appendChatMessage("Codex", text, "assistant");
    return true;
  }

  if (value.method === "codex/event/raw_response_item") {
    const raw =
      value.params?.msg?.item?.content?.[0]?.text ?? JSON.stringify(value.params);
    appendWsLog(raw, "incoming");
    return true;
  }

  if (
    value.method === "codex/event/task_complete" &&
    value.params?.conversationId === conversationId
  ) {
    statusEl.textContent = "Conversation complete (ready for new prompt)";
    messageInput.disabled = false;
    sendBtn.disabled = false;
    return true;
  }

  return false;
};

const handleMessage = (event: MessageEvent) => {
  appendWsLog(`← ${event.data}`, "incoming");

  try {
    const value = JSON.parse(event.data);

    if (handleAgentEvent(value)) {
      return;
    }

    if (value.id === 0 && value.result?.userAgent && !initialized) {
      initialized = true;
      safeSend({ method: "initialized", params: {} });
      setUiState("ready");
      appendWsLog(
        `Connected to app-server: ${value.result.userAgent as string}`,
        "meta",
      );
      startConversation();
    }

    if (value.id === 1 && value.result?.conversationId) {
      conversationId = value.result.conversationId as string;
      setUiState("ready");
      messageInput.disabled = false;
      sendBtn.disabled = false;
      appendWsLog(`Conversation started: ${conversationId}`, "meta");
      messageInput.focus();
    }

    if (value.id === 2 && value.result?.subscriptionId) {
      subscriptionId = value.result.subscriptionId as string;
      appendWsLog(`Listening for events (${subscriptionId})`, "meta");
    }
  } catch (error) {
    console.error("Failed to parse message", error);
  }
};

const connect = () => {
  const url = wsUrlInput.value.trim();
  if (!url) {
    appendWsLog("Please enter a WebSocket URL.", "meta");
    return;
  }

  socket = new WebSocket(url, "codex.app-server.v1");
  nextId = 0;
  initialized = false;
  resetConversationState();
  setUiState("connected");
  appendWsLog(`Connecting to ${url}`, "meta");

  socket.addEventListener("open", () => {
    appendWsLog("WebSocket open", "meta");
    safeSend({
      id: nextId++,
      method: "initialize",
      params: {
        clientInfo: {
          name: "codex-webapp",
          version: "0.1.0",
        },
      },
    });
  });

  socket.addEventListener("message", handleMessage);

  socket.addEventListener("close", (event) => {
    appendWsLog(`WebSocket closed: ${event.code} ${event.reason}`, "meta");
    socket = null;
    setUiState("disconnected");
  });

  socket.addEventListener("error", (event) => {
    appendWsLog(`WebSocket error: ${JSON.stringify(event)}`, "meta");
  });
};

const disconnect = () => {
  if (socket) {
    appendWsLog("Closing WebSocket", "meta");
    socket.close(1000, "client disconnect");
  }
  socket = null;
  resetConversationState();
  setUiState("disconnected");
};

const startConversation = () => {
  if (!socket) {
    appendWsLog("Cannot start conversation: not connected", "meta");
    return;
  }

  resetConversationState();

  safeSend({
    id: nextId++,
    method: "newConversation",
    params: {},
  });
};

const attachListener = () => {
  if (!conversationId) {
    return;
  }
  safeSend({
    id: nextId++,
    method: "addConversationListener",
    params: {
      conversationId,
      experimentalRawEvents: true,
    },
  });
};

const sendMessage = (text: string) => {
  if (!conversationId) {
    appendWsLog("Start a conversation before sending messages.", "meta");
    return;
  }

  if (!subscriptionId) {
    attachListener();
  }

  appendChatMessage("You", text, "user");

  safeSend({
    id: nextId++,
    method: "sendUserMessage",
    params: {
      conversationId,
      items: [
        {
          type: "text",
          data: {
            text,
          },
        },
      ],
    },
  });

  messageInput.disabled = true;
  sendBtn.disabled = true;
  messageInput.blur();
};

const setupSplitter = () => {
  let dragging = false;
  let pointerId: number | null = null;

  dividerEl.addEventListener("pointerdown", (event) => {
    dragging = true;
    pointerId = event.pointerId;
    dividerEl.setPointerCapture(event.pointerId);
  });

  dividerEl.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    const rect = panelsEl.getBoundingClientRect();
    const offset = event.clientX - rect.left;
    const percent = Math.max(20, Math.min(80, (offset / rect.width) * 100));
    chatPanelEl.style.flex = `0 0 ${percent}%`;
  });

  const stopDragging = (event: PointerEvent) => {
    if (!dragging || pointerId !== event.pointerId) {
      return;
    }
    dragging = false;
    dividerEl.releasePointerCapture(event.pointerId);
    pointerId = null;
  };

  dividerEl.addEventListener("pointerup", stopDragging);
  dividerEl.addEventListener("pointercancel", stopDragging);
};

connectBtn.addEventListener("click", () => {
  if (socket) {
    appendWsLog("Already connected", "meta");
    return;
  }
  connect();
});

disconnectBtn.addEventListener("click", () => {
  disconnect();
});

startConversationBtn.addEventListener("click", () => {
  startConversation();
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) {
    return;
  }
  sendMessage(text);
  messageInput.value = "";
  messageInput.focus();
});

setUiState("disconnected");
setupSplitter();
