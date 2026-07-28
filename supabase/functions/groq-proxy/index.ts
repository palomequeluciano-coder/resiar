import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PROMPT_VERSION = 20;
const PROMPT_VERSION_CON_IMAGENES = 21;
const RAG_THRESHOLD = 0.48;
const RAG_TOP_K = 6;
const RAG_CANDIDATES = 30;
const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const MAX_TOKENS = 4096;
const MAX_TOKENS_RAZONAMIENTO = 800;
const RAZONAMIENTO_THINKING_BUDGET = 1024;
const MAX_CHUNK_CHARS = 1200;
const FETCH_TIMEOUT_MS = 35_000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ANIOS_DESACTUALIZACION = 10;

const EXAMENES_SIN_RAG = new Set(["MIR", "ENARM"]);

// Modelos considerados "fuertes": solo estos pueden disparar la advertencia de discrepancia.
// Los lite y el llama3.1-8b quedan fuera a proposito.
const MODELOS_FUERTES = new Set([
  "gemini/gemini-2.5-flash",
  "gemini/gemini-2.0-flash",
  "groq/llama-3.3-70b-versatile",
  "cerebras/gpt-oss-120b",
]);

function esModeloFuerte(modelo: string | null | undefined): boolean {
  return !!modelo && MODELOS_FUERTES.has(modelo);
}

function esErrorTransitorio(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("rate limit") || m.includes("ratelimit") || m.includes("high demand") ||
    m.includes("overloaded") || m.includes("overload") || m.includes("capacity") ||
    m.includes("too many requests") || m.includes("service unavailable") ||
    m.includes("sin contenido") || m.includes("503") || m.includes("529")
  );
}

function usaRAG(examen: string | null | undefined): boolean {
  if (!examen) return true;
  return !EXAMENES_SIN_RAG.has(examen.toUpperCase());
}

// finishReasons que indican rechazo por filtros (mismo resultado en otros modelos del mismo proveedor).
function esContenidoBloqueado(finishReason: string | null | undefined): boolean {
  const fr = (finishReason || "").toUpperCase();
  return fr === "SAFETY" || fr === "RECITATION" || fr === "PROHIBITED_CONTENT" ||
         fr === "BLOCKLIST" || fr === "SPII" || fr === "IMAGE_SAFETY";
}

