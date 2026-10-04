const $ = (id) => document.getElementById(id);
const K_CODE = "finanzas_codigo", K_URL = "finanzas_url";
const lsGet = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const lsSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
const RE_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const urlPorDefecto = () => (window.SCRIPT_URL && RE_URL.test(window.SCRIPT_URL) ? window.SCRIPT_URL : "");
const getUrl = () => lsGet(K_URL) || urlPorDefecto();
const getCode = () => lsGet(K_CODE);

const EMO = { comida: "🍔", super: "🛒", transporte: "🚌", salud: "💊", suscripciones: "📺", ocio: "🎮", formd: "🧵", hogar: "🏠", transferencias: "📲", efectivo: "💵", otros: "📌" };
const COL = { comida: "#f59e0b", super: "#22c55e", transporte: "#3b82f6", salud: "#ef4444", suscripciones: "#a855f7", ocio: "#ec4899", formd: "#c6ff3d", hogar: "#14b8a6", transferencias: "#94a3b8", efectivo: "#84cc16", otros: "#64748b" };
const NOMBRE = { comida: "Comida", super: "Super", transporte: "Transporte", salud: "Salud", suscripciones: "Suscrip.", ocio: "Ocio", formd: "FORMD", hogar: "Hogar", transferencias: "Yape/Plin", efectivo: "Efectivo", otros: "Otros" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

let D = null, vistaPresu = "hoy", wizardMostrado = false;

const S = (n) => "S/ " + Math.round(n).toLocaleString("es-PE");
const S2 = (n) => "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (s) => parseInt(s.slice(8, 10), 10) + " " + MES[parseInt(s.slice(5, 7), 10) - 1];
const mesTxt = (m) => (/^\d{4}-\d{2}/.test(m) ? MES[parseInt(m.slice(5, 7), 10) - 1] + " " + m.slice(0, 4) : m);
const dias = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function say(text, cls = "") { const m = $("msg"); m.textContent = text; m.className = "msg " + cls; }

async function api(action, extra = {}) {
  // text/plain evita la consulta previa (CORS) que Apps Script no responde.
  const res = await fetch(getUrl(), {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: getCode(), action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.auth === false) { lsSet(K_CODE, ""); mostrar(); throw new Error("Código incorrecto. Escríbelo otra vez."); }
  if (!res.ok || data.error) throw new Error(data.error || "Error " + res.status);
  return data;
}

function mostrar() {
  const listo = !!getCode() && !!getUrl();
  $("setup").hidden = listo;
  $("app").hidden = !listo;
  $("barra").hidden = !listo;
  if (!listo) { $("url").value = getUrl(); return; }
  cargar();
}

async function cargar(accion = "dashboard", extra = {}) {
  try {
    D = await api(accion, extra);
    pintar();
    if (D.setup && !D.setup.hecho && !wizardMostrado) { wizardMostrado = true; abrirWizard(); }
    return D;
  } catch (e) { say(e.message, "bad"); throw e; }
}

// ---------- ventanas con formularios ----------

function cerrarForm() { $("sheetForm").hidden = true; }

function formModal(o) {
  const box = $("formBox"); box.replaceChildren();
  if (o.paso) box.append(h("div", "paso", o.paso));
  box.append(h("b", "", o.titulo));
  if (o.nota) { const n = h("div", "sub", o.nota); n.style.margin = "4px 0 6px"; box.append(n); }
  const inputs = {};
  (o.campos || []).forEach((c) => {
    box.append(h("label", "", c.label));
    let el;
    if (c.tipo === "select") {
      el = document.createElement("select");
      c.opciones.forEach(([v, t]) => { const op = document.createElement("option"); op.value = v; op.textContent = t; el.append(op); });
    } else {
      el = document.createElement("input");
      el.type = c.tipo === "number" ? "number" : "text";
      if (c.tipo === "number") { el.step = "0.01"; el.inputMode = "decimal"; }
      if (c.ph) el.placeholder = c.ph;
    }
    el.value = c.valor === undefined || c.valor === null ? "" : String(c.valor);
    inputs[c.k] = el; box.append(el);
    if (c.ayuda) box.append(h("div", "sub", c.ayuda));
  });
  if (o.extra) o.extra(box);
  const err = h("div", "msg bad"); box.append(err);
  const row = h("div", "row");
  if (o.onGuardar) {
    const bg = h("button", "p btn", o.textoGuardar || "Guardar");
    bg.onclick = async () => {
      const v = {}; Object.keys(inputs).forEach((k) => { v[k] = inputs[k].value; });
      bg.disabled = true; err.textContent = "";
      try { await o.onGuardar(v); } catch (e) { err.textContent = e.message; }
      bg.disabled = false;
    };
    row.append(bg);
  }
  if (o.onBorrar) {
    const bb = h("button", "s btn", "🗑 Borrar");
    bb.onclick = async () => { if (!confirm("¿Borrar «" + (o.nombreBorrar || o.titulo) + "»?")) return; try { await o.onBorrar(); } catch (e) { err.textContent = e.message; } };
    row.append(bb);
  }
  const bc = h("button", "s btn", o.textoCerrar || "Cerrar"); bc.onclick = () => { cerrarForm(); if (o.onCerrar) o.onCerrar(); };
  row.append(bc); box.append(row);
  $("sheetForm").hidden = false;
  return box;
}

async function guardarYCerrar(accion, datos, mensaje) {
  D = await api(accion, datos); pintar(); cerrarForm(); if (mensaje) say(mensaje, "ok");
}

function listaModal(titulo, nota, filas, textoNuevo, onNuevo, onVolver) {
  const box = $("formBox"); box.replaceChildren();
  box.append(h("b", "", titulo));
  if (nota) { const n = h("div", "sub", nota); n.style.margin = "4px 0 6px"; box.append(n); }
  filas.forEach((f) => {
    const it = h("div", "item");
    const t = h("div", "t"); t.append(h("b", "", f.titulo), h("span", "", f.detalle || ""));
    it.append(t, h("b", "", f.valor || "")); it.onclick = f.onClick; box.append(it);
  });
  if (!filas.length) box.append(h("div", "sub", "Aún no hay nada aquí."));
  const row = h("div", "row");
  const bn = h("button", "p btn", textoNuevo); bn.onclick = onNuevo;
  const bc = h("button", "s btn", "Cerrar"); bc.onclick = () => { cerrarForm(); if (onVolver) onVolver(); };
  row.append(bn, bc); box.append(row);
  $("sheetForm").hidden = false;
}

// ---------- deudas ----------

const OPC_PAGO = [["cuota", "Cuota mensual con mi sueldo"], ["extra", "Con un pago extra o cuando pueda"], ["sueldo_unico", "Entera con mi próximo sueldo"]];
const OPC_AUTO = [["no", "Lo pago yo"], ["si", "Automático en mi cuenta"], ["planilla", "Se descuenta por planilla"]];

function abrirDeuda(d, volver) {
  formModal({
    titulo: d ? d.nombre : "Nueva deuda",
    nota: d && d.nota ? d.nota : "Si no sabes un dato exacto, pon tu mejor cálculo. Luego lo corriges.",
    campos: [
      { k: "nombre", label: "Nombre", valor: d ? d.nombre : "", ph: "Ej.: Préstamo del banco" },
      { k: "saldo", label: "Cuánto debes hoy (S/)", tipo: "number", valor: d ? d.saldo : "" },
      { k: "pagado", label: "Anotar un pago de (S/), opcional", tipo: "number", ayuda: "Se resta de lo que debes al guardar." },
      { k: "cuota", label: "Cuota mensual (S/)", tipo: "number", valor: d ? d.cuota : 0 },
      { k: "pago", label: "¿Cómo la pagas?", tipo: "select", opciones: OPC_PAGO, valor: d ? d.pago : "cuota" },
      { k: "auto", label: "¿Quién la paga?", tipo: "select", opciones: OPC_AUTO, valor: d ? d.autoTxt : "no", ayuda: "Si se descuenta por planilla, ya está restada de tu sueldo neto." },
      { k: "fin", label: "Termina en (AAAA-MM), opcional", valor: d ? d.fin : "", ph: "2027-12" },
      { k: "prioridad", label: "Orden para pagar con un extra (1 = primero)", tipo: "number", valor: d ? d.prioridad : "" },
      { k: "tea", label: "Interés (TEA), opcional", valor: d ? d.tea : "" },
      { k: "nota", label: "Nota, opcional", valor: d ? d.nota : "" },
    ],
    onGuardar: async (v) => {
      const saldo = Math.max(0, Number(v.saldo || 0) - Number(v.pagado || 0));
      await guardarYCerrar("deuda_guardar", { original: d ? d.nombre : undefined, nombre: v.nombre, saldo, cuota: Number(v.cuota || 0), pago: v.pago, auto: v.auto, fin: v.fin, prioridad: Number(v.prioridad || 0), tea: v.tea, nota: v.nota }, "Deuda guardada.");
      if (volver) volver();
    },
    onBorrar: d ? async () => { await guardarYCerrar("deuda_borrar", { nombre: d.nombre }, "Deuda borrada."); if (volver) volver(); } : null,
    nombreBorrar: d ? d.nombre : "",
    onCerrar: volver,
  });
}

function abrirDeudas() {
  const todas = (D.deudasTodas || []).slice().sort((a, b) => a.prioridad - b.prioridad);
  listaModal("💳 Tus deudas", "Toca una para corregirla o anotar un pago.",
    todas.map((d) => ({ titulo: d.nombre, detalle: (d.cuota ? S(d.cuota) + "/mes · " : "") + (d.planilla ? "por planilla" : d.fin ? "termina " + mesTxt(d.fin) : "sin fecha"), valor: S(d.saldo), onClick: () => abrirDeuda(d, abrirDeudas) })),
    "➕ Nueva deuda", () => abrirDeuda(null, abrirDeudas), abrirCfg);
}

// ---------- ingresos extra ----------

function abrirIngreso(i, volver) {
  formModal({
    titulo: i ? i.nombre : "Nuevo ingreso esperado",
    nota: "Pon lo mínimo que estás seguro de recibir. Lo que no es seguro no debe pagar deudas con fecha fija.",
    campos: [
      { k: "nombre", label: "Nombre", valor: i ? i.nombre : "", ph: "Ej.: Pago por trabajo externo" },
      { k: "min", label: "Mínimo que esperas (S/)", tipo: "number", valor: i ? i.min : "" },
      { k: "max", label: "Máximo (S/), opcional", tipo: "number", valor: i ? i.max : "" },
      { k: "fecha", label: "Fecha aproximada (AAAA-MM-DD), opcional", valor: i ? i.fecha : "", ph: "2026-10-31" },
      { k: "nota", label: "Nota, opcional", valor: i ? i.nota : "" },
    ],
    onGuardar: async (v) => { await guardarYCerrar("ingreso_guardar", { original: i ? i.nombre : undefined, nombre: v.nombre, min: Number(v.min), max: v.max, fecha: v.fecha, nota: v.nota }, "Ingreso guardado."); if (volver) volver(); },
    onBorrar: i ? async () => { await guardarYCerrar("ingreso_borrar", { nombre: i.nombre }, "Ingreso borrado."); if (volver) volver(); } : null,
    nombreBorrar: i ? i.nombre : "",
    onCerrar: volver,
  });
}

function abrirIngresos() {
  const ing = (D.finanzas && D.finanzas.ingresos) || [];
  listaModal("💰 Ingresos extra esperados", "Cuando llegue uno, bórralo y apunta el dinero en «Ya me pagaron» o en tus gastos.",
    ing.map((i) => ({ titulo: i.nombre, detalle: i.fecha ? "hacia el " + fecha(i.fecha) : "sin fecha", valor: S(i.min) + (i.max > i.min ? " a " + S(i.max) : ""), onClick: () => abrirIngreso(i, abrirIngresos) })),
    "➕ Nuevo ingreso", () => abrirIngreso(null, abrirIngresos), abrirCfg);
}

// ---------- bolsas (presupuesto) ----------

function abrirBolsa(b, volver) {
  formModal({
    titulo: b ? b.nombre : "Nueva bolsa",
    nota: "Cada bolsa es un tope para un tipo de gasto. Los porcentajes de cada columna deben sumar 100.",
    campos: [
      { k: "nombre", label: "Nombre", valor: b ? b.nombre : "" },
      { k: "emoji", label: "Emoji", valor: b ? b.emoji : "💠" },
      { k: "pctHoy", label: "% de lo que tienes hasta el pago", tipo: "number", valor: b ? b.pctHoy : 0 },
      { k: "pctSueldo", label: "% de lo que te queda libre del sueldo", tipo: "number", valor: b ? b.pctSueldo : 0 },
      { k: "cats", label: "Categorías que cuentan aquí", valor: b ? b.cats.join(",") : "", ph: "transporte,comida", ayuda: "Opciones: " + Object.keys(NOMBRE).join(", ") },
    ],
    onGuardar: async (v) => { await guardarYCerrar("bolsa_guardar", { original: b ? b.nombre : undefined, nombre: v.nombre, emoji: v.emoji, pctHoy: Number(v.pctHoy || 0), pctSueldo: Number(v.pctSueldo || 0), cats: v.cats }, "Bolsa guardada."); if (volver) volver(); },
    onBorrar: b ? async () => { await guardarYCerrar("bolsa_borrar", { nombre: b.nombre }, "Bolsa borrada."); if (volver) volver(); } : null,
    nombreBorrar: b ? b.nombre : "",
    onCerrar: volver,
  });
}

function abrirBolsas() {
  const bs = D.presupuesto.bolsas;
  listaModal("🧮 Tus bolsas", "Toca una para cambiar cuánto le toca.",
    bs.map((b) => ({ titulo: b.emoji + " " + b.nombre, detalle: b.cats.join(", ") || "sin categorías", valor: b.pctHoy + "% · " + b.pctSueldo + "%", onClick: () => abrirBolsa(b, abrirBolsas) })),
    "➕ Nueva bolsa", () => abrirBolsa(null, abrirBolsas), abrirCfg);
}

// ---------- bancos ----------

function abrirBancos(volver) {
  const act = (D.config.bancos || "").split(",");
  const op = [["1", "Sí, leer sus avisos"], ["0", "No"]];
  formModal({
    titulo: "🏦 Bancos que lee la app",
    nota: "La app lee solo los avisos de consumo que estos bancos te mandan por correo. Nunca pide claves del banco.",
    campos: [
      { k: "interbank", label: "Interbank (tarjeta y Plin)", tipo: "select", opciones: op, valor: act.includes("interbank") ? "1" : "0" },
      { k: "bn", label: "Banco de la Nación", tipo: "select", opciones: op, valor: act.includes("bn") ? "1" : "0" },
      { k: "bcp", label: "BCP (consumos y compras rechazadas)", tipo: "select", opciones: op, valor: act.includes("bcp") ? "1" : "0" },
    ],
    extra: (box) => box.append(h("div", "sub", "¿Usas otro banco? De momento los registras a mano en la barra de abajo («almuerzo 18»).")),
    onGuardar: async (v) => {
      const lista = ["interbank", "bn", "bcp"].filter((k) => v[k] === "1").join(",");
      await guardarYCerrar("config_set", { valores: { bancos: lista || "ninguno" } }, "Bancos actualizados.");
      if (volver) volver();
    },
    onCerrar: volver,
  });
}

// ---------- boleta de pago ----------

const MESES_ES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const RE_MONTO = /^(\d{1,3}(,\d{3})+|\d+)\.\d{2}$/;
const RE_DEUDA = /BANCO|PR[EÉ]STAMO|CR[EÉ]DITO|FINANCIERA|BIENESTAR|COMPRA DE DE|CAJA (MUNICIPAL|RURAL)|CMAC/i;
const RE_NO_CONCEPTO = /TOTAL|SUB TOTAL|BONIFICACION|FUNCION|REMUNERACION|CONCEPTO|MONTO|MEF|IIAA|EMPLEADOR|HABERES|PERCIBOS/i;

function parseBoleta(rows) {
  const out = { mes: "", neto: 0, percibos: 0, aportes: 0, descuentosFac: 0, descuentos: [] };
  const mm = rows.join("\n").match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SETIEMBRE|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*(?:DE\s*)?(\d{4})/i);
  if (mm) out.mes = mm[2] + "-" + String(MESES_ES[mm[1].toLowerCase()]).padStart(2, "0");
  let enDesc = false, fac = false, fin = false;
  rows.forEach((r) => {
    const cells = r.split(" | ").map((c) => c.trim());
    const montos = cells.filter((c) => RE_MONTO.test(c)).map((c) => parseFloat(c.replace(/,/g, "")));
    const up = r.toUpperCase();
    if (/NETO A (PAGAR|COBRAR)|L[IÍ]QUIDO A (PAGAR|COBRAR)|TOTAL NETO/.test(up) && montos.length) out.neto = montos[montos.length - 1];
    if (/TOTAL (PERCIBOS|INGRESOS|HABERES|REMUNERACIONES)\b/.test(up) && !/EMPLEADOR|MENOS/.test(up) && montos.length) out.percibos = montos[0];
    if (/APORTES DEL EMPLEADOR/.test(up)) fin = true;
    if (!enDesc && /D ?E ?S ?C ?U ?E ?N ?T ?O ?S|APORTACIONES DE LEY/.test(up)) enDesc = true;
    if (/DESCUENTOS FACULTATIVOS/.test(up)) fac = true;
    if (fin || !enDesc || !montos.length || !RE_MONTO.test(cells[cells.length - 1])) return;
    const letras = cells.filter((c) => /[A-ZÁÉÍÓÚÑ]{3,}/i.test(c) && !RE_MONTO.test(c));
    const concepto = letras.sort((a, b) => b.length - a.length)[0] || "";
    if (concepto.length < 5 || RE_NO_CONCEPTO.test(concepto)) return;
    out.descuentos.push({ concepto, monto: montos[montos.length - 1], tipo: fac ? (RE_DEUDA.test(concepto) ? "deuda" : "aporte") : "ley" });
  });
  out.aportes = out.descuentos.filter((d) => d.tipo === "ley").reduce((a, d) => a + d.monto, 0);
  out.descuentosFac = out.descuentos.filter((d) => d.tipo !== "ley").reduce((a, d) => a + d.monto, 0);
  return out;
}

let pdfListo = null;
function cargarPdfJs() {
  if (pdfListo) return pdfListo;
  pdfListo = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; ok(); };
    s.onerror = () => { pdfListo = null; mal(new Error("No pude cargar el lector de PDF. Revisa tu internet.")); };
    document.head.append(s);
  });
  return pdfListo;
}

