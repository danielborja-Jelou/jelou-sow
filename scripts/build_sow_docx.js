#!/usr/bin/env node
// Builds the SOW Word document from sow.json.
// Usage: node build_sow_docx.js sow.json output.docx
// Requires: npm install (installs the "docx" library in this folder)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, TabStopType,
} = require("docx");

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) {
  console.error("Usage: node build_sow_docx.js sow.json output.docx");
  process.exit(2);
}
const sow = JSON.parse(fs.readFileSync(inFile, "utf8"));
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const meta = sow.meta || {};

// ---------- style ----------
const FONT = "Arial";
const BRAND = "0B6E7A";      // dark teal: legible when printed
const BRAND_LIGHT = "E3F4F6";
const GRID = "BFC9CC";
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1134;       // A4, 2 cm margins
const CONTENT_W = PAGE_W - 2 * MARGIN;                      // 9638 DXA

const border = { style: BorderStyle.SINGLE, size: 4, color: GRID };
const borders = { top: border, bottom: border, left: border, right: border };

// ---------- dates: business days ----------
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function fmt(d) { return d.toISOString().slice(0, 10); }
function fmtLarga(d) {
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
const festivos = new Set(arr((sow.cronograma || {}).festivos));
function esHabil(d) { const w = d.getUTCDay(); return w !== 0 && w !== 6 && !festivos.has(fmt(d)); }
function siguienteHabil(d) { const x = new Date(d); while (!esHabil(x)) x.setUTCDate(x.getUTCDate() + 1); return x; }
// returns the last business day of a block of n business days starting at "desde" (inclusive)
function finBloque(desde, n) {
  let d = siguienteHabil(desde), c = 1;
  while (c < n) { d.setUTCDate(d.getUTCDate() + 1); if (esHabil(d)) c++; }
  return d;
}

// ---------- docx helpers ----------
const run = (text, o = {}) => new TextRun({ text: String(text), font: FONT, size: o.size || 21, bold: o.bold, italics: o.italics, color: o.color });
const P = (text, o = {}) =>
  new Paragraph({
    spacing: { after: o.after ?? 120, line: 276 },
    alignment: o.align,
    keepNext: o.keepNext,
    children: arr(text).map((t) => (typeof t === "string" ? run(t, o) : t)),
  });
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text, font: FONT })] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })] });
const bullet = (text, o = {}) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60, line: 276 }, children: [typeof text === "string" ? run(text, o) : text] });
const labeled = (label, text) => P([run(label + ": ", { bold: true }), run(text)]);

function cell(content, width, o = {}) {
  const paras = arr(content).map((c) =>
    c instanceof Paragraph ? c : new Paragraph({ spacing: { after: 40, line: 252 }, children: [run(c ?? "", { size: 19, bold: o.bold, color: o.color })] })
  );
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: paras.length ? paras : [new Paragraph({ children: [] })],
  });
}
function table(headers, rows, widths) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const w = widths.map((x) => Math.round((x / sum) * CONTENT_W));
  w[w.length - 1] += CONTENT_W - w.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, w[i], { fill: BRAND_LIGHT, bold: true, color: BRAND })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, w[i])) })),
    ],
  });
}
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });
const val = (v) => (v === undefined || v === null || v === "" ? "—" : String(v));

// ---------- content ----------
const draft = !/^\d+\.0$/.test(String(meta.version || "0.0")) || String(meta.version).startsWith("0.");
const body = [];
let secN = 0;
const sec = (t) => { secN++; body.push(H1(`${secN}. ${t}`)); };

// Cover
body.push(new Paragraph({ spacing: { before: 600, after: 120 }, children: [new TextRun({ text: "STATEMENT OF WORK (SOW)", font: FONT, size: 20, bold: true, color: BRAND })] }));
body.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: val(meta.proyecto), font: FONT, size: 44, bold: true })] }));
body.push(new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: val(meta.cliente), font: FONT, size: 28, color: "555555" })] }));
body.push(table(["Dato", "Detalle"], [
  ["Cliente", val(meta.cliente)],
  ["Proyecto", val(meta.proyecto)],
  ["Nombre del bot", val(meta.bot)],
  ["País", val(meta.pais)],
  ["Tipo de proyecto", val(meta.tipo)],
  ...(meta.codigo ? [["Código de cuenta", meta.codigo]] : []),
  ["Versión", `${val(meta.version)}${draft ? " (borrador)" : " (aprobada)"}`],
  ["Fecha", meta.fecha ? fmtLarga(parseDate(meta.fecha)) : "—"],
  ["Elaborado por", val(meta.autor)],
], [30, 70]));
body.push(spacer());

