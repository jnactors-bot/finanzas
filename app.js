const $ = (id) => document.getElementById(id);
const KEY = "finanzas_codigo";
const getCode = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
const setCode = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };

const EMO = { comida: "🍔", super: "🛒", transporte: "🚌", salud: "💊", suscripciones: "📺", ocio: "🎮", formd: "🧵", hogar: "🏠", transferencias: "📲", efectivo: "💵", otros: "📌" };
const COL = { comida: "#f59e0b", super: "#22c55e", transporte: "#3b82f6", salud: "#ef4444", suscripciones: "#a855f7", ocio: "#ec4899", formd: "#c6ff3d", hogar: "#14b8a6", transferencias: "#94a3b8", efectivo: "#84cc16", otros: "#64748b" };
const NOMBRE = { comida: "Comida", super: "Super", transporte: "Transporte", salud: "Salud", suscripciones: "Suscrip.", ocio: "Ocio", formd: "FORMD", hogar: "Hogar", transferencias: "Yape/Plin", efectivo: "Efectivo", otros: "Otros" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

let D = null;

const S = (n) => "S/ " + Math.round(n).toLocaleString("es-PE");
const S2 = (n) => "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (s) => parseInt(s.slice(8, 10), 10) + " " + MES[parseInt(s.slice(5, 7), 10) - 1];
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
  const res = await fetch(window.SCRIPT_URL, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: getCode(), action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.auth === false) { setCode(""); mostrar(); throw new Error("Código incorrecto. Escríbelo otra vez."); }
  if (!res.ok || data.error) throw new Error(data.error || "Error " + res.status);
  return data;
}

function mostrar() {
  const tiene = !!getCode();
  $("setup").hidden = tiene;
  $("app").hidden = !tiene;
  $("barra").hidden = !tiene;
  if (tiene) cargar();
}

async function cargar(accion = "dashboard", extra = {}) {
  try {
    D = await api(accion, extra);
    pintar();
  } catch (e) { say(e.message, "bad"); }
}

function pintar() {
  const c = D.ciclo;
  $("ciclo").textContent = "Ciclo " + fecha(c.inicio) + " → " + fecha(c.ventana.hasta) + " · te pagan entre el " + parseInt(c.ventana.desde.slice(8), 10) + " y el " + parseInt(c.ventana.hasta.slice(8), 10);
  pintarBanner(); pintarEstado(c); pintarHoy(c); pintarLinea(c); pintarDonut(c); pintarConsejos(); pintarFinanzas(); pintarMovs();
}

function pintarBanner() {
  const b = $("banner"); b.replaceChildren();
  if (!D.pagoProbable) return;
  const card = h("div", "card banner");
  card.append(h("b", "", "🎉 Parece que ya te pagaron " + S2(D.pagoProbable.monto)));
  const bt = h("button", "p", "Empezar ciclo nuevo"); bt.style.cssText = "margin-top:10px;padding:11px 14px"; bt.onclick = abrirCfg;
  card.append(h("div", "sub", "Pulsa para empezar un ciclo nuevo y decirme cuánta plata tienes."), bt);
  b.append(card);
}

