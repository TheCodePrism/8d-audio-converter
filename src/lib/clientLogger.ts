"use client";

export type LogLevel = "info" | "warn" | "error" | "success";
export type LogTag = "Queue" | "YouTube" | "DSP" | "Player" | "Storage" | "System";

export interface ClientLogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  tag: LogTag;
  message: string;
  details?: any;
}

const STORAGE_KEY = "sphere8d_client_logs";
const MAX_LOGS = 150;

class ClientLogger {
  private logs: ClientLogEntry[] = [];
  private listeners: Set<(logs: ClientLogEntry[]) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          this.logs = JSON.parse(saved).slice(-MAX_LOGS);
        }
      } catch {
        this.logs = [];
      }
    }
  }

  private persist() {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
      } catch {
        // Ignore quota limits on sessionStorage
      }
    }
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.getLogs()));
  }

  public log(level: LogLevel, tag: LogTag, message: string, details?: any) {
    const entry: ClientLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      level,
      tag,
      message,
      details,
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }

    this.persist();
    this.notify();

    // Mirror to standard browser console with prefix
    const prefix = `[Sphere8D ${tag}]`;
    if (level === "error") {
      console.error(prefix, message, details !== undefined ? details : "");
    } else if (level === "warn") {
      console.warn(prefix, message, details !== undefined ? details : "");
    } else {
      console.log(prefix, message, details !== undefined ? details : "");
    }
  }

  public info(tag: LogTag, message: string, details?: any) {
    this.log("info", tag, message, details);
  }

  public warn(tag: LogTag, message: string, details?: any) {
    this.log("warn", tag, message, details);
  }

  public error(tag: LogTag, message: string, details?: any) {
    this.log("error", tag, message, details);
  }

  public success(tag: LogTag, message: string, details?: any) {
    this.log("success", tag, message, details);
  }

  public getLogs(): ClientLogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this.notify();
  }

  public subscribe(cb: (logs: ClientLogEntry[]) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public generateBugReport(): string {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
    const screenRes = typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "Unknown";
    const audioContextSupported = typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);
    
    let report = `### Sphere8D Diagnostics Report\n`;
    report += `- **Generated:** ${new Date().toISOString()}\n`;
    report += `- **User Agent:** ${userAgent}\n`;
    report += `- **Resolution:** ${screenRes}\n`;
    report += `- **Web Audio Supported:** ${audioContextSupported ? "Yes" : "No"}\n`;
    report += `- **Hardware Concurrency:** ${typeof navigator !== "undefined" ? navigator.hardwareConcurrency : "N/A"}\n\n`;

    report += `#### Recent Events (last ${this.logs.length}):\n`;
    report += "```text\n";
    this.logs.slice(-50).forEach((l) => {
      const time = new Date(l.timestamp).toLocaleTimeString();
      report += `[${time}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}\n`;
      if (l.details) {
        try {
          const detailStr = typeof l.details === "string" ? l.details : JSON.stringify(l.details);
          report += `       Details: ${detailStr.slice(0, 300)}\n`;
        } catch {
          // ignore
        }
      }
    });
    report += "```\n";

    return report;
  }
}

export const clientLogger = new ClientLogger();
