# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a client-side-only web application that lets users log, view, and delete spending transactions. It displays a running balance and a pie chart showing spending distribution by category. All data is persisted in the browser's `localStorage` — no server, no build tool, no package manager required.

The application is implemented in three files only:
- `index.html` — markup and CDN script references
- `css/styles.css` — all styling and responsive layout
- `js/app.js` — all application logic

Opening `index.html` directly in any modern browser is sufficient to run the app.

**Technology choices:**
- Chart.js 4.4.0 via jsDelivr CDN (`https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`) for the pie chart. UMD bundle is used because ES module imports require a server context; UMD works correctly over `file://`.
- Vanilla JavaScript (ES2020 features: `nullish coalescing`, `optional chaining`, `const`/`let`, `arrow functions`, template literals) — all natively supported in Chrome, Firefox, Edge, and Safari.
- CSS custom properties for theming; CSS Flexbox and Grid for layout; a single `@media` breakpoint at `480px`.

---

## Architecture

The app follows a **single-responsibility module pattern** implemented as a single IIFE (Immediately Invoked Function Expression) within `js/app.js`. Since the file is loaded via a plain `<script>` tag (not `type="module"`), ES module `import`/`export` is not used. Instead, the code is organized into clearly named sections that each own one concern.

```
┌──────────────────────────────────────────────────────┐
│                    index.html                        │
│  CDN: Chart.js UMD → window.Chart                    │
│  <link> → css/styles.css                             │
│  <script defer> → js/app.js                          │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│                    js/app.js                         │
│                                                      │
│  ┌─────────────┐   ┌──────────────┐  ┌───────────┐  │
│  │  Storage    │   │  Validator   │  │  State    │  │
│  │  Module     │   │  Module      │  │  Store    │  │
│  │  (R/W LS)   │   │  (pure fn)   │  │  (array)  │  │
│  └──────┬──────┘   └──────┬───────┘  └─────┬─────┘  │
│         │                 │                │         │
│         └─────────────────┴────────────────┘         │
│                           │                          │
│  ┌───────────────────────────────────────────────┐   │
│  │              UI Module                        │   │
│  │  renderList() · renderBalance() · renderChart()│  │
│  │  showError() · resetForm()                    │   │
│  └───────────────────────────────────────────────┘   │
│                           │                          │
│  ┌───────────────────────────────────────────────┐   │
│  │              Event Handlers                   │   │
│  │  onFormSubmit · onDeleteClick · onDOMReady    │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Data flow

```
User Action
    │
    ▼
Event Handler
    │── validate() ──► show inline errors (if invalid)
    │
    ▼ (if valid)
State Update (mutate in-memory array)
    │
    ▼
Storage.save(state)    ← write JSON to localStorage["transactions"]
    │
    ▼