async function leerPdf(archivo) {
  await cargarPdfJs();
  const pdf = await window.pdfjsLib.getDocument({ data: await archivo.arrayBuffer() }).promise;
  const rows = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const items = tc.items.map((i) => ({ x: i.transform[4], y: i.transform[5], s: i.str })).filter((i) => i.s.trim());
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = null;
    items.forEach((it) => { if (!cur || Math.abs(cur.y - it.y) > 2.5) { cur = { y: it.y, t: [] }; rows.push(cur); } cur.t.push(it); });
  }
  return rows.map((r) => r.t.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join(" | "));
}

function abrirBoleta() {
  const box = $("formBox"); box.replaceChildren();
  box.append(h("b", "", "📄 Subir tu boleta de pago"));
  const n = h("div", "sub", "Elige el PDF de tu boleta. Se lee aquí, en tu celular: el archivo no se envía a ningún lado. Solo se guardan los montos."); n.style.margin = "4px 0 8px"; box.append(n);
  const fi = document.createElement("input"); fi.type = "file"; fi.accept = "application/pdf"; box.append(fi);
  const zona = h("div"); box.append(zona);
  const err = h("div", "msg bad"); box.append(err);
  const bc = h("button", "s btn", "Cerrar"); bc.onclick = () => { cerrarForm(); abrirCfg(); };
  const row = h("div", "row"); row.append(bc); box.append(row);
  $("sheetForm").hidden = false;
  fi.onchange = async () => {
    const f = fi.files[0]; if (!f) return;
    err.textContent = ""; zona.replaceChildren(h("div", "sub", "Leyendo la boleta…"));
    try {
      const r = parseBoleta(await leerPdf(f));
      zona.replaceChildren(); mostrarVistaBoleta(zona, r, err);
    } catch (e) { zona.replaceChildren(); err.textContent = e.message || "No pude leer ese archivo."; }
  };
}

