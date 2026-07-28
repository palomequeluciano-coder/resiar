const LEGAL_TEXTS = {
  terminos: `
    <h2 style="font-family:var(--font-serif);font-size:1.6rem;margin-bottom:6px;">Términos y condiciones de uso</h2>
    <p style="color:var(--text3);font-size:0.82rem;margin-bottom:28px;">Última actualización: mayo 2026 · República Argentina</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">1. Aceptación y alcance</h3>
    <p>Al registrarte, acceder o usar ResiAR aceptás estos términos. Si no estás de acuerdo, no uses la plataforma. ResiAR es un servicio digital educativo orientado a la preparación de exámenes de residencias médicas argentinas.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">2. Naturaleza educativa del servicio</h3>
    <p>ResiAR ofrece bancos de preguntas, simulación de exámenes, explicaciones, estadísticas, modos de repaso y herramientas de estudio. El contenido tiene finalidad educativa y de entrenamiento. No constituye asesoramiento médico, acto médico, diagnóstico, tratamiento, indicación profesional, ni reemplaza la formación universitaria, la bibliografía oficial, los programas de residencia o el criterio de profesionales habilitados.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">3. Cuenta personal y uso permitido</h3>
    <p>El acceso es personal e intransferible. No está permitido compartir credenciales, revender accesos, automatizar consultas, extraer masivamente contenido, copiar bancos de preguntas, sortear límites técnicos o usar la plataforma de manera que afecte el funcionamiento del servicio o los derechos de terceros.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">4. Contenido, IA y exactitud</h3>
    <p>Las explicaciones, resúmenes o ayudas generadas con inteligencia artificial pueden contener errores, omisiones o interpretaciones incompletas. El usuario debe contrastar la información con fuentes oficiales, bibliografía médica actualizada y criterio académico/profesional. ResiAR puede corregir, actualizar, reclasificar, eliminar o mejorar preguntas, explicaciones y temas sin aviso previo.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">5. Planes, pagos y facturación</h3>
    <p>Los pagos se procesan mediante proveedores externos, actualmente Mercado Pago. ResiAR no almacena datos completos de tarjetas ni credenciales financieras. La activación del plan queda sujeta a la confirmación del pago. Las condiciones comerciales, precios, promociones, cupos y duración de planes pueden modificarse hacia el futuro, sin afectar períodos ya abonados salvo que corresponda por ley o por una mejora del servicio.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">6. Cancelaciones, reclamos y derechos del consumidor</h3>
    <p>Las solicitudes vinculadas a pagos, activación, fallas técnicas, cancelaciones o reclamos se atienden por los canales de contacto informados. Nada en estos términos limita derechos irrenunciables que pudieran corresponder al usuario como consumidor conforme la normativa argentina aplicable, incluida la Ley 24.240 de Defensa del Consumidor y normas complementarias.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">7. Propiedad intelectual</h3>
    <p>La interfaz, selección, organización, explicaciones, desarrollos, textos, recursos visuales, funcionalidades y demás componentes de ResiAR están protegidos por derechos de propiedad intelectual o licencias aplicables. El uso de la plataforma no transfiere propiedad sobre el contenido ni habilita su reproducción, publicación, entrenamiento de modelos, redistribución o explotación comercial no autorizada.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">8. Suspensión o limitación de acceso</h3>
    <p>Podemos suspender, limitar o cancelar accesos ante uso indebido, abuso técnico, fraude, intentos de eludir restricciones de plan, afectación de seguridad, incumplimiento de estos términos o requerimientos legales.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">9. Cambios en la plataforma</h3>
    <p>Podemos modificar funcionalidades, diseño, disponibilidad de bancos, políticas de acceso, precios futuros o herramientas de estudio para mantener, mejorar o proteger la plataforma. El uso continuado después de una actualización implica aceptación de los cambios aplicables.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">10. Legislación aplicable y contacto</h3>
    <p>Estos términos se interpretan conforme a la legislación argentina aplicable. Para consultas, soporte o reclamos: <a href="mailto:resiar.soporte@gmail.com" style="color:var(--accent);">resiar.soporte@gmail.com</a>.</p>
  `,
  privacidad: `
    <h2 style="font-family:var(--font-serif);font-size:1.6rem;margin-bottom:6px;">Política de privacidad</h2>
    <p style="color:var(--text3);font-size:0.82rem;margin-bottom:28px;">Última actualización: mayo 2026 · República Argentina</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">1. Responsable y contacto</h3>
    <p>ResiAR trata datos personales necesarios para operar la plataforma educativa. Para ejercer derechos o hacer consultas de privacidad, escribí a <a href="mailto:resiar.soporte@gmail.com" style="color:var(--accent);">resiar.soporte@gmail.com</a>.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">2. Marco normativo de referencia</h3>
    <p>Esta política toma como referencia la Ley 25.326 de Protección de los Datos Personales, su Decreto Reglamentario 1558/2001, criterios de la Agencia de Acceso a la Información Pública y demás normativa argentina que resulte aplicable.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">3. Datos que podemos tratar</h3>
    <p>Podemos tratar datos de registro y autenticación, como nombre, email, identificador de usuario, avatar y proveedor de login; datos de uso, como respuestas, tiempos, progreso, estadísticas, notas, reportes, ranking, rachas y preferencias; datos técnicos y de seguridad, como sesión activa, dispositivo, IP o identificadores equivalentes; datos sociales dentro de la plataforma, como amigos, solicitudes e invitaciones; y datos de pago estrictamente necesarios, como identificadores de operación, plan, estado y vencimiento. No almacenamos datos completos de tarjetas.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">4. Finalidades</h3>
    <p>Usamos los datos para crear y autenticar cuentas, aplicar planes y límites de acceso, generar estadísticas, habilitar repaso por errores y debilidades, sincronizar resultados, prevenir abuso o fraude, dar soporte, procesar reportes, operar funciones sociales y mejorar la experiencia educativa.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">5. Datos sensibles y contenido médico</h3>
    <p>ResiAR no está destinado a registrar historias clínicas, datos de pacientes ni información médica real identificable. El usuario no debe ingresar datos de pacientes o terceros. Si por error se incorpora información de ese tipo en notas, reportes o mensajes, podés solicitar su eliminación.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">6. Proveedores y transferencias</h3>
    <p>Para operar el servicio podemos usar proveedores tecnológicos como Supabase, Cloudflare, Google OAuth, Mercado Pago y servicios de inteligencia artificial o mensajería. Algunos proveedores pueden procesar datos fuera de Argentina. En esos casos se procura limitar la información compartida a lo necesario para prestar el servicio, seguridad, soporte, pago o cumplimiento legal.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">7. Conservación</h3>
    <p>Conservamos los datos mientras la cuenta esté activa o mientras sean necesarios para operar la plataforma, cumplir obligaciones legales, resolver reclamos, prevenir abuso o mantener registros técnicos razonables. Podés solicitar baja o eliminación de cuenta, salvo información que deba conservarse por obligaciones legales, seguridad o defensa de derechos.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">8. Tus derechos</h3>
    <p>Como titular de datos podés solicitar acceso, rectificación, actualización o supresión de tus datos personales conforme la Ley 25.326. También podés presentar reclamos ante la Agencia de Acceso a la Información Pública si considerás vulnerados tus derechos.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">9. Seguridad</h3>
    <p>Aplicamos medidas razonables de seguridad técnica y organizativa, incluyendo autenticación con proveedor externo, restricciones por plan, políticas de acceso, controles de sesión, registros mínimos y limitación de datos expuestos. Ningún sistema es absolutamente invulnerable, por lo que el usuario debe proteger sus credenciales y dispositivos.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">10. Cookies, localStorage y datos locales</h3>
    <p>La plataforma puede usar almacenamiento local del navegador para recordar tema visual, sesión, borradores de examen, notas, preferencias, estadísticas locales o resultados pendientes de sincronización. Podés borrar esos datos desde tu navegador, aunque algunas funciones pueden perder continuidad.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">11. Menores de edad</h3>
    <p>ResiAR está orientado a estudiantes y profesionales mayores de 18 años. No buscamos recopilar datos de menores de edad de forma intencional.</p>

    <h3 style="font-size:1rem;margin:20px 0 8px;">12. Cambios</h3>
    <p>Podemos actualizar esta política para reflejar cambios técnicos, legales o funcionales. La versión vigente estará disponible en la plataforma.</p>
  `
};

export function abrirModalLegal(tipo) {
  const modal = document.getElementById('modalLegal');
  const content = document.getElementById('modalLegalContent');
  if (!modal || !content) return;
  content.innerHTML = LEGAL_TEXTS[tipo] || '';
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

export function cerrarModalLegal() {
  const modal = document.getElementById('modalLegal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

export function installLegalModal() {
  if (window.__resiarLegalModalInstalled) return;
  window.__resiarLegalModalInstalled = true;
  window.abrirModalLegal = abrirModalLegal;
  window.cerrarModalLegal = cerrarModalLegal;
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') cerrarModalLegal();
  });
}