// Hash estable del contenido de la pregunta. Si cambia opciones/respuesta/anio/anulada
// el hash cambia y el cache de esa pregunta se regenera, aunque no se toque PROMPT_VERSION.
function hashPayload(p: { pregunta?: string; opciones?: Record<string, string>; respuesta?: string | null; anulada?: boolean; anio?: number | null; imagenes?: unknown }): string {
  const base = JSON.stringify({
    q: p.pregunta ?? "",
    o: p.opciones ?? {},
    r: p.respuesta ?? null,
    an: !!p.anulada,
    y: p.anio ?? null,
    imgs: Array.isArray(p.imagenes) ? p.imagenes.map((img: any) => String(img?.url || img?.path || img || "")).filter(Boolean) : [],
  });
  let h = 5381;
  for (let i = 0; i < base.length; i++) {
    h = (((h << 5) + h) ^ base.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

async function fetchTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type Provider = {
  nombre: string;
  envKey: string;
  llamar: (sys: string, user: string, key: string, maxTokens?: number, thinkingBudget?: number) => Promise<{ texto: string; modelo: string }>;
};

interface ChunkResult {
  id: number;
  fuente: string;
  categoria: string | null;
  pagina: number | null;
  contenido: string;
  similitud: number;
  rerank_score?: number;
}

type ImagenPayload = {
  url?: string;
  path?: string;
  alt?: string | null;
  caption?: string | null;
  index?: number;
};

type GeminiImagePart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

function normalizarImagenes(raw: unknown): ImagenPayload[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((img, i): ImagenPayload | null => {
      if (typeof img === "string") return { url: img, index: i + 1 };
      if (!img || typeof img !== "object") return null;
      const anyImg = img as Record<string, unknown>;
      const url = typeof anyImg.url === "string" ? anyImg.url.trim() : "";
      const path = typeof anyImg.path === "string" ? anyImg.path.trim() : "";
      if (!url && !path) return null;
      return {
        url,
        path,
        alt: typeof anyImg.alt === "string" ? anyImg.alt : null,
        caption: typeof anyImg.caption === "string" ? anyImg.caption : null,
        index: typeof anyImg.index === "number" ? anyImg.index : i + 1,
      };
    })
    .filter((img): img is ImagenPayload => !!img)
    .slice(0, MAX_IMAGES);
}

function resolverImagenUrl(img: ImagenPayload, supabaseUrl: string): string {
  const raw = String(img.url || img.path || "").trim();
  if (!raw) return "";
  if (/^https:\/\//i.test(raw)) return raw;
  const cleanPath = raw.replace(/^\/+/, "");
  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/question-images/" + cleanPath;
}

function validarHostImagen(url: string, supabaseUrl: string): boolean {
  try {
    const imageUrl = new URL(url);
    const allowedHost = new URL(supabaseUrl).hostname;
    return imageUrl.protocol === "https:" && imageUrl.hostname === allowedHost;
  } catch (_) {
    return false;
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function cargarImagenesParaGemini(imagenes: ImagenPayload[], supabaseUrl: string): Promise<GeminiImagePart[]> {
  const parts: GeminiImagePart[] = [];
  for (const img of imagenes) {
    const url = resolverImagenUrl(img, supabaseUrl);
    if (!url) continue;
    if (!validarHostImagen(url, supabaseUrl)) {
      throw new Error("URL de imagen no permitida. Solo se aceptan imagenes del Storage del proyecto.");
    }
    const res = await fetchTimeout(url, { method: "GET" });
    if (!res.ok) throw new Error("No se pudo descargar la imagen clinica (HTTP " + res.status + ")");
    const mimeType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
      throw new Error("Formato de imagen no soportado: " + (mimeType || "desconocido"));
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("La imagen clinica supera el limite de 8 MB.");
    parts.push({ inlineData: { mimeType, data: toBase64(buffer) } });
  }
  return parts;
}

function buildImageContextForPrompt(imagenes: ImagenPayload[]): string {
  if (!imagenes.length) return "";
  const lines = imagenes.map((img, i) => {
    const meta = [img.caption ? "caption: " + img.caption : null, img.alt ? "alt: " + img.alt : null].filter(Boolean).join("; ");
    return "Imagen " + (i + 1) + (meta ? " (" + meta + ")" : "");
  }).join("\n");
  return "\n\nImagenes clinicas asociadas:\n" + lines + "\n\nIMPORTANTE: La pregunta incluye imagenes. Analizalas antes de elegir o explicar la respuesta. Si una imagen no es interpretable o no aporta datos suficientes, aclaralo y no inventes hallazgos.";
}

function getPromptVersionForPayload(payload: { imagenes?: unknown }): number {
  return normalizarImagenes(payload?.imagenes).length ? PROMPT_VERSION_CON_IMAGENES : PROMPT_VERSION;
}

async function verificarAccesoExplicacion(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<{ permitido: boolean; razon?: string }> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("plan, trial_started_at, created_at, plan_expira_at, current_period_end")
    .eq("id", userId)
    .single();
  if (error || !profile) return { permitido: false, razon: "Perfil no encontrado" };
  const ahora = new Date();
  if (profile.plan === "admin") return { permitido: true };
  if (profile.plan === "pro") {
    const expira = profile.plan_expira_at || profile.current_period_end;
    if (!expira || new Date(expira) > ahora) return { permitido: true };
    return { permitido: false, razon: "Tu suscripcion vencio. Renovala para seguir usando las explicaciones con IA." };
  }
  if (profile.plan === "trial_activo") {
    const expira = profile.plan_expira_at || profile.current_period_end;
    if (!expira || new Date(expira) > ahora) return { permitido: true };
    return { permitido: false, razon: "Tu periodo de trial premium termino. Suscribite para acceder a las explicaciones con IA." };
  }
  if (profile.plan === "trial" || profile.plan === "trial_limitado") {
    return { permitido: false, razon: "Las explicaciones con IA estan disponibles en el Trial Premium (3 dias gratis) o en el plan Pro." };
  }
  return { permitido: false, razon: "Necesitas un plan activo para usar las explicaciones con IA." };
}

const GEMINI_MODELOS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];

async function llamarGemini(sys: string, user: string, key: string, maxTokens = MAX_TOKENS, thinkingBudget = 0): Promise<{ texto: string; modelo: string }> {
  let lastErr: Error | null = null;
  for (const modelo of GEMINI_MODELOS) {
    try {
      const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: maxTokens, topP: 0.9 };
      // Los 2.0 no soportan thinkingConfig. En los 2.5 usamos el budget recibido
      // (0 = sin thinking para explicacion; >0 = thinking activo para razonamiento).
      if (!modelo.includes("2.0")) { generationConfig.thinkingConfig = { thinkingBudget }; }
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent?key=" + key;
      const res = await fetchTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig })
      });
      if (res.status === 429 || res.status === 503) { lastErr = new Error("Rate limit Gemini " + modelo); continue; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as any)?.error?.message || "Error " + res.status + " Gemini " + modelo;
        if (esErrorTransitorio(msg)) { lastErr = new Error(msg); continue; }
        throw new Error(msg);
      }
      const data = await res.json();
      const candidate = data.candidates?.[0];
      const texto = candidate?.content?.parts?.[0]?.text?.trim();
      if (!texto) {
        const fr = candidate?.finishReason || "unknown";
        if (esContenidoBloqueado(fr)) {
          const blk = new Error("Gemini contenido bloqueado (" + fr + ")");
          (blk as any).contentBlock = true;
          throw blk; // mismos filtros en todos los modelos Gemini: no reintentar con esta key
        }
        throw new Error("Gemini sin contenido (" + fr + ")");
      }
      return { texto, modelo: "gemini/" + modelo };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if ((lastErr as any).contentBlock) throw lastErr;
      if (!esErrorTransitorio(lastErr.message)) throw lastErr;
    }
  }
  const e = new Error(lastErr?.message || "Gemini saturado");
  (e as any).rateLimit = true;
  throw e;
}

async function llamarGeminiVision(
  sys: string,
  user: string,
  imageParts: GeminiImagePart[],
  key: string,
  maxTokens = MAX_TOKENS,
  thinkingBudget = 0
): Promise<{ texto: string; modelo: string }> {
  let lastErr: Error | null = null;
  for (const modelo of GEMINI_MODELOS) {
    try {
      const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: maxTokens, topP: 0.9 };
      if (!modelo.includes("2.0")) { generationConfig.thinkingConfig = { thinkingBudget }; }
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent?key=" + key;
      const res = await fetchTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: user }, ...imageParts] }],
          generationConfig
        })
      });
      if (res.status === 429 || res.status === 503 || res.status === 529) { lastErr = new Error("Rate limit Gemini vision " + modelo); continue; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as any)?.error?.message || "Error " + res.status + " Gemini vision " + modelo;
        if (esErrorTransitorio(msg)) { lastErr = new Error(msg); continue; }
        throw new Error(msg);
      }
      const data = await res.json();
      const candidate = data.candidates?.[0];
      const texto = candidate?.content?.parts?.map((part: any) => part?.text || "").join("").trim();
      if (!texto) {
        const fr = candidate?.finishReason || "unknown";
        if (esContenidoBloqueado(fr)) {
          const blk = new Error("Gemini vision contenido bloqueado (" + fr + ")");
          (blk as any).contentBlock = true;
          throw blk;
        }
        throw new Error("Gemini vision sin contenido (" + fr + ")");
      }
      return { texto, modelo: "gemini/" + modelo };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if ((lastErr as any).contentBlock) throw lastErr;
      if (!esErrorTransitorio(lastErr.message)) throw lastErr;
    }
  }
  const e = new Error(lastErr?.message || "Gemini vision saturado");
  (e as any).rateLimit = true;
  throw e;
}

const GROQ_MODELOS = ["llama-3.3-70b-versatile"];