function mostrarVistaBoleta(zona, r, err) {
  const cuadra = r.neto > 0 && Math.abs(r.percibos - r.aportes - r.descuentosFac - r.neto) < 0.05;
  zona.append(h("div", "msg " + (cuadra ? "ok" : "bad"), cuadra ? "✔ Los números cuadran: percibido − descuentos = neto." : "⚠ Los números no cuadran del todo. Revisa los montos antes de guardar."));
  const campo = (lab, val, tipo) => { zona.append(h("label", "", lab)); const i = document.createElement("input"); i.type = tipo || "text"; if (tipo === "number") { i.step = "0.01"; i.inputMode = "decimal"; } i.value = val; zona.append(i); return i; };
  const mes = campo("Mes de la boleta (AAAA-MM)", r.mes || new Date().toISOString().slice(0, 7));
  const neto = campo("Neto a pagar (lo que te cae) (S/)", r.neto || "", "number");
  const perc = campo("Total percibido (S/)", r.percibos || "", "number");
  zona.append(h("label", "", "Descuentos. Marca cuáles son deudas, porque ya salen de tu planilla:"));
  const sels = [];
  r.descuentos.forEach((d) => {
    const line = h("div", "d-line"); const c = h("div", "c"); c.append(h("div", "", d.concepto), h("span", "sub", S2(d.monto)));
    const sel = document.createElement("select");
    [["ley", "De ley"], ["aporte", "Aporte / cuota"], ["deuda", "Deuda"]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.append(o); });
    sel.value = d.tipo; sels.push(sel); line.append(c, sel); zona.append(line);
  });
  const bg = h("button", "p btn", "Guardar boleta"); bg.style.marginTop = "12px";
  bg.onclick = async () => {
    err.textContent = ""; bg.disabled = true;
    try {
      const desc = r.descuentos.map((d, i) => ({ concepto: d.concepto, monto: d.monto, tipo: sels[i].value }));
      const res = await api("boleta_guardar", { mes: mes.value.trim(), neto: Number(neto.value), percibos: Number(perc.value || 0), aportes: desc.filter((d) => d.tipo === "ley").reduce((a, d) => a + d.monto, 0), descuentosTotal: desc.reduce((a, d) => a + d.monto, 0), descuentos: desc });
      D = res; pintar(); cerrarForm();
      say("Boleta guardada. Tu neto ahora es " + S2(res.config.sueldo_neto) + "." + (res.ajustes && res.ajustes.length ? " " + res.ajustes.join(" · ") : ""), "ok");
    } catch (e) { err.textContent = e.message; }
    bg.disabled = false;
  };
  zona.append(bg);
}