sec("Brief del proyecto");
arr(sow.brief).forEach((p) => body.push(P(p)));

sec("Objetivos del proyecto");
if (sow.objetivos) {
  body.push(labeled("Objetivo general", val(sow.objetivos.general)));
  body.push(P([run("Objetivos específicos:", { bold: true })], { keepNext: true, after: 60 }));
  arr(sow.objetivos.especificos).forEach((o) => body.push(bullet(o)));
}

sec("Equipo de trabajo");
body.push(table(["Nombre", "Organización", "Cargo", "Correo electrónico"], arr(sow.equipo).map((e) => [val(e.nombre), val(e.organizacion), val(e.cargo), val(e.correo)]), [24, 20, 22, 34]));
body.push(spacer());
body.push(P([run("¿Cuándo comunicarse con cada rol?", { bold: true })], { keepNext: true, after: 60 }));
body.push(bullet("AM (Account Manager): mejoras y análisis de información, dudas sobre la propuesta, precio e integraciones adicionales."));
body.push(bullet("PM (Project Manager): implementación del proyecto hasta la entrega del acta de cierre (producción del servicio)."));
body.push(bullet("Soporte: acompañamiento posproductivo, resolución de incidentes, dudas operativas y continuidad del servicio."));

const al = sow.alcance || {};
sec("Alcance del proyecto");
body.push(H2("Funcionalidades para el usuario final"));
arr(al.incluido_usuario).forEach((f) => body.push(bullet(`${f.id ? f.id + " · " : ""}${f.texto}`)));
if (arr(al.incluido_admin).length) {
  body.push(H2("Funcionalidades para el equipo del cliente (administración)"));
  arr(al.incluido_admin).forEach((f) => body.push(bullet(`${f.id ? f.id + " · " : ""}${f.texto}`)));
}
body.push(H2("Fuera de alcance"));
body.push(P("Lo siguiente no forma parte de este proyecto. Cualquier solicitud sobre estos puntos se gestiona como control de cambios."));
arr(al.fuera_de_alcance).forEach((f) => body.push(bullet(`${f.id ? f.id + " · " : ""}${f.texto}`)));
if (arr(al.supuestos).length) {
  body.push(H2("Supuestos"));
  arr(al.supuestos).forEach((s) => body.push(bullet(s)));
}

sec("Parámetros operativos");
const etiquetas = {
  horario_bot: "Horario del bot", horario_agentes: "Horario de agentes humanos", festivos: "Festivos",
  fuera_de_horario: "Atención fuera de horario", zona_horaria: "Zona horaria", idioma_tono: "Idioma y tono",
  moneda: "Moneda", impuestos: "Impuestos", reintentos: "Reintentos permitidos", retencion_datos: "Retención de datos personales",
};
body.push(table(["Parámetro", "Valor"], Object.entries(sow.parametros || {}).map(([k, v]) => [etiquetas[k] || k.replace(/_/g, " "), val(v)]), [32, 68]));
body.push(spacer());

sec("Flujo de la conversación");
const fl = sow.flujo || {};
if (fl.descripcion) body.push(P(fl.descripcion));
if (fl.mapa_url) body.push(labeled("Mapa de conversaciones", fl.mapa_url));
body.push(table(["N.º", "Actor", "Acción", "Resultado", "Reglas / Integración"], arr(fl.pasos).map((p) => [
  String(p.n), val(p.actor), val(p.accion), val(p.resultado), [...arr(p.reglas), ...(p.integracion ? [p.integracion] : [])].join(", ") || "—",
]), [6, 12, 36, 30, 16]));
body.push(spacer());

sec("Reglas de negocio");
body.push(table(["ID", "Regla", "Descripción y qué pasa si no se cumple", "Valores"], arr(sow.reglas).map((r) => [
  val(r.id), val(r.titulo), [val(r.descripcion), r.si_no_cumple ? "Si no se cumple: " + r.si_no_cumple : ""].filter(Boolean),
  Object.entries(r.parametros || {}).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("; ") || "—",
]), [8, 20, 47, 25]));
body.push(spacer());

