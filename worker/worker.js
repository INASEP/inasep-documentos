/**
 * INASEP · Recepción de documentos — Cloudflare Worker
 *
 * - Crea enlaces con token de un solo uso (12 h) para que una persona suba sus documentos.
 * - Valida el token en cada subida y reenvía los archivos a Google Drive (Apps Script).
 * - El panel admin se autentica con el login de Firebase (ID token verificado aquí).
 *   No hay ningún secreto en el código del navegador.
 *
 * Variables (Settings → Variables):
 *   ALLOWED_ORIGINS      https://inasep.github.io            (separadas por coma)
 *   ADMIN_EMAILS         correo1@...,correo2@...
 *   FIREBASE_PROJECT_ID  inasep-contratos
 *   SCRIPT_URL           https://script.google.com/macros/s/XXXX/exec
 * Secreto:
 *   SCRIPT_SECRET        mismo valor que SHARED_SECRET en Apps Script
 * KV:
 *   DOCS_KV
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // el enlace vence 12 horas después de crearlo
const MAX_BODY_BYTES = 9 * 1024 * 1024; // 5 MB de archivo en base64 + JSON ≈ 7 MB

// slot → prefijo del nombre del archivo en Drive
const SLOTS = {
  carnetFrontal:   'Carnet_Frontal',
  carnetPosterior: 'Carnet_Posterior',
  certAntecedentes:'Certificado_Antecedentes',
  certEducacion:   'Certificado_Educacion_Media',
  certMilitar:     'Certificado_Situacion_Militar',
};

// Qué documentos pide cada curso (fuente única: el formulario y el panel se adaptan a esto).
const BASE_DOCS = ['carnetFrontal', 'carnetPosterior', 'certAntecedentes', 'certEducacion'];
const COURSES = {
  supervisor: { label: 'Curso Supervisor ONLINE',                 docs: BASE_DOCS },
  cctv:       { label: 'Operador de CCTV',                        docs: BASE_DOCS },
  guardia:    { label: 'Curso de Formación Guardia de Seguridad', docs: BASE_DOCS, soloHombres: ['certMilitar'] },
};

function requiredFor(cursoId, sexo) {
  const c = COURSES[cursoId];
  return [...c.docs, ...(sexo === 'H' && c.soloHombres ? c.soloHombres : [])];
}
// Documentos de un registro (los guardados al crear el enlace; si no hay, todos)
const requiredOf = rec => rec.req || Object.keys(SLOTS);

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 símbolos, sin I L O 0 1
const TOKEN_LEN = 16;

class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.extra = extra || {}; }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(request, env);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      h.set('Cache-Control', 'no-store');
      return new Response(res.body, { status: res.status, headers: h });
    } catch (e) {
      if (e instanceof HttpError) return json({ ok: false, error: e.message, ...e.extra }, e.status, cors);
      console.error(e);
      return json({ ok: false, error: 'internal' }, 500, cors);
    }
  },
};

/* ───────────────────────── Rutas ───────────────────────── */

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = request.method;

  // Públicas (requieren token del enlace)
  if (path === '/api/token'  && m === 'GET')  return publicTokenInfo(url, env);
  if (path === '/api/upload' && m === 'POST') return publicUpload(request, url, env);
  if (path === '/api/finish' && m === 'POST') return publicFinish(url, env);

  // Admin (requieren login Firebase)
  if (path.startsWith('/api/admin/')) {
    await requireAdmin(request, env);
    if (path === '/api/admin/courses' && m === 'GET') return adminCourses();
    if (path === '/api/admin/tokens' && m === 'GET')  return adminList(env);
    if (path === '/api/admin/tokens' && m === 'POST') return adminCreate(request, env);
    if (path === '/api/admin/record' && m === 'GET')  return adminRecord(url, env);
    if (path === '/api/admin/file'   && m === 'GET')  return adminFile(url, env);
    if (path === '/api/admin/delete' && m === 'POST') return adminDelete(request, env);
  }
  if (path === '/') return json({ ok: true, service: 'INASEP docs' });
  throw new HttpError(404, 'not_found');
}

/* ───────────────────────── Públicas ───────────────────────── */

async function publicTokenInfo(url, env) {
  const rec = await loadActive(env, url.searchParams.get('t'));
  return json({
    ok: true,
    nombre: rec.nombre,
    rut: rec.rut,
    curso: rec.curso || '',
    expira: rec.expira,
    requeridos: requiredOf(rec),
    subidos: Object.keys(rec.archivos),
  });
}

