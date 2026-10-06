# SOW structure and how to write each section

The order follows Jelou's official template and adds the sections that, in earlier SOWs, were missing and forced decisions during construction (parameters, data, stories, tests, client dependencies). The SOW is written in Spanish; section names below are given in English with the Spanish heading in parentheses.

| # | Section | What it must contain | Typical error it prevents |
|---|---|---|---|
| 1 | Cover | Project, bot, client, version, date, status | Documents with no version or an unfilled template |
| 2 | Brief (Brief del proyecto) | 1–2 paragraphs: need, solution, why it matters | A generic brief that does not mention the business |
| 3 | Objectives (Objetivos) | General and specific, each measurable | "Improve the experience" with no metric |
| 4 | Team (Equipo de trabajo) | Name, organization, role, email; AM/PM/Support roles | Missing client technical owner |
| 5 | Scope (Alcance) | Included (end user and administrator) and **Out of scope** | Promises the bot later does not keep |
| 6 | Operating parameters | Hours, holidays, language and tone, currency, taxes, retries, retention | Decisions discovered while building |
| 7 | Flow | Numbered steps with actor, action and result; link to the map | A flow that contradicts the rules |
| 8 | Business rules | One per row, with ID and values | Rules with adjectives, not verifiable |
| 8b | Technical solution | Which Jelou component delivers each capability and whether it is deterministic or conversational | Promising what the platform does not do; critical rules left to the AI |
| 9 | Escalation to a human | Trigger, destination, hours, out-of-hours message | "Escalate if needed" |
| 10 | Data | Entities stored, fields and retention | Personal data with no policy |
| 11 | Integrations | Per system: operations, authentication, documentation, test environment, owner | Integration with no documented API or test environment |
| 12 | Stories and criteria | As/want/so that + Given/When/Then | Rules nobody can test |
| 13 | Tests | Types and which stories they cover | Tests that contradict the scope |
| 14 | Client dependencies | What the client must deliver and by when | Delays from late access |
| 15 | Schedule and deliverables | Milestones with business days; computed dates | Hand-typed dates that do not add up |
| 16 | Risks | Risk, probability, impact, mitigation | A generic copied matrix |
| 17 | Version control | Date, version, change, author | Changes with no traceability |

## Guidance by section

**Brief and objectives.** Answer three things: what problem the client has, what solution is proposed and why it matters to them. Write specific objectives as a verifiable result (conversion, handling time, capture errors), not as an activity.

**Scope.** Write what is included from two points of view: what the end user does on WhatsApp and what the client's team does (administration, data queries, reports). Write *out of scope* just as seriously: list everything someone might assume and will not be done (order tracking, promotions, discounts, invoice validation, other channels). Each item carries `terminos` so the linter detects if it reappears later.

**Operating parameters.** This is the section most often missing in earlier SOWs and the one that hides the most decisions. Define bot and agent hours (per day), holidays, what happens out of hours, language and tone, currency and taxes (rates, and whether they depend on the product), allowed retries, time zone, personal-data retention, what the bot does when the phone number arrives unresolved, and who supplies test data and sandbox numbers.

**Flow.** Numbered steps. Each step says who acts (user, bot, system, agent), what happens and the result, and links the integration and rules it uses. If there are branches, each branch is a step with an explicit condition. A flow that mentions an excluded action (for example "checkout with payment" when there is no payment) is a contradiction.

**Business rules.** One rule = one verifiable condition. Put the values in `parametros` (minimums, maximums, rates, times) so the document and the tests use the same numbers. State `si_no_cumple` (what happens if it is not met) and the `fuente`: client, Jelou or assumption.

**Escalation.** Each trigger (keyword, number of failures, blocked customer, change of sensitive data, return) with destination (team or queue) and hours. Decide and write whether escalation is automatic or offered; do not mix.

**Integrations.** For each system: what is read and written, how it connects (`conexion`), how it authenticates, whether documentation and a test environment exist, who answers on the client side and what availability is required. Credentials are never written. If the system does not exist yet, say who builds it and by when.

**Stories and acceptance criteria.** Format: "As [profile], I want [action], so that [benefit]". Criteria: *Given* [context] *when* [action or event] *then* [measurable result: figure, state, exact message]. One story per capability; if a business rule appears in no story, its acceptance criterion is missing.

**Tests.** Connectivity with integrations, cases per story and the complete flow. Tests only cover what is in scope.

**Schedule.** Jelou's standard milestones: Planning and SOW, Bot construction, Internal and client testing, Go-live and stabilization. Write the business days of each and let the script compute the dates. Declare the country's holidays.

**Risks.** The template risks (confidentiality, delays, service availability, requirement changes, staffing, regulation) with a mitigation **specific to this project**. Add your own: undocumented integration, late access, data volume.

**Versions.** 0.0 first generation; 0.1, 0.2 reviews; 1.0, 2.0 approved (second digit always 0).