sec("Escalamiento a agente humano");
body.push(table(["ID", "Cuándo", "Modo", "Destino y horario", "Fuera de horario"], arr(sow.escalamiento).map((e) => [
  val(e.id), val(e.disparador), e.modo === "ofrecido" ? "Se ofrece al usuario" : "Automático", `${val(e.destino)}${e.horario ? " · " + e.horario : ""}`, val(e.fuera_de_horario),
]), [8, 30, 14, 28, 20]));
body.push(spacer());

if (arr((sow.solucion || {}).componentes).length) {
  sec("Solución técnica propuesta");
  if (sow.solucion.descripcion) body.push(P(sow.solucion.descripcion));
  body.push(P("Cada funcionalidad se entrega con los siguientes componentes de la plataforma Jelou. «Determinista» significa que la regla se ejecuta siempre igual; «conversacional» significa que la IA interpreta el lenguaje del usuario y puede variar la redacción."));
  body.push(table(["ID", "Capacidad", "Componente", "Detalle", "Ejecución", "Cubre"], arr(sow.solucion.componentes).map((c) => [
    val(c.id), val(c.capacidad), val(c.componente), val(c.detalle),
    ({ determinista: "Determinista", conversacional: "Conversacional", mixto: "Mixto" })[c.ejecucion] || val(c.ejecucion),
    [...arr(c.cubre), ...arr(c.reglas)].join(", ") || "—",
  ]), [6, 17, 18, 29, 14, 16]));
  body.push(spacer());
}

if (arr(sow.datos).length) {
  sec("Datos que gestiona la solución");
  body.push(table(["Entidad", "Uso", "Campos", "Retención"], arr(sow.datos).map((d) => [val(d.entidad), val(d.uso), arr(d.campos).join(", "), val(d.retencion)]), [18, 30, 34, 18]));
  body.push(spacer());
}

sec("Integraciones");
if (arr(sow.integraciones).length === 0) body.push(P("Este proyecto no requiere integraciones con sistemas externos."));
arr(sow.integraciones).forEach((it) => {
  body.push(H2(`${it.id} · ${it.nombre}${it.sistema ? " (" + it.sistema + ")" : ""}`));
  body.push(P(val(it.proposito)));
  body.push(table(["Aspecto", "Detalle"], [
    ["Operaciones", arr(it.operaciones).map((o) => new Paragraph({ spacing: { after: 30 }, children: [run(`${o.tipo === "escritura" ? "Escritura" : "Lectura"}: ${o.descripcion}`, { size: 19 })] }))],
    ["Modalidad de conexión", ({ directa: "Conexión directa al sistema", api_cliente: "API del cliente", middleware_jelou: "Capa intermedia construida y hospedada por Jelou", middleware_cliente: "Capa intermedia construida y hospedada por el cliente" })[it.conexion] + (it.quien_hospeda ? ` · ${it.quien_hospeda}` : "") || val(it.conexion)],
    ["Autenticación", val(it.autenticacion)],
    ["Documentación técnica", val(it.documentacion)],
    ["Ambiente de pruebas", val(it.ambiente_pruebas)],
    ["Responsable técnico del cliente", val(it.responsable_cliente)],
    ["Disponibilidad requerida", val(it.disponibilidad)],
    ["Restricciones de red", val(it.restricciones_red)],
    ["Credenciales", "Se entregan por canal seguro y Jelou las almacena como secrets de la plataforma. No se incluyen en este documento."],
  ], [30, 70]));
  body.push(spacer());
});

sec("Historias de usuario y criterios de aceptación");
body.push(P("Formato: Dado [contexto], cuando [acción o evento], entonces [resultado verificable]."));
arr(sow.historias).forEach((h) => {
  body.push(H2(`${h.id} · Como ${h.perfil}, quiero ${h.quiero}`));
  body.push(P(`Para ${h.para}.${arr(h.reglas).length ? "  Reglas: " + arr(h.reglas).join(", ") + "." : ""}`));
  body.push(table(["Dado", "Cuando", "Entonces"], arr(h.criterios).map((c) => [val(c.dado), val(c.cuando), val(c.entonces)]), [33, 27, 40]));
  body.push(spacer());
});

if (arr(sow.pruebas).length) {
  sec("Pruebas");
  body.push(table(["ID", "Tipo", "Descripción", "Cubre"], arr(sow.pruebas).map((p) => [val(p.id), val(p.tipo), val(p.descripcion), arr(p.cubre).join(", ") || "—"]), [8, 20, 56, 16]));
  body.push(spacer());
}

