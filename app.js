const $ = (id) => document.getElementById(id);
const K_TOK = "finanzas_idtoken", K_TEMA = "qullqi_tema", K_SES = "qullqi_sesion", K_ME = "qullqi_me", K_D = "qullqi_panel";
let SES = "";
const TEMAS = [
  { id: "esmeralda", nombre: "Esmeralda", bg: "#0B0D12", ac: "#2DD4A0", am: "#F5B544" },
  { id: "oceano", nombre: "Océano", bg: "#08111C", ac: "#38BDF8", am: "#F5B544" },
  { id: "violeta", nombre: "Violeta", bg: "#0E0B16", ac: "#A78BFA", am: "#F5B544" },
  { id: "atardecer", nombre: "Atardecer", bg: "#130C0B", ac: "#FB923C", am: "#FDE68A" },
  { id: "rosa", nombre: "Rosa", bg: "#140A10", ac: "#F472B6", am: "#FDE68A" },
  { id: "oro", nombre: "Oro", bg: "#0D0C09", ac: "#E5B84B", am: "#7DD3FC" },
];
function aplicarTema(id, repintar) {
  const t = TEMAS.find((x) => x.id === id) || TEMAS[0];
  if (t.id === "esmeralda") delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t.id;
  C_AC = t.ac; C_AM = t.am;
  const mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute("content", t.bg);
  try { localStorage.setItem(K_TEMA, t.id); } catch {}
  if (repintar && typeof D !== "undefined" && D && D.ciclo) pintar();
}
const ssGet = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const ssSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
const RE_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const getUrl = () => (window.SCRIPT_URL && RE_URL.test(window.SCRIPT_URL) ? window.SCRIPT_URL : "");
const CLIENT_ID = () => (window.GOOGLE_CLIENT_ID && window.GOOGLE_CLIENT_ID !== "PENDIENTE" ? window.GOOGLE_CLIENT_ID : "");

const EMO = { comida: "utensils", super: "shopping-cart", transporte: "bus", salud: "heart-pulse", suscripciones: "tv", ocio: "gamepad", formd: "shirt", hogar: "home", transferencias: "send", efectivo: "banknote", deudas: "wallet", otros: "tag" }; // categoría -> icono
const COL = { comida: "#C79A6B", super: "#6DB5A8", transporte: "#7C9CD6", salud: "#D08A8A", suscripciones: "#A58BC9", ocio: "#B7B36B", formd: "#7FB0C9", hogar: "#B08968", transferencias: "#7FB0C9", efectivo: "#B7B36B", deudas: "#C78B8B", otros: "#9AA3B5" };
const NOMBRE = { comida: "Comida", super: "Super", transporte: "Transporte", salud: "Salud", suscripciones: "Suscrip.", ocio: "Ocio", formd: "FORMD", hogar: "Hogar", transferencias: "Yape/Plin", efectivo: "Efectivo", deudas: "Deudas", otros: "Otros" };
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
function say(text, cls = "") {
  const m = $("msg"); clearTimeout(sayT);
  if (!text) { m.classList.remove("show"); return; }
  m.className = cls; m.replaceChildren(ic(cls === "ok" ? "check-circle" : cls === "bad" ? "alert-triangle" : "info"), h("span", "", text));
  void m.offsetWidth; m.classList.add("show");
  sayT = setTimeout(() => m.classList.remove("show"), cls === "bad" ? 6500 : 2800);
}

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
  ["splash", "login", "registro", "espera", "app"].forEach((k) => { const e = $(k); if (e) e.hidden = k !== n; });
  $("auth").hidden = n === "app"; document.body.classList.toggle("in-app", n === "app");
  if (n !== "app") { cerrarTodo(); $("app").classList.remove("ready"); }
}

function mostrarLogin(msg, reintentar) {
  pantalla("login");
  $("loginMsg").textContent = msg || "";
  $("loginReintentar").hidden = !reintentar;
  const g = $("gbtn"); g.replaceChildren();
  if (CLIENT_ID() && window.google && window.google.accounts && window.google.accounts.id) {
    try {
      iniciarGis();
      window.google.accounts.id.renderButton(g, { theme: "filled_black", size: "large", text: "signin_with", shape: "pill", locale: "es", width: 300 });
    } catch (e) { $("loginMsg").textContent = "No pude mostrar el botón de Google."; }
  }
}

function cerrarSesion(msg) {
  TOK = ""; TOK_EXP = 0; SES = ""; D = null; ME = null; wizardMostrado = false; ssSet(K_TOK, ""); ssSet(K_SES, ""); ssSet(K_ME, ""); ssSet(K_D, "");
  try { window.google.accounts.id.disableAutoSelect(); } catch {}
  mostrarLogin(msg);
}

async function api(action, extra = {}, reintento = false) {
  let cuerpo;
  if (SES) cuerpo = { sesion: SES, action, ...extra };
  else {
    if (!tokenValido() && !(await renovarToken())) { cerrarSesion("Tu sesión venció. Entra otra vez."); throw new Error("Tu sesión venció. Entra otra vez."); }
    cuerpo = { idToken: TOK, action, ...extra };
  }
  // text/plain evita la consulta previa (CORS) que Apps Script no responde.
  const res = await fetch(getUrl(), {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify(cuerpo),
  });
  const data = await res.json().catch(() => ({}));
  if (data.sesion) { SES = data.sesion; ssSet(K_SES, SES); }
  if (data.auth === false && SES) { SES = ""; ssSet(K_SES, ""); return api(action, extra, reintento); } // la sesión venció: se vuelve a Google una vez
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
  pantalla("splash"); // no mostramos el cuadro de Google hasta saber que de verdad hace falta
  SES = ssGet(K_SES);
  if (SES) {
    // Sesión de 30 días: se abre al instante con lo último que se vio y se actualiza por detrás.
    try {
      const me0 = JSON.parse(ssGet(K_ME) || "null"), d0 = JSON.parse(ssGet(K_D) || "null");
      if (me0 && me0.estado === "Aprobado" && d0 && d0.ciclo) { ME = me0; D = d0; pantalla("app"); aplicarRol(); pintar(); cargar().catch(() => {}); return; }
    } catch {}
    return entrar();
  }
  const t = ssGet(K_TOK);
  if (t) { guardarToken(t); if (tokenValido()) { entrar(); cargarGis().then(iniciarGis).catch(() => {}); return; } }
  try { await cargarGis(); iniciarGis(); } catch (e) { return mostrarLogin(e.message, true); }
  if (await renovarToken()) return entrar();
  mostrarLogin("");
}

