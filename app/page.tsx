"use client";

import { useState, useRef, useEffect } from "react";

interface Document {
  id: number;
  original_name: string;
  page_count: number;
  file_size: number;
  uploaded_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function fetchDocuments() {
    const res = await fetch("/api/files");
    const data = await res.json();
    setDocuments(data.documents || []);
  }

  async function handleUpload(file: File) {
    if (!file.name.endsWith(".pdf")) {
      alert("Only PDF files are supported.");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (data.success) {
      await fetchDocuments();
    } else {
      alert(data.error || "Upload failed.");
    }
    setUploading(false);
  }

  async function handleDelete(id: number) {
    await fetch("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchDocuments();
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setThinking(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    const data = await res.json();
    setThinking(false);

    if (data.reply) {
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } else {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 flex flex-col bg-panel border-r border-border">
        <div className="p-5 border-b border-border">
          <h1 className="text-lg font-semibold text-white tracking-tight">DocReader AI</h1>
          <p className="text-xs text-gray-500 mt-0.5">Chat with your documents</p>
        </div>

        {/* Upload */}
        <div className="p-4 border-b border-border">
          <div
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? "border-accent bg-accent/10"
                : "border-border hover:border-accent/50 hover:bg-white/5"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleUpload(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-accent">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm">Uploading...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl mb-2">📄</div>
                <p className="text-sm text-gray-400">Drop PDF here</p>
                <p className="text-xs text-gray-600 mt-1">or click to browse</p>
              </>
            )}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {documents.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">No documents yet</p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="group bg-surface rounded-lg p-3 border border-border hover:border-accent/40 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{doc.original_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {doc.page_count} pages · {formatSize(doc.file_size)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-lg font-medium text-white">Ask anything about your documents</p>
              <p className="text-sm text-gray-500 mt-1">Upload a PDF and start chatting</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs mr-3 flex-shrink-0 mt-1">
                  AI
                </div>
              )}
              <div
                className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-accent text-white rounded-br-sm"
                    : "bg-panel border border-border text-gray-200 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs mr-3 flex-shrink-0 mt-1">
                AI
              </div>
              <div className="bg-panel border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-panel">
          <div className="flex gap-3 items-end">
            <textarea
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-accent transition-colors"
              placeholder="Ask about your document..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              style={{ maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={sendMessage}
              disabled={thinking || !input.trim()}
              className="bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl px-5 py-3 text-sm font-medium transition-all flex-shrink-0"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-700 mt-2 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>
    </div>
  );
}