// ---------- ajustes, guía y asistente de inicio ----------

function abrirCfg() {
  const c = D.config;
  formModal({
    titulo: "⚙️ Ajustes",
    campos: [
      { k: "dinero_ciclo", label: "Plata que tienes para este ciclo (S/)", tipo: "number", valor: c.dinero_ciclo || "" },
      { k: "ahorro", label: "Ahorro que quieres apartar (S/)", tipo: "number", valor: c.ahorro || "" },
      { k: "fijos_total", label: "Gastos fijos que aún no pagaste este ciclo (S/)", tipo: "number", valor: c.fijos_total || "" },
      { k: "sueldo_neto", label: "Tu sueldo neto (lo que te cae) (S/)", tipo: "number", valor: c.sueldo_neto || "", ayuda: "Lo más fácil es subir tu boleta con el botón 📄." },
      { k: "aporte_comida", label: "Aporte de comida en casa al mes (S/)", tipo: "number", valor: c.aporte_comida || 0 },
      { k: "meta_fondo", label: "Meta de fondo de emergencia (S/)", tipo: "number", valor: c.meta_fondo || "" },
      { k: "umbral_grande", label: "Avisarme si un gasto supera (S/)", tipo: "number", valor: c.umbral_grande || "" },
      { k: "alertas", label: "Avisos por correo y Calendar", tipo: "select", opciones: [["1", "Activados"], ["0", "Apagados"]], valor: String(c.alertas) },
    ],
    extra: (box) => {
      const menu = h("div", "menu");
      [["📄 Subir boleta", abrirBoleta], ["💳 Deudas", abrirDeudas], ["💰 Ingresos extra", abrirIngresos], ["🧮 Bolsas", abrirBolsas], ["🏦 Bancos", () => abrirBancos(abrirCfg)], ["🧭 Guía de inicio", abrirWizard], ["📘 Para otra persona", abrirGuiaOtros], ["🎉 Ya me pagaron", abrirNuevoCiclo]].forEach(([t, f]) => {
        const b = h("button", "s", t); b.onclick = f; menu.append(b);
      });
      box.append(menu);
    },
    onGuardar: async (v) => {
      const n = (k) => Number(v[k] || 0);
      await guardarYCerrar("config_set", { valores: { dinero_ciclo: n("dinero_ciclo"), ahorro: n("ahorro"), fijos_total: n("fijos_total"), sueldo_neto: n("sueldo_neto"), aporte_comida: n("aporte_comida"), meta_fondo: n("meta_fondo"), umbral_grande: n("umbral_grande"), alertas: n("alertas") } }, "Ajustes guardados.");
    },
  });
}