async function entrar() {
  try { ME = await api("me"); ssSet(K_ME, JSON.stringify(ME)); rutear(ME); } catch (e) { if (!ME) mostrarLogin(e.message, false); }
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
    const ei = $("esperaIco"); ei.classList.toggle("blk", b); ei.replaceChildren(ic(b ? "alert-triangle" : "clock"));
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

// ---------- términos y privacidad ----------
const LEGAL_ACT = "19 de octubre de 2026";
const LEGAL = {
  privacidad: {
    titulo: "Política de privacidad",
    partes: [
      ["Qué datos guardamos", "Tu correo de Google, tu nombre, tu celular y tu edad. Y lo que tú anotas en la app: gastos, ingresos, deudas, metas y los datos de la boleta de pago que subas (el archivo PDF no se sube: se lee en tu equipo)."],
      ["Para qué los usamos", "Para aprobar tu acceso y para calcular tu presupuesto, tus bolsas y tus estadísticas. No usamos tus datos para publicidad."],
      ["Dónde se guardan", "En una hoja de Google Sheets privada creada solo para ti, dentro de la cuenta de Google del administrador de la app. Ninguna otra persona usuaria puede ver tu hoja. El administrador podría, técnicamente, abrirla; se compromete a no hacerlo salvo para soporte que tú pidas."],
      ["Lo que NO hacemos", "No vendemos ni compartimos tus datos con terceros. La app no lee tu correo, no te pide claves de bancos y no mueve dinero."],
      ["Inicio de sesión", "Lo hace Google. La app solo recibe tu correo verificado."],
      ["Tus derechos", "Según la Ley 29733 de protección de datos personales (Perú), puedes pedir ver, corregir o borrar tus datos y tu cuenta. Escribe al administrador: jnactors@gmail.com."],
      ["Seguridad", "Cada pedido se valida con tu sesión de Google. Aun así, ningún sistema es 100 % seguro: no anotes datos que no quieras guardar."],
      ["Edad", "Debes tener al menos 14 años. Si eres menor de 18, usa la app con permiso de un adulto."],
    ],
  },
  terminos: {
    titulo: "Términos de uso",
    partes: [
      ["Qué es esta app", "Una herramienta para organizar tu plata: te ayuda a ver cuánto puedes gastar y a seguir tus deudas y metas."],
      ["No es asesoría financiera", "Los cálculos y consejos son orientativos y pueden tener errores. Las decisiones sobre tu dinero son tuyas; revisa siempre tus cuentas reales."],
      ["Acceso", "Tu cuenta debe ser aprobada por el administrador. Puede aprobar, dejar en revisión o bloquear cuentas, por ejemplo si se usa mal la app."],
      ["Tu responsabilidad", "Usa datos verdaderos en tu registro y no uses la app para fines ilegales. Cuida tu cuenta de Google."],
      ["Cambios y servicio", "La app es gratuita y se ofrece tal cual. Puede cambiar, tener cortes o cerrarse; avisaremos cuando sea posible. Si cambian estos términos, te los mostraremos de nuevo."],
    ],
  },
};
function abrirLegal(tipo) {
  const L = LEGAL[tipo];
  formModal({
    titulo: L.titulo,
    nota: "Última actualización: " + LEGAL_ACT + ".",
    extra: (box) => {
      L.partes.forEach(([t, x]) => { const b = h("b", "", t); b.style.cssText = "display:block;margin-top:14px"; const p = h("div", "sub", x); p.style.marginTop = "4px"; box.append(b, p); });
    },
    textoCerrar: "Entendido",
  });
}
$("lnkTerminos").onclick = (e) => { e.preventDefault(); abrirLegal("terminos"); };
$("lnkPrivacidad").onclick = (e) => { e.preventDefault(); abrirLegal("privacidad"); };

$("regEnviar").onclick = async () => {
  const nombre = $("regNombre").value.trim(), cel = $("regCel").value.replace(/[\s()+-]/g, ""), edad = Number($("regEdad").value);
  const m = $("regMsg"); m.textContent = "";
  if (nombre.length < 2) return void (m.textContent = "Escribe tu nombre.");
  if (!/^\d{7,15}$/.test(cel)) return void (m.textContent = "Escribe un celular de 7 a 15 números.");
  if (!(edad >= 14 && edad <= 100)) return void (m.textContent = "La edad debe estar entre 14 y 100.");
  if (!$("regAcepto").checked) return void (m.textContent = "Acepta los términos y la política de privacidad para continuar.");
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

const ACC_RAPIDAS = ["delete", "setcat", "mov_editar"];
async function cargar(accion = "dashboard", extra = {}) {
  if (ACC_RAPIDAS.includes(accion)) { rapido(accion, extra); return D; }
  try {
    D = await api(accion, extra);
    try { ssSet(K_D, JSON.stringify(D)); } catch {}
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

let formCierre = null;
function cerrarForm() { $("sheetForm").hidden = true; formCierre = null; }
function shHead(box, titulo, cierre) {
  const hd = h("div", "sh-head"); hd.append(h("h3", "sh-title", titulo));
  const x = h("button", "ib"); x.type = "button"; x.setAttribute("aria-label", "Cerrar"); x.append(ic("x")); x.onclick = cierre || cerrarForm;
  hd.append(x); box.append(hd); formCierre = cierre || cerrarForm;
}
function abrirSheet(id) { $(id).hidden = false; if (window.matchMedia("(min-width:900px)").matches && id === "sheetForm") { const f = $("formBox").querySelector("input:not([type=file]):not([type=checkbox]),select"); if (f) f.focus({ preventScroll: true }); } }

function formModal(o) {
  const box = $("formBox"); box.replaceChildren();
  const cierre = () => { cerrarForm(); if (o.onCerrar) o.onCerrar(); };
  if (o.paso) box.append(h("div", "paso", o.paso));
  shHead(box, o.titulo, cierre);
  if (o.nota) box.append(h("div", "sub", o.nota));
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
    if (c.ayuda) { const a = h("div", "sub", c.ayuda); a.style.marginTop = "6px"; box.append(a); }
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
    const bb = h("button", "s btn"); bb.append(ic("trash"), document.createTextNode("Borrar"));
    bb.onclick = async () => { if (!confirm("¿Borrar «" + (o.nombreBorrar || o.titulo) + "»?")) return; try { await o.onBorrar(); } catch (e) { err.textContent = e.message; } };
    row.append(bb);
  }
  const bc = h("button", "s btn", o.textoCerrar || "Cerrar"); bc.onclick = cierre;
  row.append(bc); box.append(row);
  abrirSheet("sheetForm");
  return box;
}

// Todo se guarda al instante: se cambia la pantalla, se cierra la ventana y el servidor se actualiza por detrás.
let pendientes = 0, colaApi = Promise.resolve();
const sumaM = (a, f) => a.reduce((t, m) => t + (f(m) ? m.monto : 0), 0);
// Solo hay los últimos movimientos en pantalla: por eso se ajusta por diferencias, no desde cero.
let __A = null;
function medidas() {
  const c = D && D.ciclo; if (!c) return { g: 0, p: 0, i: 0, pc: {} };
  const ini = c.inicio, hoy = D.hoy || new Date().toISOString().slice(0, 10), mv = D.movimientos || [];
  const pc = {}; mv.filter((m) => m.tipo === "gasto" && m.fecha >= ini && m.fecha <= hoy).forEach((m) => { pc[m.categoria] = (pc[m.categoria] || 0) + m.monto; });
  return {
    g: sumaM(mv, (m) => m.tipo === "gasto" && m.fecha >= ini && m.fecha <= hoy),
    p: sumaM(mv, (m) => m.tipo === "gasto" && m.fecha > hoy && m.fecha <= c.fin),
    i: sumaM(mv, (m) => m.tipo === "ingreso" && m.fuente === "app-ingreso" && m.fecha >= ini && m.fecha <= hoy),
    pc,
  };
}
function recalcLocal() {
  const c = D && D.ciclo, cfg = D && D.config; if (!c || !cfg) return;
  const B = medidas(), A = __A || B;
  c.gastado = (c.gastado || 0) + B.g - A.g;
  c.programado = c.estado === "esperando" ? 0 : (c.programado || 0) + B.p - A.p;
  c.ingresosApp = (c.ingresosApp || 0) + B.i - A.i;
  const pc = { ...(c.porCategoria || {}) };
  new Set([...Object.keys(A.pc), ...Object.keys(B.pc)]).forEach((k) => { pc[k] = Math.max(0, (pc[k] || 0) + (B.pc[k] || 0) - (A.pc[k] || 0)); }); c.porCategoria = pc;
  __A = B;
  if (c.estado === "esperando") return;
  c.fijosPendientes = (D.fijos || []).filter((f) => !f.pagado && f.vence && f.vence <= c.fin).reduce((t, f) => t + f.monto, 0);
  c.presupuesto = (cfg.dinero_ciclo || 0) + c.ingresosApp - (cfg.ahorro || 0) - (cfg.fijos_total || 0) - c.fijosPendientes;
  c.disponible = c.presupuesto - c.gastado - c.programado;
  c.porDia = Math.max(0, c.disponible) / Math.max(1, c.restan);
  c.proyeccion = c.gastado / Math.max(1, c.pasados) * c.total;
  c.ratio = c.presupuesto > 0 ? c.proyeccion / c.presupuesto : 0;
  c.estado = c.presupuesto > 0 ? ((c.disponible < 0 || c.ratio > 1.05) ? "rojo" : c.ratio > 0.9 ? "amarillo" : "verde") : "sin_config";
}
function upsert(arr, orig, obj, key) { const i = arr.findIndex((x) => x[key || "nombre"] === orig); if (i >= 0) arr[i] = { ...arr[i], ...obj }; else arr.push(obj); }
// Igual que el servidor: "pago crediyape 358" se reconoce como pago de esa deuda.
function deudaPorTextoLocal(texto) {
  const GEN = ["prestamo", "tarjeta", "planilla", "deuda", "credito", "banco", "cuota", "personal", "abuelo", "compra", "pago", "pague", "pagar", "mensual", "de", "del", "la", "el", "con", "para", "una", "un"];
  const TRIG = ["pago", "pague", "pagado", "prestamo", "cuota", "abono", "abone", "deuda", "cancele", "devolvi", "devolucion", "adelanto"];
  const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const pal = nrm(texto).split(" ").filter(Boolean);
  if (!pal.some((w) => TRIG.includes(w))) return null;
  let mejor = null, mejorN = 0, empate = false;
  (D.deudasTodas || []).filter((x) => x.saldo > 0).forEach((x) => {
    const n = nrm(x.nombre).split(" ").filter((t) => t.length >= 2 && !GEN.includes(t)).filter((t) => pal.includes(t)).length;
    if (n > mejorN) { mejor = x.nombre; mejorN = n; empate = false; } else if (n > 0 && n === mejorN) empate = true;
  });
  return mejorN > 0 && !empate ? mejor : null;
}
function aplicarLocal(a, d) {
  if (!D) return false;
  __A = medidas();
  D.config = D.config || {}; D.movimientos = D.movimientos || []; D.finanzas = D.finanzas || {}; D.presupuesto = D.presupuesto || {};
  const hoy = D.hoy || new Date().toISOString().slice(0, 10);
  switch (a) {
    case "add": {
      let monto = Number(d.monto), nom = d.comercio || "", fe = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || "") ? d.fecha : hoy;
      if (d.texto) {
        let t = String(d.texto);
        if (/\bayer\b/i.test(t)) { const x = new Date(hoy + "T12:00:00"); x.setDate(x.getDate() - 1); fe = x.toISOString().slice(0, 10); t = t.replace(/\bayer\b/i, " "); }
        else if (/\bpasado ma(?:ñ|n)ana\b/i.test(t)) { const x = new Date(hoy + "T12:00:00"); x.setDate(x.getDate() + 2); fe = x.toISOString().slice(0, 10); t = t.replace(/\bpasado ma(?:ñ|n)ana\b/i, " "); }
        else if (/\bma(?:ñ|n)ana\b/i.test(t)) { const x = new Date(hoy + "T12:00:00"); x.setDate(x.getDate() + 1); fe = x.toISOString().slice(0, 10); t = t.replace(/\bma(?:ñ|n)ana\b/i, " "); }
        const m = t.match(/(\d+(?:[.,]\d{1,2})?)/); if (!m) return false;
        monto = parseFloat(m[1].replace(",", ".")); nom = t.replace(m[0], " ").replace(/\bs\/\.?/i, " ").replace(/\s+/g, " ").trim() || "Gasto";
      }
      if (!(monto > 0)) return false;
      const ing = d.tipo === "ingreso";
      if (!ing && d.categoria === undefined) { const dm = deudaPorTextoLocal(nom); if (dm) return aplicarLocal("pagar_deuda", { nombre: dm, monto }); }
      D.movimientos.unshift({ id: "tmp" + Date.now(), fecha: fe, hora: new Date().toTimeString().slice(0, 5), monto, comercio: nom || (ing ? "Ingreso" : "Gasto"), banco: "manual", medio: "efectivo/otro", categoria: d.categoria || "otros", fuente: ing ? "app-ingreso" : "app", tipo: ing ? "ingreso" : "gasto", notas: "" });
      recalcLocal(); return true;
    }
    case "delete": D.movimientos = D.movimientos.filter((m) => m.id !== d.id); recalcLocal(); return true;
    case "setcat": { const m = D.movimientos.find((x) => x.id === d.id); if (m) m.categoria = d.categoria; recalcLocal(); return true; }
    case "mov_editar": {
      const m = D.movimientos.find((x) => x.id === d.id); if (!m) return false;
      if (d.monto !== undefined && d.monto !== "" && Number(d.monto) > 0) m.monto = Number(d.monto);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || "")) m.fecha = d.fecha;
      if (d.comercio) m.comercio = d.comercio; if (d.categoria) m.categoria = d.categoria;
      recalcLocal(); return true;
    }
    case "config_set": Object.assign(D.config, d.valores || {}); recalcLocal(); return true;
    case "nuevo_ciclo": D.config.dinero_ciclo = Number(d.dinero); if (d.fecha) D.config.ultimo_pago = d.fecha; return false;
    case "perfil_guardar": D.config.moneda = d.moneda; D.config.categorias = Array.isArray(d.categorias) ? d.categorias.join(",") : d.categorias; return true;
    case "boleta_guardar": D.config.sueldo_neto = Number(d.neto); return true;
    case "deuda_guardar": {
      const o = { nombre: d.nombre, saldo: Number(d.saldo), cuota: Number(d.cuota || 0), tea: d.tea || "", fin: d.fin || "", nota: d.nota || "", pago: d.pago || "cuota", auto: d.auto === "si" || d.auto === "planilla", planilla: d.auto === "planilla", autoTxt: d.auto || "no", prioridad: Number(d.prioridad) || 99 };
      D.deudasTodas = D.deudasTodas || []; upsert(D.deudasTodas, d.original || d.nombre, o);
      D.finanzas.deudas = D.finanzas.deudas || []; if (o.saldo > 0) upsert(D.finanzas.deudas, d.original || d.nombre, o); else D.finanzas.deudas = D.finanzas.deudas.filter((x) => x.nombre !== (d.original || d.nombre));
      D.finanzas.total = (D.finanzas.deudas || []).reduce((t, x) => t + x.saldo, 0); return true;
    }
    case "deuda_borrar": D.deudasTodas = (D.deudasTodas || []).filter((x) => x.nombre !== d.nombre); D.finanzas.deudas = (D.finanzas.deudas || []).filter((x) => x.nombre !== d.nombre); D.finanzas.total = (D.finanzas.deudas || []).reduce((t, x) => t + x.saldo, 0); return true;
    case "pagar_deuda": {
      const dd0 = (D.deudasTodas || []).find((y) => y.nombre === d.nombre); if (!dd0) return false;
      const monto0 = Number(d.monto), abono0 = Math.min(monto0, dd0.saldo), inter0 = Math.round((monto0 - abono0) * 100) / 100;
      const bajar = (x) => { if (x) { x.saldo = Math.round((x.saldo - abono0) * 100) / 100; if (inter0 > 0) x.interesesPagados = Math.round(((x.interesesPagados || 0) + inter0) * 100) / 100; } };
      bajar(dd0); bajar((D.finanzas.deudas || []).find((y) => y.nombre === d.nombre));
      D.finanzas.total = (D.finanzas.deudas || []).reduce((t, y) => t + y.saldo, 0);
      if (d.sinGasto !== true) { D.movimientos.unshift({ id: "tmp" + Date.now(), fecha: hoy, hora: new Date().toTimeString().slice(0, 5), monto: monto0, comercio: "Pago " + d.nombre, banco: "manual", medio: "pago deuda", categoria: "deudas", fuente: "app-deuda", tipo: "gasto", notas: "Abono " + abono0.toFixed(2) + (inter0 > 0 ? " · intereses " + inter0.toFixed(2) : "") }); }
      recalcLocal(); return true;
    }
    case "pagar_deuda_viejo": { const x = (D.deudasTodas || []).find((y) => y.nombre === d.nombre); if (x) x.saldo = Math.max(0, x.saldo - Number(d.monto)); const f = (D.finanzas.deudas || []).find((y) => y.nombre === d.nombre); if (f) f.saldo = Math.max(0, f.saldo - Number(d.monto)); D.finanzas.total = (D.finanzas.deudas || []).reduce((t, y) => t + y.saldo, 0); return true; }
    case "ingreso_guardar": { D.finanzas.ingresos = D.finanzas.ingresos || []; upsert(D.finanzas.ingresos, d.original || d.nombre, { nombre: d.nombre, min: Number(d.min), max: d.max === "" || d.max === undefined ? Number(d.min) : Number(d.max), fecha: d.fecha || "", nota: d.nota || "" }); return true; }
    case "ingreso_borrar": D.finanzas.ingresos = (D.finanzas.ingresos || []).filter((x) => x.nombre !== d.nombre); return true;
    case "meta_guardar": { D.metas = D.metas || []; const ob = Number(d.objetivo), ah = Number(d.ahorrado || 0); upsert(D.metas, d.original || d.nombre, { nombre: d.nombre, objetivo: ob, ahorrado: ah, fecha: d.fecha || "", pct: ob > 0 ? Math.min(100, Math.round(ah / ob * 100)) : 0 }); return true; }
    case "meta_borrar": D.metas = (D.metas || []).filter((x) => x.nombre !== d.nombre); return true;
    case "fijo_guardar": {
      D.fijos = D.fijos || []; const dd = Number(d.dia) || 1, dH = parseInt(hoy.slice(8, 10), 10);
      const ex = D.fijos.find((x) => x.nombre === (d.original || d.nombre));
      upsert(D.fijos, d.original || d.nombre, { nombre: d.nombre, monto: Number(d.monto), dia: dd, categoria: d.categoria || "otros", pagado: ex ? ex.pagado : false, vence: ex && ex.pagado ? "" : (dd < dH ? hoy : hoy.slice(0, 7) + "-" + String(dd).padStart(2, "0")), atrasado: !(ex && ex.pagado) && dd < dH });
      recalcLocal(); return true;
    }
    case "fijo_borrar": D.fijos = (D.fijos || []).filter((x) => x.nombre !== d.nombre); recalcLocal(); return true;
    case "fijo_pagar": {
      const f = (D.fijos || []).find((x) => x.nombre === d.nombre); if (!f) return false;
      if (d.pagado !== false && !f.pagado) {
        f.pagado = true; f.vence = ""; f.atrasado = false;
        D.movimientos.unshift({ id: "tmp" + Date.now(), fecha: hoy, hora: new Date().toTimeString().slice(0, 5), monto: f.monto, comercio: f.nombre, banco: "manual", medio: "pago fijo", categoria: f.categoria, fuente: "app-fijo", tipo: "gasto", notas: "" });
      } else if (d.pagado === false && f.pagado) {
        f.pagado = false; const dH = parseInt(hoy.slice(8, 10), 10); f.vence = f.dia < dH ? hoy : hoy.slice(0, 7) + "-" + String(f.dia).padStart(2, "0"); f.atrasado = f.dia < dH;
        const i = D.movimientos.findIndex((m) => m.fuente === "app-fijo" && m.comercio === f.nombre && m.fecha === hoy); if (i >= 0) D.movimientos.splice(i, 1);
      }
      recalcLocal(); return true;
    }
    case "bolsa_borrar": { const P2 = D.presupuesto; ["bolsas", "hoy", "sueldo"].forEach((k) => { if (P2[k]) P2[k] = P2[k].filter((x) => x.nombre !== d.nombre); }); return true; }
    case "bolsas_lote": {
      const P2 = D.presupuesto; P2.bolsas = P2.bolsas || []; P2.sueldo = P2.sueldo || [];
      (d.lista || []).forEach((x) => {
        upsert(P2.bolsas, x.original || x.nombre, { nombre: x.nombre, emoji: x.emoji || "💠", cats: String(x.cats || "").split(",").map((t) => t.trim()).filter(Boolean), modo: "monto", montoSueldo: Number(x.montoSueldo || 0), montoHoy: 0, pctHoy: 0, pctSueldo: 0 });
        const i = P2.sueldo.findIndex((y) => y.nombre === (x.original || x.nombre));
        if (Number(x.montoSueldo) > 0) { const o = { nombre: x.nombre, emoji: x.emoji || "💠", modo: "monto", pct: 0, monto: Number(x.montoSueldo) }; if (i >= 0) P2.sueldo[i] = o; else P2.sueldo.push(o); } else if (i >= 0) P2.sueldo.splice(i, 1);
      });
      return true;
    }
    case "bolsa_guardar": {
      const P2 = D.presupuesto; P2.bolsas = P2.bolsas || []; P2.sueldo = P2.sueldo || [];
      const mo = d.modo === "monto" ? "monto" : "pct", monto = mo === "monto" ? Number(d.montoSueldo || 0) : Math.round((D.finanzas.libreMensual || 0) * Number(d.pctSueldo || 0) / 100);
      upsert(P2.bolsas, d.original || d.nombre, { nombre: d.nombre, emoji: d.emoji || "💠", cats: String(d.cats || "").split(",").map((t) => t.trim()).filter(Boolean), modo: mo, pctHoy: Number(d.pctHoy || 0), pctSueldo: Number(d.pctSueldo || 0), montoHoy: Number(d.montoHoy || 0), montoSueldo: Number(d.montoSueldo || 0) });
      const i = P2.sueldo.findIndex((y) => y.nombre === (d.original || d.nombre));
      if (monto > 0) { const o = { nombre: d.nombre, emoji: d.emoji || "💠", modo: mo, pct: Number(d.pctSueldo || 0), monto }; if (i >= 0) P2.sueldo[i] = o; else P2.sueldo.push(o); } else if (i >= 0) P2.sueldo.splice(i, 1);
      return true;
    }
    default: return false;
  }
}
function rapido(accion, datos, mensaje) {
  const snap = JSON.stringify(D);
  let local = false;
  try { local = aplicarLocal(accion, datos || {}); } catch { local = false; }
  if (local) pintar();
  cerrarForm(); if (mensaje) say(mensaje, "ok");
  pendientes++;
  colaApi = colaApi.then(() => api(accion, datos)).then((r) => {
    pendientes--; if (pendientes === 0) { D = r; try { ssSet(K_D, JSON.stringify(D)); } catch {} pintar(); }
  }).catch((e) => {
    pendientes--; D = JSON.parse(snap); pintar(); say("No se pudo guardar: " + e.message, "bad");
  });
  return colaApi.catch(() => {}).then(() => D);
}
async function guardarYCerrar(accion, datos, mensaje) { rapido(accion, datos, mensaje); }

