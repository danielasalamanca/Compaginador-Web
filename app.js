const { PDFDocument, rgb } = PDFLib;
const MM = 72 / 25.4;
const $ = id => document.getElementById(id);
const val = name => document.querySelector(`input[name=${name}]:checked`).value;

// pages: { name, doc (PDFDocument), idx }
let pages = [];
let dragFrom = null;

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

async function addFiles(files) {
  const list = [...files].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  list.sort((a, b) => collator.compare(a.name, b.name));
  const errors = [];
  showError(list.length === 0 && files.length ? 'Solo se pueden subir archivos PDF.' : '');
  for (const f of list) {
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      for (let i = 0; i < doc.getPageCount(); i++) {
        pages.push({ name: f.name, doc, idx: i, multi: doc.getPageCount() > 1 });
      }
    } catch (e) {
      errors.push(f.name);
    }
  }
  if (errors.length) showError('No se pudo leer: ' + errors.join(', ') + '. Comprueba que no estén protegidos o dañados.');
  render();
}

function showError(msg) {
  const e = $('error');
  e.textContent = msg || '';
  e.hidden = !msg;
}

function move(from, to) {
  if (to < 0 || to >= pages.length) return;
  pages.splice(to, 0, pages.splice(from, 1)[0]);
  render({ focus: to });
}

function render(opts = {}) {
  const has = pages.length > 0;
  $('pages-sec').hidden = $('opts').hidden = $('go-sec').hidden = !has;
  $('count').textContent = pages.length;
  const ol = $('pages');
  ol.innerHTML = '';
  pages.forEach((p, i) => {
    const li = document.createElement('li');
    li.draggable = true;
    const detail = p.multi ? ` (pág. ${p.idx + 1})` : '';
    li.innerHTML = `<span class="pn">Página ${i + 1}</span><span class="pf" title="${p.name}${detail}"></span>
      <div class="acts">
        <button type="button" data-a="prev" aria-label="Mover la página ${i + 1} antes">←</button>
        <button type="button" data-a="next" aria-label="Mover la página ${i + 1} después">→</button>
        <button type="button" data-a="del" aria-label="Quitar la página ${i + 1}">✕</button>
      </div>`;
    li.querySelector('.pf').textContent = p.name + detail;
    const [prev, next, del] = li.querySelectorAll('button');
    prev.disabled = i === 0;
    next.disabled = i === pages.length - 1;
    prev.onclick = () => move(i, i - 1);
    next.onclick = () => move(i, i + 1);
    del.onclick = () => { pages.splice(i, 1); render({ focus: Math.min(i, pages.length - 1) }); };
    li.ondragstart = () => { dragFrom = i; li.classList.add('drag'); };
    li.ondragend = () => { li.classList.remove('drag'); dragFrom = null; };
    li.ondragover = e => { e.preventDefault(); li.classList.add('over'); };
    li.ondragleave = () => li.classList.remove('over');
    li.ondrop = e => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) move(dragFrom, i); };
    ol.appendChild(li);
  });
  if (opts.focus !== undefined && opts.focus >= 0) {
    // mantener el foco en el botón que acaba de usarse (o en el vecino si se quitó)
    const li = ol.children[opts.focus];
    const btn = li && li.querySelectorAll('button:not(:disabled)')[0];
    if (btn) btn.focus();
  }
  updatePlan();
}

// Devuelve la lista de hojas: cada hoja es [izq, der] con índices de página (null = en blanco)
function buildSheets() {
  const mode = val('mode'), rtl = val('binding') === 'rtl', cover = $('cover').checked;
  let seq = pages.map((_, i) => i);
  let sheets = [];
  if (mode === 'single') {
    return seq.map(i => [i]);
  }
  if (mode === 'spreads') {
    if (cover) seq.unshift(null); // portada sola a la derecha
    if (seq.length % 2) seq.push(null);
    for (let i = 0; i < seq.length; i += 2) sheets.push([seq[i], seq[i + 1]]);
  } else {
    while (seq.length % 4) seq.push(null);
    const n = seq.length;
    for (let i = 0; i < n / 2; i += 2) {
      sheets.push([seq[n - 1 - i], seq[i]]);         // frente
      sheets.push([seq[i + 1], seq[n - 2 - i]]);     // reverso
    }
  }
  if (rtl) sheets = sheets.map(s => [s[1], s[0]]);
  return sheets;
}

