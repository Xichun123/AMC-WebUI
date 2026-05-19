# AMC WebUI

AMC WebUI is a chat interface where users choose an API format and, for Gemini-native traffic, observe which managed Gemini backend the deployment uses.

## Language

**API Format**:
The request and response protocol the UI uses for model calls.
_Avoid_: API provider, vendor

**Gemini Native Format**:
The Gemini API format used for Gemini-specific capabilities.
_Avoid_: Gemini provider, official provider

**OpenAI-Compatible Format**:
The OpenAI-style chat/completions API format used with compatible gateways.
_Avoid_: OpenAI provider

**Gemini Backend**:
The managed upstream behind Gemini Native Format requests.
_Avoid_: API format

**Google AI Studio Backend**:
A Gemini Backend authenticated with Gemini API keys.
_Avoid_: AI Studio format

**Vertex AI Backend**:
A Gemini Backend authenticated by the server through Google Cloud credentials.
_Avoid_: Vertex format

**Authentication Mode**:
Where credentials for the active API Format are held.
_Avoid_: Provider mode

**Server-Managed Authentication**:
An Authentication Mode where the server holds or derives credentials for model requests.
_Avoid_: frontend key

**Browser Key Authentication**:
An Authentication Mode where the current browser stores and sends the user's API key.
_Avoid_: server key

**Managed Proxy Endpoint**:
The server route used by browser requests when a deployment mediates Gemini traffic.
_Avoid_: upstream provider URL

**Deployment State**:
The server-controlled runtime facts the browser can display but not change.
_Avoid_: User setting

**Client Configuration**:
The browser-held settings a user can edit for their current session.
_Avoid_: Deployment setting

**Site User**:
A person who is allowed to enter and use a protected AMC WebUI deployment.
_Avoid_: API user, provider user

**Site Access**:
The permission to load the AMC WebUI application and call its same-origin API routes.
_Avoid_: API authentication

**Login Surface**:
The small part of a protected deployment that a browser may reach before it has a Login Session.
_Avoid_: public app

**Login Session**:
The time-limited server-recognized state proving that a browser belongs to a Site User.
_Avoid_: API key, model session

**Site User Registry**:
The deployment-owned list of Site Users allowed to create Login Sessions.
_Avoid_: app account database

**Site Credential**:
A username and password pair that identifies a Site User for Site Access.
_Avoid_: API key

**Browser Data Owner**:
The current browser profile that owns local chat history, files, and client-side settings.
_Avoid_: Site User

## Relationships

- A **Site User** does not own chat history, files, or client-side settings.
- An **API Format** is either **Gemini Native Format** or **OpenAI-Compatible Format**.
- **Gemini Native Format** uses exactly one **Gemini Backend**.
- A **Gemini Backend** is either **Google AI Studio Backend** or **Vertex AI Backend**.
- **OpenAI-Compatible Format** does not have a **Gemini Backend**.
- An **Authentication Mode** applies to the active **API Format**.
- **Server-Managed Authentication** and **Browser Key Authentication** are distinct **Authentication Modes**.
- A **Managed Proxy Endpoint** is part of **Deployment State** when the deployment requires server mediation.
- **Deployment State** can constrain which **Client Configuration** fields are editable.
- A **Site User** needs a **Login Session** before receiving **Site Access**.
- A **Login Surface** is reachable before **Site Access** is granted.
- A **Login Surface** may remember the requested site location so a **Site User** returns there after login.
- **Site Access** is separate from model-request **Authentication Mode**.
- A **Site User Registry** defines which **Site Users** may create **Login Sessions**.
- A **Site Credential** belongs to exactly one **Site User**.
- A **Browser Data Owner** determines which local chat history, files, and client-side settings are visible after Site Access is granted.

## Example dialogue

> **Dev:** "Should the API selector offer Vertex AI, Google AI Studio, and OpenAI-Compatible as three peers?"
> **Domain expert:** "No. OpenAI-Compatible is an API Format; Vertex AI and Google AI Studio are Gemini Backends under Gemini Native Format."

> **Dev:** "What should the settings selector be called?"
> **Domain expert:** "Call it API Format. The Gemini option should be labelled Gemini Interface in user-facing UI."

> **Dev:** "Can we use the same credential for Site Access and Vertex AI Backend calls?"
> **Domain expert:** "No. A Login Session proves the browser may enter the site; Server-Managed Authentication proves the server may call the Gemini Backend."

> **Dev:** "Do Site Users manage themselves inside AMC WebUI?"
> **Domain expert:** "No. The deployment owner controls the Site User Registry outside the application UI."

> **Dev:** "Can a Site Credential contain Chinese characters?"
> **Domain expert:** "Yes. Site Credentials are user-facing credentials and may contain Unicode text."

> **Dev:** "Can an unauthenticated browser call /api/gemini if it knows the URL?"
> **Domain expert:** "No. Only the Login Surface is public; Site Access is required for the application and same-origin APIs."

> **Dev:** "If two Site Users log in on the same browser, do they see different chat histories?"
> **Domain expert:** "No. Site Users are gate identities; the Browser Data Owner controls the local chat history and files."

> **Dev:** "What belongs on the Login Surface?"
> **Domain expert:** "Only the AMC mark and the Site Credential form."

## Current site access implementation

- `SITE_AUTH_USERS_JSON` is the deployment-owned **Site User Registry**.
- `SITE_AUTH_SECRET` signs the **Login Session** cookie.
- `SITE_AUTH_SESSION_DAYS` controls Login Session lifetime and defaults to 7 days.
- An empty `SITE_AUTH_USERS_JSON` disables Site Access protection for local and private deployments.
- Docker Nginx protects the app shell and same-origin `/api/*` routes with `/api/auth/check`.
- The **Login Surface** is `/login`; it contains only the AMC mark and the Site Credential form.
- Login submits to `/api/auth/login`; session status is readable at `/api/auth/session`.

## Flagged ambiguities

- "API provider" was used to mean both **API Format** and **Gemini Backend** — resolved: the UI should distinguish these concepts.
- "frontend editing" was used to include both **Deployment State** and **Client Configuration** — resolved: deployment-level backend facts are read-only in the browser, while client-level API settings remain editable.
- "authorized user" was used near model API authentication — resolved: use **Site User** for people allowed into the deployment, and keep it separate from **Authentication Mode**.
- "user management" was proposed for Site Access — resolved: the initial Site User Registry belongs to deployment configuration, not the browser UI.
- "password" could be confused with API keys — resolved: use **Site Credential** for site login and **Authentication Mode** for model requests.
- "login user" could imply data ownership — resolved: **Site User** controls Site Access only; **Browser Data Owner** controls local chat and file visibility.