function listaModal(titulo, nota, filas, textoNuevo, onNuevo, onVolver) {
  const box = $("formBox"); box.replaceChildren();
  const cierre = () => { cerrarForm(); if (onVolver) onVolver(); };
  shHead(box, titulo, cierre);
  if (nota) box.append(h("div", "sub", nota));
  const lst = h("div"); lst.style.marginTop = "12px";
  filas.forEach((f) => {
    const it = h("div", "item"); it.tabIndex = 0;
    const t = h("div", "t"); t.append(h("b", "", f.titulo), h("span", "", f.detalle || ""));
    it.append(t, h("b", "", f.valor || ""), ic("chevron-right", "sm")); it.onclick = f.onClick;
    it.onkeydown = (e) => { if (e.key === "Enter") f.onClick(); };
    lst.append(it);
  });
  if (!filas.length) { const e = h("div", "vacio"); const vi = h("div", "vi"); vi.append(ic("info")); e.append(vi, h("p", "", "Aún no hay nada aquí.")); lst.append(e); }
  box.append(lst);
  const row = h("div", "row");
  const bn = h("button", "p btn"); bn.append(ic("plus"), document.createTextNode(textoNuevo)); bn.onclick = onNuevo;
  const bc = h("button", "s btn", "Cerrar"); bc.onclick = cierre;
  row.append(bn, bc); box.append(row);
  abrirSheet("sheetForm");
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
      { k: "pagado", label: "Anotar un pago de (" + mon() + "), opcional", tipo: "number", ayuda: "Baja lo que debes y queda como gasto. Si pagas más de lo que debes, lo de más cuenta como intereses." },
      { k: "cuota", label: "Cuota mensual (S/)", tipo: "number", valor: d ? d.cuota : 0 },
      { k: "pago", label: "¿Cómo la pagas?", tipo: "select", opciones: OPC_PAGO, valor: d ? d.pago : "cuota" },
      { k: "auto", label: "¿Quién la paga?", tipo: "select", opciones: OPC_AUTO, valor: d ? d.autoTxt : "no", ayuda: "Si se descuenta por planilla, ya está restada de tu sueldo neto." },
      { k: "fin", label: "Termina en (AAAA-MM), opcional", valor: d ? d.fin : "", ph: "2027-12" },
      { k: "prioridad", label: "Orden para pagar con un extra (1 = primero)", tipo: "number", valor: d ? d.prioridad : "" },
      { k: "tea", label: "Interés (TEA), opcional", valor: d ? d.tea : "" },
      { k: "nota", label: "Nota, opcional", valor: d ? d.nota : "" },
    ],
    onGuardar: async (v) => {
      const saldo = Math.max(0, Number(v.saldo || 0));
      await guardarYCerrar("deuda_guardar", { original: d ? d.nombre : undefined, nombre: v.nombre, saldo, cuota: Number(v.cuota || 0), pago: v.pago, auto: v.auto, fin: v.fin, prioridad: Number(v.prioridad || 0), tea: v.tea, nota: v.nota }, "Deuda guardada");
      if (Number(v.pagado) > 0) rapido("pagar_deuda", { nombre: v.nombre, monto: Number(v.pagado) }, "Pago anotado");
      if (volver) volver();
    },
    onBorrar: d ? async () => { await guardarYCerrar("deuda_borrar", { nombre: d.nombre }, "Deuda borrada"); if (volver) volver(); } : null,
    nombreBorrar: d ? d.nombre : "",
    onCerrar: volver,
  });
}

function abrirDeudas() {
  const todas = (D.deudasTodas || []).slice().sort((a, b) => a.prioridad - b.prioridad);
  listaModal("Tus deudas", "Toca una para corregirla o anotar un pago.",
    todas.map((d) => ({ titulo: d.nombre, detalle: (d.cuota ? S(d.cuota) + "/mes · " : "") + (d.planilla ? "por planilla" : d.fin ? "termina " + mesTxt(d.fin) : "sin fecha") + (d.interesesPagados > 0 ? " · intereses " + S2(d.interesesPagados) : ""), valor: S(d.saldo), onClick: () => abrirDeuda(d, abrirDeudas) })),
    "Nueva deuda", () => abrirDeuda(null, abrirDeudas), abrirCfg);
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
  listaModal("Ingresos extra esperados", "Cuando llegue uno, bórralo y apunta el dinero en «Ya me pagaron» o en tus gastos.",
    ing.map((i) => ({ titulo: i.nombre, detalle: i.fecha ? "hacia el " + fecha(i.fecha) : "sin fecha", valor: S(i.min) + (i.max > i.min ? " a " + S(i.max) : ""), onClick: () => abrirIngreso(i, abrirIngresos) })),
    "Nuevo ingreso", () => abrirIngreso(null, abrirIngresos), abrirCfg);
}

// ---------- bolsas (presupuesto) ----------

function abrirBolsa(b, volver) {
  const modo0 = b && b.modo === "pct" ? "pct" : "monto";
  const val0 = b ? (modo0 === "monto" ? b.montoSueldo || (b.modo === "pct" ? 0 : 0) : b.pctSueldo) : 0;
  const etiqueta = (m) => (m === "monto" ? "¿Cuánto gastas al mes en esto? (" + mon() + ")" : "¿Qué porcentaje de tu plata va aquí? (%)");
  const box = formModal({
    titulo: b ? b.nombre : "Nueva bolsa",
    nota: "Una bolsa es lo que separas para un tipo de gasto. Elige si la pones en soles o en porcentaje: la app hace el resto.",
    campos: [
      { k: "nombre", label: "Nombre", valor: b ? b.nombre : "", ph: "Ej.: Mi carro" },
      { k: "modo", label: "¿Cómo la quieres poner?", tipo: "select", opciones: [["monto", "En soles (" + mon() + " al mes)"], ["pct", "En porcentaje (%)"]], valor: modo0 },
      { k: "valor", label: etiqueta(modo0), tipo: "number", valor: Math.round(val0 * 100) / 100 },
      { k: "cats", label: "Qué gastos cuentan aquí", valor: b ? b.cats.join(",") : "", ph: "transporte,comida", ayuda: "Opciones: " + Object.keys(NOMBRE).join(", ") },
    ],
    onGuardar: async (v) => {
      const n = Number(v.valor || 0);
      const dat = { original: b ? b.nombre : undefined, nombre: v.nombre, emoji: b ? b.emoji : "💠", modo: v.modo, cats: v.cats };
      if (v.modo === "monto") Object.assign(dat, { montoSueldo: n, montoHoy: 0, pctHoy: 0, pctSueldo: 0 });
      else Object.assign(dat, { pctHoy: b && b.modo === "pct" && n === b.pctSueldo ? b.pctHoy : n, pctSueldo: n, montoHoy: 0, montoSueldo: 0 });
      await guardarYCerrar("bolsa_guardar", dat, "Bolsa guardada."); if (volver) volver();
    },
    onBorrar: b ? async () => { await guardarYCerrar("bolsa_borrar", { nombre: b.nombre }, "Bolsa borrada."); if (volver) volver(); } : null,
    nombreBorrar: b ? b.nombre : "",
    onCerrar: volver,
  });
  // Al cambiar entre soles y porcentaje, cambia solo la pregunta del monto.
  const campos = box.querySelectorAll("input, select");
  const sel = campos[1], num = campos[2];
  if (sel && num) {
    const lab = num.previousElementSibling;
    sel.onchange = () => { if (lab) lab.textContent = etiqueta(sel.value); num.placeholder = sel.value === "monto" ? "Ej.: 300" : "Ej.: 25"; num.max = sel.value === "pct" ? "100" : ""; };
    sel.onchange();
  }
}

// "Mis gastos del mes": cada persona pone cuánto gasta al mes en cada cosa (comida, transporte, su carro, etc.).
function montoMensualDe(b) {
  if (b.modo === "monto") return b.montoSueldo || 0;
  const s = ((D.presupuesto && D.presupuesto.sueldo) || []).find((x) => x.nombre === b.nombre);
  return s ? s.monto : 0;
}

function abrirMisGastos(volver) {
  const bs = (D.presupuesto && D.presupuesto.bolsas) || [];
  const total = bs.reduce((a, b) => a + montoMensualDe(b), 0);
  formModal({
    titulo: "Mis gastos del mes",
    nota: "Escribe cuánto gastas al mes en cada cosa. Pon 0 en lo que no uses. Los montos son tuyos: cámbialos cuando quieras.",
    campos: bs.map((b, i) => ({ k: "g" + i, label: b.nombre + " (" + mon() + " al mes)", tipo: "number", valor: Math.round(montoMensualDe(b)), ayuda: i === 0 ? "Ahora suman " + S(total) + " al mes." : undefined })),
    extra: (box) => {
      const nb = btnIco("s full", "plus", "Agregar otro gasto (ej. mi carro)"); nb.style.marginTop = "10px";
      nb.onclick = () => abrirNuevoGasto(() => abrirMisGastos(volver));
      box.append(nb);
    },
    textoGuardar: "Guardar mis gastos",
    onGuardar: async (v) => {
      const lista = bs.map((b, i) => ({ original: b.nombre, nombre: b.nombre, emoji: b.emoji, cats: b.cats.join(","), montoSueldo: Number(v["g" + i] || 0) }));
      await guardarYCerrar("bolsas_lote", { lista }, "Gastos guardados");
      if (volver) volver();
    },
    onCerrar: volver,
  });
}

function abrirNuevoGasto(volver) {
  const propias = String((D.config && D.config.categorias) || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cats = D.categorias.concat(propias.filter((x) => !D.categorias.includes(x)));
  formModal({
    titulo: "Agregar otro gasto",
    nota: "Por ejemplo: «Mi carro», «Mascota» o «Gimnasio». Elige qué gastos cuentan aquí.",
    campos: [
      { k: "nombre", label: "Nombre", valor: "", ph: "Mi carro" },
      { k: "monto", label: "Cuánto gastas al mes (" + mon() + ")", tipo: "number", valor: "" },
      { k: "cat", label: "¿Qué gastos cuentan aquí?", tipo: "select", opciones: [["__nueva", "Una categoría nueva con este mismo nombre"]].concat(cats.map((k) => [k, NOMBRE[k] || k])), valor: "__nueva" },
    ],
    textoGuardar: "Agregar",
    onGuardar: async (v) => {
      const nombre = (v.nombre || "").trim(); if (!nombre) throw new Error("Escribe un nombre.");
      const monto = Number(v.monto || 0); if (monto < 0) throw new Error("El monto no puede ser negativo.");
      let cat = v.cat;
      if (cat === "__nueva") {
        cat = nombre.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 20);
        if (!/^[0-9a-záéíóúüñ ]{1,20}$/.test(cat)) throw new Error("La categoría solo puede tener letras y números.");
        if (!D.categorias.includes(cat)) await api("perfil_guardar", { moneda: mon(), categorias: propias.concat(cat).filter((x, i, a) => a.indexOf(x) === i).join(",") });
      }
      await guardarYCerrar("bolsas_lote", { lista: [{ nombre, emoji: "💠", cats: cat, montoSueldo: monto }] }, "Gasto agregado");
      if (volver) volver();
    },
    onCerrar: volver,
  });
}

function abrirEditarPago() {
  const c = D.config;
  formModal({
    titulo: "Pago de este ciclo",
    nota: "Si te equivocaste de monto o de fecha, corrígelo aquí. También puedes quitarlo.",
    campos: [
      { k: "dinero_ciclo", label: "Plata que te cayó (" + mon() + ")", tipo: "number", valor: c.dinero_ciclo || 0 },
      { k: "ultimo_pago", label: "Fecha en que te cayó (AAAA-MM-DD)", valor: c.ultimo_pago || D.hoy || "" },
    ],
    onGuardar: async (v) => { await guardarYCerrar("config_set", { valores: { dinero_ciclo: Number(v.dinero_ciclo || 0), ultimo_pago: v.ultimo_pago } }, "Pago corregido"); },
    onBorrar: async () => { await guardarYCerrar("config_set", { valores: { dinero_ciclo: 0 } }, "Pago quitado"); },
    nombreBorrar: "este pago",
  });
}

function abrirBolsas() {
  const bs = D.presupuesto.bolsas;
  listaModal("Tus bolsas", "Toca una para cambiar cuánto le toca.",
    bs.map((b) => ({ titulo: b.nombre, detalle: b.cats.join(", ") || "sin categorías", valor: b.modo === "monto" ? S(b.montoHoy) + " · " + S(b.montoSueldo) + "/mes" : b.pctHoy + "% · " + b.pctSueldo + "%", onClick: () => abrirBolsa(b, abrirBolsas) })),
    "Nueva bolsa", () => abrirBolsa(null, abrirBolsas), abrirCfg);
}

// ---------- bancos ----------

function abrirBancos(volver) {
  const act = (D.config.bancos || "").split(",");
  const op = [["1", "Sí, leer sus avisos"], ["0", "No"]];
  formModal({
    titulo: "Bancos que lee la app",
    nota: "La app lee solo los avisos de consumo que estos bancos te mandan por correo. Nunca pide claves del banco.",
    campos: [
      { k: "interbank", label: "Interbank (tarjeta y Plin)", tipo: "select", opciones: op, valor: act.includes("interbank") ? "1" : "0" },
      { k: "bn", label: "Banco de la Nación", tipo: "select", opciones: op, valor: act.includes("bn") ? "1" : "0" },
      { k: "bcp", label: "BCP (consumos y compras rechazadas)", tipo: "select", opciones: op, valor: act.includes("bcp") ? "1" : "0" },
    ],
    extra: (box) => box.append(h("div", "sub", "¿Usas otro banco? De momento los registras a mano en «Gasto rápido» (por ejemplo «almuerzo 18»).")),
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
  const cierreB = () => { cerrarForm(); abrirCfg(); };
  shHead(box, "Subir tu boleta de pago", cierreB);
  const n = h("div", "sub", "Elige el PDF de tu boleta. Se lee aquí, en tu equipo: el archivo no se envía a ningún lado. Solo se guardan los montos."); n.style.margin = "4px 0 12px"; box.append(n);
  const fi = document.createElement("input"); fi.type = "file"; fi.accept = "application/pdf"; box.append(fi);
  const zona = h("div"); box.append(zona);
  const err = h("div", "msg bad"); box.append(err);
  const bc = h("button", "s btn", "Cerrar"); bc.onclick = cierreB;
  const row = h("div", "row"); row.append(bc); box.append(row);
  abrirSheet("sheetForm");
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
  zona.append(h("div", "msg " + (cuadra ? "ok" : "bad"), cuadra ? "Los números cuadran: percibido − descuentos = neto." : "Los números no cuadran del todo. Revisa los montos antes de guardar."));
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
      say("Boleta guardada", "ok");
    } catch (e) { err.textContent = e.message; }
    bg.disabled = false;
  };
  zona.append(bg);
}

// ---------- ajustes, guía y asistente de inicio ----------

