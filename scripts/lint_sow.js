#!/usr/bin/env node
// Deterministic linter for sow.json. Usage: node lint_sow.js sow.json [--json]
// Exit code 1 when there are errors; warnings do not change the exit code.
// The SOW content is Spanish, so the keyword patterns below match Spanish text.
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node lint_sow.js sow.json [--json]");
  process.exit(2);
}
let sow;
try {
  sow = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error("Could not read the JSON: " + e.message);
  process.exit(2);
}

const findings = [];
const err = (code, where, msg) => findings.push({ level: "ERROR", code, where, msg });
const warn = (code, where, msg) => findings.push({ level: "WARN", code, where, msg });

const arr = (x) => (Array.isArray(x) ? x : []);
const PLACEHOLDER = /POR DEFINIR|\bTBD\b|\bTODO\b|\[\s*(?:completar|nombre|fecha|xxx)[^\]]*\]|\.\.\.\.|\bxxx\b/;
const VAGUE = /\b(correctamente|adecuadamente|apropiad[oa]s?|razonables?|r[aá]pid[oa]s?|f[aá]cil(?:mente)?|amigable|seguro|eficientemente|bien|etc\.?)\b/i;
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// ---------- helpers ----------
function walk(node, path, cb) {
  if (typeof node === "string") cb(node, path);
  else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, cb));
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, cb);
}
const isDraft = () => {
  const v = String((sow.meta || {}).version || "0.0");
  return !/^\d+\.0$/.test(v) || v.startsWith("0.");
};

// ---------- 1. credentials and secrets ----------
const CRED_PATTERNS = [
  [/(contrase(?:ñ|n)a|password|passwd|clave|pwd)\s*[:=]\s*\S{3,}/i, "password"],
  [/(api[\s_-]?key|apikey|secret|secreto|token|client[\s_-]?secret)\s*[:=]\s*\S{6,}/i, "key or secret"],
  [/\bbearer\s+[A-Za-z0-9._\-]{16,}/i, "bearer token"],
  [/\b(usuario|user|username)\s*[:=]\s*\S+@\S+/i, "integration user"],
  [/\b[A-Za-z0-9+/_\-]{32,}={0,2}\b/, "long key-like string"],
  [/\b(?:db|sk|pk|key)_[A-Za-z0-9]{12,}/i, "prefixed key"],
];
walk(sow, "", (s, path) => {
  for (const [re, label] of CRED_PATTERNS) {
    if (re.test(s)) {
      err("CRED", path, `Possible ${label} in plain text. Credentials never go in the SOW: they are delivered through a secure channel and stored as platform secrets.`);
      break;
    }
  }
});

// ---------- 2. required sections ----------
const need = (cond, code, where, msg) => { if (!cond) err(code, where, msg); };
const m = sow.meta || {};
need(m.proyecto && m.cliente && m.version && m.fecha, "META", "meta", "Missing project, client, version or date.");
need(arr([].concat(sow.brief || [])).length > 0 && String([].concat(sow.brief).join("")).trim().length > 40, "BRIEF", "brief", "The brief is empty or too short.");
need(sow.objetivos && sow.objetivos.general && arr(sow.objetivos.especificos).length > 0, "OBJ", "objetivos", "Missing the general objective or the specific objectives.");
const al = sow.alcance || {};
need(arr(al.incluido_usuario).length > 0, "SCOPE", "alcance.incluido_usuario", "There are no end-user features.");
need(arr(al.fuera_de_alcance).length > 0, "OOS", "alcance.fuera_de_alcance", "Out of scope is mandatory: list what will NOT be done.");
need(arr((sow.flujo || {}).pasos).length > 0, "FLOW", "flujo.pasos", "There are no flow steps.");
need(arr(sow.reglas).length > 0, "RULES", "reglas", "There are no business rules.");
need(arr(sow.historias).length > 0, "STORY", "historias", "There are no user stories.");
need(arr(sow.integraciones).length > 0 || sow.sin_integraciones === true, "INT", "integraciones", "Declare integrations or set sin_integraciones: true.");
need(arr(sow.escalamiento).length > 0, "ESC", "escalamiento", "There are no escalation-to-human rules.");
need(arr((sow.cronograma || {}).hitos).length > 0, "SCHED", "cronograma.hitos", "There are no schedule milestones.");
need(arr(sow.riesgos).length > 0, "RISK", "riesgos", "There is no risk matrix.");
need(arr(sow.versiones).length > 0, "VERS", "versiones", "Version control is missing.");

