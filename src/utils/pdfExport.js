export function createExamPdfExporter(deps = {}) {
  const getExam = deps.getExam || (() => []);
  const getAnswers = deps.getAnswers || (() => []);
  const getCorrectas = deps.getCorrectas || (() => 0);
  const getIncorrectas = deps.getIncorrectas || (() => 0);
  const getTiempoTotal = deps.getTiempoTotal || (() => 0);
  const getTiempo = deps.getTiempo || (() => 0);
  const getTiemposPregunta = deps.getTiemposPregunta || (() => []);
  const esRespuestaAnulada = deps.esRespuestaAnulada || (() => false);
  const escapeHtml = deps.escapeHtml || ((value) => String(value ?? ''));

  return function exportarPDF() {
    const examen = getExam();
    if (!Array.isArray(examen) || !examen.length) return;

    const respuestas = getAnswers();
    const correctas = getCorrectas();
    const incorrectas = getIncorrectas();
    const tiempoTotal = getTiempoTotal();
    const tiempo = getTiempo();
    const tiemposPregunta = getTiemposPregunta();

    const col = p => p >= 70 ? '#4ade80' : p >= 50 ? '#fbbf24' : '#f87171';
    const respondidas = examen.filter((_, i) => respuestas[i]).length;
    const pct = respondidas ? Math.round(correctas / respondidas * 100) : 0;

    function fmt(s) {
      return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    const tUsado = tiempoTotal - tiempo;

    const rows = examen.map((p, i) => {
      const r = respuestas[i];
      const esAnulada = esRespuestaAnulada(p);
      const ok = !esAnulada && r === p.respuesta;
      const icon = !r ? '—' : esAnulada ? '⚠' : ok ? '✓' : '✗';
      const color = !r ? '#666' : esAnulada ? '#d97706' : ok ? '#16a34a' : '#dc2626';
      const seg = tiemposPregunta[i] || 0;
      const pregunta = String(p.pregunta || '');

      return `<tr>
        <td style="color:#666;font-size:11px;padding:6px 8px;">${i + 1}</td>
        <td style="font-size:12px;padding:6px 8px;max-width:340px;">${escapeHtml(pregunta.slice(0, 90))}${pregunta.length > 90 ? '…' : ''}</td>
        <td style="text-align:center;font-size:12px;padding:6px 8px;">${r || '—'}</td>
        <td style="text-align:center;font-size:12px;padding:6px 8px;">${esAnulada ? '<span style="color:#d97706;font-size:10px;font-weight:600;">SIN RESP.</span>' : p.respuesta}</td>
        <td style="text-align:center;font-weight:700;color:${color};padding:6px 8px;">${icon}</td>
        <td style="text-align:center;font-size:11px;color:#666;padding:6px 8px;">${seg ? fmt(seg) : '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Resultado del examen</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;background:#f8fafc;color:#1a202c;margin:0;padding:32px;}
      h1{font-size:22px;margin-bottom:4px;}
      .sub{color:#666;font-size:13px;margin-bottom:24px;}
      .cards{display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap;}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;min-width:100px;text-align:center;}
      .card-v{font-size:28px;font-weight:700;line-height:1;}
      .card-l{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-top:5px;}
      table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.06);}
      th{background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;padding:9px 8px;text-align:left;}
      tr:nth-child(even){background:#fafbfc;}
      @media print{body{padding:16px;}button{display:none;}}
    <\/style><\/head><body>
    <h1>📋 Resultado del simulador</h1>
    <div class="sub">Generado el ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })} · Tiempo: ${fmt(tUsado)}</div>
    <div class="cards">
      <div class="card"><div class="card-v" style="color:#16a34a">${correctas}</div><div class="card-l">Correctas</div></div>
      <div class="card"><div class="card-v" style="color:#dc2626">${incorrectas}</div><div class="card-l">Incorrectas</div></div>
      <div class="card"><div class="card-v" style="color:#34d399">${examen.length}</div><div class="card-l">Total</div></div>
      <div class="card"><div class="card-v" style="color:${col(pct)}">${pct}%</div><div class="card-l">Rendimiento</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Pregunta</th><th>Tu resp.</th><th>Correcta</th><th>Result.</th><th>Tiempo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.print();<\/script>
    <\/body><\/html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };
}