function abrirColores() {
  const actual = (() => { try { return localStorage.getItem(K_TEMA) || "esmeralda"; } catch { return "esmeralda"; } })();
  formModal({
    titulo: "Colores",
    nota: "Elige la combinación que más te guste. Se guarda en este aparato.",
    extra: (box) => {
      const g = h("div", "temas"); g.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px";
      TEMAS.forEach((t) => {
        const b = h("button", "s"); b.type = "button";
        b.style.cssText = "display:flex;align-items:center;gap:10px;padding:12px;text-align:left;border-radius:14px;background:" + t.bg + ";border:2px solid " + (t.id === actual ? t.ac : "rgba(255,255,255,.12)");
        const sw = h("span"); sw.style.cssText = "width:30px;height:30px;border-radius:50%;flex:none;background:linear-gradient(135deg," + t.ac + " 55%," + t.am + " 55%)";
        const tx = h("span", "", t.nombre); tx.style.cssText = "font-weight:600;color:#F2F4F8";
        b.append(sw, tx);
        b.onclick = () => { aplicarTema(t.id, true); say("Color: " + t.nombre, "ok"); cerrarForm(); abrirColores(); };
        g.append(b);
      });
      box.append(g);
    },
    textoCerrar: "Listo", onCerrar: abrirCfg,
  });
}

function abrirSueldo() {
  const c = D.config;
  formModal({
    titulo: "Tu sueldo",
    nota: "Dinos cuánto te cae y cuándo te pagan este mes. Si cambia de día, vuelve aquí y lo cambias.",
    campos: [
      { k: "proximo_pago", label: "¿Qué día te pagan este mes? (AAAA-MM-DD)", valor: c.proximo_pago && c.proximo_pago >= (D.hoy || "") ? c.proximo_pago : "", ph: "Ej.: " + ((D.hoy || "2026-10-20")) },
      { k: "sueldo_neto", label: "Cuánto te cae (" + mon() + ")", tipo: "number", valor: c.sueldo_neto || "" },
    ],
    extra: (box) => { const bb = btnIco("s full", "file-text", "Subir mi boleta y que se llene sola"); bb.style.marginTop = "10px"; bb.onclick = () => { cerrarForm(); abrirBoleta(); }; box.append(bb); },
    onGuardar: async (v) => {
      if (v.proximo_pago && !/^\d{4}-\d{2}-\d{2}$/.test(v.proximo_pago.trim())) throw new Error("Escribe la fecha así: AAAA-MM-DD (ej. 2026-10-20).");
      rapido("config_set", { valores: { proximo_pago: (v.proximo_pago || "").trim(), sueldo_neto: Number(v.sueldo_neto || 0) } }, "Sueldo guardado");
    },
  });
}

function abrirCfgMas() {
  const c = D.config; const admin = !!(ME && ME.admin);
  formModal({
    titulo: "Más ajustes",
    campos: [
      { k: "ultimo_pago", label: "Fecha en que empezó este ciclo, cuando te pagaron (AAAA-MM-DD)", valor: c.ultimo_pago || "" },
      { k: "ahorro", label: "Ahorro que quieres apartar (" + mon() + ")", tipo: "number", valor: c.ahorro || "" },
      { k: "fijos_total", label: "Gastos fijos que aún no pagaste este ciclo (" + mon() + ")", tipo: "number", valor: c.fijos_total || "" },
      { k: "aporte_comida", label: "Aporte de comida en casa al mes (" + mon() + ")", tipo: "number", valor: c.aporte_comida || 0 },
      { k: "meta_fondo", label: "Meta de fondo de emergencia (" + mon() + ")", tipo: "number", valor: c.meta_fondo || "" },
      { k: "umbral_grande", label: "Avisarme si un gasto supera (" + mon() + ")", tipo: "number", valor: c.umbral_grande || "" },
      { k: "alertas", label: "Avisos por correo y Calendar", tipo: "select", opciones: [["1", "Activados"], ["0", "Apagados"]], valor: String(c.alertas), solo: "admin" },
    ].filter((x) => !x.solo || admin),
    onGuardar: async (v) => {
      const n = (k) => Number(v[k] || 0);
      rapido("config_set", { valores: { ...(/^\d{4}-\d{2}-\d{2}$/.test(String(v.ultimo_pago || "")) ? { ultimo_pago: v.ultimo_pago } : {}), ahorro: n("ahorro"), fijos_total: n("fijos_total"), aporte_comida: n("aporte_comida"), meta_fondo: n("meta_fondo"), umbral_grande: n("umbral_grande"), ...(admin ? { alertas: n("alertas") } : {}) } }, "Ajustes guardados");
    },
    onCerrar: abrirCfg,
  });
}

function abrirCfg() {
  const c = D.config; const admin = !!(ME && ME.admin);
  formModal({
    titulo: "Ajustes",
    nota: "Lo esencial. Lo demás está en el menú de abajo.",
    campos: [
      { k: "dinero_ciclo", label: "Plata que tengo para este ciclo (" + mon() + ")", tipo: "number", valor: c.dinero_ciclo || "", ayuda: "Si te equivocaste, corrígela aquí." },
    ],
    extra: (box) => {
      const menu = h("div", "menu");
      [["building", "Sueldo y fecha de pago", abrirSueldo], ["wallet", "Mis gastos del mes", () => abrirMisGastos(abrirCfg)], ["receipt", "Pagos fijos", () => { cerrarForm(); irVista("presu"); }], ["wallet", "Deudas", abrirDeudas], ["banknote", "Ingresos extra", abrirIngresos], ["target", "Mis metas", abrirMetas], ["file-text", "Subir boleta", abrirBoleta], ["user", "Mi perfil", abrirPerfil], ["settings", "Más ajustes", abrirCfgMas], ["sparkles", "Colores", abrirColores], ["coins", "Bolsas una por una", abrirBolsas], admin && ["building", "Bancos", () => abrirBancos(abrirCfg)], admin && ["users", "Usuarios", abrirUsuarios], ["compass", "Guía de inicio", abrirWizard], ["play", "Cómo funciona", () => abrirVideo(true)], ["check-circle", "Ya me pagaron", abrirNuevoCiclo], ["log-out", "Cerrar sesión", () => { cerrarForm(); cerrarSesion(""); }]].filter(Boolean).forEach(([i, t, f]) => {
        const b = h("button", ""); b.type = "button"; b.append(ic(i), h("span", "", t), ic("chevron-right", "chv")); b.onclick = f; menu.append(b);
      });
      box.append(menu);
    },
    onGuardar: async (v) => { rapido("config_set", { valores: { dinero_ciclo: Number(v.dinero_ciclo || 0) } }, "Ajustes guardados"); },
  });
}

function abrirNuevoCiclo() {
  formModal({
    titulo: "Ya me pagaron",
    nota: "Empieza un ciclo nuevo desde hoy. Escribe cuánta plata tienes ahora en total, sumando lo que te cayó y lo que te sobró.",
    campos: [
      { k: "dinero", label: "Plata total que tienes hoy (" + mon() + ")", tipo: "number", valor: D.config.sueldo_neto ? Math.round(D.finanzas.libreMensual) : "", ayuda: "Sugerencia: tu libre mensual (" + S(D.finanzas.libreMensual) + ") más lo que te sobró." },
      { k: "fecha", label: "Fecha en que te pagaron (AAAA-MM-DD)", valor: D.hoy || new Date().toISOString().slice(0, 10), ayuda: "Si te equivocaste, vuelve a abrir esto o usa Ajustes para corregir la fecha y el monto." },
    ],
    textoGuardar: "Empezar ciclo nuevo",
    onGuardar: async (v) => { if (v.dinero === "") throw new Error("Escribe cuánta plata tienes hoy."); await guardarYCerrar("nuevo_ciclo", { dinero: Number(v.dinero), fecha: v.fecha }, "¡Ciclo nuevo!"); },
  });
}

const TIPS = "Cómo piensa esta app: 1) cuenta por ciclo de sueldo, no por mes; 2) lo que no es seguro (un pago extra) no debe pagar deudas con fecha fija; 3) lo que se descuenta por planilla ya no sale de tu cuenta.";