// ---------- 3. operating parameters ----------
const par = sow.parametros || {};
for (const k of ["horario_bot", "horario_agentes", "fuera_de_horario", "idioma_tono", "reintentos", "retencion_datos", "identificacion_telefono", "datos_de_prueba"]) {
  if (!par[k]) warn("PARAM", `parametros.${k}`, `Missing operating parameter "${k}" (a decision that usually gets discovered while building).`);
}
const monetary = JSON.stringify(sow.reglas || []).match(/monto|precio|pago|total|iva|cupo|valor/i);
if (monetary) for (const k of ["moneda", "impuestos"]) if (!par[k]) warn("PARAM", `parametros.${k}`, `The SOW handles amounts but "${k}" is missing.`);

// ---------- 4. IDs and references ----------
const ids = (list, key = "id") => new Set(arr(list).map((x) => x[key]));
const ruleIds = ids(sow.reglas);
const intIds = ids(sow.integraciones);
const storyIds = ids(sow.historias);
for (const [name, list] of [["reglas", sow.reglas], ["integraciones", sow.integraciones], ["historias", sow.historias], ["escalamiento", sow.escalamiento], ["pruebas", sow.pruebas], ["fuera_de_alcance", al.fuera_de_alcance]]) {
  const seen = new Set();
  arr(list).forEach((x, i) => {
    if (!x.id) err("ID", `${name}[${i}]`, "Missing id.");
    else if (seen.has(x.id)) err("ID", `${name}[${i}]`, `Duplicate ID ${x.id}.`);
    seen.add(x.id);
  });
}

const usedRules = new Set();
const usedInts = new Set();
arr((sow.flujo || {}).pasos).forEach((p, i) => {
  const w = `flujo.pasos[${i}]`;
  if (!p.accion || !p.actor) err("FLOW", w, "The step needs an actor and an action.");
  if (!p.resultado) warn("FLOW", w, "The step declares no result.");
  if (p.integracion) {
    usedInts.add(p.integracion);
    if (!intIds.has(p.integracion)) err("REF", w, `Integration does not exist: ${p.integracion}.`);
  }
  arr(p.reglas).forEach((r) => { usedRules.add(r); if (!ruleIds.has(r)) err("REF", w, `Rule does not exist: ${r}.`); });
});
arr((sow.flujo || {}).pasos).map((p) => p.n).forEach((n, i) => {
  if (n !== i + 1) warn("FLOW", "flujo.pasos", `Step numbering is not consecutive (step ${i + 1} has n=${n}).`);
});

const coveredRules = new Set();
arr(sow.historias).forEach((h, i) => {
  const w = `historias[${i}]`;
  if (!h.quiero || !h.para || !h.perfil) err("STORY", w, "The story needs perfil, quiero and para.");
  if (arr(h.criterios).length === 0) err("STORY", w, "The story has no acceptance criteria.");
  arr(h.criterios).forEach((c, j) => {
    if (!c.dado || !c.cuando || !c.entonces) err("STORY", `${w}.criterios[${j}]`, "The criterion needs dado, cuando and entonces.");
    else if (VAGUE.test(c.entonces) || c.entonces.trim().split(/\s+/).length < 4)
      warn("STORY", `${w}.criterios[${j}]`, `The "entonces" is vague or too short ("${c.entonces.slice(0, 60)}"). Say what is shown, created or sent, with a figure, state or concrete message.`);
  });
  arr(h.reglas).forEach((r) => { coveredRules.add(r); if (!ruleIds.has(r)) err("REF", w, `Rule does not exist: ${r}.`); });
});
arr(sow.reglas).forEach((r, i) => {
  if (!coveredRules.has(r.id)) warn("COVERAGE", `reglas[${i}]`, `Rule ${r.id} is not covered by any story (it has no acceptance criterion).`);
  if (!usedRules.has(r.id) && !coveredRules.has(r.id)) warn("COVERAGE", `reglas[${i}]`, `Rule ${r.id} is used neither in the flow nor in stories.`);
  if (!r.descripcion) err("RULES", `reglas[${i}]`, `Rule ${r.id} has no description.`);
  const p = r.parametros || {};
  if (!r.si_no_cumple) warn("RULES", `reglas[${i}]`, `Rule ${r.id} does not say what happens if it is NOT met (reject, adjust automatically, retry, escalate or end). Each bot resolves it differently if it is not written.`);
  if (VAGUE.test(r.descripcion || "") && !/\d/.test(r.descripcion || "") && !Object.keys(p).length)
    warn("RULES", `reglas[${i}]`, `Rule ${r.id} uses vague language with no figures or conditions: it cannot be tested.`);
  const kMin = Object.keys(p).find((k) => /^(min|minimo|desde|total_desde)/.test(k) && typeof p[k] === "number");
  const kMax = Object.keys(p).find((k) => /^(max|maximo|hasta|total_hasta)/.test(k) && typeof p[k] === "number");
  if (kMin && kMax) {
    if (p[kMin] >= p[kMax]) err("RULES", `reglas[${i}]`, `Rule ${r.id} has ${kMin} >= ${kMax}.`);
    warn("RULES", `reglas[${i}]`, `Rule ${r.id} defines a range (${p[kMin]}–${p[kMax]}): write what happens below, inside and above it, and whether the endpoints are included (exactly ${p[kMin]}? exactly ${p[kMax]}?).`);
  }
});

