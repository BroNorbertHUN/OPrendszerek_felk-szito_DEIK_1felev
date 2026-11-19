import { useCallback, useEffect, useMemo, useState } from "react";

type Question = { id: string; m_id: string; correct: boolean; points: number; description: string; hasSource: boolean; sourceName: string | null };
type Session = { id: string; total: number; score: number; questions: Question[] };
const API = import.meta.env.VITE_API_URL ?? "";

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${endpoint}`, init);
  if (!response.ok) throw new Error(`API hiba (${response.status})`);
  return response.json() as Promise<T>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [baseUrl, setBaseUrl] = useState(() => {
    const saved = window.localStorage.getItem("linuxzh-api-url");
    return !saved || saved === "http://localhost:3001" ? "http://10.0.2.2:3001" : saved;
  });
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [dark, setDark] = useState(true);
  const [message, setMessage] = useState("");

  const newSession = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try { setSession(await request<Session>("/api/sessions", { method: "POST" })); }
    catch { setMessage("Nem sikerült csatlakozni a szerverhez. Indítsd el az alkalmazást az npm run dev paranccsal."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void newSession(); if (!window.localStorage.getItem("linuxzh-api-url")) void request<{ baseUrl: string }>("/api/config").then((config) => setBaseUrl(config.baseUrl)).catch(() => undefined); }, [newSession]);

  function changeBaseUrl(value: string) {
    const normalized = value.trim().replace(/\/$/, "");
    setBaseUrl(normalized);
    window.localStorage.setItem("linuxzh-api-url", normalized);
  }

  const refresh = useCallback(async () => {
    if (!session) return;
    try { setSession(await request<Session>(`/api/sessions/${session.id}`)); } catch { /* A csendes frissítés nem zavarja a feladatmegoldást. */ }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    return () => window.clearInterval(timer);
  }, [session?.id, refresh]);

  const initCommand = useMemo(() => session ? `cd "$HOME" && curl -fsSL '${baseUrl}/api/init-script/${session.id}' | bash` : "", [session, baseUrl]);
  async function copy(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(null), 1800); }
    catch { setMessage("A vágólap nem érhető el. Jelöld ki és másold ki a parancsot."); }
  }
  function verifyCommand(question: Question) {
    return `curl -sS -F "file=@${question.m_id}.txt" '${baseUrl}/api/verify/${session?.id}/${question.id}'`;
  }

  return <main className={dark ? "app dark" : "app light"}>
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">$</span><span>linux<span className="brand-light">zh</span><small>GYAKORLÓ KÖRNYEZET</small></span></a>
      <div className="top-actions"><span className="live"><i /> SZERVER AKTÍV</span><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Téma váltása">{dark ? "☼" : "☾"}</button></div>
    </header>
    <div className="container" id="top">
      <section className="hero"><div className="eyebrow"><span>FELKÉSZÜLÉS</span><b>·</b><span>LINUX GYAKORLATI ZH</span></div>
        <div className="hero-row"><div><h1>Gyakorolj élesben.</h1><p>Oldd meg a feladatokat a saját Linux környezetedben. A pontszám automatikusan frissül.</p></div>
          <div className="score-card"><span>ELÉRT PONTSZÁM</span><strong>{session?.score ?? 0}<small> / {session?.total ?? 10}</small></strong><div className="score-bar"><i style={{ width: `${(session?.score ?? 0) * 10}%` }} /></div></div></div>
      </section>

      <section className="setup-card"><div className="setup-icon">⌘</div><div className="setup-content"><div className="setup-title"><span>0. LÉPÉS</span><h2>Készítsd elő a környezetet</h2></div><p>Futtasd ezt a parancsot a távoli Linux szerveren. Letölti az aktuális feladatokhoz szükséges forrásfájlokat.</p>
          <label className="api-url-label" htmlFor="api-url">A virtuális gépből elérhető API-cím <span>A localhost a Linux VM-re mutat. VirtualBox NAT esetén próbáld ezt: http://10.0.2.2:3001. Más hálózati módban a Windows gazdagép VM-ből elérhető IP-címét add meg.</span></label>
          <div className="api-url-field"><input id="api-url" value={baseUrl} onChange={(event) => changeBaseUrl(event.target.value)} spellCheck={false} placeholder="http://192.168.1.20:3001" /><span>A cím automatikusan megőrződik ebben a böngészőben.</span></div>
          <div className="command-box"><code>{busy ? "Munkamenet indítása…" : initCommand}</code><button onClick={() => void copy("init", initCommand)} disabled={busy}>{copied === "init" ? "✓ Másolva" : "▢ Másolás"}</button></div>
        </div></section>

      <section className="tasks-heading"><div><div className="eyebrow">A TE FELADATSOROD</div><h2>Feladatok <span>{session ? `(${session.questions.length})` : ""}</span></h2><p className="generate-hint">50 feladatból véletlenszerűen választott új 10-es csomag.</p></div><button className="generate-button" onClick={() => void newSession()} disabled={busy}>⟳ Generálj új feladatsort</button></section>
      {message && <div className="notice">{message}</div>}
      {busy ? <div className="loading"><span className="spinner" /> Feladatok betöltése…</div> : <div className="task-list">{session?.questions.map((question, index) => <article className={`task-card ${question.correct ? "is-correct" : ""}`} key={question.id}>
        <div className="task-number">{String(index + 1).padStart(2, "0")}</div><div className="task-main"><div className="task-meta"><span>FELADAT {String(index + 1).padStart(2, "0")}</span><span className={`status ${question.correct ? "correct" : "neutral"}`}>{question.correct ? "✓ Helyes" : "○ Folyamatban"}</span></div>
          <p className="task-description">{question.description}</p>
          {question.hasSource && question.sourceName && <div className="source-hint">▤ <span>Forrásfájl: <strong>{question.sourceName}</strong></span></div>}
          <div className="verify-row"><span className="verify-label">ELLENŐRZÉS</span><div className="command-box verify-command"><code>{verifyCommand(question)}</code><button onClick={() => void copy(question.id, verifyCommand(question))}>{copied === question.id ? "✓ Másolva" : "▢ Másolás"}</button></div></div>
        </div><div className={`points ${question.correct ? "earned" : ""}`}><strong>{question.points}</strong><span>/ 1 PONT</span></div>
      </article>)}</div>}
      <footer><span>Linux ZH · Gyakorló</span><span>A megoldásaid csak az adott feladat pontszámát frissítik.</span></footer>
    </div>
  </main>;
}