UI.render(state)       ← renderList + renderBalance + renderChart
```

---

## Components and Interfaces

### 1. Storage Module

Wraps all `localStorage` access. Never throws to callers — errors are caught internally and surfaced via return values or thrown as typed errors that the caller can handle.

```javascript
const Storage = {
  KEY: 'transactions',

  // Returns parsed array or throws StorageReadError
  load() { … },

  // Returns true on success, throws StorageWriteError on failure
  save(transactions) { … },

  // Removes the key; used during corrupt-data recovery
  clear() { … },
};
```

**Error types:**
- `StorageReadError` — thrown when `localStorage.getItem` fails or when the stored value cannot be parsed as a valid transaction array.
- `StorageWriteError` — thrown when `localStorage.setItem` fails (e.g., QuotaExceededError, or storage is unavailable).

### 2. Validator Module

Pure functions with no side effects. Each function accepts the raw field value and returns `{ valid: boolean, message: string }`.

```javascript
const Validator = {
  // name: string → { valid, message }
  validateName(name) { … },

  // amount: string → { valid, message }
  validateAmount(amount) { … },

  // category: string → { valid, message }
  validateCategory(category) { … },

  // Runs all three; returns { isValid, errors: { name, amount, category } }
  validateForm({ name, amount, category }) { … },
};
```

**Validation rules:**
| Field    | Rule                                                    |
|----------|---------------------------------------------------------|
| name     | Non-empty, trimmed length ≤ 100 characters              |
| amount   | Parseable as float; 0.01 ≤ value ≤ 999,999,999.99      |
| category | One of: `"Food"`, `"Transport"`, `"Fun"`                |

### 3. State Store

A plain in-memory array of transaction objects. The array is the single source of truth at runtime; `localStorage` is the persistence layer.

**Transaction object shape:**
```javascript
{
  id: string,          // crypto.randomUUID() — unique identifier
  name: string,        // trimmed item name, max 100 chars
  amount: number,      // float, 0.01 – 999999999.99
  category: string,    // "Food" | "Transport" | "Fun"
  createdAt: number,   // Date.now() timestamp (ms since epoch)
}
```

### 4. UI Module

All DOM mutation functions. Each function is idempotent — calling it with the same state produces the same DOM output.

```javascript
const UI = {
  // Clears and re-renders the transaction list
  renderList(transactions) { … },

  // Updates the balance display text
  renderBalance(transactions) { … },

  // Updates or creates the Chart.js instance
  renderChart(transactions) { … },

  // Shows a toast/notification for errors
  showError(message) { … },

  // Shows inline validation errors on form fields
  showFieldErrors(errors) { … },

  // Clears inline validation errors
  clearFieldErrors() { … },

  // Resets form to default state
  resetForm() { … },
};
```

**Chart.js integration:**

The Chart instance is stored in a module-level variable. On each update, `chart.data.labels`, `chart.data.datasets[0].data`, and `chart.data.datasets[0].backgroundColor` are replaced, then `chart.update()` is called rather than destroying and recreating the instance (avoids animation glitches).

When the transaction list is empty, the Chart instance is destroyed (if it exists), a placeholder `<p>` element reading "No data to display" is shown over the canvas, and the canvas element is hidden.

### 5. Event Handlers

```javascript
// DOMContentLoaded — bootstrap: detect browser support, load from storage, render
function onDOMReady() { … }

// form 'submit' event — validate, add transaction, persist, render
function onFormSubmit(event) { … }

// Transaction_List 'click' event (delegated) — confirm, delete, persist, render
function onDeleteClick(event) { … }
```

Event delegation is used for the delete buttons: a single `click` listener on the list container handles all delete buttons via `event.target.closest('[data-delete-id]')`.

---

## Data Models

### Transaction (runtime and stored)

```javascript
/**
 * @typedef {Object} Transaction
 * @property {string}  id         - UUID v4 from crypto.randomUUID()
 * @property {string}  name       - Item name, 1–100 chars (trimmed)
 * @property {number}  amount     - Float, 0.01–999999999.99
 * @property {string}  category   - "Food" | "Transport" | "Fun"
 * @property {number}  createdAt  - Unix timestamp in ms (Date.now())
 */
```

### localStorage schema

```
Key:   "transactions"
Value: JSON string of Transaction[]

Example:
[
  {
    "id": "3f2a4b1c-...",
    "name": "Coffee",
    "amount": 4.50,
    "category": "Food",
    "createdAt": 1720000000000
  }
]
```

### Validation error map

```javascript
/**
 * @typedef {Object} FieldError
 * @property {string|null} name      - Error message or null if valid
 * @property {string|null} amount    - Error message or null if valid
 * @property {string|null} category  - Error message or null if valid
 */
```

### Chart data model (computed, not stored)

```javascript
/**
 * Computed from transactions[] just before rendering the chart.
 * @typedef {Object} ChartData
 * @property {string[]} labels              - e.g. ["Food", "Transport", "Fun"]
 * @property {number[]} values              - total amount per category
 * @property {number[]} percentages         - value / total * 100, 1 decimal
 * @property {string[]} backgroundColors    - distinct hex colors per category
 */
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Valid transaction addition — round trip