arr(sow.pruebas).forEach((p, i) => {
  arr(p.cubre).forEach((h) => { if (!storyIds.has(h)) err("REF", `pruebas[${i}]`, `Story does not exist: ${h}.`); });
});
const tested = new Set(arr(sow.pruebas).flatMap((p) => arr(p.cubre)));
arr(sow.historias).forEach((h) => { if (arr(sow.pruebas).length && !tested.has(h.id)) warn("COVERAGE", "pruebas", `Story ${h.id} has no test.`); });
if (arr(sow.pruebas).length === 0) warn("TESTS", "pruebas", "No tests are defined.");

// ---------- 4b. technical solution ----------
const sol = arr((sow.solucion || {}).componentes);
if (sol.length === 0) warn("SOLUTION", "solucion", "The technical solution is missing: which Jelou component delivers each feature (see references/how-jelou-bots-work.md).");
const featureIds = new Set([...arr(al.incluido_usuario), ...arr(al.incluido_admin)].map((f) => f.id));
const coveredFeatures = new Set();
const deterministicRules = new Set();
const conversationalRules = new Set();
sol.forEach((c, i) => {
  const w = `solucion.componentes[${i}]`;
  if (!c.componente || !c.capacidad) err("SOLUTION", w, "The component needs capacidad and componente.");
  if (!["determinista", "conversacional", "mixto"].includes(norm(c.ejecucion))) err("SOLUTION", w, `${c.id || i}: ejecucion must be determinista, conversacional or mixto.`);
  arr(c.cubre).forEach((f) => { coveredFeatures.add(f); if (!featureIds.has(f)) err("REF", w, `Feature does not exist: ${f}.`); });
  arr(c.reglas).forEach((r) => {
    if (!ruleIds.has(r)) err("REF", w, `Rule does not exist: ${r}.`);
    (norm(c.ejecucion) === "conversacional" ? conversationalRules : deterministicRules).add(r);
  });
});
if (sol.length) {
  featureIds.forEach((f) => { if (!coveredFeatures.has(f)) warn("SOLUTION", "solucion", `Feature ${f} has no component assigned.`); });
  arr(sow.reglas).forEach((r) => {
    const critical = Object.keys(r.parametros || {}).length > 0 || /otp|identidad|cupo|monto|pago|aprob|bloque|derivaci|deriva/i.test(`${r.titulo} ${r.descripcion}`);
    if (critical && conversationalRules.has(r.id) && !deterministicRules.has(r.id))
      warn("SOLUTION", "solucion", `Rule ${r.id} (${r.titulo}) is critical but is only assigned to a conversational component. It must be deterministic: it is not guaranteed in an AI prompt.`);
    if (critical && !conversationalRules.has(r.id) && !deterministicRules.has(r.id))
      warn("SOLUTION", "solucion", `Rule ${r.id} (${r.titulo}) is not assigned to any component.`);
  });
}

