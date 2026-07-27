#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function valueFromEnv(content, name) {
  const line = content.split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

async function main() {
  const [env, state] = await Promise.all([
    readFile(path.join(root, ".env"), "utf8"),
    readFile(path.join(root, ".learning", "state.json"), "utf8")
  ]);
  const webhook = valueFromEnv(env, "WECOM_WEBHOOK_URL");
  if (!webhook) throw new Error("WECOM_WEBHOOK_URL is not configured in .env.");
  const lesson = JSON.parse(state).today;
  if (!lesson) throw new Error("There is no published lesson to send.");
  const content = [
    "**Daily English · 20 min**",
    `> ${lesson.theme}`,
    `[${lesson.source} · ${lesson.duration} · ${lesson.segment}](${lesson.source_url})`,
    "",
    `**Listen**  ${lesson.listen_task}`,
    `**Say**  ${lesson.speaking_task}`
  ].join("\n");
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "markdown", markdown: { content } })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(body || `WeCom returned ${response.status}.`);
  console.log(body);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