function abrirNuevoCiclo() {
  formModal({
    titulo: "🎉 Ya me pagaron",
    nota: "Empieza un ciclo nuevo desde hoy. Escribe cuánta plata tienes ahora en total, sumando lo que te cayó y lo que te sobró.",
    campos: [{ k: "dinero", label: "Plata total que tienes hoy (S/)", tipo: "number", valor: D.config.sueldo_neto ? Math.round(D.finanzas.libreMensual) : "" , ayuda: "Sugerencia: tu libre mensual (" + S(D.finanzas.libreMensual) + ") más lo que te sobró." }],
    textoGuardar: "Empezar ciclo nuevo",
    onGuardar: async (v) => { if (v.dinero === "") throw new Error("Escribe cuánta plata tienes hoy."); await guardarYCerrar("nuevo_ciclo", { dinero: Number(v.dinero) }, "Listo, empezó tu ciclo nuevo."); },
  });
}

const TIPS = "Cómo piensa esta app: 1) cuenta por ciclo de sueldo, no por mes; 2) lo que no es seguro (un pago extra) no debe pagar deudas con fecha fija; 3) lo que se descuenta por planilla ya no sale de tu cuenta.";

function abrirWizard() {
  const c = (D && D.config) || {};
  const sino = [["1", "Sí"], ["0", "No"]];
  const act = (c.bancos || "interbank,bn,bcp").split(",");
  const paso5 = () => formModal({
    paso: "Paso 5 de 5", titulo: "Bancos que lee la app",
    nota: "Solo lee los avisos de consumo que te llegan al correo. Nunca pide claves del banco.",
    campos: [
      { k: "interbank", label: "Interbank", tipo: "select", opciones: sino, valor: act.includes("interbank") ? "1" : "0" },
      { k: "bn", label: "Banco de la Nación", tipo: "select", opciones: sino, valor: act.includes("bn") ? "1" : "0" },
      { k: "bcp", label: "BCP", tipo: "select", opciones: sino, valor: act.includes("bcp") ? "1" : "0" },
    ],
    textoGuardar: "Terminar",
    onGuardar: async (v) => {
      const lista = ["interbank", "bn", "bcp"].filter((k) => v[k] === "1").join(",") || "ninguno";
      await api("config_set", { valores: { bancos: lista, setup_hecho: 1 } });
      await cargar("scan"); cerrarForm(); say("Todo listo. Revisé tus correos.", "ok");
    },
    textoCerrar: "Después",
  });
  const paso4 = () => formModal({
    paso: "Paso 4 de 5", titulo: "Ingresos extra esperados",
    nota: "¿Esperas algún pago que no es fijo (trabajo extra, bono)? Anota el mínimo seguro. No cuentes con él para pagos con fecha fija.",
    extra: (box) => { const b = h("button", "s btn", "➕ Agregar un ingreso"); b.style.marginTop = "10px"; b.onclick = () => abrirIngreso(null, paso4); box.append(b); },
    textoGuardar: "Siguiente", onGuardar: async () => { paso5(); }, textoCerrar: "Después",
  });
  const paso3 = () => formModal({
    paso: "Paso 3 de 5", titulo: "Tus deudas",
    nota: "Agrega cada deuda con su saldo y cuota. Marca cuáles se descuentan por planilla y cuáles pagarás con un extra. Puedes dejarlo para después.",
    extra: (box) => {
      const b = h("button", "s btn", "➕ Agregar una deuda"); b.style.marginTop = "10px"; b.onclick = () => abrirDeuda(null, paso3);
      box.append(b, h("div", "sub", "Deudas cargadas: " + ((D.deudasTodas || []).length)));
    },
    textoGuardar: "Siguiente", onGuardar: async () => { paso4(); }, textoCerrar: "Después",
  });
  const paso2 = () => formModal({
    paso: "Paso 2 de 5", titulo: "Tu plata hoy",
    nota: "Cuenta solo lo que tienes ahora, sin lo que esperas que llegue.",
    campos: [
      { k: "dinero_ciclo", label: "Plata que tienes hoy (S/)", tipo: "number", valor: c.dinero_ciclo || "" },
      { k: "ahorro", label: "Ahorro que quieres apartar (S/)", tipo: "number", valor: c.ahorro || 0 },
      { k: "fijos_total", label: "Gastos fijos que debes pagar antes de tu sueldo (S/)", tipo: "number", valor: c.fijos_total || 0 },
    ],
    textoGuardar: "Siguiente",
    onGuardar: async (v) => {
      D = await api("config_set", { valores: { dinero_ciclo: Number(v.dinero_ciclo || 0), ahorro: Number(v.ahorro || 0), fijos_total: Number(v.fijos_total || 0), ultimo_pago: new Date(Date.now() + 86400000).toISOString().slice(0, 10) } });
      pintar(); paso3();
    },
    textoCerrar: "Después",
  });
  formModal({
    paso: "Paso 1 de 5", titulo: "Tu sueldo y tus fechas", nota: TIPS,
    campos: [
      { k: "sueldo_neto", label: "Sueldo neto, lo que te cae (S/)", tipo: "number", valor: c.sueldo_neto || "", ayuda: "O sube tu boleta con 📄 en Ajustes." },
      { k: "dia_pago_min", label: "Tu pago llega desde el día…", tipo: "number", valor: c.dia_pago_min || 17 },
      { k: "dia_pago_max", label: "…hasta el día", tipo: "number", valor: c.dia_pago_max || 21, ayuda: "La app usa el último día como fecha prudente." },
    ],
    textoGuardar: "Siguiente",
    onGuardar: async (v) => {
      D = await api("config_set", { valores: { sueldo_neto: Number(v.sueldo_neto || 0), dia_pago_min: Number(v.dia_pago_min), dia_pago_max: Number(v.dia_pago_max) } });
      pintar(); paso2();
    },
    textoCerrar: "Después",
  });
}

function abrirGuiaOtros() {
  const box = $("formBox"); box.replaceChildren();
  box.append(h("b", "", "📘 Para otra persona"));
  const L = [
    "Cada persona tiene su propio servidor privado en su cuenta de Google. Así nadie más ve tus movimientos, tu sueldo ni tus deudas.",
    "Pasos: 1) copiar el programa de Apps Script que te comparta quien armó la app; 2) ejecutar «instalar» y dar permisos; 3) poner tu código APP_TOKEN en las propiedades; 4) publicar como aplicación web («Cualquiera», ejecutar como «Yo») y copiar la dirección /exec.",
    "Luego abre esta misma página, pega tu dirección y tu código, y sigue el asistente de 5 pasos.",
    "La app solo lee avisos de consumo del correo. Nunca te pide la clave del banco ni mueve dinero.",
  ];
  L.forEach((t) => { const d = h("div", "consejo", t); box.append(d); });
  const row = h("div", "row"); const bc = h("button", "s btn", "Cerrar"); bc.onclick = () => { cerrarForm(); abrirCfg(); }; row.append(bc); box.append(row);
  $("sheetForm").hidden = false;
}