if (arr(sow.dependencias_cliente).length) {
  sec("Dependencias del cliente");
  body.push(P("El cronograma depende de que el cliente entregue lo siguiente en las fechas indicadas."));
  body.push(table(["Entregable del cliente", "Responsable", "Fecha límite"], arr(sow.dependencias_cliente).map((d) => [val(d.item), val(d.responsable), d.fecha_limite && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_limite) ? fmtLarga(parseDate(d.fecha_limite)) : val(d.fecha_limite)]), [50, 28, 22]));
  body.push(spacer());
}

sec("Cronograma y entregables");
const cr = sow.cronograma || {};
let cursor = cr.inicio ? parseDate(cr.inicio) : null;
const filas = arr(cr.hitos).map((h) => {
  let rango = "—";
  if (cursor) {
    const ini = siguienteHabil(cursor);
    const fin = finBloque(ini, h.dias_habiles);
    rango = `${fmtLarga(ini)} – ${fmtLarga(fin)}`;
    cursor = new Date(fin); cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [val(h.nombre), val(h.descripcion), String(h.dias_habiles), rango, val(h.entregable)];
});
body.push(table(["Hito", "Descripción", "Días hábiles", "Periodo", "Entregable"], filas, [18, 28, 10, 24, 20]));
const totalDias = arr(cr.hitos).reduce((a, h) => a + (h.dias_habiles || 0), 0);
body.push(P(`Duración total: ${totalDias} días hábiles${cr.inicio ? ", a partir del " + fmtLarga(parseDate(cr.inicio)) : ""}. Las fechas están sujetas al cumplimiento de las dependencias del cliente y se calculan en días hábiles${festivos.size ? ", excluyendo los festivos declarados" : ""}.`, { after: 120 }));

sec("Revisión de seguridad y riesgos");
body.push(table(["Riesgo", "Probabilidad", "Impacto", "Mitigación"], arr(sow.riesgos).map((r) => [val(r.riesgo), val(r.probabilidad), val(r.impacto), val(r.mitigacion)]), [28, 12, 12, 48]));
body.push(spacer());

sec("Control de versiones");
body.push(P("Este documento requiere control de línea base. La versión inicial es 0.0; las correcciones durante la revisión incrementan el segundo dígito (0.1, 0.2). Una versión aprobada tiene primer número entero y segundo dígito 0 (1.0, 2.0)."));
body.push(table(["Fecha", "Versión", "Descripción", "Autor"], arr(sow.versiones).map((v) => [v.fecha && /^\d{4}-\d{2}-\d{2}$/.test(v.fecha) ? fmtLarga(parseDate(v.fecha)) : val(v.fecha), val(v.version), val(v.descripcion), val(v.autor)]), [22, 12, 46, 20]));

if (arr(sow.preguntas_abiertas).length) {
  body.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Anexo · Pendientes por definir", font: FONT })] }));
  body.push(P("Estos puntos deben resolverse con el cliente antes de aprobar el documento. Los marcados como bloqueantes impiden pasar a versión 1.0."));
  body.push(table(["ID", "Pregunta", "Bloquea", "Responsable"], arr(sow.preguntas_abiertas).map((q) => [val(q.id), val(q.pregunta), q.bloquea ? "Sí" : "No", val(q.responsable)]), [8, 60, 12, 20]));
}

// ---------- document ----------
const doc = new Document({
  creator: "Jelou",
  title: `SOW ${val(meta.cliente)} - ${val(meta.proyecto)}`,
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, font: FONT, color: BRAND }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, font: FONT, color: "333333" }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }],
  },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN + 200, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRID, space: 4 } },
          children: [
            new TextRun({ text: `SOW · ${val(meta.cliente)} · ${val(meta.proyecto)}`, font: FONT, size: 16, color: "666666" }),
            new TextRun({ text: `\t${draft ? "BORRADOR · " : ""}v${val(meta.version)}`, font: FONT, size: 16, bold: true, color: draft ? "B3261E" : BRAND }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Jelou · Confidencial · Página ", font: FONT, size: 16, color: "666666" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "666666" }), new TextRun({ text: " de ", font: FONT, size: 16, color: "666666" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: "666666" })],
        })],
      }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outFile, buf);
  console.log(`Generated ${path.resolve(outFile)} (${buf.length} bytes, ${secN} sections${draft ? ", DRAFT" : ""}).`);
});