function updateTips() {
  const n = pages.length, mode = val('mode'), cover = $('cover').checked;
  const plural = (k, a, b) => `${k} ${k === 1 ? a : b}`;
  let html;
  if (mode === 'single') {
    html = '<p class="good">Con "Solo unir" sirve cualquier número de páginas.</p>';
  } else if (mode === 'booklet') {
    const up = Math.ceil(n / 4) * 4, down = Math.floor(n / 4) * 4;
    const chips = [4, 8, 12, 16, 20, 24, 28, 32].filter(x => x <= Math.max(32, up)).map(x => `<span>${x}</span>`).join('');
    if (n % 4 === 0) {
      html = `<p class="good">✓ ${n} páginas es un número perfecto para un cuadernillo.</p>`;
    } else {
      html = `<p class="warn">Con ${n} páginas sobran huecos: un cuadernillo necesita un múltiplo de 4.</p><ul>
        <li>Añade ${plural(up - n, 'página', 'páginas')} hasta llegar a <strong>${up}</strong>.</li>
        ${down >= 4 ? `<li>O quita ${plural(n - down, 'página', 'páginas')} para quedarte en <strong>${down}</strong>.</li>` : ''}
        <li>Si no cambias nada, se añadirán ${plural(up - n, 'página en blanco', 'páginas en blanco')} al final, y la contraportada quedará en el interior.</li></ul>`;
    }
    html += `<p style="margin-top:12px">Cada hoja impresa a doble cara aporta 4 páginas. Números que encajan:</p><div class="chips">${chips}</div>
      <p style="margin-top:10px" class="hint">Pasadas unas 60–80 páginas, el cuadernillo se abulta al doblarse. Conviene dividirlo en varios.</p>`;
  } else {
    const ok = cover ? n % 2 === 1 : n % 2 === 0;
    if (ok) {
      html = `<p class="good">✓ ${n} páginas encaja bien${cover ? ' con portada sola' : ''}.</p>`;
    } else {
      html = `<p class="warn">Con ${n} páginas ${cover ? 'y portada sola ' : ''}quedará una página sola al final.</p>
        <ul><li>${cover ? 'Usa un número impar' : 'Usa un número par'}: añade o quita 1 página (${n + 1} o ${Math.max(1, n - 1)}).</li></ul>`;
    }
  }
  $('tips').innerHTML = html;
}

function updatePlan() {
  updateTips();
  if (!pages.length) return;
  const sheets = buildSheets();
  const lab = i => i === null ? 'en blanco' : 'pág. ' + (i + 1);
  const mode = val('mode');
  $('more').hidden = mode === 'single';
  $('cover-row').hidden = mode !== 'spreads';
  const blanks = sheets.flat().filter(x => x === null).length;
  let summary, rows;
  if (mode === 'single') {
    summary = `Se generará un PDF de ${pages.length} páginas, una por hoja.`;
    rows = sheets.map((s, k) => `Hoja ${k + 1}: ${lab(s[0])}`);
  } else {
    const hojas = Math.ceil(sheets.length / 2);
    summary = `Se generará un PDF de ${sheets.length} caras (${hojas} ${hojas === 1 ? 'hoja' : 'hojas'} a doble cara)` +
      (blanks ? `, con ${blanks} ${blanks === 1 ? 'página en blanco añadida' : 'páginas en blanco añadidas'}` : '') +
      '. Al imprimir, elige doble cara y voltear por el borde corto.';
    rows = sheets.map((s, k) => `${mode === 'booklet' ? (k % 2 ? 'Reverso' : 'Frente') + ' ' + (Math.floor(k / 2) + 1) : 'Cara ' + (k + 1)}: ${lab(s[0])} y ${lab(s[1])}`);
  }
  $('summary').textContent = summary;
  $('plan').innerHTML = rows.join('<br>');
}

async function generate() {
  const btn = $('go'), st = $('status');
  btn.disabled = true; st.className = ''; st.textContent = 'Preparando tu PDF…';
  try {
    const sheets = buildSheets();
    const out = await PDFDocument.create();
    const first = pages[0].doc.getPage(pages[0].idx).getSize();
    const w = first.width, h = first.height;
    const gap = (parseFloat($('gap').value) || 0) * MM;
    const marks = $('marks').checked;
    const mode = val('mode');

    // Incrustar cada página una sola vez
    const embedded = await Promise.all(pages.map(p => out.embedPage(p.doc.getPage(p.idx))));

    const place = (page, ep, x, cellW, cellH) => {
      if (!ep) return;
      const s = Math.min(cellW / ep.width, cellH / ep.height);
      const dw = ep.width * s, dh = ep.height * s;
      page.drawPage(ep, { x: x + (cellW - dw) / 2, y: (cellH - dh) / 2, width: dw, height: dh });
    };

    for (const s of sheets) {
      if (mode === 'single') {
        const ep = embedded[s[0]];
        const pg = out.addPage([ep.width, ep.height]);
        pg.drawPage(ep);
        continue;
      }
      const pg = out.addPage([w * 2 + gap, h]);
      place(pg, s[0] === null ? null : embedded[s[0]], 0, w, h);
      place(pg, s[1] === null ? null : embedded[s[1]], w + gap, w, h);
      if (marks) {
        const cx = w + gap / 2;
        pg.drawLine({ start: { x: cx, y: 0 }, end: { x: cx, y: 8 }, thickness: .5, color: rgb(0, 0, 0) });
        pg.drawLine({ start: { x: cx, y: h }, end: { x: cx, y: h - 8 }, thickness: .5, color: rgb(0, 0, 0) });
      }
    }
    const bytes = await out.save();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = 'compaginado.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    st.className = 'ok'; st.textContent = 'Listo: tu PDF se ha descargado como compaginado.pdf.';
  } catch (e) {
    console.error(e);
    st.textContent = 'No se pudo crear el PDF. ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

$('file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
const drop = $('drop');
drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
$('sort').onclick = () => { pages.sort((a, b) => collator.compare(a.name, b.name) || a.idx - b.idx); render(); };
$('clear').onclick = () => { pages = []; showError(''); $('status').textContent = ''; render(); $('file').focus(); };
document.querySelectorAll('#opts input, #opts select').forEach(el => el.addEventListener('change', updatePlan));
$('go').onclick = generate;
$('tipsBtn').onclick = () => {
  const open = $('tips').hidden;
  $('tips').hidden = !open;
  $('tipsBtn').setAttribute('aria-expanded', open);
};