// ---------- pantalla principal ----------

function pintar() {
  const c = D.ciclo;
  $("ciclo").textContent = "Ciclo " + fecha(c.inicio) + " → " + fecha(c.ventana.hasta) + " · te pagan entre el " + parseInt(c.ventana.desde.slice(8), 10) + " y el " + parseInt(c.ventana.hasta.slice(8), 10);
  pintarBanner(); pintarEstado(c); pintarHoy(c); pintarIngresos(c); pintarPresu(); pintarLinea(c); pintarDonut(c); pintarConsejos(); pintarFinanzas(); pintarMovs();
}

function pintarBanner() {
  const b = $("banner"); b.replaceChildren();
  if (!D.pagoProbable) return;
  const card = h("div", "card banner");
  card.append(h("b", "", "🎉 Parece que ya te pagaron " + S2(D.pagoProbable.monto)));
  const bt = h("button", "p", "Empezar ciclo nuevo"); bt.style.cssText = "margin-top:10px;padding:11px 14px"; bt.onclick = abrirNuevoCiclo;
  card.append(h("div", "sub", "Pulsa para empezar un ciclo nuevo y decirme cuánta plata tienes."), bt);
  b.append(card);
}

function abrirRegistrarIngreso() {
  const c = (D && D.config) || {};
  formModal({
    titulo: "Registrar plata que recibí", nota: "Suma lo que te entró (un pago extra, un préstamo, un regalo) a tu plata de hoy.",
    campos: [
      { k: "monto", label: "Monto recibido (S/)", tipo: "number", valor: "" },
      { k: "nota", label: "¿De qué fue? (opcional)", valor: "", ph: "Ej.: me prestaron" },
    ],
    textoGuardar: "Sumar a mi plata",
    onGuardar: async (v) => {
      const m = Number(v.monto); if (!(m > 0)) throw new Error("Pon un monto mayor a 0");
      await guardarYCerrar("config_set", { valores: { dinero_ciclo: Math.round((Number(c.dinero_ciclo || 0) + m) * 100) / 100 } }, "Sumé " + S2(m) + " a tu plata de hoy.");
    },
  });
}

function pintarIngresos(c) {
  const el = $("ing"); el.replaceChildren();
  const f = D.finanzas || {}; const cfg = D.config || {};
  const card = h("div", "card"); card.append(h("h2", "", "💰 Ingresos"));
  const fila = (ic, t, s, m, fn) => { const r = h("div", "ing-row"); const tt = h("div", "t"); tt.append(h("b", "", t), h("span", "", s)); r.append(h("div", "ic", ic), tt, h("div", "m", m)); if (fn) r.onclick = fn; return r; };
  if (cfg.sueldo_neto > 0) card.append(fila("🏛️", "Mi sueldo", "llega entre el " + parseInt(c.ventana.desde.slice(8), 10) + " y el " + parseInt(c.ventana.hasta.slice(8), 10) + " · fijo", S(cfg.sueldo_neto), abrirBoleta));
  (f.ingresos || []).forEach((i) => card.append(fila("✨", i.nombre, (i.fecha ? "hacia el " + fecha(i.fecha) : "sin fecha") + " · no seguro", S(i.min) + (i.max > i.min ? "–" + S(i.max) : ""), () => abrirIngreso((D.finanzas.ingresos || []).find((x) => x.nombre === i.nombre) || i, null))));
  const tot = (cfg.sueldo_neto || 0) + (f.ingresos || []).reduce((a, i) => a + i.min, 0);
  card.append(h("div", "sub", "Total que esperas: " + S(tot) + " (sueldo + lo mínimo de los extras)."));
  const row = h("div", "row");
  const b1 = h("button", "s btn", "➕ Ingreso esperado"); b1.onclick = () => abrirIngreso(null, null);
  const b2 = h("button", "p btn", "💵 Ya recibí plata"); b2.onclick = abrirRegistrarIngreso;
  row.append(b1, b2); card.append(row);
  el.append(card);
}

function pintarEstado(c) {
  const el = $("estado"); el.replaceChildren();
  const card = h("div", "card estado " + (c.estado === "sin_config" ? "" : c.estado));
  const luz = h("div", "luz", { verde: "🟢", amarillo: "🟡", rojo: "🔴", sin_config: "⚙️" }[c.estado]);
  const t = h("div");
  if (c.estado === "sin_config") t.append(h("b", "", "Cuéntame cuánta plata tienes"), h("span", "", "Abre ⚙️ Ajustes y escribe tu plata de este ciclo para empezar."));
  else {
    const titulo = { verde: "Vas bien: te alcanza", amarillo: "Ojo: vas ajustado", rojo: "Cuidado: no te alcanzaría" }[c.estado];
    t.append(h("b", "", titulo), h("span", "", "A este ritmo gastarás " + S(c.proyeccion) + " de " + S(c.presupuesto) + " (" + Math.round(c.ratio * 100) + "%)."));
  }
  card.append(luz, t); el.append(card);
}

function pintarHoy(c) {
  const el = $("hoy"); el.replaceChildren();
  if (c.estado === "sin_config") return;
  const card = h("div", "card hoy");
  card.append(h("div", "lab", "Hoy puedes gastar"), h("div", "num", S(c.porDia)));
  card.append(h("div", "lab", c.atrasado ? "Tu pago ya pasó: cuando llegue, pulsa «Ya me pagaron»." : "para llegar bien al día de pago"));
  const mini = h("div", "mini");
  [[S(c.disponible), "te quedan"], [c.restan + (c.restan === 1 ? " día" : " días"), "para el pago"], [S(c.gastado), "gastado"]].forEach(([a, b]) => { const d = h("div"); d.append(h("b", "", a), h("span", "", b)); mini.append(d); });
  card.append(mini); el.append(card);
}

