const $ = (id) => document.getElementById(id);
const K_TOK = "finanzas_idtoken";
const ssGet = (k) => { try { return sessionStorage.getItem(k) || ""; } catch { return ""; } };
const ssSet = (k, v) => { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch {} };
const RE_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const getUrl = () => (window.SCRIPT_URL && RE_URL.test(window.SCRIPT_URL) ? window.SCRIPT_URL : "");
const CLIENT_ID = () => (window.GOOGLE_CLIENT_ID && window.GOOGLE_CLIENT_ID !== "PENDIENTE" ? window.GOOGLE_CLIENT_ID : "");

const EMO = { comida: "🍔", super: "🛒", transporte: "🚌", salud: "💊", suscripciones: "📺", ocio: "🎮", formd: "🧵", hogar: "🏠", transferencias: "📲", efectivo: "💵", otros: "📌" };
const COL = { comida: "#FFA62B", super: "#00E5A0", transporte: "#2D9CFF", salud: "#FF6B6B", suscripciones: "#8C6BFF", ocio: "#FF5FB5", formd: "#00D1E0", hogar: "#FF8A3D", transferencias: "#9DB4FF", efectivo: "#E6B8FF", otros: "#8FA3C8" };
const NOMBRE = { comida: "Comida", super: "Super", transporte: "Transporte", salud: "Salud", suscripciones: "Suscrip.", ocio: "Ocio", formd: "FORMD", hogar: "Hogar", transferencias: "Yape/Plin", efectivo: "Efectivo", otros: "Otros" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

let D = null, ME = null, TOK = "", TOK_EXP = 0, esperaToken = null, gisIniciado = false, vistaPresu = "hoy", wizardMostrado = false;

const mon = () => (D && D.config && D.config.moneda) || "S/";
const M = (t) => String(t).replace(/\(S\/\)/g, "(" + mon() + ")");
const S = (n) => mon() + " " + Math.round(n).toLocaleString("es-PE");
const S2 = (n) => mon() + " " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (s) => parseInt(s.slice(8, 10), 10) + " " + MES[parseInt(s.slice(5, 7), 10) - 1];
const mesTxt = (m) => (/^\d{4}-\d{2}/.test(m) ? MES[parseInt(m.slice(5, 7), 10) - 1] + " " + m.slice(0, 4) : m);
const dias = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
let sayT = null;
function say(text, cls = "") { const m = $("msg"); m.textContent = text; m.className = "msg " + cls; clearTimeout(sayT); if (text) sayT = setTimeout(() => { m.textContent = ""; }, cls === "bad" ? 7000 : 3500); }

// ---------- identidad (Google Identity Services) ----------

function jwt(t) {
  try {
    const b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
  } catch { return {}; }
}
const tokenValido = () => !!TOK && TOK_EXP - Date.now() > 60000;

function guardarToken(t) {
  TOK = t; TOK_EXP = (jwt(t).exp || 0) * 1000;
  ssSet(K_TOK, t);
}

function cargarGis() {
  return new Promise((ok, mal) => {
    if (window.google && window.google.accounts && window.google.accounts.id) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => ok(); s.onerror = () => mal(new Error("No pude cargar Google. Revisa tu internet."));
    document.head.append(s);
  });
}

function recibirToken(resp) {
  if (!resp || !resp.credential) return;
  guardarToken(resp.credential);
  if (esperaToken) { const r = esperaToken.res; esperaToken = null; r(true); } else entrar();
}

function iniciarGis() {
  if (gisIniciado) return;
  window.google.accounts.id.initialize({ client_id: CLIENT_ID(), callback: recibirToken, auto_select: true, cancel_on_tap_outside: false });
  gisIniciado = true;
}

// Pide un token nuevo en silencio. Devuelve true si llegó uno.
function renovarToken() {
  if (esperaToken) return esperaToken.p;
  let res; const p = new Promise((r) => { res = r; });
  esperaToken = { p, res };
  const fin = (ok) => { if (esperaToken && esperaToken.p === p) { esperaToken = null; res(ok); } };
  try {
    iniciarGis();
    window.google.accounts.id.prompt((n) => {
      if ((n.isNotDisplayed && n.isNotDisplayed()) || (n.isSkippedMoment && n.isSkippedMoment()) || (n.isDismissedMoment && n.isDismissedMoment() && n.getDismissedReason && n.getDismissedReason() !== "credential_returned")) fin(false);
    });
  } catch { fin(false); }
  setTimeout(() => fin(false), 10000);
  return p;
}

function pantalla(n) {
  ["login", "registro", "espera", "app"].forEach((k) => { $(k).hidden = k !== n; });
  $("barra").hidden = n !== "app"; $("nav").hidden = n !== "app";
  if (n !== "app") cerrarForm();
}

function mostrarLogin(msg, reintentar) {
  pantalla("login");
  $("loginMsg").textContent = msg || "";
  $("loginReintentar").hidden = !reintentar;
  const g = $("gbtn"); g.replaceChildren();
  if (CLIENT_ID() && window.google && window.google.accounts && window.google.accounts.id) {
    try {
      iniciarGis();
      window.google.accounts.id.renderButton(g, { theme: "filled_black", size: "large", text: "signin_with", shape: "pill", locale: "es", width: 260 });
    } catch (e) { $("loginMsg").textContent = "No pude mostrar el botón de Google."; }
  }
}

function cerrarSesion(msg) {
  TOK = ""; TOK_EXP = 0; D = null; ME = null; wizardMostrado = false; ssSet(K_TOK, "");
  try { window.google.accounts.id.disableAutoSelect(); } catch {}
  mostrarLogin(msg);
}

async function api(action, extra = {}, reintento = false) {
  if (!tokenValido() && !(await renovarToken())) { cerrarSesion("Tu sesión venció. Entra otra vez."); throw new Error("Tu sesión venció. Entra otra vez."); }
  // text/plain evita la consulta previa (CORS) que Apps Script no responde.
  const res = await fetch(getUrl(), {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ idToken: TOK, action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.auth === false) {
    TOK = ""; TOK_EXP = 0; ssSet(K_TOK, "");
    if (!reintento && (await renovarToken())) return api(action, extra, true);
    cerrarSesion("Tu sesión venció. Entra otra vez.");
    throw new Error("Tu sesión venció. Entra otra vez.");
  }
  if (!res.ok || data.error) { const e = new Error(data.error || "Error " + res.status); if (data.estado) e.estado = data.estado; throw e; }
  return data;
}

async function iniciar() {
  if (!getUrl()) return mostrarLogin("Falta la dirección del servidor en config.js (SCRIPT_URL).");
  if (!CLIENT_ID()) return mostrarLogin("Falta configurar el acceso con Google (GOOGLE_CLIENT_ID en config.js).");
  mostrarLogin("");
  try { await cargarGis(); iniciarGis(); } catch (e) { return mostrarLogin(e.message, true); }
  const t = ssGet(K_TOK);
  if (t) { guardarToken(t); if (tokenValido()) return entrar(); }
  mostrarLogin("");
  if (await renovarToken()) entrar();
}

async function entrar() {
  try { ME = await api("me"); rutear(ME); } catch (e) { if (!ME) mostrarLogin(e.message, false); }
}

function rutear(m) {
  ME = m;
  const p = jwt(TOK);
  $("quien").textContent = m.email || p.email || "";
  if (m.estado === "nuevo") {
    pantalla("registro");
    $("regEmail").value = p.email || ""; if (!$("regNombre").value) $("regNombre").value = p.name || "";
    $("regMsg").textContent = "";
  } else if (m.estado === "Pendiente" || m.estado === "Bloqueado") {
    pantalla("espera");
    const b = m.estado === "Bloqueado";
    $("esperaIco").textContent = b ? "⛔" : "⏳";
    $("esperaTit").textContent = b ? "Acceso denegado" : "Tu cuenta está en revisión";
    $("esperaTxt").textContent = b ? "El administrador no te dio acceso a esta app. Si crees que es un error, escríbele." : "Te avisaremos cuando esté lista. Vuelve a revisar en un rato.";
    $("esperaMsg").textContent = "";
  } else if (m.estado === "Aprobado") {
    pantalla("app"); aplicarRol(); cargar().catch(() => {});
  } else mostrarLogin("No pude saber el estado de tu cuenta.");
}

function aplicarRol() {
  const admin = !!(ME && ME.admin);
  $("btnScan").hidden = !admin;
  $("btnUsers").hidden = !admin;
}

$("regEnviar").onclick = async () => {
  const nombre = $("regNombre").value.trim(), cel = $("regCel").value.replace(/[\s()+-]/g, ""), edad = Number($("regEdad").value);
  const m = $("regMsg"); m.textContent = "";
  if (nombre.length < 2) return void (m.textContent = "Escribe tu nombre.");
  if (!/^\d{7,15}$/.test(cel)) return void (m.textContent = "Escribe un celular de 7 a 15 números.");
  if (!(edad >= 14 && edad <= 100)) return void (m.textContent = "La edad debe estar entre 14 y 100.");
  if (!$("regAcepto").checked) return void (m.textContent = "Marca la casilla para continuar.");
  $("regEnviar").disabled = true;
  try { rutear(await api("registrar", { nombre, celular: cel, edad, acepto: true })); } catch (e) { m.textContent = e.message; }
  $("regEnviar").disabled = false;
};
$("esperaRevisar").onclick = async () => {
  $("esperaRevisar").disabled = true;
  try { rutear(await api("me")); } catch (e) { $("esperaMsg").textContent = e.message; }
  $("esperaRevisar").disabled = false;
};
$("regSalir").onclick = $("esperaSalir").onclick = () => cerrarSesion("");
$("salir").onclick = (ev) => { ev.preventDefault(); cerrarSesion(""); };
$("loginReintentar").onclick = () => iniciar();

async function cargar(accion = "dashboard", extra = {}) {
  try {
    D = await api(accion, extra);
    pintar();
    if (ME && ME.admin && accion === "dashboard") contarPendientes();
    if (D.setup && !D.setup.hecho && !wizardMostrado) { wizardMostrado = true; abrirWizard(); }
    return D;
  } catch (e) {
    if (e.estado && e.estado !== "Aprobado") rutear({ ...(ME || {}), estado: e.estado });
    else say(e.message, "bad");
    throw e;
  }
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
    box.append(h("label", "", M(c.label)));
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
      await guardarYCerrar("deuda_guardar", { original: d ? d.nombre : undefined, nombre: v.nombre, saldo, cuota: Number(v.cuota || 0), pago: v.pago, auto: v.auto, fin: v.fin, prioridad: Number(v.prioridad || 0), tea: v.tea, nota: v.nota }, "Deuda guardada ✔");
      if (volver) volver();
    },
    onBorrar: d ? async () => { await guardarYCerrar("deuda_borrar", { nombre: d.nombre }, "Deuda borrada ✔"); if (volver) volver(); } : null,
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
  const campo = (lab, val, tipo) => { zona.append(h("label", "", M(lab))); const i = document.createElement("input"); i.type = tipo || "text"; if (tipo === "number") { i.step = "0.01"; i.inputMode = "decimal"; } i.value = val; zona.append(i); return i; };
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
      say("Boleta guardada ✔", "ok");
    } catch (e) { err.textContent = e.message; }
    bg.disabled = false;
  };
  zona.append(bg);
}