// ---------- 5. integrations ----------
arr(sow.integraciones).forEach((it, i) => {
  const w = `integraciones[${i}]`;
  if (!usedInts.has(it.id)) warn("INT", w, `Integration ${it.id} is not used in any flow step.`);
  if (arr(it.operaciones).length === 0) err("INT", w, `${it.id}: define what is read and what is written.`);
  if (!it.autenticacion) err("INT", w, `${it.id}: missing how it authenticates (the mechanism only, no credentials).`);
  if (!it.responsable_cliente || PLACEHOLDER.test(it.responsable_cliente)) (isDraft() ? warn : err)("INT", w, `${it.id}: missing the client's technical owner.`);
  for (const k of ["documentacion", "ambiente_pruebas"]) {
    const v = norm(it[k]);
    if (!["si", "no", "pendiente"].includes(v)) err("INT", `${w}.${k}`, `${it.id}: ${k} must be si, no or pendiente.`);
    else if (v !== "si") warn("INT", `${w}.${k}`, `${it.id}: ${k} = ${v}. Make sure there is a dated client dependency to resolve it.`);
  }
  if (!it.disponibilidad) warn("INT", w, `${it.id}: missing the required availability.`);
  if (!["directa", "api_cliente", "middleware_jelou", "middleware_cliente"].includes(norm(it.conexion)))
    err("INT", `${w}.conexion`, `${it.id}: define the connection mode: directa | api_cliente | middleware_jelou | middleware_cliente. (Who builds and hosts the intermediate layer must be written down.)`);
  else if (norm(it.conexion).startsWith("middleware") && !it.quien_hospeda)
    err("INT", `${w}.quien_hospeda`, `${it.id}: with middleware, state who builds, hosts and maintains it.`);
  const undecidedMode = JSON.stringify(it).match(/o bien|una de las siguientes|se definir[aá]|a definir/i);
  if (undecidedMode) err("INT", w, `${it.id}: a connection mode is left undecided. Choose one or turn the decision into an open question with an owner.`);
});

// ---------- 6. contradictions with out of scope ----------
const includedText = [];
walk(
  { "alcance.incluido_usuario": al.incluido_usuario, "alcance.incluido_admin": al.incluido_admin, flujo: sow.flujo, historias: sow.historias, pruebas: sow.pruebas, reglas: sow.reglas, escalamiento: sow.escalamiento },
  "",
  (s, path) => includedText.push({ s, path })
);
arr(al.fuera_de_alcance).forEach((o) => {
  const terms = arr(o.terminos).map(norm).filter(Boolean);
  if (terms.length === 0) warn("OOS", `alcance.fuera_de_alcance[${o.id}]`, `${o.id} has no "terminos" to detect contradictions.`);
  for (const t of terms) {
    for (const { s, path } of includedText) {
      if (norm(s).includes(t)) {
        // mentions that explicitly state the exclusion do not count
        if (/no incluye|fuera de alcance|no aplica|no se (?:realiza|permite|ofrece|hace)|sin /i.test(s)) continue;
        warn("OOS", path, `Possible contradiction with ${o.id} ("${o.texto}"): "${t}" appears in: "${s.slice(0, 90)}…". If it is only informational, clarify it; otherwise remove it from the scope.`);
      }
    }
  }
});

// ---------- 6b. technical names with different capitalization ----------
const tokens = new Map();
const TOKEN_RE = new RegExp("[A-Za-z]+(?:_[A-Za-z0-9]+)+", "g");
walk(sow, "", (s) => { for (const t of s.match(TOKEN_RE) || []) { const k = t.toLowerCase(); if (!tokens.has(k)) tokens.set(k, new Set()); tokens.get(k).add(t); } });
tokens.forEach((vars) => { if (vars.size > 1) warn("NAMES", "document", `The field is spelled several ways: ${[...vars].join(" / ")}. Use a single spelling (the client system's).`); });

// ---------- 6c. escalation offered vs automatic ----------
const offerStep = arr((sow.flujo || {}).pasos).find((p) => /ofrec\w*\s+(?:derivar|transferir|pasar|hablar)|se\s+ofrece/i.test(`${p.accion} ${p.resultado}`));
const hasAuto = arr(sow.escalamiento).some((e) => norm(e.modo) === "automatico");
const hasOffered = arr(sow.escalamiento).some((e) => norm(e.modo) === "ofrecido");
if (offerStep && hasAuto && !hasOffered)
  warn("ESC", `flujo.pasos[${offerStep.n}]`, "The flow offers escalation, but every escalation in the table is automatic. Unify: is it offered or automatic?");
if (hasAuto && hasOffered)
  warn("ESC", "escalamiento", "There are automatic and offered escalations to the same destination. Confirm each trigger has a single mode and that the flow reflects it the same way.");