*For any* valid transaction (name between 1–100 characters, amount between 0.01 and 999,999,999.99, category one of Food/Transport/Fun), adding it to the transaction list and then saving to and loading from localStorage should produce a list containing the original transaction with all fields preserved.

**Validates: Requirements 1.2, 6.1, 6.3**

---

### Property 2: Validator accepts valid inputs and rejects invalid inputs

*For any* combination of form field values, the validator should return `isValid = true` if and only if all three of these conditions hold simultaneously: the name is non-empty and trimmed length ≤ 100; the amount parses to a float in [0.01, 999,999,999.99]; the category is one of "Food", "Transport", or "Fun". Any input that violates one or more conditions should return `isValid = false` with a non-empty error message for each violated field.

**Validates: Requirements 1.3, 1.4**

---

### Property 3: Form resets after valid submission

*For any* valid transaction submission, the name field, amount field, and category dropdown should all return to their default empty/unselected state after the transaction is successfully added.

**Validates: Requirements 1.5**

---

### Property 4: Transaction list renders required fields correctly

*For any* set of transactions, every transaction rendered in the list should display the item name (truncated to 100 characters if needed), the amount formatted as `"$X.XX"` with exactly 2 decimal places and a `$` prefix, the category label, and a delete button.

**Validates: Requirements 2.1, 3.1**

---

### Property 5: Transaction list order is most-recent-first

*For any* list of transactions with distinct `createdAt` timestamps, the rendered order of items in the Transaction_List should correspond to descending `createdAt` order (newest first).

**Validates: Requirements 2.3**

---

### Property 6: Delete removes transaction from list and storage

*For any* transaction that exists in the list, after the user confirms deletion, that transaction's `id` should not appear in either the rendered Transaction_List or in the array deserialized from `localStorage["transactions"]`.

**Validates: Requirements 3.3, 3.4**

---

### Property 7: Balance equals sum of all transaction amounts

*For any* list of transactions (including the empty list), the value displayed in the Balance_Display should equal the arithmetic sum of all `amount` fields, formatted with a `$` prefix and exactly 2 decimal places. For an empty list the display should be `"$0.00"`.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

---

### Property 8: Chart data proportions are correct

*For any* non-empty list of transactions, the computed chart data for each category should satisfy: `categoryTotal / overallTotal * 100` equals the displayed percentage (rounded to 1 decimal place), and the sum of all category totals equals `overallTotal`. Only categories with at least one transaction should appear as chart segments.

**Validates: Requirements 5.1, 5.2, 5.3, 5.6**

---

### Property 9: Serialization round trip preserves transaction data

*For any* valid array of transaction objects, serializing it to JSON and then deserializing it should produce an array of objects with identical `id`, `name`, `amount`, `category`, and `createdAt` values.

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 10: Invalid localStorage data triggers recovery

*For any* string stored under `"transactions"` that is either not valid JSON or is valid JSON but not a valid array of transaction objects, the initialization routine should: remove the `"transactions"` key from localStorage, initialize the in-memory state as an empty array, and surface an error notification to the user — without throwing an unhandled exception.

**Validates: Requirements 6.5, 6.6**

---

## Error Handling

| Scenario | Detection | Response |
|---|---|---|
| Form submitted with invalid fields | `Validator.validateForm()` returns `isValid: false` | Show inline error per field; do not add transaction |
| `localStorage.setItem` throws on write | `try/catch` in `Storage.save()` | Show error toast; do not add transaction to list (or restore it if already removed) |
| `localStorage.getItem` returns non-JSON string | `JSON.parse` throws in `Storage.load()` | Call `Storage.clear()`; show error toast; initialize with `[]` |
| `localStorage.getItem` returns valid JSON but invalid structure | Type-guard check in `Storage.load()` | Same recovery as above |
| `localStorage` is entirely unavailable (`window.localStorage` is `undefined` or throws on access) | `try/catch` during `onDOMReady` | Show compatibility banner listing supported browsers; disable form |
| `crypto.randomUUID` unavailable | Feature-detect in transaction creation | Fallback to `Math.random()`-based UUID |
| Chart.js CDN fails to load (`window.Chart` is undefined) | Check in `UI.renderChart()` | Show error toast; continue without chart |