// ---------- ajustes, guía y asistente de inicio ----------

function abrirCfg() {
  const c = D.config; const admin = !!(ME && ME.admin);
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
      { k: "alertas", label: "Avisos por correo y Calendar", tipo: "select", opciones: [["1", "Activados"], ["0", "Apagados"]], valor: String(c.alertas), solo: "admin" },
    ].filter((x) => !x.solo || admin),
    extra: (box) => {
      const menu = h("div", "menu");
      [["👤 Mi perfil", abrirPerfil], ["🎯 Mis metas", abrirMetas], ["📄 Subir boleta", abrirBoleta], ["💳 Deudas", abrirDeudas], ["💰 Ingresos extra", abrirIngresos], ["🧮 Bolsas", abrirBolsas], admin && ["🏦 Bancos", () => abrirBancos(abrirCfg)], admin && ["👥 Usuarios", abrirUsuarios], ["🧭 Guía de inicio", abrirWizard], ["📘 Cómo funciona", abrirGuiaOtros], ["🎉 Ya me pagaron", abrirNuevoCiclo]].filter(Boolean).forEach(([t, f]) => {
        const b = h("button", "s", t); b.onclick = f; menu.append(b);
      });
      box.append(menu);
    },
    onGuardar: async (v) => {
      const n = (k) => Number(v[k] || 0);
      await guardarYCerrar("config_set", { valores: { dinero_ciclo: n("dinero_ciclo"), ahorro: n("ahorro"), fijos_total: n("fijos_total"), sueldo_neto: n("sueldo_neto"), aporte_comida: n("aporte_comida"), meta_fondo: n("meta_fondo"), umbral_grande: n("umbral_grande"), ...(admin ? { alertas: n("alertas") } : {}) } }, "Ajustes guardados ✔");
    },
  });
}

function abrirNuevoCiclo() {
  formModal({
    titulo: "🎉 Ya me pagaron",
    nota: "Empieza un ciclo nuevo desde hoy. Escribe cuánta plata tienes ahora en total, sumando lo que te cayó y lo que te sobró.",
    campos: [{ k: "dinero", label: "Plata total que tienes hoy (S/)", tipo: "number", valor: D.config.sueldo_neto ? Math.round(D.finanzas.libreMensual) : "" , ayuda: "Sugerencia: tu libre mensual (" + S(D.finanzas.libreMensual) + ") más lo que te sobró." }],
    textoGuardar: "Empezar ciclo nuevo",
    onGuardar: async (v) => { if (v.dinero === "") throw new Error("Escribe cuánta plata tienes hoy."); await guardarYCerrar("nuevo_ciclo", { dinero: Number(v.dinero) }, "¡Ciclo nuevo! 🎉"); },
  });
}

const TIPS = "Cómo piensa esta app: 1) cuenta por ciclo de sueldo, no por mes; 2) lo que no es seguro (un pago extra) no debe pagar deudas con fecha fija; 3) lo que se descuenta por planilla ya no sale de tu cuenta.";

