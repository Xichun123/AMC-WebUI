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

## Relationships

- An **API Format** is either **Gemini Native Format** or **OpenAI-Compatible Format**.
- **Gemini Native Format** uses exactly one **Gemini Backend**.
- A **Gemini Backend** is either **Google AI Studio Backend** or **Vertex AI Backend**.
- **OpenAI-Compatible Format** does not have a **Gemini Backend**.
- An **Authentication Mode** applies to the active **API Format**.
- **Server-Managed Authentication** and **Browser Key Authentication** are distinct **Authentication Modes**.
- A **Managed Proxy Endpoint** is part of **Deployment State** when the deployment requires server mediation.
- **Deployment State** can constrain which **Client Configuration** fields are editable.

## Example dialogue

> **Dev:** "Should the API selector offer Vertex AI, Google AI Studio, and OpenAI-Compatible as three peers?"
> **Domain expert:** "No. OpenAI-Compatible is an API Format; Vertex AI and Google AI Studio are Gemini Backends under Gemini Native Format."

> **Dev:** "What should the settings selector be called?"
> **Domain expert:** "Call it API Format. The Gemini option should be labelled Gemini Interface in user-facing UI."

## Flagged ambiguities

- "API provider" was used to mean both **API Format** and **Gemini Backend** — resolved: the UI should distinguish these concepts.
- "frontend editing" was used to include both **Deployment State** and **Client Configuration** — resolved: deployment-level backend facts are read-only in the browser, while client-level API settings remain editable.