async function publicUpload(request, url, env) {
  const rec = await loadActive(env, url.searchParams.get('t'));
  const slot = url.searchParams.get('slot') || '';
  if (!SLOTS[slot] || !requiredOf(rec).includes(slot)) throw new HttpError(400, 'bad_slot');

  const len = parseInt(request.headers.get('content-length') || '0', 10);
  if (!len) throw new HttpError(411, 'length_required');
  if (len > MAX_BODY_BYTES) throw new HttpError(413, 'too_large');

  const params = new URLSearchParams({
    secret: env.SCRIPT_SECRET,
    action: 'save_file',
    rut: rec.rut,
    nombre: rec.nombre,
    curso: rec.curso || '',
    slot,
    label: SLOTS[slot],
  });
  const data = await callScript(env, params, request.body, 'application/json');
  if (!data.ok) throw new HttpError(502, 'drive_error', { detail: String(data.error || '').slice(0, 200) });

  rec.folderId = data.folderId;
  rec.folderUrl = data.folderUrl;
  rec.carpeta = data.folderName;
  rec.archivos[slot] = { name: data.name, id: data.fileId, size: data.size, mime: data.mime, subidoEn: Date.now() };
  await saveRec(env, rec);
  return json({ ok: true, slot, name: data.name, size: data.size });
}

async function publicFinish(url, env) {
  const rec = await loadActive(env, url.searchParams.get('t'));
  const missing = requiredOf(rec).filter(k => !rec.archivos[k]);
  if (missing.length) throw new HttpError(400, 'missing', { missing });
  rec.usado = true;
  rec.usadoEn = Date.now();
  await saveRec(env, rec);
  return json({ ok: true, usadoEn: rec.usadoEn });
}

/* ───────────────────────── Admin ───────────────────────── */