async function llamarGroq(sys: string, user: string, key: string, maxTokens = MAX_TOKENS, _thinkingBudget = 0): Promise<{ texto: string; modelo: string }> {
  let lastErr: Error | null = null;
  for (const modelo of GROQ_MODELOS) {
    try {
      const res = await fetchTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.2, max_tokens: maxTokens, top_p: 0.9 })
      });
      if (res.status === 429 || res.status === 503) { lastErr = new Error("Rate limit Groq " + modelo); continue; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as any)?.error?.message || "Error " + res.status + " Groq " + modelo;
        if (esErrorTransitorio(msg)) { lastErr = new Error(msg); continue; }
        throw new Error(msg);
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      const texto = choice?.message?.content?.trim();
      if (!texto) {
        if (choice?.finish_reason === "content_filter") {
          const blk = new Error("Groq contenido bloqueado (content_filter)");
          (blk as any).contentBlock = true;
          throw blk;
        }
        throw new Error("Groq sin contenido");
      }
      return { texto, modelo: "groq/" + modelo };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if ((lastErr as any).contentBlock) throw lastErr;
      if (!esErrorTransitorio(lastErr.message)) throw lastErr;
    }
  }
  const e = new Error(lastErr?.message || "Groq saturado");
  (e as any).rateLimit = true;
  throw e;
}

const CEREBRAS_MODELOS = ["gpt-oss-120b", "llama3.1-8b"];

async function llamarCerebras(sys: string, user: string, key: string, maxTokens = MAX_TOKENS, _thinkingBudget = 0): Promise<{ texto: string; modelo: string }> {
  let lastErr: Error | null = null;
  for (const modelo of CEREBRAS_MODELOS) {
    try {
      const res = await fetchTimeout("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.2, max_completion_tokens: maxTokens, top_p: 0.9 })
      });
      if (res.status === 429 || res.status === 503 || res.status === 529) { lastErr = new Error("Rate limit Cerebras " + modelo); continue; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as any)?.error?.message || "Error " + res.status + " Cerebras " + modelo;
        if (esErrorTransitorio(msg)) { lastErr = new Error(msg); continue; }
        throw new Error(msg);
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      const texto = choice?.message?.content?.trim();
      if (!texto) {
        if (choice?.finish_reason === "content_filter") {
          const blk = new Error("Cerebras contenido bloqueado (content_filter)");
          (blk as any).contentBlock = true;
          throw blk;
        }
        throw new Error("Cerebras sin contenido");
      }
      return { texto, modelo: "cerebras/" + modelo };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if ((lastErr as any).contentBlock) throw lastErr;
      if (!esErrorTransitorio(lastErr.message)) throw lastErr;
    }
  }
  const e = new Error(lastErr?.message || "Cerebras saturado");
  (e as any).rateLimit = true;
  throw e;
}

const PROVEEDORES: Provider[] = [
  ...[1,2,3,4,5,6].map(n => ({ nombre: "Gemini",   envKey: "GEMINI_API_KEY_"   + n, llamar: llamarGemini   })),
  ...[1,2,3,4,5,6].map(n => ({ nombre: "Groq",     envKey: "GROQ_API_KEY_"     + n, llamar: llamarGroq     })),
  ...[1,2,3,4,5,6].map(n => ({ nombre: "Cerebras", envKey: "CEREBRAS_API_KEY_" + n, llamar: llamarCerebras })),
];

async function llamarConCascada(sys: string, user: string, maxTokens = MAX_TOKENS, thinkingBudget = 0): Promise<{ texto: string; modelo: string; proveedor: string }> {
  const errores: string[] = [];
  for (const p of PROVEEDORES) {
    const key = Deno.env.get(p.envKey);
    if (!key) { errores.push(p.nombre + " (" + p.envKey + "): sin key"); continue; }
    try {
      const { texto, modelo } = await p.llamar(sys, user, key, maxTokens, thinkingBudget);
      return { texto, modelo, proveedor: p.nombre + " (" + p.envKey + ")" };
    } catch (e) {
      const err = e as Error & { rateLimit?: boolean; contentBlock?: boolean };
      errores.push(p.nombre + " (" + p.envKey + "): " + err.message);
      if (err.contentBlock) continue; // este modelo rechazo el contenido: probar otro proveedor (los open suelen responder)
      if (!err.rateLimit && !esErrorTransitorio(err.message)) throw err;
    }
  }
  const todoBloqueado = errores.length > 0 && errores.every(x => /contenido bloqueado/.test(x));
  const e = new Error(todoBloqueado
    ? "Todos los modelos rechazaron el contenido de esta pregunta por filtros de seguridad."
    : "Todos los proveedores saturados - " + errores.join(" | "));
  (e as any).status = todoBloqueado ? 422 : 429;
  throw e;
}

async function llamarConCascadaVision(
  sys: string,
  user: string,
  imageParts: GeminiImagePart[],
  maxTokens = MAX_TOKENS,
  thinkingBudget = 0
): Promise<{ texto: string; modelo: string; proveedor: string }> {
  const errores: string[] = [];
  for (let n = 1; n <= 6; n++) {
    const envKey = "GEMINI_API_KEY_" + n;
    const key = Deno.env.get(envKey);
    if (!key) { errores.push("Gemini Vision (" + envKey + "): sin key"); continue; }
    try {
      const { texto, modelo } = await llamarGeminiVision(sys, user, imageParts, key, maxTokens, thinkingBudget);
      return { texto, modelo, proveedor: "Gemini Vision (" + envKey + ")" };
    } catch (e) {
      const err = e as Error & { rateLimit?: boolean; contentBlock?: boolean };
      errores.push("Gemini Vision (" + envKey + "): " + err.message);
      if (err.contentBlock) continue;
      if (!err.rateLimit && !esErrorTransitorio(err.message)) throw err;
    }
  }
  const todoBloqueado = errores.length > 0 && errores.every(x => /contenido bloqueado/.test(x));
  const e = new Error(todoBloqueado
    ? "Todos los modelos con vision rechazaron el contenido de esta pregunta por filtros de seguridad."
    : "Todos los modelos con vision estan saturados - " + errores.join(" | "));
  (e as any).status = todoBloqueado ? 422 : 429;
  throw e;
}

function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
}

