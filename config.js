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
    // Solo para los cursos que lo definan aquí (hoy: Guardia de Seguridad)
    infoAceptada: {
      guardia: 'Asimismo, el declarante manifiesta haber leído y aceptado la información sobre su proceso (plazos de remisión de antecedentes a la Subsecretaría de Prevención del Delito y llamado a examen ante la Autoridad Fiscalizadora OS10), contenida en el formulario de envío de documentos.',
    },
    cierre: 'El declarante aceptó esta declaración marcando la casilla de conformidad en el formulario de envío de documentos de INASEP (www.inasep.cl), en la fecha y hora indicadas. INASEP podrá dejar sin efecto la matrícula o certificación si se comprueba la falsedad de algún documento.',
  },
 
  // Aviso informativo por curso (se muestra al final del formulario, antes de la declaración)
  INFO: {
    guardia: {
      titulo: 'Información importante sobre tu proceso',
      resumen: 'El curso dura 10 días. Al terminar, INASEP envía tus antecedentes y tu certificado de asistencia a la Subsecretaría de Prevención del Delito (SPD), que coordina con OS10 el llamado a examen: plazo estimado de aproximadamente 2 meses, o menos según la coordinación entre ambas instituciones.',
      detalle: [
        'Nuestro Curso de Formación de Guardia de Seguridad tiene una duración de 10 días. Una vez finalizado, INASEP remite los antecedentes del participante, junto con su certificado de asistencia, a la Subsecretaría de Prevención del Delito (SPD).',
        'A partir de ese momento, la SPD revisa la documentación y coordina con la Autoridad Fiscalizadora OS10 el correspondiente llamado a examen.',
        'De acuerdo con la información oficial comunicada por la SPD a las OTEC y empresas de seguridad del país, el plazo estimado para este llamado es de aproximadamente 2 meses desde la recepción de los antecedentes, aunque puede ser menor dependiendo de las coordinaciones entre ambas instituciones.',
        'Una vez rendido el examen, OS10 remite los resultados a la SPD, organismo responsable de incorporarlos directamente en su plataforma.',
        'Tu proceso de acreditación: en el Aula Virtual INASEP encontrarás una guía interactiva que te orienta paso a paso sobre los documentos y gestiones necesarios para avanzar en tu acreditación.',
      ],
      cierre: 'INASEP – Formación y capacitación en Seguridad Privada.',
    },
  },
};