async function adminList(env) {
  const items = [];
  let cursor;
  do {
    const page = await env.DOCS_KV.list({ prefix: 'tk:', cursor, limit: 1000 });
    for (const k of page.keys) {
      const md = k.metadata || {};
      items.push({ token: k.name.slice(3), ...md, estado: estadoDe(md) });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  items.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
  return json({ ok: true, tokens: items, ahora: Date.now() });
}

function adminCourses() {
  return json({
    ok: true,
    courses: Object.entries(COURSES).map(([id, c]) => ({
      id, label: c.label, docs: c.docs, soloHombres: c.soloHombres || [], pideSexo: !!c.soloHombres,
    })),
  });
}

async function adminCreate(request, env) {
  const b = await readJson(request);
  const nombre = cleanText(b.nombre, 120);
  const nota = cleanText(b.nota, 200);
  const cursoId = String(b.cursoId || '');
  const course = COURSES[cursoId];
  if (!course) throw new HttpError(400, 'Elige el curso.');
  const sexo = course.soloHombres ? String(b.sexo || '') : '';
  if (course.soloHombres && sexo !== 'H' && sexo !== 'M') throw new HttpError(400, 'Indica si la persona es hombre o mujer.');
  const curso = course.label;
  const rut = normalizeRut(b.rut);
  if (nombre.length < 3) throw new HttpError(400, 'Ingresa el nombre completo.');
  if (!rut) throw new HttpError(400, 'El RUT no es válido. Revisa el dígito verificador.');

  const token = newToken();
  const now = Date.now();
  const rec = {
    token, nombre, rut, curso, cursoId, sexo, nota,
    req: requiredFor(cursoId, sexo),
    creadoEn: now, expira: now + TOKEN_TTL_MS,
    usado: false, usadoEn: null,
    folderId: null, folderUrl: null, carpeta: null,
    archivos: {},
  };
  await saveRec(env, rec);
  return json({ ok: true, token, rut, expira: rec.expira, creadoEn: now });
}

async function adminRecord(url, env) {
  const t = normalizeToken(url.searchParams.get('t'));
  const rec = t && await env.DOCS_KV.get('tk:' + t, 'json');
  if (!rec) throw new HttpError(404, 'not_found');
  return json({ ok: true, record: rec });
}

async function adminFile(url, env) {
  const t = normalizeToken(url.searchParams.get('t'));
  const slot = url.searchParams.get('slot') || '';
  const rec = t && await env.DOCS_KV.get('tk:' + t, 'json');
  const f = rec && rec.archivos && rec.archivos[slot];
  if (!f) throw new HttpError(404, 'not_found');
  const params = new URLSearchParams({ secret: env.SCRIPT_SECRET, action: 'get_file', id: f.id });
  const resp = await callScriptRaw(env, params, '', null);
  // Se reenvía tal cual: { ok, name, mime, data(base64) }. El navegador lo decodifica.
  return new Response(resp.body, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function adminDelete(request, env) {
  const b = await readJson(request);
  const t = normalizeToken(b.token);
  if (!t) throw new HttpError(400, 'bad_token');
  await env.DOCS_KV.delete('tk:' + t);
  return json({ ok: true });
}

/* ───────────────────────── Tokens / KV ───────────────────────── */

function newToken() {
  let out = '';
  while (out.length < TOKEN_LEN) {
    const buf = crypto.getRandomValues(new Uint8Array(32));
    for (const b of buf) {
      if (b < 248 && out.length < TOKEN_LEN) out += ALPHABET[b % 31]; // 248 = 31*8 → sin sesgo
    }
  }
  return out;
}

function normalizeToken(s) {
  const t = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (t.length !== TOKEN_LEN) return null;
  for (const ch of t) if (!ALPHABET.includes(ch)) return null;
  return t;
}

async function loadActive(env, raw) {
  const t = normalizeToken(raw);
  if (!t) throw new HttpError(404, 'invalid');
  const rec = await env.DOCS_KV.get('tk:' + t, 'json');
  if (!rec) throw new HttpError(404, 'invalid');
  if (rec.usado) throw new HttpError(410, 'used');
  if (Date.now() > rec.expira) throw new HttpError(410, 'expired');
  return rec;
}

function metaOf(rec) {
  return {
    nombre: rec.nombre, rut: rec.rut, curso: rec.curso || '',
    cursoId: rec.cursoId || '', sexo: rec.sexo || '', req: requiredOf(rec).length,
    creadoEn: rec.creadoEn, expira: rec.expira,
    usado: !!rec.usado, usadoEn: rec.usadoEn || null,
    n: Object.keys(rec.archivos || {}).length,
  };
}

async function saveRec(env, rec) {
  await env.DOCS_KV.put('tk:' + rec.token, JSON.stringify(rec), { metadata: metaOf(rec) });
}

function estadoDe(md) {
  if (md.usado) return 'usado';
  if (Date.now() > md.expira) return 'expirado';
  return 'pendiente';
}

/* ───────────────────────── RUT / texto ───────────────────────── */

function normalizeRut(input) {
  const s = String(input || '').toUpperCase().replace(/[^0-9K]/g, '');
  if (s.length < 8 || s.length > 9) return null;
  const body = s.slice(0, -1), dv = s.slice(-1);
  if (!/^\d+$/.test(body)) return null;
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) { sum += parseInt(body[i], 10) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (sum % 11);
  const expected = r === 11 ? '0' : r === 10 ? 'K' : String(r);
  if (dv !== expected) return null;
  return body + '-' + dv; // formato canónico: 12345678-9
}

function cleanText(s, max) {
  return String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function readJson(request) {
  try { return await request.json(); } catch { throw new HttpError(400, 'bad_json'); }
}

/* ───────────────────────── Apps Script (Drive) ───────────────────────── */

async function callScriptRaw(env, params, body, contentType) {
  const target = `${env.SCRIPT_URL}?${params}`;
  const headers = contentType ? { 'content-type': contentType } : {};
  // Apps Script responde 302 a la URL con el resultado: se ejecuta con POST y se lee con GET.
  let resp = await fetch(target, { method: 'POST', body, headers, redirect: 'manual' });
  if (resp.status >= 300 && resp.status < 400) {
    const loc = resp.headers.get('location');
    if (!loc) throw new HttpError(502, 'drive_error');
    resp = await fetch(loc, { method: 'GET' });
  }
  return resp;
}

async function callScript(env, params, body, contentType) {
  const resp = await callScriptRaw(env, params, body, contentType);
  const text = await resp.text();
  try { return JSON.parse(text); }
  catch { throw new HttpError(502, 'drive_unreachable'); }
}

/* ───────────────────────── Login Firebase ───────────────────────── */

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache = { keys: null, exp: 0 };

async function getJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.exp) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new HttpError(503, 'auth_unavailable');
  const j = await r.json();
  jwksCache = { keys: j.keys, exp: Date.now() + 60 * 60 * 1000 };
  return j.keys;
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'unauthorized');

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch { throw new HttpError(401, 'unauthorized'); }
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'unauthorized');

  const jwk = (await getJwks()).find(k => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, 'unauthorized');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]),
  );
  if (!ok) throw new HttpError(401, 'unauthorized');

  const now = Math.floor(Date.now() / 1000);
  const pid = env.FIREBASE_PROJECT_ID;
  if (payload.aud !== pid || payload.iss !== 'https://securetoken.google.com/' + pid) throw new HttpError(401, 'unauthorized');
  if (!payload.exp || payload.exp < now || (payload.iat && payload.iat > now + 300)) throw new HttpError(401, 'unauthorized');

  const allowed = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const email = String(payload.email || '').toLowerCase();
  if (!email || !allowed.includes(email)) throw new HttpError(403, 'forbidden');
  return payload;
}

/* ───────────────────────── CORS / utilidades ───────────────────────── */

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}