**Error notification pattern:**

Errors are surfaced via a non-blocking toast notification that appears at the top of the viewport, auto-dismisses after 5 seconds, and can be dismissed manually. Inline form errors appear adjacent to each field and are cleared when the user next modifies that field.

---

## Testing Strategy

### Unit tests (example-based)

Focused on concrete scenarios and edge cases:

- Empty form submission shows all three error messages and does not add a transaction
- Form with `name=""`, valid amount, valid category: only name error appears
- Form with valid name, `amount="0"`, valid category: only amount error appears  
- Form with valid name, `amount="abc"`, valid category: only amount error appears
- Balance shows `"$0.00"` when transaction list is empty
- Balance shows `"-$5.00"` when total is negative (defensive, since validation prevents negative amounts but covers formatting)
- Empty state message is shown when transaction list is empty
- Chart shows placeholder when no transactions exist
- Recovery routine runs when `localStorage["transactions"]` is `"not json"`
- Recovery routine runs when `localStorage["transactions"]` is `"null"` (valid JSON, not an array)
- Compatibility message is shown when `localStorage` is unavailable

### Property-based tests

Uses [fast-check](https://fast-check.io/) loaded via CDN for browser-based property testing. Each property test runs a minimum of **100 iterations**.

The tag format for each test references the design property:
**Feature: expense-budget-visualizer, Property N: {property_text}**

**Property 1 — Valid transaction round trip**
Generate arbitrary valid transactions (arbitrary name string 1–100 chars, float in [0.01, 999999999.99], one of three categories). Add each to the list, serialize, deserialize, verify the transaction is present with all fields intact.

**Property 2 — Validator correctness**
Generate arbitrary triples of (name, amount string, category string) covering valid and invalid combinations. Verify the validator's `isValid` output matches whether all three constraints are satisfied.

**Property 3 — Form reset**
Generate arbitrary valid transactions, simulate form submission, verify all three form fields are in their reset state afterward.

**Property 4 — Render fields**
Generate arbitrary non-empty arrays of transactions, render the list, verify every rendered entry contains the required formatted fields and a delete button.

**Property 5 — Render order**
Generate arbitrary arrays of transactions with distinct timestamps, render the list, verify rendered order is descending by `createdAt`.

**Property 6 — Delete removes from list and storage**
Generate an arbitrary non-empty list, pick an arbitrary transaction to delete, confirm deletion, verify the `id` is absent from both the list and storage.

**Property 7 — Balance sum**
Generate arbitrary arrays of transactions (including empty), compute the expected sum, verify the displayed balance equals the formatted sum.

**Property 8 — Chart proportions**
Generate arbitrary non-empty transaction arrays with known per-category totals. Compute expected percentages. Verify chart data matches.

**Property 9 — Serialization round trip**
Generate arbitrary valid transaction arrays. Serialize to JSON and parse back. Verify deep equality on all fields.

**Property 10 — Invalid storage recovery**
Generate arbitrary strings that are not valid JSON, and generate valid JSON values that are not valid transaction arrays (numbers, `null`, objects, arrays with wrong shapes). For each, call the initialization routine and verify recovery behavior.

### Integration / smoke tests (manual checklist)

- Open `index.html` via `file://` in Chrome, Firefox, Edge, and Safari — verify no console errors
- Verify Chart.js CDN loads (check `window.Chart` is defined in browser console)
- Add 3 transactions across all categories — verify pie chart renders with correct proportions
- Resize window through 480px breakpoint — verify layout switches correctly
- Add a transaction, close tab, reopen — verify transaction persists
- Open browser DevTools → Application → Storage → clear `localStorage["transactions"]` → reload — verify empty state
- Corrupt `localStorage["transactions"]` with `localStorage.setItem('transactions', 'INVALID')` → reload — verify error toast and empty state