function abrirWizard() {
  const c = (D && D.config) || {};
  const sino = [["1", "Sí"], ["0", "No"]];
  const act = (c.bancos || "interbank,bn,bcp").split(",");
  const admin = !!(ME && ME.admin); const N = admin ? 5 : 4;
  const terminar = async () => { await api("config_set", { valores: { setup_hecho: 1 } }); await cargar(admin ? "scan" : "dashboard"); cerrarForm(); say("¡Todo listo! 🎉", "ok"); };
  const paso5 = () => formModal({
    paso: "Paso 5 de " + N, titulo: "Bancos que lee la app",
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
      await cargar("scan"); cerrarForm(); say("¡Todo listo! 🎉", "ok");
    },
    textoCerrar: "Después",
  });
  const paso4 = () => formModal({
    paso: "Paso 4 de " + N, titulo: "Ingresos extra esperados",
    nota: "¿Esperas algún pago que no es fijo (trabajo extra, bono)? Anota el mínimo seguro. No cuentes con él para pagos con fecha fija.",
    extra: (box) => { const b = h("button", "s btn", "➕ Agregar un ingreso"); b.style.marginTop = "10px"; b.onclick = () => abrirIngreso(null, paso4); box.append(b); },
    textoGuardar: admin ? "Siguiente" : "Terminar", onGuardar: async () => { if (admin) paso5(); else await terminar(); }, textoCerrar: "Después",
  });
  const paso3 = () => formModal({
    paso: "Paso 3 de " + N, titulo: "Tus deudas",
    nota: "Agrega cada deuda con su saldo y cuota. Marca cuáles se descuentan por planilla y cuáles pagarás con un extra. Puedes dejarlo para después.",
    extra: (box) => {
      const b = h("button", "s btn", "➕ Agregar una deuda"); b.style.marginTop = "10px"; b.onclick = () => abrirDeuda(null, paso3);
      box.append(b, h("div", "sub", "Deudas cargadas: " + ((D.deudasTodas || []).length)));
    },
    textoGuardar: "Siguiente", onGuardar: async () => { paso4(); }, textoCerrar: "Después",
  });
  const paso2 = () => formModal({
    paso: "Paso 2 de " + N, titulo: "Tu plata hoy",
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
    paso: "Paso 1 de " + N, titulo: "Tu sueldo y tus fechas", nota: TIPS,
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
  box.append(h("b", "", "📘 Cómo funciona"));
  const L = [
    "Entras con tu cuenta de Google. Cada persona tiene su propio Sheet privado, creado solo para ella: nadie más ve tus movimientos, tu sueldo ni tus deudas.",
    "La primera vez te pedimos tus datos y el administrador aprueba tu cuenta. Después sigue el asistente de inicio (" + ((ME && ME.admin) ? "5" : "4") + " pasos).",
    "En «Mi perfil» eliges tu moneda, tus propias categorías y tus metas de ahorro.",
    "Los gastos los anotas en la barra de abajo («almuerzo 18»). La app nunca te pide la clave del banco ni mueve dinero.",
  ];
  L.forEach((t) => { const d = h("div", "consejo", t); box.append(d); });
  const row = h("div", "row"); const bc = h("button", "s btn", "Cerrar"); bc.onclick = () => { cerrarForm(); abrirCfg(); }; row.append(bc); box.append(row);
  $("sheetForm").hidden = false;
}

// ---------- perfil, metas y usuarios ----------

const MONEDAS = ["S/", "$", "€", "Bs"];

function abrirPerfil() {
  const mActual = mon(); const esOtra = !MONEDAS.includes(mActual);
  const p = (ME && ME.perfil) || {};
  formModal({
    titulo: "👤 Mi perfil",
    nota: ((p.nombre || (ME && ME.nombre) || "") + " · " + ((ME && ME.email) || "")).replace(/^ · /, ""),
    campos: [
      { k: "moneda", label: "Moneda", tipo: "select", opciones: MONEDAS.map((x) => [x, x]).concat([["otro", "Otra…"]]), valor: esOtra ? "otro" : mActual },
      { k: "otra", label: "Si elegiste «Otra», escríbela (máx. 5 letras)", valor: esOtra ? mActual : "", ph: "Ej.: COP" },
      { k: "categorias", label: "Mis categorías propias (separadas por coma, máx. 10)", valor: (D.config.categorias || ""), ph: "mascotas, gym", ayuda: "Aparecen junto a las demás al clasificar un gasto." },
    ],
    extra: (box) => {
      const b = h("button", "s btn", "🎯 Mis metas de ahorro"); b.style.marginTop = "10px"; b.onclick = abrirMetas; box.append(b);
    },
    onGuardar: async (v) => {
      const moneda = v.moneda === "otro" ? v.otra.trim() : v.moneda;
      if (!moneda || moneda.length > 5) throw new Error("Escribe una moneda de 1 a 5 letras.");
      const cats = v.categorias.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (cats.length > 10) throw new Error("Máximo 10 categorías.");
      if (cats.some((x) => !/^[a-z0-9áéíóúñü ]+$/i.test(x))) throw new Error("Las categorías solo pueden tener letras, números y espacios.");
      await api("perfil_guardar", { moneda, categorias: cats.join(",") });
      await cargar("dashboard"); cerrarForm(); say("Perfil guardado.", "ok");
    },
    onCerrar: abrirCfg,
  });
}

function abrirMeta(m, volver) {
  formModal({
    titulo: m ? m.nombre : "Nueva meta de ahorro",
    nota: "Pon cuánto quieres juntar y cuánto llevas. Actualiza «llevo» cada vez que apartes plata.",
    campos: [
      { k: "nombre", label: "¿Para qué ahorras?", valor: m ? m.nombre : "", ph: "Ej.: Viaje, laptop" },
      { k: "objetivo", label: "Cuánto quieres juntar (S/)", tipo: "number", valor: m ? m.objetivo : "" },
      { k: "ahorrado", label: "Cuánto llevas (S/)", tipo: "number", valor: m ? m.ahorrado : 0 },
      { k: "fecha", label: "Fecha meta (AAAA-MM-DD), opcional", valor: m ? m.fecha : "", ph: "2027-03-01" },
    ],
    onGuardar: async (v) => {
      if (v.nombre.trim().length < 2) throw new Error("Escribe un nombre para la meta.");
      if (!(Number(v.objetivo) > 0)) throw new Error("El objetivo debe ser mayor a 0.");
      await api("meta_guardar", { original: m ? m.nombre : undefined, nombre: v.nombre.trim(), objetivo: Number(v.objetivo), ahorrado: Number(v.ahorrado || 0), fecha: v.fecha.trim() });
      await cargar("dashboard"); cerrarForm(); say("Meta guardada.", "ok"); if (volver) volver();
    },
    onBorrar: m ? async () => { await api("meta_borrar", { nombre: m.nombre }); await cargar("dashboard"); cerrarForm(); say("Meta borrada.", "ok"); if (volver) volver(); } : null,
    nombreBorrar: m ? m.nombre : "",
    onCerrar: volver,
  });
}

function abrirMetas(v) {
  const back = typeof v === "function" ? v : v === null ? null : abrirCfg;
  listaModal("🎯 Mis metas de ahorro", "Toca una para actualizar cuánto llevas.",
    (D.metas || []).map((m) => ({ titulo: m.nombre, detalle: (m.fecha ? "para el " + fecha(m.fecha) + " · " : "") + Math.round(m.pct || 0) + "%", valor: S(m.ahorrado) + " / " + S(m.objetivo), onClick: () => abrirMeta(m, abrirMetas) })),
    "➕ Nueva meta", () => abrirMeta(null, abrirMetas), back);
}

function pintarUsuarios(box, usuarios, err) {
  box.replaceChildren();
  box.append(h("b", "", "👥 Usuarios"));
  const n = usuarios.filter((u) => u.estado === "Pendiente").length;
  box.append(h("div", "sub", n ? n + (n === 1 ? " solicitud pendiente." : " solicitudes pendientes.") : "No hay solicitudes pendientes."));
  usuarios.forEach((u) => {
    const row = h("div", "urow");
    const top = h("div", "r"); top.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:baseline";
    top.append(h("b", "", u.nombre || u.email), h("span", "chip est-" + u.estado, u.estado));
    row.append(top, h("div", "sub", u.email + (u.celular ? " · " + u.celular : "") + (u.edad ? " · " + u.edad + " años" : "")));
    if (u.email !== (ME && ME.email)) {
      const bt = h("div", "bt");
      [["Aprobado", "Aprobar"], ["Bloqueado", "Bloquear"], ["Pendiente", "Pendiente"]].filter(([e]) => e !== u.estado).forEach(([e, t]) => {
        const b = h("button", e === "Aprobado" ? "p btn" : "s btn", t);
        b.onclick = async () => {
          b.disabled = true; err.textContent = "";
          try { const r = await api("admin_estado", { email: u.email, estado: e }); pintarUsuarios(box, r.usuarios || [], err); actualizarBadge(r.usuarios || []); } catch (x) { err.textContent = x.message; b.disabled = false; }
        };
        bt.append(b);
      });
      row.append(bt);
    }
    box.append(row);
  });
  box.append(err);
  const r = h("div", "row"); const bc = h("button", "s btn", "Cerrar"); bc.onclick = cerrarForm; r.append(bc); box.append(r);
}

function actualizarBadge(us) { const n = us.filter((u) => u.estado === "Pendiente").length; $("badge").textContent = n; $("badge").hidden = !n; }

async function abrirUsuarios() {
  if (!ME || !ME.admin) return;
  const box = $("formBox"); box.replaceChildren(h("div", "sub", "Cargando…")); $("sheetForm").hidden = false;
  const err = h("div", "msg bad");
  try { const r = await api("admin_listar"); pintarUsuarios(box, r.usuarios || [], err); actualizarBadge(r.usuarios || []); } catch (e) { cerrarForm(); say(e.message, "bad"); }
}

// ---------- pantalla principal ----------

const NS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k])); if (parent) parent.append(e); return e; };
const BOLSA_COL = ["#00E5A0", "#2D9CFF", "#FFC83D", "#FF6B6B", "#8C6BFF", "#FF5FB5", "#00D1E0", "#FF8A3D"];
let vista = "inicio";
const vistaPorDefecto = "inicio";
const metasFestejadas = new Set();

