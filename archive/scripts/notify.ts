#!/usr/bin/env ts-node

type Level = "info" | "warn" | "error";
type Target = "slack" | "discord";

const { 
  WEBHOOK_SLACK_URL, 
  WEBHOOK_DISCORD_URL, 
  ALERT_ENV = "prod", 
  ALERT_PROJECT = "baseball-ai-media" 
} = process.env;

// Import fetch for Node.js compatibility
const nodeFetch = typeof globalThis.fetch !== 'undefined' ? globalThis.fetch : require('node-fetch');

function toSlackPayload(title: string, body: string, level: Level, meta?: any) {
  const color = level === "error" ? "#ef4444" : level === "warn" ? "#f59e0b" : "#10b981";
  return {
    attachments: [{
      color,
      title: `【${ALERT_PROJECT} / ${ALERT_ENV}】${title}`,
      text: body,
      fields: meta ? Object.entries(meta).map(([k, v]) => ({ 
        title: k, 
        value: String(v), 
        short: true 
      })) : [],
      ts: Math.floor(Date.now() / 1000)
    }]
  };
}

function toDiscordPayload(title: string, body: string, level: Level, meta?: any) {
  const prefix = level === "error" ? "🛑" : level === "warn" ? "⚠️" : "✅";
  const lines = [`**${prefix} ${title}**`, body];
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      lines.push(`- **${k}**: ${v}`);
    }
  }
  return { content: lines.join("\n") };
}

async function send(target: Target, title: string, body: string, level: Level, meta?: any) {
  const url = target === "slack" ? WEBHOOK_SLACK_URL : WEBHOOK_DISCORD_URL;
  if (!url) throw new Error(`Missing webhook URL for ${target}`);
  
  const payload = target === "slack" 
    ? toSlackPayload(title, body, level, meta) 
    : toDiscordPayload(title, body, level, meta);
  
  const response = await nodeFetch(url, { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(payload) 
  });
  
  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${await response.text()}`);
  }
}

// Export for use in other scripts
async function notifyInternal(level: Level, title: string, body: string, meta?: any) {
  const target: Target = process.env.NOTIFY_TARGET === "slack" ? "slack" : "discord";
  await send(target, title, body, level, meta);
}

// CommonJS export for compatibility
module.exports = { notify: notifyInternal };

// CLI interface
async function main() {
  // CLI: ts-node scripts/notify.ts --level warn --title "Coeff Δ 9.1%" --body "..."
  const args = process.argv.slice(2);
  const getArg = (key: string) => {
    const index = args.indexOf(key);
    return index !== -1 ? args[index + 1] : undefined;
  };
  
  const level = (getArg("--level") as Level) || "info";
  const title = getArg("--title") || "Notification";
  const body = getArg("--body") || "";
  const metaString = getArg("--meta");
  const meta = metaString ? JSON.parse(metaString) : undefined;
  
  try {
    await notifyInternal(level, title, body, meta);
    console.log(`✅ Notification sent successfully (${level}): ${title}`);
  } catch (error) {
    console.error("❌ Notification failed:", error);
    process.exit(1);
  }
}

// Run CLI if this script is executed directly
if (require.main === module) {
  main();
}