function pintarPresu() {
  const el = $("presu"); el.replaceChildren();
  const P = D.presupuesto; if (!P) return;
  const card = h("div", "card"); card.append(h("h2", "", "🧮 Cuánto gastar en cada cosa"));
  const tabs = h("div", "tabs");
  [["hoy", "Hasta el pago · " + S(P.baseHoy)], ["sueldo", "Con mi sueldo · " + S(P.baseSueldo)]].forEach(([k, t]) => {
    const b = h("button", vistaPresu === k ? "on" : "", t); b.onclick = () => { vistaPresu = k; pintarPresu(); }; tabs.append(b);
  });
  card.append(tabs);
  const lista = vistaPresu === "hoy" ? P.hoy : P.sueldo;
  card.append(h("div", "sub", vistaPresu === "hoy" ? "Lo que tienes hoy, repartido hasta que caiga tu sueldo (" + P.dias + (P.dias === 1 ? " día" : " días") + ")." : "Lo que te queda libre cada mes después de tus cuotas, repartido por bolsa."));
  lista.forEach((b) => {
    const row = h("div", "bolsa"); const r = h("div", "r");
    r.append(h("b", "", b.emoji + " " + b.nombre), h("span", "m" + (b.queda < 0 ? " neg" : ""), S(b.monto)));
    row.append(r);
    if (vistaPresu === "hoy") {
      const tr = h("div", "track"); tr.style.height = "8px";
      const g = h("div", "gasto"); g.style.width = Math.min(100, b.monto > 0 ? b.gastado / b.monto * 100 : (b.gastado > 0 ? 100 : 0)) + "%"; g.style.background = b.queda < 0 ? "var(--rojo)" : "var(--ac)"; tr.append(g);
      row.append(tr, h("div", "s", "gastado " + S(b.gastado) + " · " + (b.queda < 0 ? "te pasaste " + S(-b.queda) : "queda " + S(b.queda))));
    } else row.append(h("div", "s", b.pct + "% de lo libre"));
    row.onclick = () => { const full = P.bolsas.find((x) => x.nombre === b.nombre); if (full) abrirBolsa(full, () => {}); };
    card.append(row);
  });
  P.consejos.forEach((t) => card.append(h("div", "consejo", t)));
  const bb = h("button", "s btn", "Editar bolsas"); bb.style.marginTop = "10px"; bb.onclick = abrirBolsas; card.append(bb);
  el.append(card);
}

function pintarLinea(c) {
  const el = $("linea"); el.replaceChildren();
  if (c.estado === "sin_config") return;
  const card = h("div", "card"); card.append(h("h2", "", "Tu ciclo"));
  const total = c.total;
  const tr = h("div", "track");
  const ini = Math.max(0, dias(c.inicio, c.ventana.desde)) / total * 100;
  const win = h("div", "win"); win.style.left = Math.min(ini, 98) + "%"; win.style.right = "0";
  const fill = h("div", "fill"); fill.style.width = (c.pasados / total * 100) + "%";
  const m = h("div", "hoy-m"); m.style.left = "calc(" + (c.pasados / total * 100) + "% - 1px)";
  tr.append(win, fill, m);
  card.append(h("div", "sub", "Días: hoy es el día " + c.pasados + " de " + total + " (la franja rayada es tu ventana de pago)"), tr);
  const pct = Math.min(100, c.gastado / Math.max(1, c.presupuesto) * 100);
  const tr2 = h("div", "track"); const g = h("div", "gasto"); g.style.width = pct + "%";
  g.style.background = c.estado === "rojo" ? "var(--rojo)" : c.estado === "amarillo" ? "var(--amarillo)" : "var(--verde)"; tr2.append(g);
  card.append(h("div", "sub", "Plata gastada: " + Math.round(pct) + "% de " + S(c.presupuesto)), tr2);
  const l = h("div", "leyenda"); l.append(h("span", "", fecha(c.inicio)), h("span", "", "~" + fecha(c.fin)));
  card.append(l); el.append(card);
}

function pintarDonut(c) {
  const el = $("donut"); el.replaceChildren();
  const keys = Object.keys(c.porCategoria).sort((a, b) => c.porCategoria[b] - c.porCategoria[a]);
  const card = h("div", "card"); card.append(h("h2", "", "En qué se va tu plata"));
  if (!keys.length) { card.append(h("div", "sub", "Aún no hay gastos en este ciclo.")); el.append(card); return; }
  const tot = keys.reduce((a, k) => a + c.porCategoria[k], 0);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 42 42"); svg.setAttribute("class", "donut");
  let off = 0;
  keys.forEach((k) => {
    const p = c.porCategoria[k] / tot * 100;
    const ci = document.createElementNS(NS, "circle");
    ci.setAttribute("cx", 21); ci.setAttribute("cy", 21); ci.setAttribute("r", 15.9155); ci.setAttribute("fill", "none");
    ci.setAttribute("stroke", COL[k] || "#64748b"); ci.setAttribute("stroke-width", 6);
    ci.setAttribute("stroke-dasharray", p + " " + (100 - p)); ci.setAttribute("stroke-dashoffset", -off);
    svg.append(ci); off += p;
  });
  const wrap = h("div", "donut-wrap"); const list = h("div", "cats");
  keys.slice(0, 6).forEach((k) => {
    const row = h("div"); const dot = h("span", "dot"); dot.style.background = COL[k] || "#64748b";
    row.append(dot, h("span", "", (EMO[k] || "📌") + " " + (NOMBRE[k] || k)), h("span", "n", Math.round(c.porCategoria[k] / tot * 100) + "% · " + S(c.porCategoria[k])));
    list.append(row);
  });
  wrap.append(svg, list); card.append(wrap); el.append(card);
}

function pintarConsejos() {
  const el = $("consejos"); el.replaceChildren();
  const card = h("div", "card"); card.append(h("h2", "", "💡 Consejos para ti"));
  D.consejos.forEach((t) => card.append(h("div", "consejo", t)));
  el.append(card);
}