function abrirWizard() {
  const c = (D && D.config) || {};
  const sino = [["1", "Sí"], ["0", "No"]];
  const act = (c.bancos || "interbank,bn,bcp").split(",");
  const admin = !!(ME && ME.admin); const N = admin ? 5 : 4;
  const terminar = async () => { await api("config_set", { valores: { setup_hecho: 1 } }); await cargar(admin ? "scan" : "dashboard"); cerrarForm(); say("¡Todo listo!", "ok"); };
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
      await cargar("scan"); cerrarForm(); say("¡Todo listo!", "ok");
    },
    textoCerrar: "Después",
  });
  const paso4 = () => formModal({
    paso: "Paso 4 de " + N, titulo: "Ingresos extra esperados",
    nota: "¿Esperas algún pago que no es fijo (trabajo extra, bono)? Anota el mínimo seguro. No cuentes con él para pagos con fecha fija.",
    extra: (box) => { const b = h("button", "s btn", "Agregar un ingreso"); b.style.marginTop = "10px"; b.onclick = () => abrirIngreso(null, paso4); box.append(b); },
    textoGuardar: admin ? "Siguiente" : "Terminar", onGuardar: async () => { if (admin) paso5(); else await terminar(); }, textoCerrar: "Después",
  });
  const paso3 = () => formModal({
    paso: "Paso 3 de " + N, titulo: "Tus deudas",
    nota: "Agrega cada deuda con su saldo y cuota. Marca cuáles se descuentan por planilla y cuáles pagarás con un extra. Puedes dejarlo para después.",
    extra: (box) => {
      const b = h("button", "s btn", "Agregar una deuda"); b.style.marginTop = "10px"; b.onclick = () => abrirDeuda(null, paso3);
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
      D = await api("config_set", { valores: { dinero_ciclo: Number(v.dinero_ciclo || 0), ahorro: Number(v.ahorro || 0), fijos_total: Number(v.fijos_total || 0), ultimo_pago: D.hoy || new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10) } });
      pintar(); paso3();
    },
    textoCerrar: "Después",
  });
  formModal({
    paso: "Paso 1 de " + N, titulo: "Tu sueldo y tus fechas", nota: TIPS,
    campos: [
      { k: "sueldo_neto", label: "Sueldo neto, lo que te cae (S/)", tipo: "number", valor: c.sueldo_neto || "", ayuda: "O sube tu boleta con «Subir boleta» en Ajustes." },
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
  const cierreG = () => { cerrarForm(); abrirCfg(); };
  shHead(box, "Cómo funciona", cierreG);
  const L = [
    "Entras con tu cuenta de Google. Cada persona tiene su propio Sheet privado, creado solo para ella: nadie más ve tus movimientos, tu sueldo ni tus deudas.",
    "La primera vez te pedimos tus datos y el administrador aprueba tu cuenta. Después sigue el asistente de inicio (" + ((ME && ME.admin) ? "5" : "4") + " pasos).",
    "En «Mi perfil» eliges tu moneda, tus propias categorías y tus metas de ahorro.",
    "Los gastos los anotas con el botón «+» o en «Gasto rápido» («almuerzo 18»). La app nunca te pide la clave del banco ni mueve dinero.",
  ];
  L.forEach((t) => { const d = h("div", "consejo", t); box.append(d); });
  const row = h("div", "row"); const bc = h("button", "s btn", "Cerrar"); bc.onclick = cierreG; row.append(bc); box.append(row);
  abrirSheet("sheetForm");
}

// ---------- perfil, metas y usuarios ----------

const MONEDAS = ["S/", "$", "€", "Bs"];

function abrirPerfil() {
  const mActual = mon(); const esOtra = !MONEDAS.includes(mActual);
  const p = (ME && ME.perfil) || {};
  formModal({
    titulo: "Mi perfil",
    nota: ((p.nombre || (ME && ME.nombre) || "") + " · " + ((ME && ME.email) || "")).replace(/^ · /, ""),
    campos: [
      { k: "moneda", label: "Moneda", tipo: "select", opciones: MONEDAS.map((x) => [x, x]).concat([["otro", "Otra…"]]), valor: esOtra ? "otro" : mActual },
      { k: "otra", label: "Si elegiste «Otra», escríbela (máx. 5 letras)", valor: esOtra ? mActual : "", ph: "Ej.: COP" },
      { k: "categorias", label: "Mis categorías propias (separadas por coma, máx. 10)", valor: (D.config.categorias || ""), ph: "mascotas, gym", ayuda: "Aparecen junto a las demás al clasificar un gasto." },
    ],
    extra: (box) => {
      const b = h("button", "s btn", "Mis metas de ahorro"); b.style.marginTop = "10px"; b.onclick = abrirMetas; box.append(b);
    },
    onGuardar: async (v) => {
      const moneda = v.moneda === "otro" ? v.otra.trim() : v.moneda;
      if (!moneda || moneda.length > 5) throw new Error("Escribe una moneda de 1 a 5 letras.");
      const cats = v.categorias.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (cats.length > 10) throw new Error("Máximo 10 categorías.");
      if (cats.some((x) => !/^[a-z0-9áéíóúñü ]+$/i.test(x))) throw new Error("Las categorías solo pueden tener letras, números y espacios.");
      rapido("perfil_guardar", { moneda, categorias: cats.join(",") }, "Perfil guardado");
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
      rapido("meta_guardar", { original: m ? m.nombre : undefined, nombre: v.nombre.trim(), objetivo: Number(v.objetivo), ahorrado: Number(v.ahorrado || 0), fecha: v.fecha.trim() }, "Meta guardada"); if (volver) volver();
    },
    onBorrar: m ? async () => { rapido("meta_borrar", { nombre: m.nombre }, "Meta borrada"); if (volver) volver(); } : null,
    nombreBorrar: m ? m.nombre : "",
    onCerrar: volver,
  });
}

function abrirMetas(v) {
  const back = typeof v === "function" ? v : v === null ? null : abrirCfg;
  listaModal("Mis metas de ahorro", "Toca una para actualizar cuánto llevas.",
    (D.metas || []).map((m) => ({ titulo: m.nombre, detalle: (m.fecha ? "para el " + fecha(m.fecha) + " · " : "") + Math.round(m.pct || 0) + "%", valor: S(m.ahorrado) + " / " + S(m.objetivo), onClick: () => abrirMeta(m, abrirMetas) })),
    "Nueva meta", () => abrirMeta(null, abrirMetas), back);
}

function pintarUsuarios(box, usuarios, err) {
  box.replaceChildren();
  shHead(box, "Usuarios");
  const n = usuarios.filter((u) => u.estado === "Pendiente").length;
  box.append(h("div", "sub", n ? n + (n === 1 ? " solicitud pendiente." : " solicitudes pendientes.") : "No hay solicitudes pendientes."));
  usuarios.forEach((u) => {
    const row = h("div", "urow");
    const top = h("div", "r"); top.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:center";
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
  const box = $("formBox"); box.replaceChildren(h("div", "sub", "Cargando…")); abrirSheet("sheetForm");
  const err = h("div", "msg bad");
  try { const r = await api("admin_listar"); pintarUsuarios(box, r.usuarios || [], err); actualizarBadge(r.usuarios || []); } catch (e) { cerrarForm(); say(e.message, "bad"); }
}

// ---------- pantalla principal ----------

const NS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k])); if (parent) parent.append(e); return e; };
function ic(n, cls) {
  const s = document.createElementNS(NS, "svg"); s.setAttribute("class", "ic" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS(NS, "use"); u.setAttribute("href", "#i-" + n); s.append(u); return s;
}
let C_AC = "#2DD4A0", C_AM = "#F5B544"; const C_RED = "#F2685B", C_SLATE = "#7B849A";
try { aplicarTema(localStorage.getItem(K_TEMA) || "esmeralda"); } catch { aplicarTema("esmeralda"); }
const PAL = ["#7C9CD6", "#C79A6B", "#A58BC9", "#6DB5A8", "#D08A8A", "#B7B36B", "#7FB0C9", "#9AA3B5"];
const BOLSA_COL = PAL;
const VISTAS = ["inicio", "presu", "ingdeu", "metas", "stats"];
const TITULOS = { inicio: "Inicio", presu: "Gastos", ingdeu: "Dinero", metas: "Metas", stats: "Estadísticas" };
let vista = "inicio";
const vistaPorDefecto = "inicio";
const metasFestejadas = new Set();
const bolsasAbiertas = new Set();
const esLaptop = () => window.matchMedia("(min-width:900px)").matches;
const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

// emoji guardado en los datos de la bolsa -> icono
const EMO_ICO = { "🛵": "bus", "🚌": "bus", "🚗": "bus", "🍳": "utensils", "🍔": "utensils", "🍽": "utensils", "🎉": "sparkles", "🆘": "heart-pulse", "💊": "heart-pulse", "🧵": "shirt", "🛡": "shield", "📉": "trending-down", "📌": "tag", "🛒": "shopping-cart", "📺": "tv", "🎮": "gamepad", "🏠": "home", "📲": "send", "💵": "banknote", "🐷": "piggy-bank", "🎯": "target", "💠": "circle" };
const normE = (e) => String(e || "").replace(/️/g, "").trim();

function tinte(el, col) { el.style.background = col + "1F"; el.style.color = col; return el; }
function iconBox(name, col, extra) { const d = h("div", "ico" + (extra ? " " + extra : "")); tinte(d, col); d.append(ic(name)); return d; }
function bolsaIco(b, col) {
  const k = EMO_ICO[normE(b.emoji)];
  if (k && k !== "circle") return iconBox(k, col);
  const d = h("div", "ico rd", (b.nombre || "?").trim().charAt(0).toUpperCase()); return tinte(d, col);
}

function registrarCats() {
  const lista = String((D.config && D.config.categorias) || "").split(",").map((x) => x.trim()).filter(Boolean);
  lista.forEach((k, i) => {
    if (!EMO[k]) EMO[k] = "tag";
    if (!COL[k]) COL[k] = PAL[(i + 2) % PAL.length];
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

// Número que cuenta hacia arriba (400 ms). Parte del valor anterior de esa clave.
const prevNum = {};
function cnt(el, key, val, fmt) {
  fmt = fmt || S;
  const from = prevNum[key] === undefined ? 0 : prevNum[key]; prevNum[key] = val;
  if (from === val || reduceMotion() || !isFinite(val)) { el.textContent = fmt(val); return el; }
  el.textContent = fmt(from);
  const t0 = performance.now(), dur = 400;
  const paso = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (val - from) * e); if (k < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
  setTimeout(() => { el.textContent = fmt(val); }, dur + 80);
  return el;
}

function info(titulo, texto) {
  $("infoTit").textContent = titulo;
  const b = $("infoTxt"); b.replaceChildren();
  (Array.isArray(texto) ? texto : [texto]).forEach((t) => b.append(h("p", "", t)));
  $("sheetInfo").hidden = false;
}

function ib(titulo, texto) {
  const b = h("button", "ib"); b.type = "button"; b.setAttribute("aria-label", "Más información: " + titulo); b.append(ic("info"));
  b.onclick = (e) => { e.stopPropagation(); info(titulo, texto); };
  return b;
}

function cardHead(titulo, infoTexto, extra) {
  const hd = h("div", "ch"); hd.append(h("h2", "", titulo));
  if (extra) hd.append(extra);
  if (infoTexto) hd.append(ib(titulo, infoTexto));
  return hd;
}

function vacio(icono, frase, sub, btnTxt, fn) {
  const e = h("div", "vacio"); const vi = h("div", "vi"); vi.append(ic(icono, "lg")); e.append(vi, h("p", "", frase));
  if (sub) e.append(h("div", "sub", sub));
  if (btnTxt) { const b = h("button", "s"); b.append(ic("plus"), document.createTextNode(btnTxt)); b.onclick = fn; e.append(b); }
  return e;
}

function btnIco(cls, icono, texto) { const b = h("button", cls); b.type = "button"; b.append(ic(icono), document.createTextNode(texto)); return b; }

function ring(pct, o) {
  o = o || {};
  const size = o.size || 120, sw = o.stroke || 6, r = 50 - sw / 2;
  const svg = sv("svg", { viewBox: "0 0 100 100", class: "ring " + (o.cls || ""), width: size, height: size, "aria-hidden": "true" });
  sv("circle", { cx: 50, cy: 50, r, fill: "none", stroke: "rgba(255,255,255,.07)", "stroke-width": sw }, svg);
  const p = Math.max(0, Math.min(100, pct));
  const c = sv("circle", { cx: 50, cy: 50, r, fill: "none", stroke: o.color || C_AC, "stroke-width": sw, "stroke-linecap": "round", pathLength: 100, class: "pr" }, svg);
  c.style.strokeDasharray = p + " 100";
  return svg;
}

function bar(pct, color, alto) {
  const tr = h("div", "track"); if (alto) tr.style.height = alto + "px";
  const f = h("div", "fill"); f.style.width = Math.max(0, Math.min(100, pct)) + "%"; if (color) f.style.background = color;
  tr.append(f); return tr;
}

function confeti(host) {
  if (reduceMotion()) return;
  const cols = [C_AM, C_AC, "#F2F4F8"];
  for (let i = 0; i < 12; i++) {
    const s = h("i", "cf"); s.style.setProperty("--dx", Math.round((Math.random() - 0.5) * 120) + "px"); s.style.setProperty("--dy", Math.round(-30 - Math.random() * 60) + "px");
    s.style.background = cols[i % cols.length]; s.style.animationDelay = (i * 25) + "ms"; host.append(s);
    setTimeout(() => s.remove(), 1500);
  }
}

// tooltip compartido (mouse y dedo)
function tipShow(ev, t, filas) {
  const el = $("tip"); el.replaceChildren(h("b", "", t));
  (filas || []).forEach(([a, b, col]) => {
    const r = h("div", "tr"); const l = h("span", "", a);
    if (col) { const d = h("i", "cdot"); d.style.background = col; d.style.display = "inline-block"; d.style.marginRight = "7px"; l.prepend(d); }
    r.append(l, h("span", "", b)); el.append(r);
  });
  el.classList.add("on"); tipMove(ev);
}
function tipMove(ev) {
  const el = $("tip"); const w = el.offsetWidth, hh = el.offsetHeight;
  let x = ev.clientX + 14, y = ev.clientY - hh - 14;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
  if (x < 8) x = 8;
  if (y < 8) y = ev.clientY + 18;
  el.style.left = x + "px"; el.style.top = y + "px";
}
function tipHide() { $("tip").classList.remove("on"); }
function conTip(el, fn) {
  el.addEventListener("pointerenter", (e) => { const r = fn(e); if (r) tipShow(e, r[0], r[1]); });
  el.addEventListener("pointermove", (e) => { if ($("tip").classList.contains("on")) tipMove(e); });
  el.addEventListener("pointerleave", tipHide);
}

function irVista(v) {
  vista = v; const app = $("app"); app.dataset.v = v;
  document.querySelectorAll("#nav button[data-v]").forEach((b) => { const on = b.dataset.v === v; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  $("vtitle").textContent = TITULOS[v] || "Inicio";
  app.classList.remove("vin"); void app.offsetWidth; app.classList.add("vin");
  tipHide(); window.scrollTo(0, 0);
}
document.querySelectorAll("#nav button[data-v]").forEach((b) => { b.onclick = () => irVista(b.dataset.v); });

function pintar() {
  registrarCats();
  const c = D.ciclo;
  const ci = $("ciclo"); ci.replaceChildren(ic("calendar", "sm"), document.createTextNode(fecha(c.inicio) + " → " + fecha(c.ventana.hasta)));
  pintarBanner(); pintarEstado(c); pintarHoy(c); pintarFijos(); pintarIngresos(c); pintarMetas(); pintarPresu(); pintarBolsasIni(); pintarLinea(c); pintarDonut(c); pintarConsejos(); pintarFinanzas(); pintarMovs();
  try { pintarStats(); } catch (e) { $("stats").replaceChildren(); }
  $("app").classList.add("ready");
}

function pintarBanner() {
  const b = $("banner"); b.replaceChildren();
  if (!D.pagoProbable) return;
  const card = h("div", "card banner");
  const i = h("div", "bt-i"); i.append(ic("sparkles"));
  const t = h("div", "ban-t", "Te pagaron " + S2(D.pagoProbable.monto)); t.append(h("small", "", "Empieza un ciclo nuevo para repartir tu plata."));
  const bt = h("button", "p", "Ciclo nuevo"); bt.onclick = abrirNuevoCiclo;
  card.append(i, t, bt); b.append(card);
}

function abrirRegistrarIngreso() {
  const c = (D && D.config) || {};
  formModal({
    titulo: "Recibí plata", nota: "Anota lo que te entró (un pago extra, un préstamo, un regalo). Queda en tu lista y lo puedes corregir después.",
    campos: [
      { k: "monto", label: "Monto recibido (" + mon() + ")", tipo: "number", valor: "" },
      { k: "fecha", label: "Fecha en que te entró (AAAA-MM-DD)", valor: D.hoy || new Date().toISOString().slice(0, 10), ayuda: "Si todavía no te cae, pon la fecha de cuando te caerá: se suma ese día." },
      { k: "nota", label: "¿De qué fue? (opcional)", valor: "", ph: "Ej.: me prestaron" },
    ],
    textoGuardar: "Guardar ingreso",
    onGuardar: async (v) => {
      const m = Number(v.monto); if (!(m > 0)) throw new Error("Pon un monto mayor a 0");
      await guardarYCerrar("add", { tipo: "ingreso", monto: m, comercio: (v.nota || "").trim() || "Ingreso", fecha: v.fecha }, "Ingreso guardado");
    },
  });
}

function pintarIngresos(c) {
  const el = $("ing"); el.replaceChildren();
  const f = D.finanzas || {}; const cfg = D.config || {};
  const card = h("div", "card");
  card.append(cardHead("Ingresos", "Tu sueldo es fijo. Los ingresos extra no son seguros: la app cuenta solo el mínimo que esperas. Cuando llegue uno, usa «Recibí» para sumarlo a tu plata de hoy."));
  const ext = f.ingresos || [];
  const tot = Math.max(1, (cfg.sueldo_neto || 0) + ext.reduce((a, i) => a + i.min, 0));
  const fila = (icono, col, t, s, monto, pct, fn) => {
    const r = h("div", "irow tapr"); r.tabIndex = 0;
    const tt = h("div", "t"); const top = h("div", "top"); top.append(h("b", "", t), h("span", "m", monto));
    tt.append(top, h("span", "s", s), bar(pct, col, 4)); r.append(iconBox(icono, col), tt); if (fn) { r.onclick = fn; r.onkeydown = (e) => { if (e.key === "Enter") fn(); }; } return r;
  };
  const tt = h("div", "total"); tt.append(h("span", "", "Esperas este ciclo")); const tb = h("b"); cnt(tb, "ing_tot", tot); tt.append(tb); card.append(tt);
  if (cfg.sueldo_neto > 0) card.append(fila("building", C_AC, "Sueldo", (cfg.proximo_pago && cfg.proximo_pago >= (D.hoy || "") ? "Te pagan el " + fecha(cfg.proximo_pago) : "Normalmente días " + parseInt(c.ventana.desde.slice(8), 10) + " a " + parseInt(c.ventana.hasta.slice(8), 10)) + " · toca para cambiar", S(cfg.sueldo_neto), cfg.sueldo_neto / tot * 100, abrirSueldo));
  if (cfg.dinero_ciclo > 0) card.append(fila("check-circle", C_AC, "Pago de este ciclo", "Recibido el " + (cfg.ultimo_pago ? fecha(cfg.ultimo_pago) : "—") + " · toca para corregir", S(cfg.dinero_ciclo), Math.min(100, cfg.dinero_ciclo / tot * 100), abrirEditarPago));
  (D.movimientos || []).filter((m) => m.tipo === "ingreso" && m.fuente === "app-ingreso").forEach((m) => card.append(fila("arrow-down-left", C_AC, m.comercio, "Anotado el " + fecha(m.fecha) + " · toca para corregir", S(m.monto), Math.min(100, m.monto / tot * 100), () => abrirMov(m))));
  ext.forEach((i) => card.append(fila("banknote", C_AM, i.nombre, "Variable · " + (i.fecha ? fecha(i.fecha) : "sin fecha") + (i.max > i.min ? " · hasta " + S(i.max) : ""), S(i.min), i.min / tot * 100, () => abrirIngreso((D.finanzas.ingresos || []).find((x) => x.nombre === i.nombre) || i, null))));
  if (cfg.sueldo_neto <= 0 && !ext.length) card.append(vacio("banknote", "Aún no hay ingresos", "Anota tu sueldo o un pago que esperas."));
  const row = h("div", "row");
  const b1 = btnIco("s", "plus", "Esperado"); b1.onclick = () => abrirIngreso(null, null);
  const b2 = btnIco("p", "arrow-down-left", "Recibí"); b2.onclick = abrirRegistrarIngreso;
  row.append(b1, b2); card.append(row);
  el.append(card);
}

function pintarMetas() {
  const el = $("metas"); el.replaceChildren();
  const ms = D.metas || [];
  const card = h("div", "card");
  card.append(cardHead("Metas de ahorro", "Cada anillo muestra cuánto llevas de tu meta. Toca una meta para actualizar cuánto llevas."));
  if (!ms.length) card.append(vacio("target", "Aún no tienes metas", "Crea una para ver tu avance.", "Crear meta", () => abrirMeta(null, null)));
  else {
    const grid = h("div", "metas-grid");
    ms.forEach((m) => {
      const pct = Math.max(0, Math.min(100, Number(m.pct !== undefined ? m.pct : (m.objetivo > 0 ? m.ahorrado / m.objetivo * 100 : 0))));
      const it = h("div", "meta"); it.tabIndex = 0; const w = h("div", "mring");
      const done = pct >= 100;
      w.append(ring(pct, { size: 92, stroke: 6, color: done ? C_AC : C_AM }), h("div", "mpct", Math.round(pct) + "%"));
      if (done) { w.classList.add("lograda"); if (!metasFestejadas.has(m.nombre)) { metasFestejadas.add(m.nombre); setTimeout(() => confeti(w), 400); } }
      const falta = Math.max(0, m.objetivo - m.ahorrado);
      it.append(w, h("b", "mn", m.nombre), h("span", "ms", S(m.ahorrado) + " de " + S(m.objetivo)), h("span", "ms", done ? "Lograda" : "Faltan " + S(falta) + (m.fecha ? " · " + fecha(m.fecha) : "")));
      it.onclick = () => abrirMeta(m, null); it.onkeydown = (e) => { if (e.key === "Enter") abrirMeta(m, null); };
      grid.append(it);
    });
    card.append(grid);
  }
  const b = btnIco("s full", "plus", "Nueva meta"); b.onclick = () => abrirMeta(null, null); if (ms.length) card.append(b);
  el.append(card);
}

const ESTADO = { verde: ["En orden", "check-circle", C_AC], amarillo: ["Con cuidado", "alert-triangle", C_AM], rojo: ["En riesgo", "alert-triangle", C_RED] };

function abrirFijo(f, volver) {
  const propias = String((D.config && D.config.categorias) || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cats = D.categorias.concat(propias.filter((x) => !D.categorias.includes(x)));
  formModal({
    titulo: f ? f.nombre : "Nuevo pago fijo",
    nota: "Algo que pagas todos los meses: suscripción, gimnasio, cuota… Marca cuándo lo pagas y la app lo cuenta.",
    campos: [
      { k: "nombre", label: "¿Qué pagas?", valor: f ? f.nombre : "", ph: "Ej.: Spotify" },
      { k: "monto", label: "Cuánto es (" + mon() + ")", tipo: "number", valor: f ? f.monto : "" },
      { k: "dia", label: "¿Qué día del mes te cobran? (1 a 31)", tipo: "number", valor: f ? f.dia : "" },
      { k: "categoria", label: "Categoría", tipo: "select", opciones: cats.map((k) => [k, NOMBRE[k] || k]), valor: f ? f.categoria : "suscripciones" },
    ],
    onGuardar: async (v) => {
      if (!(v.nombre || "").trim()) throw new Error("Escribe qué pagas.");
      if (!(Number(v.monto) > 0)) throw new Error("El monto debe ser mayor a 0.");
      const dia = Number(v.dia); if (!(dia >= 1 && dia <= 31)) throw new Error("El día va de 1 a 31.");
      rapido("fijo_guardar", { original: f ? f.nombre : undefined, nombre: v.nombre.trim(), monto: Number(v.monto), dia, categoria: v.categoria }, "Pago fijo guardado"); if (volver) volver();
    },
    onBorrar: f ? async () => { rapido("fijo_borrar", { nombre: f.nombre }, "Pago fijo borrado"); if (volver) volver(); } : null,
    nombreBorrar: f ? f.nombre : "",
    onCerrar: volver,
  });
}

function pintarFijos() {
  const el = $("fijos"); if (!el) return; el.replaceChildren();
  const L = D.fijos || [];
  const card = h("div", "card");
  card.append(cardHead("Pagos fijos", "Lo que pagas todos los meses. Marca cada pago cuando lo hagas. Lo pendiente que vence antes de tu próximo pago se reserva de tu plata."));
  const pend = L.filter((f) => !f.pagado).reduce((t, f) => t + f.monto, 0), pag = L.filter((f) => f.pagado).reduce((t, f) => t + f.monto, 0);
  if (L.length) {
    const tt = h("div", "total"); tt.append(h("span", "", "Falta pagar")); const tb = h("b"); cnt(tb, "fij_pend", pend); tt.append(tb); card.append(tt);
    const sb = h("div", "sub", "Ya pagaste " + S(pag) + " este mes."); sb.style.margin = "8px 0 4px"; card.append(sb);
  }
  if (!L.length) card.append(vacio("receipt", "Aún no tienes pagos fijos", "Agrega tus suscripciones, el gimnasio y otras cuotas para saber cuál pagaste y cuál falta."));
  L.slice().sort((a, b) => (a.pagado - b.pagado) || a.dia - b.dia).forEach((f) => {
    const r = h("div", "irow"); r.style.cssText = "display:flex;align-items:center;gap:10px";
    const t = h("div", "t"); t.style.cssText = "flex:1;min-width:0;cursor:pointer"; t.tabIndex = 0;
    const top = h("div", "top"); top.append(h("b", "", f.nombre), h("span", "m", S2(f.monto)));
    const sub = f.pagado ? "Pagado este mes" : (f.atrasado ? "Atrasado: era el día " + f.dia : "Vence el " + fecha(f.vence));
    const sp = h("span", "s", sub); if (f.atrasado) sp.style.color = C_RED; if (f.pagado) sp.style.color = C_AC;
    t.append(top, sp); t.onclick = () => abrirFijo(f, null);
    const b = btnIco(f.pagado ? "s" : "p", f.pagado ? "check-circle" : "check", f.pagado ? "Pagado" : "Pagar"); b.style.cssText = "flex:none;min-width:92px";
    b.onclick = () => rapido("fijo_pagar", { nombre: f.nombre, pagado: !f.pagado }, f.pagado ? "Marcado como pendiente" : "Marcado como pagado");
    r.append(iconBox(f.pagado ? "check-circle" : "clock", f.pagado ? C_AC : (f.atrasado ? C_RED : C_AM)), t, b); card.append(r);
  });
  const ba = btnIco("s full", "plus", "Agregar pago fijo"); ba.style.marginTop = "12px"; ba.onclick = () => abrirFijo(null, null); card.append(ba);
  el.append(card);
}

function pintarEstado(c) {
  const el = $("estado"); el.replaceChildren();
  if (c.estado !== "sin_config") return;
  const card = h("div", "card");
  const sueldo = (D.config && D.config.sueldo_neto) || 0;
  if (sueldo > 0) {
    card.append(vacio("building", "¿Ya te pagaron?", "Tu sueldo es de " + S(sueldo) + ", pero aún no me dices cuánta plata tienes para este ciclo. Dime cuánto tienes ahora y empiezo a calcular tu gasto diario."));
    const b1 = btnIco("p", "check-circle", "Ya me pagaron"); b1.style.alignSelf = "center"; b1.style.marginBottom = "12px"; b1.onclick = abrirNuevoCiclo; card.append(b1); el.append(card); return;
  }
  card.append(vacio("settings", "Cuenta tu plata", "Dinos tu sueldo y cuánto tienes hoy para calcular tu gasto diario."));
  const b = h("button", "p", "Empezar"); b.style.alignSelf = "center"; b.style.marginBottom = "12px"; b.onclick = abrirCfg; card.append(b); el.append(card);
}

function pintarHoy(c) {
  const el = $("hoy"); el.replaceChildren();
  if (c.estado === "sin_config") return;
  if (c.estado === "esperando") {
    const w = h("div", "card hoy");
    w.append(cardHead("Tu pago está por llegar", ["Esa plata todavía no es tuya para gastar. Cuando llegue la fecha, la app empieza a contarla.", "Si la fecha no es correcta, toca «Corregir»."]));
    const bd = h("div", "hoy-body"); const l = h("div", "hoy-l");
    const est = h("span", "est"); est.append(h("i", "edot"), document.createTextNode("Llega el " + fecha(c.pagoEn)), ic("clock", "sm"));
    const num = h("div", "big"); cnt(num, "esp", c.montoEsperado);
    l.append(h("div", "sub", c.diasParaPago === 1 ? "Mañana te llega:" : "Te llega en " + c.diasParaPago + " días:"), num, est, h("div", "sub", "Hasta entonces, hoy tienes S/ 0 para gastar."));
    bd.append(l); w.append(bd);
    const r2 = h("div", "row"); r2.style.marginTop = "12px";
    const b1 = btnIco("s", "pencil", "Corregir"); b1.onclick = abrirEditarPago;
    const b2 = btnIco("p", "check-circle", "Ya me pagaron"); b2.onclick = abrirNuevoCiclo;
    r2.append(b1, b2); w.append(r2); el.append(w); return;
  }
  const card = h("div", "card hoy " + c.estado);
  card.append(cardHead("Disponible hoy", ["A este ritmo gastarás " + S(c.proyeccion) + " de " + S(c.presupuesto) + " (" + Math.round(c.ratio * 100) + "%).", "El anillo muestra cuánto falta del ciclo hasta tu pago. El número es lo que puedes gastar hoy sin pasarte."]));
  const [txt, icn] = ESTADO[c.estado] || ["", "info"];
  const resto = Math.max(0, Math.min(100, (c.total - c.pasados) / Math.max(1, c.total) * 100));
  const col = c.estado === "rojo" ? C_RED : c.estado === "amarillo" ? C_AM : C_AC;
  const body = h("div", "hoy-body"); const l = h("div", "hoy-l");
  const num = h("div", "big"); cnt(num, "hoy", c.porDia);
  const est = h("span", "est"); est.append(h("i", "edot"), document.createTextNode(txt), ic(icn, "sm"));
  l.append(num, est, h("div", "sub", "Lo que puedes gastar hoy sin pasarte."));
  const rw = h("div", "hoy-ring"); rw.append(ring(resto, { size: 148, stroke: 6, color: col }));
  const mid = h("div", "mid"); const nb = h("b"); cnt(nb, "hoy_dias", c.restan, (n) => String(Math.round(n))); mid.append(nb, h("span", "", c.restan === 1 ? "día" : "días")); rw.append(mid);
  body.append(l, rw); card.append(body);
  if (c.atrasado) { const b = h("button", "p btn-ya", "Ya me pagaron"); b.onclick = abrirNuevoCiclo; b.style.alignSelf = "flex-start"; card.append(b); }
  const pct = Math.min(100, c.gastado / Math.max(1, c.presupuesto) * 100);
  const bl = h("div", "hoy-bar"); const bt = h("div", "blk-t"); bt.append(h("span", "", "Presupuesto usado"), h("b", "", Math.round(pct) + "%"));
  const tr2 = bar(pct, col); tr2.classList.add("gruesa");
  const lg2 = h("div", "leyenda"); lg2.append(h("span", "", S(c.gastado) + " gastado"), h("span", "", "de " + S(c.presupuesto))); bl.append(bt, tr2, lg2); card.append(bl);
  if (c.fijosPendientes > 0) { const fp = h("div", "sub", "Reservado para pagos fijos que vencen antes de tu pago: " + S(c.fijosPendientes)); fp.style.marginTop = "8px"; card.append(fp); }
  if (c.programado > 0) { const pg = h("div", "sub", "Reservado para gastos de los próximos días: " + S(c.programado)); pg.style.marginTop = "8px"; card.append(pg); }
  const mini = h("div", "mini");
  [["Queda", c.disponible, "m_q", S], ["Gastado", c.gastado, "m_g", S], ["Al pago", c.restan, "m_p", (n) => Math.round(n) + " d"]].forEach(([lab, v, k, f]) => { const d = h("div"); const b = h("b"); cnt(b, k, v, f); d.append(h("span", "ml", lab), b); mini.append(d); });
  card.append(mini); el.append(card);
}

// ---- bolsas ----

function gastosDeBolsa(nombre) {
  const P = D.presupuesto || {}; const full = (P.bolsas || []).find((x) => x.nombre === nombre);
  const cats = (full && full.cats) || [];
  return (D.movimientos || []).filter((m) => m.tipo === "gasto" && cats.includes(m.categoria));
}

// Una sola lista, fácil: cuánto gastas al mes en cada cosa, cuánto llevas y cuánto te queda.
function bolsasUnificadas() {
  const P = D.presupuesto || {};
  const ini = (D.ciclo && D.ciclo.inicio) || "";
  return (P.sueldo || []).map((b) => {
    const full = (P.bolsas || []).find((x) => x.nombre === b.nombre) || { cats: [] };
    const g = (D.movimientos || []).filter((m) => m.tipo === "gasto" && m.fecha >= ini && full.cats.includes(m.categoria)).reduce((a, m) => a + m.monto, 0);
    return { nombre: b.nombre, emoji: b.emoji, monto: b.monto, gastado: Math.round(g), queda: Math.round(b.monto - g) };
  });
}

function listaBolsas(lista, modo, limite) {
  const P = D.presupuesto;
  const grid = h("div", "bolsas");
  lista.slice(0, limite || lista.length).forEach((b, i) => {
    const col = BOLSA_COL[i % BOLSA_COL.length];
    const row = h("div", "bolsa" + (bolsasAbiertas.has(b.nombre) ? " open" : ""));
    const head = h("button", "bolsa-h"); head.type = "button"; head.setAttribute("aria-expanded", bolsasAbiertas.has(b.nombre) ? "true" : "false");
    const t = h("div", "t"); const top = h("div", "top"); top.append(h("b", "", b.nombre));
    if (modo === "hoy") {
      const neg = b.queda < 0;
      const m = h("span", "m" + (neg ? " neg" : "")); if (neg) m.append(ic("alert-triangle", "sm"), document.createTextNode(" −" + S(-b.queda))); else m.textContent = "Queda " + S(b.queda);
      top.append(m);
      t.append(top, h("span", "s", S(b.gastado) + " de " + S(b.monto)), bar(b.monto > 0 ? b.gastado / b.monto * 100 : (b.gastado > 0 ? 100 : 0), neg ? C_RED : col));
    } else { top.append(h("span", "m", S(b.monto))); t.append(top, h("span", "s", b.modo === "monto" ? "Monto fijo al mes" : b.pct + "% de lo que te sobra al mes"), bar(b.modo === "monto" ? Math.min(100, b.monto / Math.max(1, P.baseSueldo || b.monto) * 100) : b.pct, col)); }
    head.append(bolsaIco(b, col), t, ic("chevron-down", "sm chev"));
    const det = h("div", "det"); const din = h("div"); const dc = h("div", "det-in");
    const gs = gastosDeBolsa(b.nombre).slice(0, 4);
    if (gs.length) { dc.append(h("div", "cap", "Últimos gastos")); gs.forEach((g) => { const ln = h("div", "dline"); ln.append(h("span", "", g.comercio + " · " + fecha(g.fecha)), h("b", "", S2(g.monto))); dc.append(ln); }); }
    else dc.append(h("div", "sub", "Aún no hay gastos en esta bolsa."));
    const full = (P.bolsas || []).find((x) => x.nombre === b.nombre);
    if (full) { const e = btnIco("s", "pencil", "Editar bolsa"); e.onclick = () => abrirBolsa(full, () => {}); dc.append(e); }
    din.append(dc); det.append(din);
    head.onclick = () => { const on = row.classList.toggle("open"); head.setAttribute("aria-expanded", on ? "true" : "false"); if (on) bolsasAbiertas.add(b.nombre); else bolsasAbiertas.delete(b.nombre); };
    row.append(head, det); grid.append(row);
  });
  return grid;
}

function pintarPresu() {
  const el = $("presu"); el.replaceChildren();
  const P = D.presupuesto; if (!P) return;
  const card = h("div", "card");
  card.append(cardHead("Gastos variables", ["Lo que cambia cada mes (comida, transporte, salidas…). Pon un tope por cosa y aquí ves cuánto llevas gastado y cuánto te queda.", "Toca una para ver sus gastos o cambiar el monto."]));
  const lista = bolsasUnificadas();
  if (!lista.length) card.append(vacio("wallet", "Aún no pones tus gastos", "Escribe cuánto gastas al mes en cada cosa.", "Mis gastos del mes", () => abrirMisGastos(null)));
  else card.append(listaBolsas(lista, "hoy", 0));
  const bm = btnIco("p full", "wallet", "Mis gastos del mes"); bm.onclick = () => abrirMisGastos(null); bm.style.marginTop = "16px"; card.append(bm);
  const bb = btnIco("s full", "pencil", "Editar una por una"); bb.onclick = abrirBolsas; bb.style.marginTop = "8px"; card.append(bb);
  el.append(card);
}

function pintarBolsasIni() {
  const el = $("bolsasIni"); el.replaceChildren();
  const P = D.presupuesto; const uni = bolsasUnificadas(); if (!P || !uni.length) return;
  const card = h("div", "card");
  card.append(cardHead("Gastos variables", "Lo que llevas gastado contra lo que pusiste para cada cosa. Toca una para ver sus gastos."));
  card.append(listaBolsas(uni, "hoy", 5));
  const v = h("button", "t"); v.type = "button"; v.append(document.createTextNode("Ver todas las bolsas"), ic("chevron-right", "sm")); v.onclick = () => irVista("presu"); v.style.marginTop = "auto"; v.style.paddingTop = "12px";
  card.append(v); el.append(card);
}

function pintarLinea(c) {
  const el = $("linea"); el.replaceChildren();
  if (c.estado === "sin_config") return;
  const card = h("div", "card");
  if (c.estado === "esperando") {
    card.append(cardHead("Tu pago", "Mientras llega, la app no cuenta con esa plata. Si la fecha cambia, corrígela en «Sueldo»."));
    const t0 = h("div", "blk-t"); t0.append(h("span", "", "Llega"), h("b", "", c.diasParaPago === 1 ? "mañana" : "en " + c.diasParaPago + " días"));
    const l0 = h("div", "leyenda"); l0.append(h("span", "", "Hoy"), h("span", "", fecha(c.pagoEn)));
    const b0 = btnIco("s full", "calendar", "Cambiar la fecha"); b0.onclick = abrirSueldo; b0.style.marginTop = "12px";
    card.append(t0, l0, b0); el.append(card); return;
  }
  card.append(cardHead("Ciclo", "Hoy es el día " + c.pasados + " de " + c.total + ". La franja rayada es tu ventana de pago."));
  const total = c.total;
  const t1 = h("div", "blk-t"); t1.append(h("span", "", "Tiempo"), h("b", "", "Día " + c.pasados + " de " + total));
  const tr = h("div", "track gruesa");
  const ini = Math.max(0, dias(c.inicio, c.ventana.desde)) / total * 100;
  const win = h("div", "win"); win.style.left = Math.min(ini, 98) + "%"; win.style.right = "0";
  const fill = h("div", "fill"); fill.style.width = (c.pasados / total * 100) + "%";
  const m = h("div", "hoy-m"); m.style.left = "calc(" + (c.pasados / total * 100) + "% - 1px)";
  tr.append(win, fill, m);
  const l = h("div", "leyenda"); l.append(h("span", "", fecha(c.inicio)), h("span", "", "Pago ~ " + fecha(c.fin)));
  card.append(t1, tr, l); el.append(card);
}

// ---- gastos por categoría ----

function donutSvg(pares, tot, size, centro) {
  const wrap = h("div", "donut-box"); wrap.style.width = size + "px"; wrap.style.height = size + "px";
  const svg = sv("svg", { viewBox: "0 0 42 42", class: "donut", width: size, height: size, "aria-hidden": "true" });
  sv("circle", { cx: 21, cy: 21, r: 15.9155, fill: "none", stroke: "rgba(255,255,255,.06)", "stroke-width": 4 }, svg);
  let off = 0; wrap._arcs = {};
  pares.forEach(([k, v]) => {
    const p = v / tot * 100; const col = COL[k] || "#9AA3B5";
    const ci = sv("circle", { cx: 21, cy: 21, r: 15.9155, fill: "none", stroke: col, "stroke-width": 4, "stroke-dasharray": Math.max(0, p - 0.8) + " " + (100 - Math.max(0, p - 0.8)), "stroke-dashoffset": -off, class: "arc" }, svg);
    ci.style.animationDelay = (off * 6) + "ms"; off += p; wrap._arcs[k] = ci;
    conTip(ci, () => { svg.classList.add("hv"); ci.classList.add("hi"); return [NOMBRE[k] || k, [["Gastado", S2(v), col], ["Del total", Math.round(p) + "%"]]]; });
    ci.addEventListener("pointerleave", () => { svg.classList.remove("hv"); ci.classList.remove("hi"); });
  });
  wrap.append(svg);
  const mid = h("div", "donut-mid"); const b = h("b"); cnt(b, "donut_" + (centro || "Total"), tot); mid.append(h("span", "", centro || "Total"), b); wrap.append(mid);
  return wrap;
}

function listaCats(pares, tot, donut) {
  const list = h("div", "cats");
  pares.slice(0, 6).forEach(([k, v]) => {
    const row = h("div", "cat"); const dot = h("i", "cdot"); dot.style.background = COL[k] || "#9AA3B5";
    row.append(dot, h("span", "cn", NOMBRE[k] || k), h("span", "cp", Math.round(v / tot * 100) + "%"), h("span", "cm", S(v)));
    const svg = donut && donut.querySelector("svg"); const arc = donut && donut._arcs[k];
    if (arc) { row.onpointerenter = () => { svg.classList.add("hv"); arc.classList.add("hi"); }; row.onpointerleave = () => { svg.classList.remove("hv"); arc.classList.remove("hi"); }; }
    list.append(row);
  });
  return list;
}

function pintarDonut(c) {
  const el = $("donut"); el.replaceChildren();
  const keys = Object.keys(c.porCategoria).sort((a, b) => c.porCategoria[b] - c.porCategoria[a]);
  const card = h("div", "card"); card.append(cardHead("Gastos por categoría", "Muestra en qué categorías se fue tu plata en este ciclo."));
  if (!keys.length) { card.append(vacio("pie", "Aún no hay gastos", "Anota tu primer gasto para ver el reparto.", "Anotar gasto", abrirAdd)); el.append(card); return; }
  const tot = keys.reduce((a, k) => a + c.porCategoria[k], 0);
  const pares = keys.map((k) => [k, c.porCategoria[k]]);
  const wrap = h("div", "donut-wrap"); const d = donutSvg(pares, tot, 156);
  wrap.append(d, listaCats(pares, tot, d)); card.append(wrap); el.append(card);
}

// ---- consejos ----

function iconoConsejo(t) {
  const s = t.toLowerCase();
  if (/deud|debes|cuota/.test(s)) return "wallet"; if (/ahorr|fondo|guard/.test(s)) return "piggy-bank"; if (/comid|almuerz|comer|delivery/.test(s)) return "utensils";
  if (/sueldo|pago|cobr/.test(s)) return "banknote"; if (/meta/.test(s)) return "target"; if (/gast|compr|superas/.test(s)) return "shopping-cart"; if (/transp|taxi/.test(s)) return "bus";
  return "sparkles";
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
  const card = h("div", "card"); card.append(cardHead("Consejos"));
  const tips = h("div", "tips");
  const ver = consejosTodos ? lista : lista.slice(0, 3);
  ver.forEach((t) => {
    const chip = h("button", "tip"); chip.type = "button"; chip.append(ic(iconoConsejo(t)), h("span", "tip-t", cortoConsejo(t)), ic("chevron-right", "chv"));
    chip.onclick = () => info("Consejo", t); tips.append(chip);
  });
  card.append(tips);
  if (lista.length > 3) { const b = h("button", "t"); b.type = "button"; b.append(document.createTextNode(consejosTodos ? "Ver menos" : "Ver " + (lista.length - 3) + " más"), ic(consejosTodos ? "chevron-down" : "chevron-down", "sm")); b.style.marginTop = "8px"; b.onclick = () => { consejosTodos = !consejosTodos; pintarConsejos(); }; card.append(b); }
  el.append(card);
}

// ---- tu mes, plan, deudas ----

function pintarFinanzas() {
  ["fin_mes", "fin_plan", "fin_deu", "fin_ev"].forEach((id) => $(id).replaceChildren());
  const f = D.finanzas; if (!f) return;

  const mes = h("div", "card");
  mes.append(cardHead("Tu mes", "Sueldo = el neto de tu boleta (ya sin lo que se descuenta por planilla). Compromisos = cuotas que salen de tu cuenta + comida en casa. Lo libre es lo único que puedes gastar." + (D.boletas && D.boletas.length ? " Última boleta: " + mesTxt(D.boletas[0].mes) + " · neto " + S2(D.boletas[0].neto) + "." : "")));
  const sueldo = D.config.sueldo_neto || 0;
  const lm = h("div", "mes-l");
  [["Sueldo", sueldo, "mes_s", "", C_AC], ["Fijos", f.compromisos, "mes_f", "ml", C_AM], ["Libre", f.libreMensual, "mes_l", "lib", C_AC]].forEach(([lab, v, k, cls, col], i) => {
    const it = h("div", "mes-i" + (i === 2 ? " lib" : "")); const tp = h("div", "top"); tp.append(h("span", "cap", lab), h("span", "sub", i === 0 ? "" : (sueldo > 0 ? Math.round(v / sueldo * 100) + "% del sueldo" : "")));
    const val = h("div", "v"); cnt(val, k, v);
    it.append(tp, val); if (i > 0 && sueldo > 0) it.append(bar(Math.max(0, v) / sueldo * 100, col, 4));
    lm.append(it);
  });
  mes.append(lm); $("fin_mes").append(mes);

  if (f.plan.length) {
    const pl = h("div", "card"); const tot = f.ingresos.reduce((a, i) => a + i.min, 0);
    pl.append(cardHead("Plan extra", "Con " + S(tot) + " (lo mínimo que esperas), págalo en este orden. Cada deuda que termina te libera su cuota."));
    f.plan.forEach((p, i) => {
      const row = h("div", "step"); row.append(h("span", "num-c", String(i + 1)), h("span", "sn", p.nombre), h("b", "", S(p.monto))); pl.append(row);
    });
    if (f.sobra > 0) { const r = h("div", "step"); const n = h("span", "num-c"); n.append(ic("piggy-bank", "sm")); r.append(n, h("span", "sn", "Sobra (fondo)"), h("b", "", S(f.sobra))); pl.append(r); }
    const bi = btnIco("s full", "pencil", "Ingresos extra"); bi.onclick = abrirIngresos; bi.style.marginTop = "16px"; pl.append(bi);
    $("fin_plan").append(pl);
  }

  const dd = h("div", "card");
  dd.append(cardHead("Deudas", "Toca una deuda para corregirla o anotar un pago."));
  const top = h("div", "debe"); top.append(h("span", "", "Debes en total")); const tb = h("b"); cnt(tb, "debe", f.total); top.append(tb); dd.append(top);
  if (!f.deudas.length) dd.append(vacio("check-circle", "No tienes deudas anotadas", "Si tienes alguna, agrégala para llevar el control."));
  f.deudas.forEach((d, i) => {
    const col = BOLSA_COL[(i + 3) % BOLSA_COL.length];
    const row = h("div", "irow tapr"); row.tabIndex = 0;
    const t = h("div", "t"); const tp = h("div", "top"); tp.append(h("b", "", d.nombre), h("span", "m", S(d.saldo)));
    t.append(tp, h("span", "s", (d.cuota ? S(d.cuota) + "/mes" : "sin cuota") + (d.fin ? " · termina " + mesTxt(d.fin) : "") + (d.interesesPagados > 0 ? " · intereses pagados " + S2(d.interesesPagados) : "")), bar(Math.min(100, d.saldo / Math.max(1, f.total) * 100 * 3), col, 4));
    row.append(iconBox(d.planilla ? "building" : "wallet", col), t);
    const abrir = () => { const full = (D.deudasTodas || []).find((x) => x.nombre === d.nombre) || d; abrirDeuda(full, null); };
    row.onclick = abrir; row.onkeydown = (e) => { if (e.key === "Enter") abrir(); };
    dd.append(row);
  });
  const bd = btnIco("s full", "plus", "Agregar o ver deudas"); bd.onclick = abrirDeudas; bd.style.marginTop = "16px"; dd.append(bd);
  $("fin_deu").append(dd);

  if (f.evolucion.length > 1) {
    const ev = h("div", "card"); ev.append(cardHead("Libre a futuro", "Cada deuda que termina te libera su cuota, y tu plata libre sube."));
    const max = Math.max(...f.evolucion.map((e) => e.libre), 1);
    f.evolucion.forEach((e) => {
      const row = h("div", "evrow"); const t2 = h("div", "leyenda"); t2.style.marginTop = "0"; t2.append(h("span", "", e.mes === "Hoy" ? "Hoy" : mesTxt(e.mes)), h("b", "", S(e.libre)));
      row.append(t2, bar(e.libre / max * 100, C_AC, 6)); ev.append(row);
    });
    $("fin_ev").append(ev);
  }
}

// ---- movimientos ----

function movIco(m) {
  const rech = m.tipo === "rechazo", ing = m.tipo === "ingreso";
  const col = rech ? C_RED : ing ? C_AC : (COL[m.categoria] || "#9AA3B5");
  return iconBox(rech ? "x" : ing ? "arrow-down-left" : (EMO[m.categoria] || "tag"), col, "rd");
}

function pintarMovs() {
  const el = $("movs"); el.replaceChildren();
  const card = h("div", "card");
  const n = D.movimientos.length;
  card.append(cardHead("Movimientos", null, n ? h("span", "ch-x", n + (n === 1 ? " reciente" : " recientes")) : null));
  if (!n) { card.append(vacio("receipt", "Aún no hay movimientos", "Anota un gasto y aparecerá aquí.", "Anotar gasto", abrirAdd)); el.append(card); return; }
  const lst = h("div", "movs");
  D.movimientos.forEach((m) => {
    const row = h("div", "mov"); row.tabIndex = 0; row.setAttribute("role", "button");
    const rech = m.tipo === "rechazo", ing = m.tipo === "ingreso";
    const t = h("div", "t"); t.append(h("b", "", m.comercio), h("span", "d", fecha(m.fecha) + " · " + m.hora + " · " + (NOMBRE[m.categoria] || m.categoria)));
    const mt = h("div", "m" + (rech ? " rech" : ing ? " ing" : ""), (ing ? "+" : rech ? "" : "−") + S2(m.monto)); if (rech) mt.append(h("small", "", "Rechazado"));
    row.append(movIco(m), t, h("span", "cc", NOMBRE[m.categoria] || m.categoria), h("span", "bk", fecha(m.fecha) + " · " + m.hora), mt);
    row.onclick = () => abrirMov(m); row.onkeydown = (e) => { if (e.key === "Enter") abrirMov(m); };
    lst.append(row);
  });
  card.append(lst); el.append(card);
}

// ---------- estadísticas ----------

function chartBarras(meses) {
  const wrap = h("div", "bc");
  const max = Math.max(1, ...meses.map((m) => Math.max(m.ingreso || 0, m.gasto || 0)));
  const plot = h("div", "plot"); plot.style.gridTemplateColumns = "repeat(" + meses.length + ",minmax(0,1fr))";
  [100, 50].forEach((p) => { const g = h("div", "gl"); g.style.top = (100 - p) + "%"; g.append(h("span", "", S(max * p / 100))); plot.append(g); });
  const xl = h("div", "xl"); xl.style.gridTemplateColumns = "repeat(" + meses.length + ",minmax(0,1fr))";
  meses.forEach((m, i) => {
    const col = h("div", "col");
    [[m.ingreso || 0, C_AC], [m.gasto || 0, C_SLATE]].forEach(([v, c], k) => { const b = h("i"); b.style.height = Math.max(1.5, v / max * 100) + "%"; b.style.background = c; b.style.animationDelay = (i * 50 + k * 30) + "ms"; col.append(b); });
    conTip(col, () => [mesTxt(m.mes), [["Ingreso", S(m.ingreso || 0), C_AC], ["Gasto", S(m.gasto || 0), C_SLATE], ["Ahorro", S(m.ahorro || 0)]]]);
    plot.append(col);
    xl.append(h("span", "", MES[parseInt(String(m.mes).slice(5, 7), 10) - 1] || ""));
  });
  wrap.append(plot, xl);
  return wrap;
}

function chartDeuda(dh) {
  const n = dh.length, vals = dh.map((d) => d.total), mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
  const X = (i) => i / (n - 1) * 100, Y = (v) => (1 - (v - mn) / Math.max(1, mx - mn)) * 100;
  const wrap = h("div", "lc"); const pl = h("div", "lp");
  const svg = sv("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", class: "lsvg" });
  const defs = sv("defs", {}, svg); const g = sv("linearGradient", { id: "gd", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  sv("stop", { offset: "0", "stop-color": "#F2F4F8", "stop-opacity": ".16" }, g); sv("stop", { offset: "1", "stop-color": "#F2F4F8", "stop-opacity": "0" }, g);
  const pts = dh.map((d, i) => X(i) + "," + Y(d.total));
  sv("polygon", { points: "0,100 " + pts.join(" ") + " 100,100", fill: "url(#gd)" }, svg);
  const pl2 = sv("polyline", { points: pts.join(" "), fill: "none", stroke: "#F2F4F8", "stroke-width": 1.75, "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", class: "line" }, svg);
  pl2.style.strokeDasharray = "none";
  pl.append(svg);
  const dots = dh.map((d, i) => { const o = h("i", "dot" + (i === n - 1 ? " last" : "")); o.style.left = X(i) + "%"; o.style.top = Y(d.total) + "%"; pl.append(o); return o; });
  const hits = h("div", "hits");
  const idx = (e) => { const r = hits.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left) / Math.max(1, r.width) * (n - 1)))); };
  let ult = -1;
  const mostrar = (e) => { const i = idx(e); if (i !== ult) { if (ult >= 0) dots[ult].classList.remove("on"); dots[i].classList.add("on"); ult = i; } tipShow(e, fecha(dh[i].fecha), [["Debes", S(dh[i].total)]]); };
  hits.addEventListener("pointerenter", mostrar); hits.addEventListener("pointermove", mostrar);
  hits.addEventListener("pointerleave", () => { if (ult >= 0) dots[ult].classList.remove("on"); ult = -1; tipHide(); });
  pl.append(hits); wrap.append(pl);
  return wrap;
}

function pintarStats() {
  const el = $("stats"); el.replaceChildren();
  const E = D.estadisticas || {};
  const meses = (E.meses || []).slice(-6), dh = (E.deudaHistorial || []).slice(-12), cm = (E.categoriasMes || []).filter((x) => x.monto > 0);

  // 1. puntaje
  const sc = h("div", "card s4");
  sc.append(cardHead("Tu salud financiera", E.mensaje ? [E.mensaje, "El puntaje va de 0 a 100: sube si gastas menos de lo que ganas y bajan tus deudas."] : "El puntaje va de 0 a 100: sube si gastas menos de lo que ganas y bajan tus deudas."));
  if (typeof E.puntaje !== "number") sc.append(vacio("bar-chart", "Aún faltan datos", "Usa la app unos días para ver tu puntaje."));
  else {
    const p = Math.max(0, Math.min(100, E.puntaje)); const col = p >= 70 ? C_AC : p >= 40 ? C_AM : C_RED;
    const tn = { mejora: ["trending-up", C_AC, "Mejorando"], igual: ["arrow-right", C_AM, "Estable"], empeora: ["trending-down", C_RED, "Empeorando"] }[E.tendencia] || ["arrow-right", "#8B93A7", "Estable"];
    const body = h("div", "score-body"); const w = h("div", "score-ring"); w.append(ring(p, { size: 168, stroke: 6, color: col }));
    const mid = h("div", "mid"); const nb = h("b"); cnt(nb, "score", p, (n) => String(Math.round(n))); mid.append(nb, h("span", "", "de 100")); w.append(mid);
    const tr = h("div", "trend"); tr.style.color = tn[1]; tr.append(ic(tn[0], "sm"), h("span", "", tn[2]));
    body.append(w, tr); if (E.mensaje) body.append(h("div", "stat-msg", cortoConsejo(E.mensaje)));
    sc.append(body);
  }
  el.append(sc);

  // 2. ingreso vs gasto
  const bc = h("div", "card s8");
  bc.append(cardHead("Ganas vs gastas", "Pasa el mouse o el dedo por un mes para ver el detalle."));
  if (meses.length < 2) bc.append(vacio("bar-chart", "Aún faltan meses", "Cuando tengas dos meses de datos, aparecerá aquí."));
  else {
    bc.append(chartBarras(meses));
    const lg = h("div", "legend");
    [["Ganas", C_AC], ["Gastas", C_SLATE]].forEach(([t, c]) => { const s = h("span", "lg"); const i = h("i"); i.style.background = c; s.append(i, document.createTextNode(t)); lg.append(s); });
    bc.append(lg);
  }
  el.append(bc);

  // 3. deuda
  const dc = h("div", "card s7");
  dc.append(cardHead("Tu deuda", "Cuánto debes en total a lo largo del tiempo. Si baja, vas bien."));
  if (dh.length < 2) dc.append(vacio("trending-down", "Aún faltan datos", "Se llenará con el tiempo."));
  else {
    const dif = dh[dh.length - 1].total - dh[0].total; const dl = h("div", "debe");
    dl.append(h("span", "", (dif <= 0 ? "Bajó desde " : "Subió desde ") + fecha(dh[0].fecha)), h("b", dif <= 0 ? "ok" : "neg", S(Math.abs(dif))));
    dc.append(dl, chartDeuda(dh));
    const ax = h("div", "xl2"); ax.append(h("span", "", fecha(dh[0].fecha)), h("span", "", fecha(dh[dh.length - 1].fecha))); dc.append(ax);
  }
  el.append(dc);

  // 4. categorías del mes
  const cc = h("div", "card s5");
  cc.append(cardHead("Este mes por categoría", "En qué categorías gastaste este mes."));
  if (cm.length < 1) cc.append(vacio("pie", "Aún no hay gastos", "Anota un gasto para ver el reparto.", "Anotar gasto", abrirAdd));
  else {
    const ord = cm.slice().sort((a, b) => b.monto - a.monto); const tot = ord.reduce((a, x) => a + x.monto, 0);
    const pares = ord.map((x) => [x.categoria, x.monto]);
    const wrap = h("div", "donut-wrap"); const d = donutSvg(pares, tot, 140, "Mes");
    wrap.append(d, listaCats(pares, tot, d)); cc.append(wrap);
  }
  el.append(cc);
}

// ---------- detalle de un movimiento ----------

let movActual = null;
function abrirMov(m) {
  movActual = m;
  $("smTitulo").textContent = m.comercio;
  $("smInfo").textContent = S2(m.monto) + " · " + m.banco + " · " + fecha(m.fecha) + " " + m.hora;
  const g = $("smCats"); g.replaceChildren();
  const propias = String((D.config && D.config.categorias) || "").split(",").map((x) => x.trim()).filter(Boolean);
  D.categorias.concat(propias.filter((x) => !D.categorias.includes(x))).forEach((k) => {
    const b = h("button", k === m.categoria ? "sel" : ""); b.type = "button";
    const d = h("i", "cdot"); d.style.background = COL[k] || "#9AA3B5";
    b.append(d, h("span", "", NOMBRE[k] || k));
    b.onclick = async () => { $("sheetMov").hidden = true; await cargar("setcat", { id: m.id, categoria: k, aprender: $("smAprender").checked }); say("Categoría cambiada", "ok"); };
    g.append(b);
  });
  $("smAprender").checked = false;
  $("sheetMov").hidden = false;
}
$("smCerrar").onclick = $("smX").onclick = () => { $("sheetMov").hidden = true; };
$("smEditar").onclick = () => {
  if (!movActual) return;
  const m = movActual; $("sheetMov").hidden = true;
  const esIng = m.tipo === "ingreso";
  const propias = String((D.config && D.config.categorias) || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cats = D.categorias.concat(propias.filter((x) => !D.categorias.includes(x)));
  formModal({
    titulo: esIng ? "Corregir ingreso" : "Corregir gasto",
    nota: "Cambia lo que te equivocaste: el monto, la fecha o el nombre.",
    campos: [
      { k: "comercio", label: "Nombre", valor: m.comercio },
      { k: "monto", label: "Monto (" + mon() + ")", tipo: "number", valor: m.monto },
      { k: "fecha", label: "Fecha (AAAA-MM-DD)", valor: m.fecha, ayuda: "Ej.: " + (D.hoy || "2026-10-20") + ".  Si pones una fecha de mañana, queda reservado como gasto programado." },
      ...(esIng ? [] : [{ k: "categoria", label: "Categoría", tipo: "select", opciones: cats.map((k) => [k, NOMBRE[k] || k]), valor: m.categoria }]),
    ],
    onGuardar: async (v) => {
      await guardarYCerrar("mov_editar", { id: m.id, comercio: v.comercio, monto: v.monto, fecha: v.fecha, ...(esIng ? {} : { categoria: v.categoria }) }, "Cambios guardados");
    },
  });
};
$("smBorrar").onclick = async () => { if (!movActual || !confirm("¿Borrar este movimiento?")) return; $("sheetMov").hidden = true; await cargar("delete", { id: movActual.id }); say("Movimiento borrado", "ok"); };

// ---------- registrar un gasto (hoja con teclado) y barra rápida ----------

async function enviarGasto(t, btn, err, ok) {
  t = (t || "").trim(); if (!t) return;
  if (err) err.textContent = "";
  if (!/\d/.test(t)) { const msg = "Escribe el monto. Ejemplo: almuerzo 18"; if (err) err.textContent = msg; say(msg, "bad"); return; }
  rapido("add", { texto: t }, "Gasto agregado"); if (ok) ok();
}

function abrirAdd() {
  if (!D) return;
  $("addMsg").textContent = ""; $("texto2").value = "";
  $("sheetAdd").hidden = false;
  if (esLaptop()) $("texto2").focus();
}

(function armarTeclado() {
  const k = $("keys");
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "<"].forEach((x) => {
    const b = h("button"); b.type = "button"; b.setAttribute("aria-label", x === "<" ? "Borrar" : x);
    if (x === "<") b.append(ic("backspace")); else b.textContent = x;
    b.onclick = () => { const i = $("texto2"); i.value = x === "<" ? i.value.slice(0, -1) : i.value + x; };
    k.append(b);
  });
  const q = $("qchips");
  ["Almuerzo", "Pasaje", "Café", "Super"].forEach((x) => {
    const b = h("button", "", x); b.type = "button";
    b.onclick = () => { const i = $("texto2"); const m = i.value.match(/[\d.,]+\s*$/); i.value = x.toLowerCase() + " " + (m ? m[0].trim() : ""); if (esLaptop()) i.focus(); };
    q.append(b);
  });
})();

$("formAdd2").onsubmit = (e) => { e.preventDefault(); enviarGasto($("texto2").value, $("btnAdd2"), $("addMsg"), () => { $("sheetAdd").hidden = true; }); };
$("formAdd").onsubmit = (e) => { e.preventDefault(); enviarGasto($("texto").value, $("btnAdd"), null, () => { $("texto").value = ""; }); };
$("addX").onclick = () => { $("sheetAdd").hidden = true; };

// ---------- botones, atajos y cierre de hojas ----------

$("btnCfg").onclick = () => { if (D) abrirCfg(); };
$("navCfg").onclick = () => { if (D) abrirCfg(); };
$("btnBoleta").onclick = () => { if (D) abrirBoleta(); };
$("btnIng").onclick = () => { if (D) abrirRegistrarIngreso(); };
$("btnGasto").onclick = abrirAdd;
$("fab").onclick = abrirAdd;
$("btnScan").onclick = async () => { say("Revisando correos…", "mut"); $("btnScan").disabled = true; try { await cargar("scan"); say("Correos revisados", "ok"); } catch {} $("btnScan").disabled = false; };
$("btnUsers").onclick = () => abrirUsuarios();
$("infoCerrar").onclick = $("infoX").onclick = () => { $("sheetInfo").hidden = true; };

// ---------- video "Cómo funciona" ----------

function abrirVideo(conGuia) {
  const m = $("vidModal"); if (!m) return;
  $("vidGuia").hidden = !conGuia;
  m.hidden = false;
  try { $("vidX").focus({ preventScroll: true }); } catch {}
}
function cerrarVideo() {
  const m = $("vidModal"); if (!m || m.hidden) return false;
  const v = $("vidV"); try { v.pause(); } catch {}
  m.hidden = true; return true;
}
document.querySelectorAll("[data-video]").forEach((b) => { b.onclick = () => abrirVideo(false); });
$("vidX").onclick = cerrarVideo;
$("vidGuia").onclick = () => { cerrarVideo(); abrirGuiaOtros(); };
(() => { const m = $("vidModal"); let abajo = false;
  m.addEventListener("pointerdown", (e) => { abajo = e.target === m; });
  m.addEventListener("click", (e) => { if (abajo && e.target === m) cerrarVideo(); abajo = false; });
})();

function cerrarTodo() { ["sheetInfo", "sheetMov", "sheetAdd", "sheetForm"].forEach((id) => { $(id).hidden = true; }); formCierre = null; tipHide(); }
function hayHoja() { if (!$("vidModal").hidden) return true; return ["sheetInfo", "sheetMov", "sheetAdd", "sheetForm"].some((id) => !$(id).hidden); }

function fondo(id, fn) {
  const el = $(id); let abajo = false;
  el.addEventListener("pointerdown", (e) => { abajo = e.target === el; });
  el.addEventListener("click", (e) => { if (abajo && e.target === el) fn(); abajo = false; });
}
fondo("sheetInfo", () => { $("sheetInfo").hidden = true; });
fondo("sheetMov", () => { $("sheetMov").hidden = true; });
fondo("sheetAdd", () => { $("sheetAdd").hidden = true; });
fondo("sheetForm", () => { (formCierre || cerrarForm)(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (cerrarVideo()) return;
    if (!$("sheetInfo").hidden) $("sheetInfo").hidden = true;
    else if (!$("sheetMov").hidden) $("sheetMov").hidden = true;
    else if (!$("sheetAdd").hidden) $("sheetAdd").hidden = true;
    else if (!$("sheetForm").hidden) (formCierre || cerrarForm)();
    else if (document.activeElement === $("texto")) $("texto").blur();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || $("app").hidden || hayHoja()) return;
  const tg = e.target; if (tg && (/^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName) || tg.isContentEditable)) return;
  if (e.key === "n" || e.key === "N") { e.preventDefault(); abrirAdd(); }
  else if (e.key === "/") { if ($("texto").offsetParent) { e.preventDefault(); $("texto").focus(); } }
  else if (/^[1-5]$/.test(e.key)) irVista(VISTAS[Number(e.key) - 1]);
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
irVista(vistaPorDefecto);
iniciar();