const STOPWORDS = new Set(["que","cual","como","para","por","con","una","uno","del","las","los","sus","son","sin","mas","esta","este","estos","estas","entre","opcion","correcta","incorrecta","paciente","mujer","hombre","anos","meses","senale","indique","respecto","sobre","presenta","consulta","tratamiento","diagnostico"]);

function tokensClave(texto: string): string[] {
  return normalizarTexto(texto).split(" ").filter(t => t.length >= 4 && !STOPWORDS.has(t));
}

function scoreLexico(query: string, chunk: ChunkResult): number {
  const qTokens = [...new Set(tokensClave(query))];
  if (!qTokens.length) return 0;
  const chunkText = normalizarTexto(chunk.fuente + " " + (chunk.categoria || "") + " " + chunk.contenido);
  let hits = 0; let rareHits = 0;
  for (const t of qTokens) {
    if (chunkText.includes(t)) { hits++; if (t.length >= 8) rareHits++; }
  }
  return Math.min(1, hits / qTokens.length + Math.min(0.25, rareHits * 0.035));
}

function rerankChunks(query: string, chunks: ChunkResult[]): ChunkResult[] {
  return chunks
    .map(c => ({ ...c, rerank_score: c.similitud * 0.75 + scoreLexico(query, c) * 0.25 }))
    .sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))
    .slice(0, RAG_TOP_K);
}

function buildRagQuery(payload: { pregunta: string; opciones: Record<string, string> }): string {
  // El concepto discriminante suele estar en las opciones (diagnosticos, farmacos, criterios),
  // asi que sumamos su texto al enunciado para mejorar el recall del RAG.
  const opcionesTexto = Object.values(payload.opciones || {}).join(" ");
  return (payload.pregunta + " " + opcionesTexto).trim().slice(0, 2000);
}

async function getQueryEmbedding(text: string, jinaKey: string): Promise<number[]> {
  const res = await fetchTimeout(JINA_API_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + jinaKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "jina-embeddings-v3", input: [text.slice(0, 3000)], dimensions: 768, task: "retrieval.query" })
  });
  if (!res.ok) { const err = await res.text(); throw new Error("Jina error " + res.status + ": " + err.slice(0, 200)); }
  const data = await res.json();
  return data.data[0].embedding;
}

async function buscarRAG(queryTexto: string, supabaseAdmin: ReturnType<typeof createClient>, jinaKey: string): Promise<ChunkResult[]> {
  const embedding = await getQueryEmbedding(queryTexto, jinaKey);
  const { data, error } = await supabaseAdmin.rpc("buscar_bibliografia_hybrid", {
    query_embedding: embedding,
    query_text: queryTexto.slice(0, 500),
    match_threshold: RAG_THRESHOLD,
    match_count: RAG_CANDIDATES
  });
  if (error) {
    console.warn("Hybrid RAG fallback:", error.message);
    const { data: dataFallback, error: errFallback } = await supabaseAdmin.rpc("buscar_bibliografia", {
      query_embedding: embedding,
      match_threshold: RAG_THRESHOLD,
      match_count: RAG_CANDIDATES
    });
    if (errFallback) throw new Error("RAG error: " + errFallback.message);
    return rerankChunks(queryTexto, (dataFallback as ChunkResult[]) || []);
  }
  return rerankChunks(queryTexto, (data as ChunkResult[]) || []);
}

function buildRagContext(chunks: ChunkResult[]): string {
  if (!chunks.length) return "";
  let ctx = "\n\n--- CONTEXTO BIBLIOGRAFICO ---\n\n";
  chunks.forEach((c, i) => {
    const contenido = c.contenido.length > MAX_CHUNK_CHARS ? c.contenido.slice(0, MAX_CHUNK_CHARS) + "..." : c.contenido;
    const pagina = c.pagina ? ", p. " + c.pagina : "";
    ctx += "[F" + (i + 1) + "] " + c.fuente + pagina + "\n" + contenido + "\n\n";
  });
  return ctx + "--- FIN DEL CONTEXTO ---";
}

function buildPromptRazonamiento(
  payload: { pregunta: string; opciones: Record<string, string>; especialidad: string; anulada?: boolean },
  chunks: ChunkResult[]
): { system: string; user: string } {
  const opcionesStr = Object.entries(payload.opciones).map(([k, v]) => "  " + k + ") " + v).join("\n");
  const notaAnulada = payload.anulada
    ? "\n\nNOTA: Esta pregunta fue marcada como anulada oficialmente, pero analizala con criterio clinico independiente igual. Determina si existe UNA opcion claramente correcta (o incorrecta, segun lo que pregunte) o si genuinamente no hay respuesta unica defendible. Responde con la opcion que consideres mas correcta clinicamente, o '?' si realmente no hay una respuesta unica."
    : "";
  const system = "Sos un medico clinico experto. Tu unica tarea es analizar una pregunta de examen de residencia medica y determinar cual es la opcion correcta basandote exclusivamente en tu conocimiento clinico y en los fragmentos bibliograficos si los hay.\n\nResponde SOLO con este formato exacto, sin ningun texto adicional:\nOPCION: [letra de la opcion que consideras correcta, ej: a, b, c, d \u2014 o '?' si genuinamente no hay respuesta unica]\nRAZON: [una o dos oraciones explicando tu conclusion]";
  const user = "Especialidad: " + payload.especialidad + "\n\nPregunta:\n" + payload.pregunta + "\n\nOpciones:\n" + opcionesStr + buildImageContextForPrompt((payload as any).imagenes || []) + buildRagContext(chunks) + notaAnulada + "\n\nAnalizala clinicamente y determina cual opcion es la correcta (o incorrecta segun lo que pida la pregunta).";
  return { system, user };
}

