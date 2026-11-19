import cors from "cors";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeOutput } from "./normalize.js";

type QuestionDefinition = {
  id: string;
  description: string;
  sourceFile: string;
  sourceFileExt: string | null;
};
type SessionQuestion = QuestionDefinition & { m_id: string; correct: boolean };
type PracticeSession = { id: string; questions: SessionQuestion[]; createdAt: number };

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const questionsPath = path.join(root, "data", "questions.json");
const sourcePath = path.join(root, "sources");
const solutionsPath = path.join(root, "solutions");
const PORT = Number(process.env.PORT ?? 3001);
const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? `http://10.0.2.2:${PORT}`).replace(/\/$/, "");
const app = express();
const sessions = new Map<string, PracticeSession>();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

app.use(cors());
app.use(express.json());

async function getDefinitions(): Promise<QuestionDefinition[]> {
  const raw: unknown = JSON.parse(await readFile(questionsPath, "utf8"));
  if (!Array.isArray(raw) || raw.length < 10) throw new Error("A questions.json legalább 10 feladatot kell tartalmazzon.");
  return raw as QuestionDefinition[];
}

function publicSession(session: PracticeSession) {
  return {
    id: session.id,
    total: session.questions.length,
    score: session.questions.filter((question) => question.correct).length,
    questions: session.questions.map(({ id, description, sourceFile, sourceFileExt, m_id, correct }) => ({
      id, m_id, correct, points: correct ? 1 : 0,
      description: description
        .replaceAll("{m_id}", m_id)
        .replaceAll("{id}", id)
        .replaceAll("{sourceFileExt}", sourceFileExt ?? ""),
      hasSource: sourceFile === "id" && sourceFileExt !== null,
      sourceName: sourceFile === "id" && sourceFileExt ? `${id}.${sourceFileExt}` : null,
    })),
  };
}

function findSession(req: Request, res: Response): PracticeSession | null {
  const rawSessionId = req.params.sessionId;
  const session = sessions.get(typeof rawSessionId === "string" ? rawSessionId : "");
  if (!session) { res.status(404).json({ error: "A munkamenet nem található." }); return null; }
  return session;
}

app.get("/api/config", (_req, res) => res.json({ baseUrl: publicBaseUrl }));

app.post("/api/sessions", async (_req, res, next) => {
  try {
    const definitions = await getDefinitions();
    const shuffled = [...definitions];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
    }
    const session: PracticeSession = {
      id: randomUUID(), createdAt: Date.now(),
      questions: shuffled.slice(0, 10).map((definition) => ({ ...definition, m_id: `meg_${randomBytes(4).toString("hex")}`, correct: false })),
    };
    sessions.set(session.id, session);
    res.status(201).json(publicSession(session));
  } catch (error) { next(error); }
});

app.get("/api/sessions/:sessionId", (req, res) => {
  const session = findSession(req, res);
  if (session) res.json(publicSession(session));
});

app.get("/api/init-script/:sessionId", (req, res) => {
  const session = findSession(req, res);
  if (!session) return;
  const requestBaseUrl = `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
  const scriptBaseUrl = process.env.PUBLIC_BASE_URL ? publicBaseUrl : requestBaseUrl;
  const sources = session.questions.filter((question) => question.sourceFile === "id" && question.sourceFileExt !== null);
  const lines = ["#!/usr/bin/env bash", "set -e", "echo 'Linux ZH gyakorlókörnyezet előkészítése…'"];
  if (sources.length === 0) {
    lines.push("echo 'Ehhez a munkamenethez nem tartozik letölthető forrásfájl.'");
  } else {
    lines.push('if [ ! -w . ]; then echo "Hiba: a jelenlegi könyvtár nem írható ($PWD). Lépj a saját könyvtáradba: cd $HOME" >&2; exit 1; fi');
    lines.push("mkdir -p .");
    for (const question of sources) {
      const filename = `${question.id}.${question.sourceFileExt}`;
      lines.push(`curl -fsS '${scriptBaseUrl}/api/sources/${session.id}/${question.id}' -o '${filename}'`);
      lines.push(`echo 'Letöltve: ${filename}'`);
    }
  }
  lines.push("echo 'A munkakörnyezet kész.'");
  res.type("text/x-shellscript").send(`${lines.join("\n")}\n`);
});

app.get("/api/sources/:sessionId/:questionId", async (req, res, next) => {
  try {
    const session = findSession(req, res);
    if (!session) return;
    const questionId = typeof req.params.questionId === "string" ? req.params.questionId : "";
    const question = session.questions.find((item) => item.id === questionId && item.sourceFile === "id");
    if (!question || !question.sourceFileExt) { res.sendStatus(404); return; }
    const filename = `${question.id}.${question.sourceFileExt}`;
    res.type("text/plain; charset=utf-8").send(await readFile(path.join(sourcePath, filename), "utf8"));
  } catch (error) { next(error); }
});

async function verifyOne(session: PracticeSession, questionId: string, submission: Buffer | undefined) {
  const question = session.questions.find((item) => item.id === questionId);
  if (!question || !submission) return null;
  try {
    const expected = await readFile(path.join(solutionsPath, `${question.id}.txt`), "utf8");
    question.correct = normalizeOutput(submission.toString("utf8")) === normalizeOutput(expected);
  } catch {
    question.correct = false;
  }
  return { id: question.id, correct: question.correct, points: question.correct ? 1 : 0 };
}

app.post("/api/verify/:sessionId/:questionId", (req, res, next) => {
  upload.single("file")(req, res, async (error: unknown) => {
    try {
      const session = findSession(req, res);
      if (!session) return;
      const questionId = typeof req.params.questionId === "string" ? req.params.questionId : "";
      const result = error ? await verifyOne(session, questionId, undefined) : await verifyOne(session, questionId, req.file?.buffer);
      res.json({ ...(result ?? { id: questionId, correct: false, points: 0 }), score: session.questions.filter((question) => question.correct).length, total: session.questions.length });
    } catch (caught) { next(caught); }
  });
});

app.post("/api/verify-batch/:sessionId", (req, res, next) => {
  upload.array("files", 10)(req, res, async (error: unknown) => {
    try {
      const session = findSession(req, res);
      if (!session) return;
      const files = error ? [] : (req.files as Express.Multer.File[] | undefined) ?? [];
      const results = await Promise.all(files.map(async (file) => {
        const match = /^meg_[a-f0-9]+\.txt$/i.exec(file.originalname);
        const question = match ? session.questions.find((item) => item.m_id === file.originalname.slice(0, -4)) : undefined;
        return question ? verifyOne(session, question.id, file.buffer) : null;
      }));
      res.json({ results: results.filter((result) => result !== null), score: session.questions.filter((question) => question.correct).length, total: session.questions.length });
    } catch (caught) { next(caught); }
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Belső szerverhiba." });
});

const distPath = path.join(root, "dist");
void access(distPath).then(() => {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}).catch(() => undefined);

app.listen(PORT, "0.0.0.0", () => console.log(`Linux ZH API fut: ${publicBaseUrl} (0.0.0.0:${PORT})`));