function registrarCats() {
  const lista = String((D.config && D.config.categorias) || "").split(",").map((x) => x.trim()).filter(Boolean);
  lista.forEach((k) => {
    if (!EMO[k]) EMO[k] = "🏷️";
    if (!COL[k]) COL[k] = "#6FA8FF";
    if (!NOMBRE[k]) NOMBRE[k] = k.charAt(0).toUpperCase() + k.slice(1);
  });
}

async function contarPendientes() {
  const b = $("badge");
  if (!ME || !ME.admin) { b.hidden = true; return; }
  try {
    const r = await api("admin_listar");
    const n = (r.usuarios || []).filter((u) => u.estado === "Pendiente").length;
    b.textContent = n; b.hidden = !n;
  } catch { b.hidden = true; }
}

// ---- piezas visuales reutilizables ----

function info(titulo, texto) {
  $("infoTit").textContent = titulo;
  const b = $("infoTxt"); b.replaceChildren();
  (Array.isArray(texto) ? texto : [texto]).forEach((t) => b.append(h("p", "", t)));
  $("sheetInfo").hidden = false;
}
$("infoCerrar").onclick = () => { $("sheetInfo").hidden = true; };
$("sheetInfo").onclick = (e) => { if (e.target === $("sheetInfo")) $("sheetInfo").hidden = true; };

function ib(titulo, texto) {
  const b = h("button", "ib", "ⓘ"); b.type = "button"; b.setAttribute("aria-label", "Más información: " + titulo);
  b.onclick = (e) => { e.stopPropagation(); info(titulo, texto); };
  return b;
}

function cardHead(emoji, titulo, infoTexto, extra) {
  const hd = h("div", "ch"); hd.append(h("span", "ch-e", emoji), h("h2", "", titulo));
  if (extra) hd.append(extra);
  if (infoTexto) hd.append(ib(titulo, infoTexto));
  return hd;
}

function ring(pct, o) {
  o = o || {};
  const size = o.size || 120, sw = o.stroke || 10, r = 50 - sw / 2;
  const svg = sv("svg", { viewBox: "0 0 100 100", class: "ring " + (o.cls || ""), width: size, height: size, "aria-hidden": "true" });
  sv("circle", { cx: 50, cy: 50, r, fill: "none", stroke: "rgba(255,255,255,.12)", "stroke-width": sw }, svg);
  const p = Math.max(0, Math.min(100, pct));
  const c = sv("circle", { cx: 50, cy: 50, r, fill: "none", stroke: o.color || "var(--ac)", "stroke-width": sw, "stroke-linecap": "round", pathLength: 100, class: "pr" }, svg);
  c.style.strokeDasharray = p + " 100";
  return svg;
}

function bar(pct, color, alto) {
  const tr = h("div", "track"); if (alto) tr.style.height = alto + "px";
  const f = h("div", "fill"); f.style.width = Math.max(0, Math.min(100, pct)) + "%"; if (color) f.style.background = color;
  tr.append(f); return tr;
}

function confeti(host) {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cols = ["#FFC83D", "#00E5A0", "#2D9CFF", "#FF6B6B", "#FF5FB5"];
  for (let i = 0; i < 14; i++) {
    const s = h("i", "cf"); s.style.setProperty("--dx", Math.round((Math.random() - 0.5) * 140) + "px"); s.style.setProperty("--dy", Math.round(-40 - Math.random() * 70) + "px");
    s.style.background = cols[i % cols.length]; s.style.animationDelay = (i * 25) + "ms"; host.append(s);
    setTimeout(() => s.remove(), 1600);
  }
}