function parsearRazonamiento(texto: string): { opcion: string; razon: string } {
  const t = texto.trim();
  let opcion: string | null = null;

  // 1) Formato pedido: "OPCION: x" (tolera tilde, ':' '-' o nada, comillas/parentesis/corchete)
  const m1 = t.match(/OPCI[O\u00d3]N\s*[:\-]?\s*["'(\[]?\s*([a-jA-J?])/i);
  if (m1) opcion = m1[1];

  // 2) Fallback a frases naturales: "la opcion correcta es la C", "respuesta correcta: c"
  if (!opcion || opcion === "?") {
    const m2 = t.match(/(?:opci[o\u00f3]n|respuesta)\s+(?:correcta|m[a\u00e1]s\s+correcta)\s*(?:es|:)?\s*(?:la\s+)?["'(\[]?\s*([a-jA-J])\b/i);
    if (m2) opcion = m2[1];
  }

  // 3) Sin respuesta unica explicita
  if (!opcion && /no\s+hay\s+(?:una\s+)?(?:respuesta|opci[o\u00f3]n)\s+[u\u00fa]nica/i.test(t)) opcion = "?";

  const razonMatch = t.match(/RAZ[O\u00d3]N\s*[:\-]?\s*([\s\S]+)/i);
  const razon = razonMatch?.[1]?.trim() || t;

  return { opcion: (opcion || "?").toLowerCase().trim(), razon };
}

function buildSystemExplicacion(anulada: boolean, tieneRespuestaClara: boolean, tieneRAG: boolean): string {
  // REGLA DE CITADO: solo citar si el dato aparece literalmente en el fragmento.
  // Prohibido inventar citas ni atribuir afirmaciones propias a fuentes del contexto.
  const reglaCitado = tieneRAG
    ? "Podes citar fragmentos bibliograficos con [F1], [F2], etc. UNICAMENTE si el dato especifico que afirmas aparece literalmente en ese fragmento. Si el dato viene de tu conocimiento clinico general y no esta en ningun fragmento, NO pongas cita. Prohibido inventar citas o atribuir a [Fn] afirmaciones que no esten en el fragmento correspondiente. No incluyas la seccion Referencias manualmente."
    : "No incluyas seccion Referencias.";

  const reglasGenerales = [
    "PROHIBIDO escribir cualquier texto libre antes del primer titulo de seccion. La respuesta debe comenzar DIRECTAMENTE con el titulo correspondiente. Cero introduccion suelta antes del titulo.",
    "La explicacion se cachea para todos los usuarios. Nunca menciones que opcion respondio, eligio o marco el estudiante.",
    "Si la pregunta incluye imagenes clinicas, analizalas antes de decidir la respuesta. Si una imagen no es interpretable o no aporta datos suficientes, aclaralo sin inventar hallazgos.",
    "Nunca hagas referencia a instrucciones, estructura, prompt, formato ni al proceso interno. El lector solo debe ver la explicacion medica.",
    "Al mencionar una opcion siempre escribila como **X) enunciado completo** \u2014 letra en negrita junto con su enunciado completo tambien en negrita. Nunca cites solo la letra.",
    "Usar **negrita** para resaltar terminos anatomicos, diagnosticos, farmacos, valores numericos clave y conceptos clinicos importantes. Minimo 4 terminos en negrita por explicacion.",
    "Espanol rioplatense, voseo natural. Sin asteriscos en titulos de seccion. Nunca repitas la pregunta completa.",
    reglaCitado
  ].join("\n- ");

  if (anulada && !tieneRespuestaClara) {
    return "Sos un docente de medicina clinica especializado en residencias medicas en Argentina y Espana (MIR).\n\nReglas:\n- " + reglasGenerales + "\n\n" +
      "Esta pregunta fue anulada oficialmente Y el analisis independiente confirma que no tiene una sola respuesta defendible. Comenza DIRECTAMENTE con el titulo 'Motivo de anulacion:' sin ningun texto previo.\n\n" +
      "Motivo de anulacion:\nExplica por que no tiene una sola respuesta correcta defendible.\n\n" +
      "Analisis de opciones:\nPara cada opcion indica si es defendible, nombrando siempre letra y enunciado en negrita.\n\n" +
      "Concepto clave:\nUna sola oracion diferenciadora.\n\n" +
      "Extension objetivo: 180-320 palabras.";
  }

  if (anulada && tieneRespuestaClara) {
    return "Sos un docente de medicina clinica especializado en residencias medicas en Argentina y Espana (MIR).\n\nReglas:\n- " + reglasGenerales + "\n\n" +
      "Esta pregunta fue anulada oficialmente, pero el analisis clinico independiente encuentra una respuesta claramente correcta (o incorrecta segun lo que pregunta). Explica la pregunta con la estructura normal como si no estuviera anulada, y al final agrega exactamente este bloque sin modificarlo:\n" +
      "> \u26a0\ufe0f **Pregunta anulada oficialmente** \u2014 A pesar de la anulaci\u00f3n, el an\u00e1lisis cl\u00ednico independiente identifica una opci\u00f3n claramente correcta. La anulaci\u00f3n puede deberse a un error de carga o a criterios administrativos del examen.\n\n" +
      "=== ESTRUCTURA OBLIGATORIA ===\n\n" +
      "Respuesta correcta:\n" +
      "La PRIMERA oracion nombra la opcion correcta con letra y enunciado en negrita: 'La opcion correcta es **X) enunciado completo**.' Luego desarrolla el razonamiento clinico.\n\n" +
      "Respuestas incorrectas:\n" +
      "Para cada opcion incorrecta, un parrafo en prosa con letra y enunciado en negrita: por que falla y en que situacion si seria correcta.\n\n" +
      "Concepto clave:\n" +
      "Una sola oracion diferenciadora.\n\n" +
      "Extension objetivo: 250-440 palabras.";
  }

  return "Sos un docente de medicina clinica especializado en residencias medicas en Argentina y Espana (MIR).\n\nReglas:\n- " + reglasGenerales + "\n\n" +
    "=== CUANDO HAY DISCREPANCIA entre la respuesta oficial y el analisis independiente ===\n" +
    "PASO 1 (obligatorio): Antes de cualquier seccion, copia LITERALMENTE este bloque completando los corchetes con los datos reales:\n" +
    "> \u26a0\ufe0f **La respuesta oficial del examen es [letra]) [enunciado completo de esa opcion]**, sin embargo el an\u00e1lisis cl\u00ednico independiente concluye que la opci\u00f3n m\u00e9dicamente correcta es **[letra]) [enunciado completo]**. La respuesta oficial puede estar mal cargada, o bien reflejar un criterio distinto al an\u00e1lisis m\u00e9dico actual.\n" +
    "PASO 2: Continua normalmente con las secciones de abajo.\n\n" +
    "=== ESTRUCTURA OBLIGATORIA (con o sin discrepancia) ===\n\n" +
    "Respuesta correcta:\n" +
    "La PRIMERA oracion es SIEMPRE nombrar la opcion correcta con letra y enunciado en negrita: 'La opcion correcta es **X) enunciado completo**.' Luego desarrolla contexto clinico y razonamiento.\n\n" +
    "Respuestas incorrectas:\n" +
    "Para cada opcion incorrecta, un parrafo en prosa con letra y enunciado en negrita: por que falla y en que situacion si seria correcta.\n\n" +
    "Concepto clave:\n" +
    "Una sola oracion: mnemotecnica, criterio numerico clave, o frase diferenciadora.\n\n" +
    "Extension objetivo: 250-440 palabras.";
}

function buildPromptExplicacion(
  payload: {
    pregunta: string;
    opciones: Record<string, string>;
    respuesta: string | null;
    especialidad: string;
    anulada: boolean;
    esMIR: boolean;
    tipo_banco: string | null;
    anio?: number | null;
  },
  razonamientoIA: { opcion: string; razon: string },
  chunks: ChunkResult[],
  razonamientoEsFuerte: boolean
): { system: string; user: string } {
  const opcionesStr = Object.entries(payload.opciones).map(([k, v]) => "  " + k + ") " + v).join("\n");
  const bancoLabel = payload.esMIR ? "MIR (Medico Interno Residente - Espana)"
    : payload.tipo_banco === "EU" ? "Examen Unico Nacional (Argentina)"
    : (payload.tipo_banco?.toUpperCase().includes("BUENOS AIRES") || payload.tipo_banco?.toUpperCase().includes("PBA")) ? "Examen de Residencias - Provincia de Buenos Aires"
    : payload.tipo_banco === "ENARM" ? "ENARM (Mexico)"
    : payload.tipo_banco || "Examen de Residencias";
  const anioActual = new Date().getFullYear();
  const esDesactualizada = typeof payload.anio === "number" && !isNaN(payload.anio) && (anioActual - payload.anio) >= ANIOS_DESACTUALIZACION;
  const notaDesactualizacion = esDesactualizada
    ? "\n\nAl final de tu explicacion agrega exactamente este bloque (sin modificarlo):\n\n> \u26a0\ufe0f **Pregunta del " + payload.anio + "** \u2014 Han pasado m\u00e1s de " + ANIOS_DESACTUALIZACION + " a\u00f1os desde su publicaci\u00f3n. Los criterios diagn\u00f3sticos, gu\u00edas terap\u00e9uticas o f\u00e1rmacos de referencia pueden haber cambiado. Verific\u00e1 con bibliograf\u00eda actualizada antes del examen."
    : "";
  const tieneRAG = chunks.length > 0;
  const tieneRespuestaClara = razonamientoIA.opcion !== "?";
  const system = buildSystemExplicacion(payload.anulada, tieneRespuestaClara, tieneRAG);

  let bloqueAnalisis = "";
  if (!payload.anulada) {
    const respuestaBase = payload.respuesta || "No especificada";
    const opcionIA = razonamientoIA.opcion;
    const razonIA = razonamientoIA.razon;
    const difiere = opcionIA !== "?" && respuestaBase !== "No especificada" && opcionIA.toLowerCase() !== respuestaBase.toLowerCase();
    // Solo se muestra la advertencia de discrepancia si el razonamiento lo hizo un modelo fuerte.
    const hayDiscrepancia = difiere && razonamientoEsFuerte;
    const enunciadoBase = payload.opciones[respuestaBase.toLowerCase()] || "";
    const enunciadoIA   = payload.opciones[opcionIA.toLowerCase()] || "";
    if (hayDiscrepancia) {
      bloqueAnalisis = "\n\n--- ANALISIS INDEPENDIENTE (DISCREPANCIA DETECTADA) ---\n" +
        "Respuesta oficial del examen: " + respuestaBase.toUpperCase() + ") " + enunciadoBase + "\n" +
        "Mi analisis clinico independiente concluye: " + opcionIA.toUpperCase() + ") " + enunciadoIA + " \u2014 " + razonIA + "\n" +
        "ACCION REQUERIDA: aplica el PASO 1 del bloque de discrepancia antes de las secciones. Completa los corchetes con los datos reales de arriba.";
    } else {
      // Coinciden, razonamiento ambiguo ('?'), o discrepancia suprimida por modelo debil.
      // En todos los casos se explica la RESPUESTA OFICIAL como correcta, sin mencionar analisis alternativos.
      bloqueAnalisis = "\n\n--- RESPUESTA OFICIAL ---\n" +
        "Respuesta correcta: " + respuestaBase.toUpperCase() + ") " + enunciadoBase + "\n" +
        "Comenza directamente con 'Respuesta correcta:' nombrando esta opcion con letra y enunciado en negrita, y explica por que es la correcta. No menciones analisis alternativos ni discrepancias.";
    }
  } else {
    const opcionIA = razonamientoIA.opcion;
    const razonIA = razonamientoIA.razon;
    const tieneRespuestaClaraAnulada = opcionIA !== "?";
    bloqueAnalisis = tieneRespuestaClaraAnulada
      ? "\n\n--- ANALISIS INDEPENDIENTE (PREGUNTA ANULADA CON RESPUESTA CLARA) ---\n" +
        "A pesar de la anulacion oficial, el analisis clinico independiente concluye que la opcion " + opcionIA.toUpperCase() + ") " + (payload.opciones[opcionIA.toLowerCase()] || "") + " es la respuesta claramente correcta.\n" +
        "Razon: " + razonIA + "\n" +
        "INSTRUCCION: Explica la pregunta con la estructura normal (Respuesta correcta / Respuestas incorrectas / Concepto clave) y agrega la nota de anulacion al final."
      : "\n\n--- ANALISIS INDEPENDIENTE (GENUINAMENTE AMBIGUA) ---\n" +
        "El analisis clinico independiente no encuentra una unica respuesta claramente correcta: " + razonIA + "\n" +
        "INSTRUCCION: Usa la estructura de anulacion (Motivo de anulacion / Analisis de opciones / Concepto clave).";
  }

  const user = "Banco: " + bancoLabel +
    "\nEspecialidad: " + payload.especialidad +
    (payload.anio ? "\nAnio: " + payload.anio : "") +
    "\n\nPregunta:\n" + payload.pregunta +
    "\n\nOpciones:\n" + opcionesStr +
    buildImageContextForPrompt((payload as any).imagenes || []) +
    buildRagContext(chunks) +
    bloqueAnalisis +
    notaDesactualizacion +
    "\n\nRedacta la explicacion.";
  return { system, user };
}

function normalizarCitasNumericas(texto: string, maxFuentes: number): string {
  if (!maxFuentes) return texto;
  let out = texto;
  out = out.replace(/\b(?:fuente|fuentes|ref\.?|referencia|referencias|fragmento|fragmentos)\s*\[?\s*F?\s*(\d{1,2})\s*\]?/gi,
    (_m, raw) => { const n = Number(raw); return n >= 1 && n <= maxFuentes ? "[F" + n + "]" : ""; });
  out = out.replace(/\[\s*F\s*(\d{1,2})\s*\]/gi,
    (_m, raw) => { const n = Number(raw); return n >= 1 && n <= maxFuentes ? "[F" + n + "]" : ""; });
  // NO convertimos corchetes con numeros pelados ([2], [1,3]) a citas: el modelo puede
  // usarlos por otros motivos (estadios, scores). Solo se reconocen citas [Fn] explicitas.
  return out;
}

function quitarSeccionReferencias(texto: string): string {
  return texto.replace(/\n{1,}\s*(?:Referencias|Bibliograf[\u00eda]a|Bibliografia|Fuentes)\s*:\s*[\s\S]*$/i, "").trim();
}

function extraerIdsCitados(texto: string, maxFuentes: number): number[] {
  const ids: number[] = []; const seen = new Set<number>();
  const re = /\[([^\]]+)\]/g; let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    for (const ref of (m[1] || "").match(/F\s*(\d{1,2})/gi) || []) {
      const n = Number(ref.replace(/\D/g, ""));
      if (n >= 1 && n <= maxFuentes && !seen.has(n)) { seen.add(n); ids.push(n); }
    }
  }
  return ids;
}

function eliminarCitasInvalidas(texto: string, maxFuentes: number): string {
  return texto.replace(/\[\s*F\s*(\d{1,2})\s*\]/gi, (_m, raw) => { const n = Number(raw); return n >= 1 && n <= maxFuentes ? "[F" + n + "]" : ""; });
}

function formatearReferencia(chunk: ChunkResult, index: number): string {
  const fuente = String(chunk.fuente || "Fuente bibliografica").trim();
  const pagina = chunk.pagina ? ", p. " + chunk.pagina : "";
  const categoria = chunk.categoria ? " (" + chunk.categoria + ")" : "";
  return "[F" + (index + 1) + "] " + fuente + pagina + categoria + ".";
}

function sanitizarMencionesUsuario(textoOriginal: string): string {
  let texto = textoOriginal;
  const patrones = [
    /\b(?:el|la)\s+(?:estudiante|usuario|alumno|alumna)\s+(?:respondi[o\u00f3]|marc[o\u00f3]|eligi[o\u00f3]|seleccion[o\u00f3])[^.?!]*(?:[.?!]|$)/gi,
    /\b(?:tu|su)\s+respuesta\s+(?:fue|es|era|coincide|no coincide)[^.?!]*(?:[.?!]|$)/gi,
    /\b(?:la\s+)?opci[o\u00f3]n\s+marcada\s+(?:por\s+(?:el|la)\s+(?:estudiante|usuario|alumno|alumna))?[^.?!]*(?:[.?!]|$)/gi,
    /\b(?:probablemente|posiblemente)\s+(?:marc[o\u00f3]|eligi[o\u00f3]|respondi[o\u00f3])[^.?!]*(?:[.?!]|$)/gi
  ];
  for (const p of patrones) texto = texto.replace(p, "");
  return texto.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function eliminarPreambulo(texto: string): string {
  const patronInicio = /(?:^>\s*[\u26a0]|^Respuesta correcta:|^Motivo de anulaci[o\u00f3]n:)/mu;
  const match = patronInicio.exec(texto);
  if (match && match.index > 0) {
    return texto.slice(match.index).trim();
  }
  return texto;
}

function postProcesarReferencias(textoOriginal: string, chunks: ChunkResult[]): string {
  let texto = sanitizarMencionesUsuario(textoOriginal);
  texto = eliminarPreambulo(texto);
  if (!chunks.length) return quitarSeccionReferencias(texto);
  const max = chunks.length;
  texto = normalizarCitasNumericas(texto, max);
  texto = quitarSeccionReferencias(texto);
  texto = eliminarCitasInvalidas(texto, max);
  texto = sanitizarMencionesUsuario(texto);
  texto = texto.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const ids = extraerIdsCitados(texto, max);
  if (!ids.length) return texto;
  return texto + "\n\nReferencias:\n" + ids.map(id => formatearReferencia(chunks[id - 1], id - 1)).join("\n");
}

Deno.serve(async (req: Request) => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const supabaseUser  = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Token invalido" }, 401);
    const acceso = await verificarAccesoExplicacion(supabaseAdmin, user.id);
    if (!acceso.permitido) return json({ error: acceso.razon }, 403);
    const body = await req.json();
    const { payload, pregunta_id } = body;
    if (!payload || !pregunta_id) return json({ error: "Faltan parametros" }, 400);

    const imagenes = normalizarImagenes(payload.imagenes);
    const tieneImagenes = imagenes.length > 0;
    const promptVersion = getPromptVersionForPayload(payload);
    let imageParts: GeminiImagePart[] = [];

    const payloadHash = hashPayload(payload);

    // Explicacion manual escrita a mano: tiene prioridad y no se invalida por hash.
    const { data: manual } = await supabaseAdmin
      .from("explicaciones_cache").select("texto")
      .eq("pregunta_id", pregunta_id).eq("modelo", "manual").maybeSingle();
    if (manual?.texto) return json({ texto: manual.texto, fromCache: true, isManual: true, score: 0, promptVersion: promptVersion, visionUsada: tieneImagenes, imageCount: imagenes.length });

    // Cache valido solo si coincide prompt_version Y hash de contenido.
    const { data: cached } = await supabaseAdmin
      .from("explicaciones_cache").select("texto")
      .eq("pregunta_id", pregunta_id).eq("prompt_version", promptVersion).eq("payload_hash", payloadHash).neq("modelo", "manual").maybeSingle();
    if (cached?.texto) return json({ texto: cached.texto, fromCache: true, isManual: false, score: 0, promptVersion: promptVersion, visionUsada: tieneImagenes, imageCount: imagenes.length });

    if (tieneImagenes) {
      imageParts = await cargarImagenesParaGemini(imagenes, Deno.env.get("SUPABASE_URL")!);
      if (!imageParts.length) return json({ error: "No se pudo preparar ninguna imagen clinica para analisis." }, 400);
    }

    const jinaKey = Deno.env.get("JINA_API_KEY");
    let chunks: ChunkResult[] = [];
    const examenTipo = payload.tipo_banco as string | null;
    if (jinaKey && usaRAG(examenTipo)) {
      try {
        chunks = await buscarRAG(buildRagQuery(payload), supabaseAdmin, jinaKey);
        console.log("RAG hybrid: " + chunks.length + " chunks para examen=" + examenTipo);
      } catch (ragErr) {
        console.error("RAG error (non-fatal):", (ragErr as Error).message);
      }
    }

    // ── Stage 1: razonamiento independiente (con thinking activo) ──
    let razonamientoIA = { opcion: "?", razon: "" };
    let modeloRazonamiento = "";
    try {
      const { system: sys1, user: usr1 } = buildPromptRazonamiento({ ...payload, anulada: payload.anulada }, chunks);
      const { texto: textoRazonamiento, modelo: mr } = tieneImagenes
        ? await llamarConCascadaVision(sys1, usr1, imageParts, MAX_TOKENS_RAZONAMIENTO, RAZONAMIENTO_THINKING_BUDGET)
        : await llamarConCascada(sys1, usr1, MAX_TOKENS_RAZONAMIENTO, RAZONAMIENTO_THINKING_BUDGET);
      razonamientoIA = parsearRazonamiento(textoRazonamiento);
      modeloRazonamiento = mr;
      console.log("Razonamiento IA: opcion=" + razonamientoIA.opcion + ", anulada=" + payload.anulada + ", base=" + payload.respuesta + ", modelo=" + modeloRazonamiento + ", fuerte=" + esModeloFuerte(modeloRazonamiento));
    } catch (e) {
      console.error("Razonamiento error (non-fatal):", (e as Error).message);
    }

    const razonamientoEsFuerte = esModeloFuerte(modeloRazonamiento);

    // ── Stage 2: explicacion (sin thinking, mas rapido) ──
    const { system: sys2, user: usr2 } = buildPromptExplicacion(payload, razonamientoIA, chunks, razonamientoEsFuerte);
    const { texto: textoModelo, modelo, proveedor } = tieneImagenes
      ? await llamarConCascadaVision(sys2, usr2, imageParts, MAX_TOKENS, 0)
      : await llamarConCascada(sys2, usr2, MAX_TOKENS, 0);
    const texto = postProcesarReferencias(textoModelo, chunks);
    const refsUsadas = extraerIdsCitados(texto, chunks.length);

    const difiereRaw = !payload.anulada && razonamientoIA.opcion !== "?" && !!payload.respuesta && razonamientoIA.opcion.toLowerCase() !== payload.respuesta.toLowerCase();
    const discrepancia = difiereRaw && razonamientoEsFuerte;
    const discrepanciaSilenciada = difiereRaw && !razonamientoEsFuerte;
    const posibleErrorCarga = /respuesta oficial del examen/i.test(texto);

    // ── Caché (Opción A): cachear SIEMPRE para no regenerar en cada apertura. ──
    // Para no degradar calidad, una explicacion de modelo debil no pisa una fuerte
    // ya guardada: solo se persiste si no existe fila previa o la previa tambien es debil.
    // El campo `modelo` permite que un job posterior reprocese las debiles cuando haya
    // capacidad fuerte (ver reprocesar-explicaciones-debiles).
    const explicacionEsFuerte = esModeloFuerte(modelo);
    let cacheado = false;
    if (explicacionEsFuerte) {
      await supabaseAdmin.from("explicaciones_cache").upsert(
        { pregunta_id, prompt_version: promptVersion, payload_hash: payloadHash, texto, modelo, updated_at: new Date().toISOString() },
        { onConflict: "pregunta_id,prompt_version" }
      );
      cacheado = true;
    } else {
      const { data: existente } = await supabaseAdmin
        .from("explicaciones_cache").select("modelo")
        .eq("pregunta_id", pregunta_id).eq("prompt_version", promptVersion).maybeSingle();
      if (!existente || !esModeloFuerte(existente.modelo as string | null)) {
        await supabaseAdmin.from("explicaciones_cache").upsert(
          { pregunta_id, prompt_version: promptVersion, payload_hash: payloadHash, texto, modelo, updated_at: new Date().toISOString() },
          { onConflict: "pregunta_id,prompt_version" }
        );
        cacheado = true;
      }
    }

    return json({
      texto, fromCache: false, isManual: false, score: 0, modelo, proveedor,
      modeloRazonamiento, razonamientoIA, razonamientoEsFuerte,
      ragUsado: chunks.length > 0, ragChunks: chunks.length, ragRefsUsadas: refsUsadas,
      promptVersion: promptVersion, cacheado, explicacionEsFuerte,
      visionUsada: tieneImagenes, imageCount: imageParts.length,
      discrepancia, discrepanciaSilenciada, posibleErrorCarga
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const status = (err as any)?.status === 429 ? 429 : 500;
    return new Response(JSON.stringify({ error: error.message }), { status, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
  }
});
