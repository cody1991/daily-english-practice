#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const requiredFields = ["id", "date", "theme", "source", "source_type", "source_url", "duration", "segment", "accent", "listen_task", "speaking_task", "phrases"];
const segmentPattern = /^\d{1,2}:\d{2}(?::\d{2})?\s*[–-]\s*\d{1,2}:\d{2}(?::\d{2})?$/;

function parseArguments(args) {
  const lessonPath = args[0];
  const projectFlag = args.indexOf("--project-root");
  const projectRoot = projectFlag === -1 ? null : args[projectFlag + 1];
  if (!lessonPath || !projectRoot) throw new Error("Usage: node scripts/publish-lesson.js lesson.json --project-root .");
  return { lessonPath, projectRoot: path.resolve(projectRoot) };
}

function validateLesson(lesson) {
  const missing = requiredFields.filter((field) => !(field in lesson));
  if (missing.length) throw new Error(`Lesson is missing fields: ${missing.join(", ")}`);
  if (!Array.isArray(lesson.phrases) || lesson.phrases.length < 2 || lesson.phrases.length > 3) throw new Error("Lesson must include 2-3 reusable phrases.");
  if (!/^https?:\/\//.test(lesson.source_url)) throw new Error("Lesson source_url must be an HTTP(S) URL.");
  if (!segmentPattern.test(lesson.segment)) throw new Error("Lesson segment must be an exact time range, for example '00:00–06:20'.");
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function main() {
  const { lessonPath, projectRoot } = parseArguments(process.argv.slice(2));
  const lesson = await readJson(lessonPath);
  validateLesson(lesson);
  const stateFile = path.join(projectRoot, ".learning", "state.json");
  const seedFile = path.join(projectRoot, "data", "seed-state.json");
  let state;
  try {
    state = await readJson(stateFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    state = await readJson(seedFile);
  }
  const prior = state.today;
  if (prior?.source_url === lesson.source_url) throw new Error("Refusing to publish the same source URL twice in a row.");

  state.today = { ...lesson, status: "ready" };
  state.review = (state.review ?? []).slice(0, 12);
  state.history = state.history ?? [];
  if (prior) {
    state.history.unshift({ id: prior.id, source_url: prior.source_url, theme: prior.theme, source: prior.source, status: prior.status });
  }
  state.history = state.history.slice(0, 90);
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`Published ${lesson.id} to ${stateFile}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
