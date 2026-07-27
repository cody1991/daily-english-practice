import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyAction, loadState, saveState, stateForDisplay, syncState } from "./state.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
const port = Number(process.env.PORT ?? 4174);

app.use(express.json());
app.use((_, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});

app.get("/api/state", async (_, response, next) => {
  try {
    response.json(stateForDisplay(await loadState()));
  } catch (error) {
    next(error);
  }
});

app.post("/api/action", async (request, response, next) => {
  const action = request.body?.action;
  if (!new Set(["complete", "hard", "skip", "reset"]).has(action)) {
    response.status(400).json({ error: "Unknown action" });
    return;
  }
  try {
    const state = applyAction(await loadState(), action);
    await saveState(state);
    response.json(stateForDisplay(state));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/sync", async (_, response, next) => {
  try {
    const state = await loadState();
    response.json({ state: stateForDisplay(state), sync: await syncState() });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(root, "dist")));
app.get("/{*splat}", (_, response) => response.sendFile(path.join(root, "dist", "index.html")));
app.use((error, _, response, __) => {
  console.error(error);
  response.status(500).json({ error: "The local learning service could not complete that request." });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Daily English API is running at http://127.0.0.1:${port}`);
});
