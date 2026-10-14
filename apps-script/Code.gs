/**
 * INASEP · Recepción de documentos — Google Apps Script (Drive)
 *
 * Guarda los archivos que recibe el Worker de Cloudflare en carpetas separadas
 * por persona dentro de una carpeta raíz de tu Drive.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   ROOT_FOLDER_ID  ID de la carpeta raíz de Drive (el final de su URL)
 *   SHARED_SECRET   texto largo y aleatorio; el mismo que SCRIPT_SECRET en Cloudflare
 */

var MAX_BYTES = 6 * 1024 * 1024; // el formulario limita a 5 MB; aquí hay un margen

function doGet() {
  return out({ ok: true, service: 'INASEP docs' });
}

function doPost(e) {
  try {
    return out(handle(e));
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function handle(e) {
  var p = e.parameter || {};
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SHARED_SECRET') || '';
  if (!secret || !safeEqual(p.secret || '', secret)) return { ok: false, error: 'unauthorized' };

  var rootId = props.getProperty('ROOT_FOLDER_ID');
  if (!rootId) return { ok: false, error: 'ROOT_FOLDER_ID no configurado' };
  var root = DriveApp.getFolderById(rootId);

  if (p.action === 'save_file') return saveFile(p, e, root);
  if (p.action === 'get_file') return getFile(p, root);
  if (p.action === 'ping') return { ok: true, root: root.getName() };
  return { ok: false, error: 'acción desconocida' };
}

/* ── Guardar archivo ─────────────────────────────────────────── */

function saveFile(p, e, root) {
  var rut = String(p.rut || '');
  if (!/^\d{7,8}-[\dK]$/.test(rut)) return { ok: false, error: 'RUT inválido' };
  var label = String(p.label || '');
  if (!/^[A-Za-z_]{3,40}$/.test(label)) return { ok: false, error: 'etiqueta inválida' };
  var nombre = sanitizeName(p.nombre);
  if (!nombre) return { ok: false, error: 'nombre inválido' };

  var body = JSON.parse(e.postData.contents);
  var bytes = Utilities.base64Decode(String(body.data || ''));
  if (!bytes.length) return { ok: false, error: 'archivo vacío' };
  if (bytes.length > MAX_BYTES) return { ok: false, error: 'archivo demasiado grande' };

  var type = detectType(bytes);
  if (!type) return { ok: false, error: 'el archivo no es PDF, JPEG o PNG' };

  var folder = getOrCreateFolder(root, rut, nombre, String(p.curso || ''));
  var fileName = label + '.' + type.ext;

  // Si la persona vuelve a subir el mismo documento, el anterior va a la papelera.
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(label + '.') === 0) f.setTrashed(true);
  }

  var file = folder.createFile(Utilities.newBlob(bytes, type.mime, fileName));
  return {
    ok: true,
    fileId: file.getId(),
    name: fileName,
    size: bytes.length,
    mime: type.mime,
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    folderName: folder.getName(),
  };
}

function getOrCreateFolder(root, rut, nombre, curso) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var prefix = rut + ' - ';
    var it = root.searchFolders("title contains '" + rut + "'");
    while (it.hasNext()) {
      var f = it.next();
      if (f.getName().indexOf(prefix) === 0) return f; // misma persona → misma carpeta
    }
    var folder = root.createFolder(prefix + nombre);
    folder.setDescription('RUT ' + rut + (curso ? ' · ' + curso : '') + ' · creada ' +
      Utilities.formatDate(new Date(), 'America/Santiago', 'dd-MM-yyyy HH:mm'));
    return folder;
  } finally {
    lock.releaseLock();
  }
}

/* ── Leer archivo (solo si está dentro de la carpeta raíz) ───── */

function getFile(p, root) {
  var file = DriveApp.getFileById(String(p.id || ''));
  if (!isInside(file, root.getId())) return { ok: false, error: 'archivo fuera de la carpeta raíz' };
  var blob = file.getBlob();
  return {
    ok: true,
    name: file.getName(),
    mime: blob.getContentType(),
    data: Utilities.base64Encode(blob.getBytes()),
  };
}

function isInside(file, rootId) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    var folder = parents.next();
    if (folder.getId() === rootId) return true;
    var up = folder.getParents();
    while (up.hasNext()) if (up.next().getId() === rootId) return true;
  }
  return false;
}

/* ── Utilidades ──────────────────────────────────────────────── */

function detectType(b) {
  var x = function (i) { return b[i] & 0xff; };
  if (x(0) === 0x25 && x(1) === 0x50 && x(2) === 0x44 && x(3) === 0x46) return { mime: 'application/pdf', ext: 'pdf' };
  if (x(0) === 0xff && x(1) === 0xd8 && x(2) === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (x(0) === 0x89 && x(1) === 0x50 && x(2) === 0x4e && x(3) === 0x47) return { mime: 'image/png', ext: 'png' };
  return null;
}

function sanitizeName(s) {
  return String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecútala una vez desde el editor para autorizar los permisos de Drive. */
function autorizar() {
  var id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  Logger.log('Carpeta raíz: ' + DriveApp.getFolderById(id).getName());
}