function pintarFinanzas() {
  const el = $("fin"); el.replaceChildren();
  const f = D.finanzas; if (!f) return;

  const mes = h("div", "card"); mes.append(h("h2", "", "📆 Tu mes en una mirada"));
  const mini = h("div", "mini");
  [[S(D.config.sueldo_neto), "sueldo"], [S(f.compromisos), "compromisos"], [S(f.libreMensual), "libre"]].forEach(([x, y]) => { const d = h("div"); d.append(h("b", "", x), h("span", "", y)); mini.append(d); });
  mes.append(mini, h("div", "sub", "Sueldo = el neto de tu boleta (ya sin lo que se descuenta por planilla). Compromisos = cuotas que salen de tu cuenta + comida en casa. Lo libre es lo único que puedes gastar."));
  if (D.boletas && D.boletas.length) mes.append(h("div", "sub", "Última boleta: " + mesTxt(D.boletas[0].mes) + " · neto " + S2(D.boletas[0].neto)));
  el.append(mes);

  if (f.plan.length) {
    const pl = h("div", "card"); pl.append(h("h2", "", "🎯 Plan para tu pago extra"));
    const tot = f.ingresos.reduce((a, i) => a + i.min, 0);
    pl.append(h("div", "sub", "Con " + S(tot) + " (lo mínimo que esperas), págalo en este orden:"));
    f.plan.forEach((p, i) => {
      const row = h("div", "consejo"); row.style.cssText = "display:flex;justify-content:space-between;gap:10px";
      row.append(h("span", "", (i + 1) + ". " + p.nombre), h("b", "", S(p.monto))); pl.append(row);
    });
    if (f.sobra > 0) pl.append(h("div", "consejo", "Te sobrarían " + S(f.sobra) + ": guárdalos como fondo de emergencia."));
    const bi = h("button", "s btn", "Editar ingresos extra"); bi.style.marginTop = "10px"; bi.onclick = abrirIngresos; pl.append(bi);
    el.append(pl);
  }

  const dd = h("div", "card"); dd.append(h("h2", "", "💳 Tus deudas"));
  const top = h("div", "hoy"); top.append(h("div", "lab", "Debes en total"), h("div", "num", S(f.total)));
  top.querySelector(".num").style.fontSize = "34px"; top.style.marginBottom = "8px";
  dd.append(top, h("div", "sub", "Toca una deuda para corregirla o anotar un pago."));
  f.deudas.forEach((d) => {
    const row = h("div", "mov");
    const t = h("div", "t"); t.append(h("b", "", d.nombre));
    const bar = h("div", "track"); bar.style.height = "8px";
    const fill = h("div", "fill"); fill.style.width = Math.min(100, d.saldo / Math.max(1, f.total) * 100 * 3) + "%"; bar.append(fill);
    t.append(h("span", "", (d.cuota ? S(d.cuota) + "/mes · " : "sin cuota fija · ") + (d.fin ? "termina " + mesTxt(d.fin) : "sin fecha") + (d.planilla ? " · se descuenta por planilla" : d.auto ? " · automático" : "")), bar);
    row.append(t, h("div", "m", S(d.saldo)));
    row.onclick = () => { const full = (D.deudasTodas || []).find((x) => x.nombre === d.nombre) || d; abrirDeuda(full, null); };
    dd.append(row);
  });
  const bd = h("button", "s btn", "➕ Agregar o ver todas las deudas"); bd.style.marginTop = "10px"; bd.onclick = abrirDeudas; dd.append(bd);
  el.append(dd);

  if (f.evolucion.length > 1) {
    const ev = h("div", "card"); ev.append(h("h2", "", "📈 Tu plata libre en el tiempo"));
    const max = Math.max(...f.evolucion.map((e) => e.libre), 1);
    f.evolucion.forEach((e) => {
      const row = h("div"); row.style.margin = "8px 0";
      const t2 = h("div", "leyenda"); t2.append(h("span", "", e.mes === "Hoy" ? "Hoy" : mesTxt(e.mes) + " · termina " + e.nombre), h("b", "", S(e.libre)));
      const bar = h("div", "track"); bar.style.height = "10px"; const fl = h("div", "fill"); fl.style.width = (e.libre / max * 100) + "%"; bar.append(fl);
      row.append(t2, bar); ev.append(row);
    });
    ev.append(h("div", "sub", "Cada deuda que termina te libera su cuota."));
    el.append(ev);
  }
}

function pintarMovs() {
  const el = $("movs"); el.replaceChildren();
  if (!D.movimientos.length) { el.append(h("div", "sub", "Todavía no hay movimientos. Los avisos de tus bancos llegan solos; para efectivo usa la barra de abajo.")); return; }
  D.movimientos.forEach((m) => {
    const row = h("div", "mov");
    row.append(h("div", "ico", m.tipo === "rechazo" ? "⛔" : m.tipo === "ingreso" ? "💰" : (EMO[m.categoria] || "📌")));
    const t = h("div", "t"); t.append(h("b", "", m.comercio));
    const s = h("span", "", fecha(m.fecha) + " " + m.hora + " · "); s.append(h("span", "chip", m.banco), h("span", "chip", m.tipo === "gasto" ? (NOMBRE[m.categoria] || m.categoria) : m.tipo));
    t.append(s);
    row.append(t, h("div", "m" + (m.tipo === "rechazo" ? " rech" : m.tipo === "ingreso" ? " ing" : ""), (m.tipo === "ingreso" ? "+" : "") + S2(m.monto)));
    row.onclick = () => abrirMov(m);
    el.append(row);
  });
}

let movActual = null;
function abrirMov(m) {
  movActual = m;
  $("smTitulo").textContent = m.comercio;
  $("smInfo").textContent = S2(m.monto) + " · " + m.banco + " · " + fecha(m.fecha) + " " + m.hora;
  const g = $("smCats"); g.replaceChildren();
  D.categorias.forEach((k) => {
    const b = h("button", "", (EMO[k] || "") + " " + (NOMBRE[k] || k));
    if (k === m.categoria) b.style.borderColor = "var(--ac)";
    b.onclick = async () => { $("sheetMov").hidden = true; await cargar("setcat", { id: m.id, categoria: k, aprender: $("smAprender").checked }); };
    g.append(b);
  });
  $("smAprender").checked = false;
  $("sheetMov").hidden = false;
}
$("smCerrar").onclick = () => { $("sheetMov").hidden = true; };
$("smBorrar").onclick = async () => { if (!movActual || !confirm("¿Borrar este movimiento?")) return; $("sheetMov").hidden = true; await cargar("delete", { id: movActual.id }); };

$("btnCfg").onclick = () => { if (D) abrirCfg(); };
$("btnBoleta").onclick = () => { if (D) abrirBoleta(); };
$("btnScan").onclick = async () => { say("Revisando tus correos…", "mut"); $("btnScan").disabled = true; try { await cargar("scan"); say("Correos revisados.", "ok"); } catch {} $("btnScan").disabled = false; };

$("formAdd").onsubmit = async (e) => {
  e.preventDefault();
  const t = $("texto").value.trim(); if (!t) return;
  $("btnAdd").disabled = true; say("Guardando…", "mut");
  try { D = await api("add", { texto: t }); $("texto").value = ""; pintar(); say("Agregado ✔", "ok"); } catch (err) { say(err.message, "bad"); }
  $("btnAdd").disabled = false;
};

$("saveCode").onclick = () => {
  const u = $("url").value.trim(), c = $("code").value.trim();
  if (!RE_URL.test(u)) { $("setupMsg").textContent = "La dirección debe empezar con https://script.google.com/macros/s/ y terminar en /exec."; return; }
  if (!c) { $("setupMsg").textContent = "Escribe tu código de acceso."; return; }
  $("setupMsg").textContent = ""; lsSet(K_URL, u); lsSet(K_CODE, c); $("code").value = ""; mostrar();
};
$("reset").onclick = (ev) => { ev.preventDefault(); lsSet(K_CODE, ""); lsSet(K_URL, ""); mostrar(); };

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
mostrar();
