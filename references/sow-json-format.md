# `sow.json` format

A complete, valid example is in `assets/example-sow.json`; copy it and change it. The **keys are Spanish** (they mirror the sections of the Spanish SOW) and **all values are Spanish text**. A value that is not yet defined is written exactly `"POR DEFINIR"` (the linter counts it as pending).

```jsonc
{
  "meta": {
    "proyecto": "E-commerce por WhatsApp",
    "bot": "Nombre del bot",
    "cliente": "Nombre del cliente",
    "pais": "Ecuador",
    "tipo": "nuevo",            // nuevo | upgrade | mejora
    "codigo": "EC-01-000-01",   // optional: account code in ClickUp
    "version": "0.1",           // 0.x draft, X.0 approved
    "fecha": "2026-10-05",
    "autor": "Nombre Jelou"
  },
  "brief": ["paragraph 1", "paragraph 2"],
  "objetivos": { "general": "text", "especificos": ["measurable 1", "measurable 2"] },
  "equipo": [
    { "nombre": "…", "organizacion": "Jelou", "cargo": "PM", "correo": "…" }
  ],
  "alcance": {
    "incluido_usuario": [ { "id": "F-U1", "texto": "…" } ],
    "incluido_admin":   [ { "id": "F-A1", "texto": "…" } ],
    "fuera_de_alcance": [ { "id": "OOS-1", "texto": "Seguimiento de pedidos", "terminos": ["seguimiento", "estado del pedido"] } ],
    "supuestos": ["…"]
  },
  "parametros": {                // key → value; recommended keys below
    "horario_bot": "24/7",
    "horario_agentes": "Lunes a viernes 09:00–18:00; sábados 09:00–16:00",
    "festivos": "Feriados nacionales de Ecuador",
    "fuera_de_horario": "Mensaje de espera y seguimiento al siguiente día hábil",
    "zona_horaria": "America/Guayaquil",
    "idioma_tono": "Español de Ecuador, trato de tú",
    "moneda": "USD",
    "impuestos": "IVA 0 %, 5 % y 15 % según el producto",
    "reintentos": "3 intentos por validación",
    "retencion_datos": "24 meses",
    "identificacion_telefono": "…",
    "datos_de_prueba": "…"
  },
  "flujo": {
    "descripcion": "short text",
    "mapa_url": "https://…",
    "pasos": [
      { "n": 1, "actor": "Usuario|Bot|Sistema|Agente", "accion": "…", "resultado": "…", "integracion": "INT-1", "reglas": ["RN-01"] }
    ]
  },
  "reglas": [
    { "id": "RN-01", "titulo": "Monto mínimo", "descripcion": "…", "parametros": { "minimo": 100, "maximo": 5000, "moneda": "USD" }, "si_no_cumple": "El bot informa el mínimo y no permite confirmar", "fuente": "cliente" }
  ],
  "solucion": {
    "descripcion": "short text about the architecture",
    "componentes": [
      { "id": "C-1", "capacidad": "Validación de cliente y cupo", "componente": "Tool HTTP + capa intermedia (Jelou Functions)",
        "detalle": "…", "cubre": ["F-U1"], "reglas": ["RN-04"], "ejecucion": "determinista" }   // determinista | conversacional | mixto
    ]
  },
  "escalamiento": [
    { "id": "ESC-1", "disparador": "Cliente bloqueado", "modo": "automatico", "destino": "Panel de agentes", "horario": "L–V 09:00–18:00", "fuera_de_horario": "Mensaje y seguimiento" }   // modo: automatico | ofrecido
  ],
  "datos": [
    { "entidad": "Usuario", "uso": "Identificar al cliente", "campos": ["cédula", "correo"], "retencion": "24 meses" }
  ],
  "integraciones": [
    {
      "id": "INT-1", "nombre": "ERP del cliente", "sistema": "SAP Business One",
      "proposito": "…",
      "operaciones": [ { "tipo": "lectura", "descripcion": "Consultar stock" }, { "tipo": "escritura", "descripcion": "Crear pedido" } ],
      "conexion": "middleware_jelou",   // directa | api_cliente | middleware_jelou | middleware_cliente
      "quien_hospeda": "Jelou en Jelou Functions",  // required when there is middleware
      "autenticacion": "Usuario de integración con permisos mínimos",
      "documentacion": "si",            // si | no | pendiente
      "ambiente_pruebas": "si",         // si | no | pendiente
      "responsable_cliente": "Cargo o nombre",
      "disponibilidad": "99 % en horario comercial",
      "restricciones_red": "Whitelist de IP de Jelou"
    }
  ],
  "historias": [
    {
      "id": "HU-1", "perfil": "Cliente", "quiero": "…", "para": "…", "reglas": ["RN-01"],
      "criterios": [ { "dado": "…", "cuando": "…", "entonces": "…" } ]
    }
  ],
  "pruebas": [ { "id": "PR-1", "tipo": "Conectividad|Funcional|Extremo a extremo", "descripcion": "…", "cubre": ["HU-1"] } ],
  "dependencias_cliente": [ { "item": "Accesos de integración", "responsable": "Sistemas del cliente", "fecha_limite": "2026-10-16" } ],
  "cronograma": {
    "inicio": "2026-10-12",
    "festivos": ["2026-11-02", "2026-11-03"],
    "hitos": [ { "id": "H1", "nombre": "Planificación y SOW", "descripcion": "…", "dias_habiles": 5, "entregable": "SOW firmado" } ]
  },
  "riesgos": [ { "riesgo": "…", "probabilidad": "Media", "impacto": "Alto", "mitigacion": "specific to the project" } ],
  "versiones": [ { "fecha": "2026-10-05", "version": "0.1", "descripcion": "Generación del documento", "autor": "…" } ],
  "preguntas_abiertas": [ { "id": "Q-1", "pregunta": "…", "bloquea": true, "responsable": "Cliente" } ]
}
```

## Recommended `parametros` keys
`horario_bot`, `horario_agentes`, `festivos`, `fuera_de_horario`, `zona_horaria`, `idioma_tono`, `reintentos`, `retencion_datos`, `identificacion_telefono` (what the bot does if the WhatsApp number arrives unresolved) and `datos_de_prueba` (test customers and sandbox numbers). If the project charges or computes amounts, add `moneda` and `impuestos`. The linter warns about missing ones.

## Why this format
- The IDs (`RN-`, `HU-`, `INT-`, `ESC-`, `OOS-`, `PR-`, `C-`) allow cross-references: a story cites the rules it covers, a flow step cites the integration it uses, a test cites the stories.
- `terminos` on each out-of-scope item are the words the linter searches for in the rest of the document to detect contradictions.
- Schedule dates are not written: the generator computes them from `inicio`, `festivos` and `dias_habiles`.

## Why `si_no_cumple` and `conexion`
In one client's final bot, the SOW said "the flow ends" on a failed validation and the bot ended up offering another ID number or an agent; it said "the connection mode will be defined" and it was solved with an intermediate HTTP layer nobody had assigned. When the SOW does not write what happens when a rule is not met, or how the system connects, each implementer decides alone. That is why both fields are required.
