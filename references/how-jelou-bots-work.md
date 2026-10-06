# How Jelou bots work (to write a realistic SOW)

This document exists so the SOW describes the solution with real components and neither promises what the platform does not do nor omits what always appears. It comes from reviewing production bots of several clients (commerce, restaurants, real estate). If you doubt a limit or capability, verify it in the Jelou documentation or, for an existing bot, with the CLI in read-only mode (`jelou context`, `jelou graph`). Do not modify anything.

## 1. Anatomy of a project

| Piece | What it is | What it implies for the SOW |
|---|---|---|
| **Channel** | WhatsApp number (production) and a sandbox number for tests | Who provides the number, Meta verification and when it is tested in sandbox |
| **Workflows** | Conversation flows. Almost always: *Start* (default), an *AI router* that decides the destination, one workflow per domain (sales, payments, FAQ, after-sales), *Agent* and utilities | The SOW's conversation map must correspond to these workflows |
| **Nodes** | Messages, conditionals, code, HTTP calls, tools, subflows, AI tasks, human handoff (CONNECT), HSM templates, pauses, memory | Critical rules must live in deterministic nodes (see section 3) |
| **Tools** | Reusable actions, own (query stock, validate customer) or from the marketplace (email OTP, reminders, payments) | Each SOW integration is usually one or several tools |
| **Functions** | Serverless code with cron. Used as an intermediate layer with the client's system or to synchronize a catalog | Decides who builds and hosts that layer and how often it runs |
| **Datum** | Jelou's database with collections (users, sessions, orders, events) and Excel/CSV export | It is the default "report"; what is not in Datum cannot be reported |
| **Jelou Shop** | Catalog, cart and purchase webview | "Catalog by webview" almost always means Shop; define SKU loading and who maintains it |
| **WhatsApp Flows** | In-chat forms, sometimes with a validation function | Each form is a deliverable with defined fields |
| **HSM templates** | Messages initiated by the bot, approved by Meta | Need approved texts and approval time in the schedule |
| **Knowledge base** | Documents the bot consults to answer FAQs | The client must deliver the documents; define whether it answers only from them |
| **Agent panel (PMA / Connect)** | Handoff to agent teams with hours | Each team, its hours and the out-of-hours message belong in the SOW |
| **Secrets** | Credentials stored securely | The SOW never carries credentials; it only names which ones are needed |

## 2. Frequent capabilities and how they are delivered

| Capability the client asks for | How it is delivered in Jelou | What the SOW must say |
|---|---|---|
| Browse the catalog and buy | Jelou Shop + webview + stock tool | Catalog source, number of SKUs, sync frequency, who loads images |
| Validate customer, credit limit or balance | HTTP tool to the client's system | Exact operation, returned fields, what happens on failure |
| Verify identity | Email OTP (marketplace tool) or ID validation | Attempts, validity, what happens on failure, whether several emails exist |
| Create an order in an ERP | HTTP tool or function + intermediate layer | Connection mode, who hosts, input and output data, error handling |
| Payments | Marketplace payments app or the client's gateway | Provider, methods, retries, environment; if there is no charge in the chat, say so in plain words |
| Frequently asked questions | Knowledge base | Documents, language, what is escalated to a human |
| Talk to an agent | CONNECT to a team with hours | Teams, hours, escalation criteria |
| Campaigns and reminders | HSM templates + reminders tool | Texts, Meta approval, sending windows |
| Forms and registration | WhatsApp Flows or guided conversation | Fields, validations, where they are stored |
| Reports | Datum + export; platform metrics | Which columns, what frequency; do not promise custom dashboards |

## 3. Deterministic vs conversational (a decision almost never in the SOW)

A bot combines deterministic nodes (always do the same thing) and AI tasks (interpret language and can vary). In real bots, important rules ended up written in the AI prompt, so they are not guaranteed: for example the OTP or the escalation to an agent.

Rule for the SOW: every rule that moves money, validates identity or decides an approval must be declared **deterministic**. Wording, tone, product search or understanding the intent may be **conversational**. Each solution component carries this attribute and the linter warns if a critical rule is left as conversational.

## 4. Elements that almost always appear (decide to accept or exclude them)

1. **Resolution of the user's phone.** If the WhatsApp number does not arrive resolved, the bot asks to share the contact (phone guard). Applies to any bot that uses the phone as identity.
2. **Acceptance of terms and data policy**, stored with a date.
3. **Out-of-hours message** and handoff behavior per team.
4. **Log or audit** of events and failures in Datum.
5. **Confirmation emails** (to the customer and the salesperson).
6. **Reminders** (abandoned cart, pending payment).
7. **Sandbox vs production mode** and test data.

If the client did not ask for them, the SOW must say whether they are included or left out. Otherwise they show up in the bot without anyone having agreed to them.

## 5. Known constraints and traps

- **HSM templates** require Meta approval: include that time in the schedule and treat the texts as a dependency.
- **The catalog and checkout webview** is provided by Jelou Shop; a custom one is not designed unless it is in scope and budget.
- **Client internal systems** (ERP, databases) usually require an IP whitelist, VPN or an integration user; it is a client dependency with a date.
- **Batch updates** (cron) and real-time queries coexist: the SOW must say which one is used for each decision.
- **The bot sees no more than the system hands it.** If a rule needs a datum (credit limit, block), it must exist in some documented read operation.
- **Personal data**: ID number, email and phone that are stored need a purpose and retention.
- **Secrets, not literals.** Credentials are never written in nodes or in the SOW; the SOW lists the required secrets by name.
- **Environments.** If the variable that selects the environment is missing, it must not fall back to production by default.
- **Test data.** QA shortcuts (fixed phone numbers or ID numbers that skip validations) do not go to production.

## 6. Indicative effort

The official template uses these milestones: planning and SOW (≈ 11 business days), bot construction (≈ 12), internal and client testing (≈ 8), go-live and stabilization (≈ 8). They are a starting point: add time when there are undocumented integrations, HSM templates to approve or accesses the client has not delivered yet.

## 7. How to check technical context without touching anything

- **Jelou documentation:** look the limit or capability up there before stating it in the SOW.
- **Existing bot (upgrade or improvement):** `jelou context` and `jelou graph` in a folder of your own, read-only. Describe what exists and what changes, without copying credentials, phone numbers or emails.
- **Never** run `push` or `publish`, or modify the platform, from this skill.
