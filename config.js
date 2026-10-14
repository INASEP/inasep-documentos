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
    // Lo genera el formulario (no se pide a la persona). Aparece en el panel junto a los demás.
    { key: 'declaracion',      label: 'Declaración de autenticidad (firmada con casilla)', auto: true },
  ],

  // Textos de la declaración (constancia PDF) según el curso
  DECL: {
    curso: {
      supervisor: 'Supervisor de Seguridad Privada',
      cctv:       'Operador de Cámaras de Televigilancia y Alarmas',
      guardia:    'Guardia de Seguridad (OS10)',
    },
    docs: {
      carnetFrontal:    'Cédula de identidad (ambas caras)',
      certAntecedentes: 'Certificado de antecedentes para fines especiales',
      certEducacion:    'Certificado de estudios (enseñanza media)',
      certMilitar:      'Situación militar al día (solo alumnos de sexo masculino)',
    },
    texto: 'Declaro que los documentos que envío a INASEP son auténticos y no han sido modificados ni adulterados. Asumo toda responsabilidad por su veracidad y libero a INASEP de cualquier responsabilidad derivada de documentos falsos o alterados.',
    cierre: 'El declarante aceptó esta declaración marcando la casilla de conformidad en el formulario de envío de documentos de INASEP (www.inasep.cl), en la fecha y hora indicadas. INASEP podrá dejar sin efecto la matrícula o certificación si se comprueba la falsedad de algún documento.',
  },
};