function pintarEstado(c) {
  const el = $("estado"); el.replaceChildren();
  const card = h("div", "card estado " + (c.estado === "sin_config" ? "" : c.estado));
  const luz = h("div", "luz", { verde: "🟢", amarillo: "🟡", rojo: "🔴", sin_config: "⚙️" }[c.estado]);
  const t = h("div");
  if (c.estado === "sin_config") {
    t.append(h("b", "", "Cuéntame cuánta plata tienes"), h("span", "", "Abre ⚙️ Ajustes y escribe tu plata de este ciclo para empezar."));
  } else {
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
  card.append(h("div", "lab", c.atrasado ? "Tu pago ya pasó el 21: cuando llegue, pulsa “Ya me pagaron”." : "para llegar bien al día de pago"));
  const mini = h("div", "mini");
  [[S(c.disponible), "te quedan"], [c.restan + (c.restan === 1 ? " día" : " días"), "para el pago"], [S(c.gastado), "gastado"]].forEach(([a, b]) => {
    const d = h("div"); d.append(h("b", "", a), h("span", "", b)); mini.append(d);
  });
  card.append(mini); el.append(card);
}

function pintarLinea(c) {
  const el = $("linea"); el.replaceChildren();
  if (c.estado === "sin_config") return;
  const card = h("div", "card");
  card.append(h("h2", "", "Tu ciclo"));
  const total = c.total;
  const tr = h("div", "track");
  const ini = Math.max(0, dias(c.inicio, c.ventana.desde)) / total * 100;
  const win = h("div", "win"); win.style.left = Math.min(ini, 98) + "%"; win.style.right = "0";
  const fill = h("div", "fill"); fill.style.width = (c.pasados / total * 100) + "%";
  const m = h("div", "hoy-m"); m.style.left = "calc(" + (c.pasados / total * 100) + "% - 1px)";
  tr.append(win, fill, m);
  card.append(h("div", "sub", "Días: hoy es el día " + c.pasados + " de " + total + " (la franja rayada es tu ventana de pago)"), tr);
  const pct = Math.min(100, c.gastado / Math.max(1, c.presupuesto) * 100);
  const tr2 = h("div", "track");
  const g = h("div", "gasto"); g.style.width = pct + "%";
  g.style.background = c.estado === "rojo" ? "var(--rojo)" : c.estado === "amarillo" ? "var(--amarillo)" : "var(--verde)";
  tr2.append(g);
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


function mesTxt(m) {
  if (!/^\d{4}-\d{2}/.test(m)) return m;
  return MES[parseInt(m.slice(5, 7), 10) - 1] + " " + m.slice(0, 4);
}

function pintarFinanzas() {
  const el = $("fin"); el.replaceChildren();
  const f = D.finanzas;
  if (!f) return;

  const mes = h("div", "card"); mes.append(h("h2", "", "📆 Tu mes en una mirada"));
  const mini = h("div", "mini");
  [[S(D.config.sueldo_neto), "sueldo"], [S(f.compromisos), "compromisos"], [S(f.libreMensual), "libre"]].forEach(([x, y]) => {
    const d = h("div"); d.append(h("b", "", x), h("span", "", y)); mini.append(d);
  });
  mes.append(mini, h("div", "sub", "Sueldo = el neto de tu boleta (ya sin la planilla del GNB). Compromisos = cuotas que salen de tu cuenta + comida en casa. Lo libre es lo único que puedes gastar."));
  el.append(mes);

  if (f.plan.length) {
    const pl = h("div", "card"); pl.append(h("h2", "", "🎯 Plan para tu pago extra"));
    const tot = f.ingresos.reduce((a, i) => a + i.min, 0);
    pl.append(h("div", "sub", "Con S/ " + Math.round(tot).toLocaleString("es-PE") + " (lo mínimo que esperas), págalo en este orden:"));
    f.plan.forEach((p, i) => {
      const row = h("div", "consejo"); row.style.display = "flex"; row.style.justifyContent = "space-between"; row.style.gap = "10px";
      row.append(h("span", "", (i + 1) + ". " + p.nombre), h("b", "", S(p.monto)));
      pl.append(row);
    });
    if (f.sobra > 0) pl.append(h("div", "consejo", "Te sobrarían " + S(f.sobra) + ": guárdalos como fondo de emergencia."));
    el.append(pl);
  }

  const dd = h("div", "card"); dd.append(h("h2", "", "💳 Tus deudas"));
  const top = h("div", "hoy"); top.append(h("div", "lab", "Debes en total"), h("div", "num", S(f.total)));
  top.style.marginBottom = "8px"; top.querySelector(".num").style.fontSize = "34px";
  dd.append(top, h("div", "sub", "Toca una deuda para anotar un pago."));
  f.deudas.forEach((d) => {
    const row = h("div", "mov");
    const t = h("div", "t"); t.append(h("b", "", d.nombre));
    const bar = h("div", "track"); bar.style.height = "8px";
    const fill = h("div", "fill"); fill.style.width = Math.min(100, d.saldo / Math.max(1, f.total) * 100 * 3) + "%"; bar.append(fill);
    const s = h("span", "", (d.cuota ? S(d.cuota) + "/mes · " : "sin cuota fija · ") + (d.fin ? "termina " + mesTxt(d.fin) : "sin fecha") + (d.planilla ? " · se descuenta por planilla" : d.auto ? " · automático" : ""));
    t.append(s, bar);
    row.append(t, h("div", "m", S(d.saldo)));
    row.onclick = async () => {
      const v = prompt("¿Cuánto pagaste a «" + d.nombre + "»? (S/)");
      if (v === null || v === "") return;
      await cargar("pagar_deuda", { nombre: d.nombre, monto: Number(v) });
    };
    dd.append(row);
  });
  if (D.hojaUrl) {
    const a = h("a", "", "Editar deudas e ingresos en mi hoja de Google ↗");
    a.href = D.hojaUrl; a.target = "_blank"; a.rel = "noopener"; a.style.cssText = "display:block;margin-top:12px;color:var(--ac);font-size:14px";
    dd.append(a);
  }
  el.append(dd);

  if (f.evolucion.length > 1) {
    const ev = h("div", "card"); ev.append(h("h2", "", "📈 Tu plata libre en el tiempo"));
    const max = Math.max(...f.evolucion.map((e) => e.libre), 1);
    f.evolucion.forEach((e) => {
      const row = h("div"); row.style.margin = "8px 0";
      const top2 = h("div", "leyenda"); top2.append(h("span", "", e.mes === "Hoy" ? "Hoy" : mesTxt(e.mes) + " · termina " + e.nombre), h("b", "", S(e.libre)));
      const bar = h("div", "track"); bar.style.height = "10px";
      const fl = h("div", "fill"); fl.style.width = (e.libre / max * 100) + "%"; bar.append(fl);
      row.append(top2, bar); ev.append(row);
    });
    ev.append(h("div", "sub", "Cada deuda que termina te libera su cuota. Con los saldos de tu hoja se actualiza solo."));
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
    const monto = h("div", "m" + (m.tipo === "rechazo" ? " rech" : m.tipo === "ingreso" ? " ing" : ""), (m.tipo === "ingreso" ? "+" : "") + S2(m.monto));
    row.append(t, monto);
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
    b.onclick = async () => {
      $("sheetMov").hidden = true;
      await cargar("setcat", { id: m.id, categoria: k, aprender: $("smAprender").checked });
    };
    g.append(b);
  });
  $("smAprender").checked = false;
  $("sheetMov").hidden = false;
}
$("smCerrar").onclick = () => { $("sheetMov").hidden = true; };
$("smBorrar").onclick = async () => {
  if (!movActual || !confirm("¿Borrar este movimiento?")) return;
  $("sheetMov").hidden = true;
  await cargar("delete", { id: movActual.id });
};

function abrirCfg() {
  const c = D.config;
  $("cfgDinero").value = c.dinero_ciclo || ""; $("cfgAhorro").value = c.ahorro || ""; $("cfgFijos").value = c.fijos_total || "";
  $("cfgSueldo").value = c.sueldo_neto || ""; $("cfgUmbral").value = c.umbral_grande || ""; $("cfgAlertas").value = String(c.alertas);
  $("nuevoDinero").value = "";
  $("sheetCfg").hidden = false;
}
$("btnCfg").onclick = () => { if (D) abrirCfg(); };
$("cfgCerrar").onclick = () => { $("sheetCfg").hidden = true; };
$("cfgGuardar").onclick = async () => {
  const n = (id) => Number($(id).value || 0);
  $("sheetCfg").hidden = true;
  await cargar("config_set", { valores: { dinero_ciclo: n("cfgDinero"), ahorro: n("cfgAhorro"), fijos_total: n("cfgFijos"), sueldo_neto: n("cfgSueldo"), umbral_grande: n("cfgUmbral"), alertas: n("cfgAlertas") } });
  say("Ajustes guardados.", "ok");
};
$("btnNuevo").onclick = async () => {
  const v = $("nuevoDinero").value;
  if (v === "") { say("Escribe cuánta plata tienes hoy.", "bad"); return; }
  $("sheetCfg").hidden = true;
  await cargar("nuevo_ciclo", { dinero: Number(v) });
  say("Listo, empezó tu ciclo nuevo.", "ok");
};

$("btnScan").onclick = async () => {
  say("Revisando tus correos…", "mut"); $("btnScan").disabled = true;
  await cargar("scan"); say("Correos revisados.", "ok"); $("btnScan").disabled = false;
};

$("formAdd").onsubmit = async (e) => {
  e.preventDefault();
  const t = $("texto").value.trim();
  if (!t) return;
  $("btnAdd").disabled = true; say("Guardando…", "mut");
  try { D = await api("add", { texto: t }); $("texto").value = ""; pintar(); say("Agregado ✔", "ok"); }
  catch (err) { say(err.message, "bad"); }
  $("btnAdd").disabled = false;
};

$("saveCode").onclick = () => { const v = $("code").value.trim(); if (v) { setCode(v); $("code").value = ""; mostrar(); } };
$("reset").onclick = (ev) => { ev.preventDefault(); setCode(""); mostrar(); };

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
mostrar();