// ---------- 7. escalation ----------
arr(sow.escalamiento).forEach((e, i) => {
  const w = `escalamiento[${i}]`;
  if (!e.disparador || !e.destino) err("ESC", w, "Missing disparador or destino.");
  if (!["automatico", "ofrecido"].includes(norm(e.modo))) err("ESC", w, `${e.id}: modo must be "automatico" or "ofrecido" (do not leave it ambiguous whether it escalates or offers).`);
  if (!e.horario) warn("ESC", w, `${e.id}: missing the destination's service hours.`);
  if (!e.fuera_de_horario) warn("ESC", w, `${e.id}: missing what happens out of hours.`);
});

// ---------- 8. personal data ----------
arr(sow.datos).forEach((d, i) => {
  if (!d.retencion || PLACEHOLDER.test(d.retencion)) warn("DATA", `datos[${i}]`, `Entity "${d.entidad}" declares no retention.`);
});
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/;
walk(sow, "", (s, path) => {
  if (path.startsWith("equipo")) return;
  if (EMAIL.test(s)) warn("PII", path, "There is an email outside the team table.");
  if (PHONE.test(s) && !/^\d{4}-\d{2}-\d{2}$/.test(s) && !/(?:\d+\s*[–-]\s*\d+)/.test(s) && s.replace(/\D/g, "").length >= 10 && !path.includes("fecha") && !path.startsWith("cronograma"))
    warn("PII", path, "This looks like a phone number outside the team table.");
});

// ---------- 9. schedule and version ----------
const cr = sow.cronograma || {};
if (!/^\d{4}-\d{2}-\d{2}$/.test(cr.inicio || "")) err("SCHED", "cronograma.inicio", "Missing start date (YYYY-MM-DD).");
arr(cr.hitos).forEach((h, i) => {
  if (!(Number.isInteger(h.dias_habiles) && h.dias_habiles > 0)) err("SCHED", `cronograma.hitos[${i}]`, `${h.id || i}: dias_habiles must be a positive integer.`);
  if (!h.entregable) warn("SCHED", `cronograma.hitos[${i}]`, `${h.id || i}: missing deliverable.`);
});
arr(sow.dependencias_cliente).forEach((d, i) => {
  if (!d.fecha_limite || PLACEHOLDER.test(d.fecha_limite)) warn("DEP", `dependencias_cliente[${i}]`, `The dependency "${d.item}" has no deadline.`);
});
if (arr(sow.dependencias_cliente).length === 0) warn("DEP", "dependencias_cliente", "There are no client dependencies (access, documentation, approvals).");

const v = String(m.version || "");
if (!/^\d+\.\d+$/.test(v)) err("VERS", "meta.version", "The version must be X.Y (0.1 draft; 1.0 approved).");
const last = arr(sow.versiones).slice(-1)[0];
if (last && last.version !== v) warn("VERS", "versiones", `The last version in version control (${last.version}) does not match meta.version (${v}).`);
if (/^[1-9]\d*\.[1-9]/.test(v)) err("VERS", "meta.version", "An approved version has second digit 0 (1.0, 2.0).");

// ---------- 10. pending items ----------
walk(sow, "", (s, path) => {
  if (path.startsWith("preguntas_abiertas")) return;
  if (PLACEHOLDER.test(s)) {
    (isDraft() ? warn : err)("PENDING", path, "Pending value (POR DEFINIR/placeholder)." + (isDraft() ? "" : " An approved version cannot contain them."));
  }
});
const blocking = arr(sow.preguntas_abiertas).filter((q) => q.bloquea);
if (!isDraft() && blocking.length) err("PENDING", "preguntas_abiertas", `${blocking.length} blocking question(s) are still open: this cannot be an approved version.`);

// ---------- output ----------
const errors = findings.filter((f) => f.level === "ERROR");
const warns = findings.filter((f) => f.level === "WARN");
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ errors: errors.length, warnings: warns.length, findings }, null, 2));
} else {
  for (const f of [...errors, ...warns]) console.log(`${f.level.padEnd(5)} [${f.code}] ${f.where}: ${f.msg}`);
  console.log(`\n${errors.length} error(s), ${warns.length} warning(s). ${isDraft() ? "Status: draft." : "Status: approved version."}`);
}
process.exit(errors.length ? 1 : 0);
