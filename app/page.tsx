"use client";

import { useState, useRef, useEffect } from "react";
import { SplineScene } from "@/components/ui/splite";

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

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, { label: string; color: string }> = {
    pdf: { label: "PDF", color: "#ff6b6b" },
    docx: { label: "DOC", color: "#74b9ff" },
    doc: { label: "DOC", color: "#74b9ff" },
    xlsx: { label: "XLS", color: "#55efc4" },
    xls: { label: "XLS", color: "#55efc4" },
    csv: { label: "CSV", color: "#fdcb6e" },
    txt: { label: "TXT", color: "#a29bfe" },
  };
  const info = map[ext || ""] || { label: "FILE", color: "#a29bfe" };
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ background: info.color + "20", color: info.color, letterSpacing: "0.05em" }}
    >
      {info.label}
    </span>
  );
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

  useEffect(() => { fetchDocuments(); }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function fetchDocuments() {
    const res = await fetch("/api/files");
    const data = await res.json();
    setDocuments(data.documents || []);
  }

  async function handleUpload(file: File) {
    const supported = [".pdf", ".docx", ".xlsx", ".xls", ".csv", ".txt"];
    if (!supported.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      alert("Supported: PDF, DOCX, XLSX, CSV, TXT");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (data.success) await fetchDocuments();
    else alert(data.error || "Upload failed.");
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
    setMessages([
      ...newMessages,
      { role: "assistant", content: data.reply || "Sorry, something went wrong." },
    ]);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-radial">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-0 left-64 w-96 h-96 bg-accent opacity-5 rounded-full blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-80 h-80 bg-purple-600 opacity-5 rounded-full blur-3xl" />

      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 flex flex-col glass border-r border-border relative z-10">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center shadow-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white tracking-tight">DocReader AI</h1>
              <p className="text-[10px] text-gray-500">Powered by GPT-4o mini</p>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="p-4 border-b border-border">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Upload Document</p>
          <div
            className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-300 ${
              dragOver
                ? "border-accent bg-accent-soft scale-[0.99]"
                : "border-border hover:border-accent/40 hover:bg-white/[0.02]"
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
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span className="text-xs text-accent font-medium">Uploading...</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-300">Drop file here</p>
                <p className="text-[10px] text-gray-600 mt-1">PDF · DOCX · XLSX · CSV · TXT</p>
              </>
            )}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Documents</p>
            <div className="flex items-center gap-2">
              {documents.length > 0 && (
                <>
                  <span className="text-[10px] bg-accent-soft text-accent px-2 py-0.5 rounded-full font-medium">
                    {documents.length}
                  </span>
                  <button
                    onClick={async () => {
                      if (!confirm("Delete all documents?")) return;
                      await Promise.all(documents.map(d => fetch("/api/files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id }) })));
                      await fetchDocuments();
                    }}
                    className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2 opacity-20">📂</div>
                <p className="text-[11px] text-gray-600">No documents yet</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative rounded-xl p-3 border border-border hover:border-border-light hover:bg-white/[0.03] transition-all duration-200"
                >
                  <div className="flex items-start gap-2.5">
                    <FileIcon name={doc.original_name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 font-medium truncate leading-tight">{doc.original_name}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {doc.page_count} pages · {formatSize(doc.file_size)} · {formatDate(doc.uploaded_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-gray-500 hover:text-red-400 transition-all p-0.5 flex-shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">

        {/* Spline full background */}
        <div className="absolute inset-0 z-0">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
          {/* Dark overlay so text is readable */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(8,8,16,0.72)" }} />
        </div>

        {/* Header */}
        <header className="px-6 py-4 border-b border-border glass flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-sm font-semibold text-white">Document Chat</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {documents.length === 0 ? "Upload a document to get started" : `${documents.length} document${documents.length > 1 ? "s" : ""} ready`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-gray-500">Online</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 relative z-10">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center select-none py-20">
              <div className="w-14 h-14 rounded-2xl bg-gradient-accent flex items-center justify-center mb-5 shadow-lg glow mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Ask anything about your documents</h3>
              <p className="text-sm text-gray-400 max-w-sm mb-6">Upload a PDF, spreadsheet, or document — ask questions, calculate totals, or search for data.</p>
              <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                {["What is the total amount?","Summarize this document","Find mentions of [keyword]","Calculate average salary"].map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-left text-xs text-gray-400 border border-border hover:border-accent/40 hover:text-gray-200 rounded-lg px-3 py-2 transition-all hover:bg-accent-soft backdrop-blur-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5 shadow-md">
                  AI
                </div>
              )}
              <div className={`max-w-xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-gradient-accent text-white px-4 py-3 rounded-2xl rounded-br-sm shadow-lg"
                  : "glass px-4 py-3 rounded-2xl rounded-bl-sm text-gray-200"
              }`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-panel-light border border-border flex items-center justify-center text-[11px] font-bold text-gray-400 flex-shrink-0 mt-0.5">
                  U
                </div>
              )}
            </div>
          ))}

          {thinking && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5 shadow-md">AI</div>
              <div className="glass px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="dot-pulse flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full block" />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full block" />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full block" />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-border glass relative z-10">
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                className="w-full bg-panel-light border border-border rounded-2xl px-4 py-3 pr-4 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-accent/50 focus:bg-white/[0.03] transition-all duration-200"
                placeholder="Ask about your documents..."
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
            </div>
            <button
              onClick={sendMessage}
              disabled={thinking || !input.trim()}
              className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-accent hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed text-white transition-all duration-200 flex items-center justify-center shadow-lg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-gray-700 mt-2 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>
    </div>
  );
}