function irVista(v) {
  vista = v; $("app").dataset.v = v;
  document.querySelectorAll("#nav button[data-v]").forEach((b) => { const on = b.dataset.v === v; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  window.scrollTo(0, 0);
}
document.querySelectorAll("#nav button[data-v]").forEach((b) => { b.onclick = () => irVista(b.dataset.v); });

function pintar() {
  registrarCats();
  const c = D.ciclo;
  $("ciclo").textContent = "📅 " + fecha(c.inicio) + " → " + fecha(c.ventana.hasta);
  pintarBanner(); pintarEstado(c); pintarHoy(c); pintarIngresos(c); pintarMetas(); pintarPresu(); pintarLinea(c); pintarDonut(c); pintarConsejos(); pintarFinanzas(); pintarMovs();
  try { pintarStats(); } catch (e) { $("stats").replaceChildren(); }
}

function pintarBanner() {
  const b = $("banner"); b.replaceChildren();
  if (!D.pagoProbable) return;
  const card = h("div", "card banner");
  card.append(h("div", "ban-t", "🎉 ¡Te pagaron! " + S2(D.pagoProbable.monto)));
  const bt = h("button", "p btn", "🚀 Ciclo nuevo"); bt.onclick = abrirNuevoCiclo;
  card.append(bt); b.append(card);
}

function abrirRegistrarIngreso() {
  const c = (D && D.config) || {};
  formModal({
    titulo: "💵 Recibí plata", nota: "Suma lo que te entró (un pago extra, un préstamo, un regalo) a tu plata de hoy.",
    campos: [
      { k: "monto", label: "Monto recibido (S/)", tipo: "number", valor: "" },
      { k: "nota", label: "¿De qué fue? (opcional)", valor: "", ph: "Ej.: me prestaron" },
    ],
    textoGuardar: "Sumar a mi plata",
    onGuardar: async (v) => {
      const m = Number(v.monto); if (!(m > 0)) throw new Error("Pon un monto mayor a 0");
      await guardarYCerrar("config_set", { valores: { dinero_ciclo: Math.round((Number(c.dinero_ciclo || 0) + m) * 100) / 100 } }, "Sumado ✔");
    },
  });
}

function pintarIngresos(c) {
  const el = $("ing"); el.replaceChildren();
  const f = D.finanzas || {}; const cfg = D.config || {};
  const card = h("div", "card");
  card.append(cardHead("💰", "Ingresos", "Tu sueldo es fijo (🔒). Los ingresos extra no son seguros (🎲): la app cuenta solo el mínimo que esperas. Cuando llegue uno, usa «Recibí» para sumarlo a tu plata de hoy."));
  const ext = f.ingresos || [];
  const tot = Math.max(1, (cfg.sueldo_neto || 0) + ext.reduce((a, i) => a + i.min, 0));
  const fila = (ic, col, t, s, monto, pct, fn) => {
    const r = h("div", "irow"); const i = h("div", "bigico", ic); i.style.background = col + "30"; i.style.color = col;
    const tt = h("div", "t"); const top = h("div", "top"); top.append(h("b", "", t), h("span", "m", monto));
    tt.append(top, h("span", "s", s), bar(pct, col, 10)); r.append(i, tt); if (fn) r.onclick = fn; return r;
  };
  if (cfg.sueldo_neto > 0) card.append(fila("🏛️", "#00E5A0", "Sueldo", "🔒 " + parseInt(c.ventana.desde.slice(8), 10) + "–" + parseInt(c.ventana.hasta.slice(8), 10), S(cfg.sueldo_neto), cfg.sueldo_neto / tot * 100, abrirBoleta));
  ext.forEach((i) => card.append(fila("✨", "#2D9CFF", i.nombre, "🎲 " + (i.fecha ? fecha(i.fecha) : "sin fecha") + (i.max > i.min ? " · hasta " + S(i.max) : ""), S(i.min), i.min / tot * 100, () => abrirIngreso((D.finanzas.ingresos || []).find((x) => x.nombre === i.nombre) || i, null))));
  const tt = h("div", "total"); tt.append(h("span", "", "Esperas"), h("b", "", S(tot))); card.append(tt);
  const row = h("div", "row");
  const b1 = h("button", "s btn", "➕ Esperado"); b1.onclick = () => abrirIngreso(null, null);
  const b2 = h("button", "p btn", "💵 Recibí"); b2.onclick = abrirRegistrarIngreso;
  row.append(b1, b2); card.append(row);
  el.append(card);
}

function pintarMetas() {
  const el = $("metas"); el.replaceChildren();
  const ms = D.metas || [];
  const card = h("div", "card");
  card.append(cardHead("🎯", "Metas", "Cada anillo muestra cuánto llevas de tu meta. Toca una meta para actualizar cuánto llevas."));
  if (!ms.length) { const e = h("div", "vacio"); e.append(h("div", "vacio-e", "🎯"), h("div", "", "Crea tu primera meta")); card.append(e); }
  const grid = h("div", "metas-grid");
  ms.forEach((m) => {
    const pct = Math.max(0, Math.min(100, Number(m.pct !== undefined ? m.pct : (m.objetivo > 0 ? m.ahorrado / m.objetivo * 100 : 0))));
    const it = h("div", "meta"); const w = h("div", "mring");
    w.append(ring(pct, { size: 96, stroke: 11, color: "#FFC83D" }), h("div", "mpct", Math.round(pct) + "%"));
    if (pct >= 100) { w.classList.add("lograda"); w.append(h("span", "spark", "✨")); if (!metasFestejadas.has(m.nombre)) { metasFestejadas.add(m.nombre); setTimeout(() => confeti(w), 400); } }
    it.append(w, h("b", "mn", m.nombre), h("span", "ms", S(m.ahorrado) + " / " + S(m.objetivo)));
    it.onclick = () => abrirMeta(m, null); grid.append(it);
  });
  card.append(grid);
  const b = h("button", "s btn", "➕ Nueva meta"); b.onclick = () => abrirMeta(null, null); card.append(b);
  el.append(card);
}

const CARA = { verde: ["😄", "Vas bien"], amarillo: ["😐", "Vas ajustado"], rojo: ["😟", "Cuidado, no alcanza"] };

function pintarEstado(c) {
  const el = $("estado"); el.replaceChildren();
  if (c.estado !== "sin_config") return;
  const card = h("div", "card empty-cfg");
  card.append(h("div", "vacio-e", "⚙️"), h("b", "", "Cuenta tu plata"));
  const b = h("button", "p btn", "⚙️ Empezar"); b.onclick = abrirCfg; card.append(b); el.append(card);
}

function pintarHoy(c) {
  const el = $("hoy"); el.replaceChildren();
  if (c.estado === "sin_config") return;
  const card = h("div", "card hoy " + c.estado);
  const [cara, frase] = CARA[c.estado] || ["🙂", ""];
  const resto = Math.max(0, Math.min(100, (c.total - c.pasados) / Math.max(1, c.total) * 100));
  const wrap = h("div", "hoy-ring");
  wrap.append(ring(resto, { size: 240, stroke: 9, color: "#00E5A0", cls: "big" }));
  const mid = h("div", "hoy-mid"); mid.append(h("div", "lab", "Hoy puedes gastar"), h("div", "num", S(c.porDia)), h("div", "lab2", "⏳ " + c.restan + (c.restan === 1 ? " día" : " días")));
  wrap.append(mid, h("div", "cara", cara));
  const top = h("div", "hoy-top");
  top.append(h("span", "est-t", frase), ib("Tu estado", ["A este ritmo gastarás " + S(c.proyeccion) + " de " + S(c.presupuesto) + " (" + Math.round(c.ratio * 100) + "%).", "El anillo muestra cuánto falta del ciclo hasta tu pago. El número es lo que puedes gastar hoy sin pasarte."]));
  card.append(top, wrap);
  if (c.atrasado) { const b = h("button", "p btn", "🎉 Ya me pagaron"); b.onclick = abrirNuevoCiclo; card.append(b); }
  const mini = h("div", "mini");
  [["💼", S(c.disponible), "queda"], ["🧾", S(c.gastado), "gastado"], ["🗓️", c.restan + "d", "al pago"]].forEach(([i, a, b]) => { const d = h("div"); d.append(h("span", "mi", i), h("b", "", a), h("span", "ml", b)); mini.append(d); });
  card.append(mini); el.append(card);
}

function pintarPresu() {
  const el = $("presu"); el.replaceChildren();
  const P = D.presupuesto; if (!P) return;
  const card = h("div", "card");
  card.append(cardHead("🧮", "Bolsas", ["Cada bolsa es un tope para un tipo de gasto.", vistaPresu === "hoy" ? "Lo que tienes hoy, repartido hasta que caiga tu sueldo (" + P.dias + (P.dias === 1 ? " día" : " días") + ")." : "Lo que te queda libre cada mes después de tus cuotas, repartido por bolsa."]));
  const tabs = h("div", "tabs");
  [["hoy", "📅 Hasta el pago"], ["sueldo", "💼 Con sueldo"]].forEach(([k, t]) => {
    const b = h("button", vistaPresu === k ? "on" : "", t); b.onclick = () => { vistaPresu = k; pintarPresu(); }; tabs.append(b);
  });
  card.append(tabs);
  const lista = vistaPresu === "hoy" ? P.hoy : P.sueldo;
  const grid = h("div", "bolsas");
  lista.forEach((b, i) => {
    const col = BOLSA_COL[i % BOLSA_COL.length];
    const row = h("div", "bolsa"); const ico = h("div", "bigico", b.emoji || "💠"); ico.style.background = col + "30";
    const t = h("div", "t"); const top = h("div", "top"); top.append(h("b", "", b.nombre));
    if (vistaPresu === "hoy") {
      const neg = b.queda < 0;
      top.append(h("span", "m" + (neg ? " neg" : ""), (neg ? "⚠️ -" + S(-b.queda) : "queda " + S(b.queda))));
      t.append(top, bar(b.monto > 0 ? b.gastado / b.monto * 100 : (b.gastado > 0 ? 100 : 0), neg ? "#FF6B6B" : col, 14));
    } else { top.append(h("span", "m", S(b.monto))); t.append(top, bar(b.pct, col, 14)); }
    row.append(ico, t);
    row.onclick = () => { const full = P.bolsas.find((x) => x.nombre === b.nombre); if (full) abrirBolsa(full, () => {}); };
    grid.append(row);
  });
  card.append(grid);
  const bb = h("button", "s btn", "✏️ Editar bolsas"); bb.onclick = abrirBolsas; card.append(bb);
  el.append(card);
}

function pintarLinea(c) {
  const el = $("linea"); el.replaceChildren();
  if (c.estado === "sin_config") return;
  const card = h("div", "card");
  card.append(cardHead("📅", "Tu ciclo", "La barra de arriba son los días: hoy es el día " + c.pasados + " de " + c.total + ", y la franja rayada es tu ventana de pago. La de abajo es la plata gastada del presupuesto."));
  const total = c.total;
  const tr = h("div", "track gruesa");
  const ini = Math.max(0, dias(c.inicio, c.ventana.desde)) / total * 100;
  const win = h("div", "win"); win.style.left = Math.min(ini, 98) + "%"; win.style.right = "0";
  const fill = h("div", "fill"); fill.style.width = (c.pasados / total * 100) + "%";
  const m = h("div", "hoy-m"); m.style.left = "calc(" + (c.pasados / total * 100) + "% - 1px)";
  tr.append(win, fill, m);
  const l = h("div", "leyenda"); l.append(h("span", "", fecha(c.inicio)), h("b", "", "Día " + c.pasados + "/" + total), h("span", "", "~" + fecha(c.fin)));
  card.append(tr, l);
  const pct = Math.min(100, c.gastado / Math.max(1, c.presupuesto) * 100);
  const col = c.estado === "rojo" ? "#FF6B6B" : c.estado === "amarillo" ? "#FFC83D" : "#00E5A0";
  const tr2 = bar(pct, col, 16); tr2.classList.add("gruesa");
  const l2 = h("div", "leyenda"); l2.append(h("span", "", "🧾 " + Math.round(pct) + "%"), h("span", "", S(c.presupuesto)));
  card.append(tr2, l2); el.append(card);
}

function pintarDonut(c) {
  const el = $("donut"); el.replaceChildren();
  const keys = Object.keys(c.porCategoria).sort((a, b) => c.porCategoria[b] - c.porCategoria[a]);
  const card = h("div", "card"); card.append(cardHead("🍩", "Tus gastos", "Muestra en qué categorías se fue tu plata en este ciclo."));
  if (!keys.length) { const e = h("div", "vacio"); e.append(h("div", "vacio-e", "🍩"), h("div", "", "Aún no hay gastos")); card.append(e); el.append(card); return; }
  const tot = keys.reduce((a, k) => a + c.porCategoria[k], 0);
  card.append(donutSvg(keys.map((k) => [k, c.porCategoria[k]]), tot, 200));
  const list = h("div", "cats");
  keys.slice(0, 6).forEach((k) => {
    const row = h("div", "cat"); const ico = h("span", "cico", EMO[k] || "📌"); ico.style.background = (COL[k] || "#6FA8FF") + "33"; ico.style.boxShadow = "inset 0 0 0 2px " + (COL[k] || "#6FA8FF");
    row.append(ico, h("span", "cn", NOMBRE[k] || k), h("b", "cp", Math.round(c.porCategoria[k] / tot * 100) + "%"), h("span", "cm", S(c.porCategoria[k])));
    list.append(row);
  });
  card.append(list); el.append(card);
}

function donutSvg(pares, tot, size, centro) {
  const wrap = h("div", "donut-box"); wrap.style.width = size + "px"; wrap.style.height = size + "px";
  const svg = sv("svg", { viewBox: "0 0 42 42", class: "donut", width: size, height: size, "aria-hidden": "true" });
  let off = 0;
  pares.forEach(([k, v]) => {
    const p = v / tot * 100;
    const ci = sv("circle", { cx: 21, cy: 21, r: 15.9155, fill: "none", stroke: COL[k] || "#6FA8FF", "stroke-width": 6, "stroke-dasharray": Math.max(0, p - 0.6) + " " + (100 - Math.max(0, p - 0.6)), "stroke-dashoffset": -off }, svg);
    ci.style.animationDelay = (off * 8) + "ms"; off += p;
  });
  wrap.append(svg);
  const mid = h("div", "donut-mid"); mid.append(h("span", "", centro || "Total"), h("b", "", S(tot))); wrap.append(mid);
  return wrap;
}

function emojiConsejo(t) {
  const s = t.toLowerCase();
  if (/deud|debes|cuota/.test(s)) return "💳"; if (/ahorr|fondo|guard/.test(s)) return "🐷"; if (/comid|almuerz|comer|delivery/.test(s)) return "🍔";
  if (/sueldo|pago|cobr/.test(s)) return "💼"; if (/meta/.test(s)) return "🎯"; if (/gast|compr|superas/.test(s)) return "🛒"; if (/transp|taxi/.test(s)) return "🚌";
  return "💡";
}
function cortoConsejo(t) {
  const p = String(t).split(/[.;:!?]\s/)[0].replace(/[.]$/, "").split(/\s+/);
  return p.length > 10 ? p.slice(0, 10).join(" ") + "…" : p.join(" ");
}

let consejosTodos = false;
function pintarConsejos() {
  const el = $("consejos"); el.replaceChildren();
  const lista = (D.consejos || []).concat((D.presupuesto && D.presupuesto.consejos) || []).filter(Boolean);
  if (!lista.length) return;
  const card = h("div", "card"); card.append(cardHead("💡", "Consejos"));
  const ver = consejosTodos ? lista : lista.slice(0, 3);
  ver.forEach((t) => {
    const chip = h("button", "tip"); chip.type = "button"; chip.append(h("span", "tip-e", emojiConsejo(t)), h("span", "tip-t", cortoConsejo(t)));
    chip.onclick = () => info("💡 Consejo", t); card.append(chip);
  });
  if (lista.length > 3) { const b = h("button", "s btn vermas", consejosTodos ? "Ver menos ▴" : "Ver más (" + (lista.length - 3) + ") ▾"); b.onclick = () => { consejosTodos = !consejosTodos; pintarConsejos(); }; card.append(b); }
  el.append(card);
}

function pintarFinanzas() {
  ["fin_mes", "fin_plan", "fin_deu", "fin_ev"].forEach((id) => $(id).replaceChildren());
  const f = D.finanzas; if (!f) return;

  const mes = h("div", "card");
  mes.append(cardHead("📆", "Tu mes", "Sueldo = el neto de tu boleta (ya sin lo que se descuenta por planilla). Compromisos = cuotas que salen de tu cuenta + comida en casa. Lo libre es lo único que puedes gastar." + (D.boletas && D.boletas.length ? " Última boleta: " + mesTxt(D.boletas[0].mes) + " · neto " + S2(D.boletas[0].neto) + "." : "")));
  const mini = h("div", "mini");
  [["🏛️", S(D.config.sueldo_neto), "sueldo"], ["🔗", S(f.compromisos), "fijos"], ["🆓", S(f.libreMensual), "libre"]].forEach(([i, x, y]) => { const d = h("div"); d.append(h("span", "mi", i), h("b", "", x), h("span", "ml", y)); mini.append(d); });
  mes.append(mini); $("fin_mes").append(mes);

  if (f.plan.length) {
    const pl = h("div", "card"); const tot = f.ingresos.reduce((a, i) => a + i.min, 0);
    pl.append(cardHead("🧭", "Plan extra", "Con " + S(tot) + " (lo mínimo que esperas), págalo en este orden. Cada deuda que termina te libera su cuota."));
    f.plan.forEach((p, i) => {
      const row = h("div", "step"); row.append(h("span", "num-c", String(i + 1)), h("span", "sn", p.nombre), h("b", "", S(p.monto))); pl.append(row);
    });
    if (f.sobra > 0) { const r = h("div", "step"); r.append(h("span", "num-c", "🐷"), h("span", "sn", "Sobra (fondo)"), h("b", "", S(f.sobra))); pl.append(r); }
    const bi = h("button", "s btn", "✏️ Ingresos extra"); bi.onclick = abrirIngresos; pl.append(bi);
    $("fin_plan").append(pl);
  }

  const dd = h("div", "card");
  dd.append(cardHead("💳", "Deudas", "Toca una deuda para corregirla o anotar un pago."));
  const top = h("div", "debe"); top.append(h("span", "", "Debes"), h("b", "", S(f.total))); dd.append(top);
  f.deudas.forEach((d, i) => {
    const col = BOLSA_COL[(i + 3) % BOLSA_COL.length];
    const row = h("div", "irow"); const ic = h("div", "bigico", d.planilla ? "🏢" : "💳"); ic.style.background = col + "30";
    const t = h("div", "t"); const tp = h("div", "top"); tp.append(h("b", "", d.nombre), h("span", "m", S(d.saldo)));
    t.append(tp, h("span", "s", (d.cuota ? S(d.cuota) + "/mes" : "sin cuota") + (d.fin ? " · 🏁 " + mesTxt(d.fin) : "")), bar(Math.min(100, d.saldo / Math.max(1, f.total) * 100 * 3), col, 10));
    row.append(ic, t);
    row.onclick = () => { const full = (D.deudasTodas || []).find((x) => x.nombre === d.nombre) || d; abrirDeuda(full, null); };
    dd.append(row);
  });
  const bd = h("button", "s btn", "➕ Deudas"); bd.onclick = abrirDeudas; dd.append(bd);
  $("fin_deu").append(dd);

  if (f.evolucion.length > 1) {
    const ev = h("div", "card"); ev.append(cardHead("📈", "Libre a futuro", "Cada deuda que termina te libera su cuota, y tu plata libre sube."));
    const max = Math.max(...f.evolucion.map((e) => e.libre), 1);
    f.evolucion.forEach((e) => {
      const row = h("div", "evrow"); const t2 = h("div", "leyenda"); t2.append(h("span", "", e.mes === "Hoy" ? "Hoy" : mesTxt(e.mes)), h("b", "", S(e.libre)));
      row.append(t2, bar(e.libre / max * 100, "#2D9CFF", 12)); ev.append(row);
    });
    $("fin_ev").append(ev);
  }
}

function pintarMovs() {
  const el = $("movs"); el.replaceChildren();
  if (!D.movimientos.length) { const e = h("div", "vacio"); e.append(h("div", "vacio-e", "🧾"), h("div", "", "Aún no hay movimientos")); el.append(e); return; }
  D.movimientos.forEach((m) => {
    const row = h("div", "mov");
    const rech = m.tipo === "rechazo", ing = m.tipo === "ingreso";
    const col = rech ? "#FF6B6B" : ing ? "#00E5A0" : (COL[m.categoria] || "#6FA8FF");
    const ic = h("div", "ico", rech ? "⛔" : ing ? "💰" : (EMO[m.categoria] || "📌")); ic.style.background = col + "33"; ic.style.boxShadow = "inset 0 0 0 2px " + col;
    const t = h("div", "t"); t.append(h("b", "", m.comercio), h("span", "", fecha(m.fecha) + " · " + m.hora));
    row.append(ic, t, h("div", "m" + (rech ? " rech" : ing ? " ing" : ""), (ing ? "▲ +" : rech ? "✖ " : "▼ −") + S2(m.monto)));
    row.onclick = () => abrirMov(m);
    el.append(row);
  });
}

// ---------- estadísticas ----------

const MES_C = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function pintarStats() {
  const el = $("stats"); el.replaceChildren();
  const E = D.estadisticas || {};
  const meses = (E.meses || []).slice(-6), dh = (E.deudaHistorial || []).slice(-12), cm = (E.categoriasMes || []).filter((x) => x.monto > 0);

  // 1. puntaje
  const sc = h("div", "card stat-score");
  sc.append(cardHead("📈", "Tu salud", E.mensaje ? [E.mensaje, "El puntaje va de 0 a 100: sube si gastas menos de lo que ganas y bajan tus deudas."] : "El puntaje va de 0 a 100: sube si gastas menos de lo que ganas y bajan tus deudas."));
  if (typeof E.puntaje !== "number") { const e = h("div", "vacio"); e.append(h("div", "vacio-e", "📊"), h("div", "", "Aún faltan datos")); sc.append(e); }
  else {
    const p = Math.max(0, Math.min(100, E.puntaje)); const col = p >= 70 ? "#00E5A0" : p >= 40 ? "#FFC83D" : "#FF6B6B";
    const flecha = { mejora: ["↗", "#00E5A0", "Mejorando"], igual: ["→", "#FFC83D", "Estable"], empeora: ["↘", "#FF6B6B", "Empeorando"] }[E.tendencia] || ["→", "#B8C7E6", "Estable"];
    const w = h("div", "hoy-ring score"); w.append(ring(p, { size: 200, stroke: 12, color: col }));
    const mid = h("div", "hoy-mid"); mid.append(h("div", "num", String(Math.round(p))), h("div", "lab", "de 100")); w.append(mid);
    const tr = h("div", "trend"); tr.style.color = flecha[1]; tr.style.borderColor = flecha[1]; tr.append(h("span", "ta", flecha[0]), h("b", "", flecha[2]));
    sc.append(w, tr);
    if (E.mensaje) sc.append(h("div", "stat-msg", cortoConsejo(E.mensaje)));
  }
  el.append(sc);

  // 2. barras ingreso vs gasto
  const bc = h("div", "card");
  bc.append(cardHead("📊", "Ganas vs gastas", "Barras azules: lo que ganaste cada mes. Barras coral: lo que gastaste."));
  if (meses.length < 2) { const e = h("div", "vacio"); e.append(h("div", "vacio-e", "📊"), h("div", "", "Aún faltan meses")); bc.append(e); }
  else {
    const W = 340, Hh = 190, pad = 22, max = Math.max(1, ...meses.map((m) => Math.max(m.ingreso || 0, m.gasto || 0)));
    const svg = sv("svg", { viewBox: "0 0 " + W + " " + Hh, class: "chart", role: "img", "aria-label": "Ingreso y gasto por mes" });
    const gw = (W - pad) / meses.length, bw = Math.min(22, gw / 2 - 4);
    [0.5, 1].forEach((f) => sv("line", { x1: pad, x2: W, y1: Hh - 26 - (Hh - 50) * f, y2: Hh - 26 - (Hh - 50) * f, stroke: "rgba(255,255,255,.1)", "stroke-dasharray": "3 4" }, svg));
    meses.forEach((m, i) => {
      const x0 = pad + gw * i + gw / 2;
      [[m.ingreso || 0, "#2D9CFF", -bw - 1], [m.gasto || 0, "#FF6B6B", 1]].forEach(([v, col, dx], k) => {
        const hh = Math.max(2, (Hh - 50) * v / max);
        const r = sv("rect", { x: x0 + dx, y: Hh - 26 - hh, width: bw, height: hh, rx: 5, fill: col, class: "bgrow" }, svg); r.style.animationDelay = (i * 60 + k * 30) + "ms";
      });
      const lab = sv("text", { x: x0, y: Hh - 8, "text-anchor": "middle", class: "ax" }, svg); lab.textContent = MES_C[parseInt(String(m.mes).slice(5, 7), 10) - 1] || "";
    });
    bc.append(svg);
    const lg = h("div", "legend"); lg.append(h("span", "lg b", "📥 Ganas"), h("span", "lg c", "📤 Gastas")); bc.append(lg);
  }
  el.append(bc);

  // 3. deuda
  const dc = h("div", "card");
  dc.append(cardHead("💳", "Tu deuda", "Línea de cuánto debes en total a lo largo del tiempo. Si baja, vas bien."));
  if (dh.length < 2) { const e = h("div", "vacio"); e.append(h("div", "vacio-e", "💳"), h("div", "", "Aún faltan datos")); dc.append(e); }
  else {
    const W = 340, Hh = 170, pad = 14, vals = dh.map((d) => d.total), mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
    const X = (i) => pad + (W - 2 * pad) * i / (dh.length - 1), Y = (v) => 18 + (Hh - 46) * (1 - (v - mn) / Math.max(1, mx - mn));
    const svg = sv("svg", { viewBox: "0 0 " + W + " " + Hh, class: "chart", role: "img", "aria-label": "Deuda total en el tiempo" });
    const defs = sv("defs", {}, svg); const g = sv("linearGradient", { id: "gd", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    sv("stop", { offset: "0", "stop-color": "#FF6B6B", "stop-opacity": ".45" }, g); sv("stop", { offset: "1", "stop-color": "#FF6B6B", "stop-opacity": "0" }, g);
    const pts = dh.map((d, i) => X(i) + "," + Y(d.total));
    sv("polygon", { points: pad + "," + (Hh - 26) + " " + pts.join(" ") + " " + (W - pad) + "," + (Hh - 26), fill: "url(#gd)" }, svg);
    sv("polyline", { points: pts.join(" "), fill: "none", stroke: "#FF6B6B", "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round", class: "line" }, svg);
    dh.forEach((d, i) => sv("circle", { cx: X(i), cy: Y(d.total), r: i === dh.length - 1 ? 6 : 3.5, fill: "#fff", stroke: "#FF6B6B", "stroke-width": 2.5 }, svg));
    const l1 = sv("text", { x: pad, y: Hh - 6, class: "ax" }, svg); l1.textContent = fecha(dh[0].fecha);
    const l2 = sv("text", { x: W - pad, y: Hh - 6, "text-anchor": "end", class: "ax" }, svg); l2.textContent = fecha(dh[dh.length - 1].fecha);
    dc.append(svg);
    const dif = dh[dh.length - 1].total - dh[0].total; const dl = h("div", "debe");
    dl.append(h("span", "", dif <= 0 ? "▼ Bajó" : "▲ Subió"), h("b", dif <= 0 ? "ok" : "neg", S(Math.abs(dif)))); dc.append(dl);
  }
  el.append(dc);

  // 4. categorías del mes
  const cc = h("div", "card");
  cc.append(cardHead("🍩", "Este mes", "En qué categorías gastaste este mes."));
  if (cm.length < 1) { const e = h("div", "vacio"); e.append(h("div", "vacio-e", "🍩"), h("div", "", "Aún no hay gastos")); cc.append(e); }
  else {
    const ord = cm.slice().sort((a, b) => b.monto - a.monto); const tot = ord.reduce((a, x) => a + x.monto, 0);
    cc.append(donutSvg(ord.map((x) => [x.categoria, x.monto]), tot, 160, "Mes"));
    const lg = h("div", "chips");
    ord.slice(0, 6).forEach((x) => { const c = h("span", "chp", (EMO[x.categoria] || "📌") + " " + Math.round(x.monto / tot * 100) + "%"); c.style.borderColor = COL[x.categoria] || "#6FA8FF"; lg.append(c); });
    cc.append(lg);
  }
  el.append(cc);
}

let movActual = null;
function abrirMov(m) {
  movActual = m;
  $("smTitulo").textContent = m.comercio;
  $("smInfo").textContent = S2(m.monto) + " · " + m.banco + " · " + fecha(m.fecha) + " " + m.hora;
  const g = $("smCats"); g.replaceChildren();
  const propias = String((D.config && D.config.categorias) || "").split(",").map((x) => x.trim()).filter(Boolean);
  D.categorias.concat(propias.filter((x) => !D.categorias.includes(x))).forEach((k) => {
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
$("navCfg").onclick = () => { if (D) abrirCfg(); };
$("btnBoleta").onclick = () => { if (D) abrirBoleta(); };
$("btnIng").onclick = () => { if (D) abrirRegistrarIngreso(); };
$("btnMetas").onclick = () => { if (D) abrirMetas(null); };
$("btnStats").onclick = () => irVista("stats");
$("btnGasto").onclick = () => { $("texto").focus(); };
$("btnScan").onclick = async () => { say("Revisando correos…", "mut"); $("btnScan").disabled = true; try { await cargar("scan"); say("Correos revisados ✔", "ok"); } catch {} $("btnScan").disabled = false; };

$("formAdd").onsubmit = async (e) => {
  e.preventDefault();
  const t = $("texto").value.trim(); if (!t) return;
  $("btnAdd").disabled = true; say("Guardando…", "mut");
  try { D = await api("add", { texto: t }); $("texto").value = ""; pintar(); say("Agregado ✔", "ok"); } catch (err) { say(err.message, "bad"); }
  $("btnAdd").disabled = false;
};

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
$("btnUsers").onclick = () => abrirUsuarios();
irVista(vistaPorDefecto);
iniciar();
