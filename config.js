/* Configuración compartida por index.html (formulario) y admin.html (portal).
   Aquí no hay secretos: todo lo que ves es público por diseño. */
window.INASEP = {
  // URL del Worker de Cloudflare (sin barra final)
  WORKER_URL: 'https://inasep-docs.inasep.workers.dev',

  // Dirección pública del formulario. Si la dejas vacía se usa la carpeta donde está admin.html.
  FORM_URL: '',

  // Proyecto Firebase del login de coordinación (el mismo del panel de contratos)
  FIREBASE: {
    apiKey: 'AIzaSyA0Uls6Te3scv4iF-5AcKQkc7tQVXq2xz0',
    authDomain: 'inasep-contratos.firebaseapp.com',
    projectId: 'inasep-contratos',
    appId: '1:947153429430:web:bbec23c4f3230457ab9717',
  },

  // Contacto que ve la persona si su enlace no funciona
  CONTACTO: 'coordinacion@inasep.cl',

  MAX_MB: 5,

  // Los documentos marcados con `vigencia` deben haberse emitido dentro de estos días
  VIGENCIA_DIAS: 30,

  // Etiquetas de los documentos. Qué documentos pide cada curso se define en worker/worker.js (COURSES).
  DOCS: [
    { key: 'carnetFrontal',    label: 'Carnet de identidad, cara frontal',
      help: 'Cédula de identidad chilena vigente.' },
    { key: 'carnetPosterior',  label: 'Carnet de identidad, cara posterior' },
    { key: 'certAntecedentes', label: 'Certificado de antecedentes para fines especiales',
      vigencia: true, corto: 'certificado de antecedentes', help: 'Se descarga desde el Registro Civil.', link: 'https://www.registrocivil.cl/' },
    { key: 'certEducacion',    label: 'Certificado de educación media',
      help: 'Se descarga desde el Mineduc.', link: 'https://certificados.mineduc.cl/mvc/home/index' },
    { key: 'certMilitar',      label: 'Certificado de situación militar al día',
      vigencia: true, corto: 'certificado de situación militar', help: 'Se descarga desde la DGMN.', link: 'https://dgmn.cerofilas.gob.cl/' },
  ],
};
