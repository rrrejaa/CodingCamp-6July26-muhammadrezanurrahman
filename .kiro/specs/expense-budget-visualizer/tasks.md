# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a client-side-only expense tracker as three static files (`index.html`, `css/styles.css`, `js/app.js`). The app lets users add, view, and delete transactions, displays a running balance, and renders a Chart.js pie chart by category. All data is persisted in `localStorage`. No build step, no server, no package manager required.

## Tasks

- [x] 1. Create project file structure and HTML shell
  - Create `index.html` at the project root with the required `<meta viewport>` tag, `<link>` to `css/styles.css`, Chart.js CDN `<script>` tag (UMD bundle from jsDelivr), and deferred `<script>` to `js/app.js`
  - Create empty `css/styles.css` inside a `css/` directory
  - Create empty `js/app.js` inside a `js/` directory
  - Add all semantic HTML sections: Balance_Display, Input_Form (name text field, amount number field, category dropdown with Food/Transport/Fun options), Transaction_List container, and Chart canvas element
  - Ensure no additional HTML, CSS, or JS files exist anywhere in the project
  - _Requirements: 7.1, 7.2, 7.3, 8.1, 9.2_

- [x] 2. Implement the Storage Module
  - [x] 2.1 Write the `Storage` object with `KEY`, `load()`, `save()`, and `clear()` methods inside an IIFE in `js/app.js`
    - `load()` reads `localStorage["transactions"]`, parses JSON, validates it is an array of valid transaction objects, and throws `StorageReadError` on failure
    - `save(transactions)` serializes the array to JSON and writes it; throws `StorageWriteError` on `QuotaExceededError` or any other write failure
    - `clear()` calls `localStorage.removeItem(KEY)`
    - Define `StorageReadError` and `StorageWriteError` as subclasses of `Error`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 2.2 Write property test for Storage serialization round trip
    - **Property 9: Serialization round trip preserves transaction data**
    - Generate arbitrary valid transaction arrays; serialize via `JSON.stringify` and parse back via `JSON.parse`; assert deep equality on all five fields (`id`, `name`, `amount`, `category`, `createdAt`)
    - Use fast-check loaded via CDN in a test HTML file
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 2.3 Write property test for invalid localStorage recovery
    - **Property 10: Invalid localStorage data triggers recovery**
    - Generate arbitrary non-JSON strings and valid JSON values that are not valid transaction arrays (numbers, `null`, objects, arrays with wrong shapes); call the initialization routine for each; assert `localStorage["transactions"]` is removed, in-memory state is `[]`, and an error notification was surfaced
    - **Validates: Requirements 6.5, 6.6**

- [x] 3. Implement the Validator Module
  - [x] 3.1 Write the `Validator` object with `validateName()`, `validateAmount()`, `validateCategory()`, and `validateForm()` methods
    - `validateName(name)`: returns `{ valid, message }` — valid when trimmed length is 1–100 chars
    - `validateAmount(amount)`: returns `{ valid, message }` — valid when parseable as float and value is in `[0.01, 999999999.99]`
    - `validateCategory(category)`: returns `{ valid, message }` — valid when value is exactly `"Food"`, `"Transport"`, or `"Fun"`
    - `validateForm({ name, amount, category })`: runs all three, returns `{ isValid, errors: { name, amount, category } }`
    - _Requirements: 1.3, 1.4_

  - [ ]* 3.2 Write property test for Validator correctness
    - **Property 2: Validator accepts valid inputs and rejects invalid inputs**
    - Generate arbitrary triples of (name string, amount string, category string) covering valid and invalid combinations; verify `isValid` is `true` if and only if all three constraints hold; verify each violated field carries a non-empty error message
    - **Validates: Requirements 1.3, 1.4**

- [x] 4. Checkpoint — Ensure Storage and Validator are correct
  - Ensure all tests written so far pass; confirm `Storage.load()` and `Validator.validateForm()` behave correctly against the unit test cases from the design's Testing Strategy section, ask the user if questions arise.

- [x] 5. Implement State Store and core transaction logic
  - [x] 5.1 Define the in-memory `state` array and implement `addTransaction()` and `deleteTransaction()` helpers
    - `addTransaction({ name, amount, category })` creates a transaction object with `id` from `crypto.randomUUID()` (falling back to `Math.random()`-based UUID if unavailable), `name` trimmed, `amount` as `parseFloat`, and `createdAt` as `Date.now()`; prepends to `state`; calls `Storage.save(state)`
    - `deleteTransaction(id)` removes the entry with matching `id` from `state`; calls `Storage.save(state)`
    - _Requirements: 1.2, 3.3, 6.1, 6.2_

  - [ ]* 5.2 Write property test for valid transaction round trip
    - **Property 1: Valid transaction addition — round trip**
    - Generate arbitrary valid transactions (name 1–100 chars, amount in `[0.01, 999999999.99]`, one of three categories); call `addTransaction()`; serialize and deserialize via `Storage`; assert the transaction is present with all fields intact
    - **Validates: Requirements 1.2, 6.1, 6.3**

- [x] 6. Implement the UI Module — list, balance, and error rendering
  - [x] 6.1 Write `UI.renderList(transactions)`, `UI.renderBalance(transactions)`, `UI.showError(message)`, `UI.showFieldErrors(errors)`, `UI.clearFieldErrors()`, and `UI.resetForm()`
    - `renderList`: clears the Transaction_List container, sorts transactions descending by `createdAt`, and re-renders each as a row showing item name (truncated to 100 chars), amount as `"$X.XX"`, category, and a delete button with `data-delete-id` attribute; shows an empty-state message when the array is empty
    - `renderBalance`: computes `sum` of all amounts and sets the Balance_Display text to `"$X.XX"` (or `"-$X.XX"` for negative totals); displays `"$0.00"` for an empty list
    - `showError`: creates/updates a toast element, displays it at the top of the viewport, auto-dismisses after 5 s, supports manual dismiss
    - `showFieldErrors` / `clearFieldErrors`: show and clear inline error text adjacent to each form field
    - `resetForm`: clears the name field, amount field, and resets the category dropdown to its default unselected state
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5, 1.4, 1.5_

  - [ ]* 6.2 Write property test for transaction list render fields
    - **Property 4: Transaction list renders required fields correctly**
    - Generate arbitrary non-empty arrays of transactions; call `renderList()`; query the DOM; assert every rendered row contains the correctly formatted name, `"$X.XX"` amount, category label, and a delete button
    - **Validates: Requirements 2.1, 3.1**

  - [ ]* 6.3 Write property test for transaction list order
    - **Property 5: Transaction list order is most-recent-first**
    - Generate arbitrary arrays of transactions with distinct `createdAt` timestamps; call `renderList()`; query the rendered rows; assert the order of `createdAt` values in the DOM is strictly descending
    - **Validates: Requirements 2.3**

  - [ ]* 6.4 Write property test for balance sum
    - **Property 7: Balance equals sum of all transaction amounts**
    - Generate arbitrary arrays of transactions (including empty); call `renderBalance()`; assert the displayed text equals `"$" + sum.toFixed(2)` (with negative-sign handling for negative sums); assert empty list shows `"$0.00"`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 7. Implement the UI Module — Chart rendering
  - [x] 7.1 Write `UI.renderChart(transactions)`
    - When `transactions` is empty: destroy any existing Chart instance, hide the canvas element, show a placeholder `<p>` reading "No data to display"
    - When `transactions` is non-empty: compute per-category totals and percentages (rounded to 1 decimal place); if a Chart instance already exists, update `chart.data.labels`, `chart.data.datasets[0].data`, `chart.data.datasets[0].backgroundColor`, and call `chart.update()` (do NOT destroy and recreate); otherwise create a new `Chart` instance of type `"pie"` with tooltip showing name + percentage
    - If `window.Chart` is undefined (CDN load failure), call `UI.showError()` and return without throwing
    - Only include categories with at least one transaction as segments
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 7.2 Write property test for chart data proportions
    - **Property 8: Chart data proportions are correct**
    - Generate arbitrary non-empty transaction arrays with known per-category totals; compute expected percentages; verify chart data labels, values, and percentages match; verify sum of category totals equals overall total; verify only categories with ≥ 1 transaction appear
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**

- [x] 8. Implement Event Handlers and bootstrap wiring
  - [x] 8.1 Write `onDOMReady()`, `onFormSubmit(event)`, and `onDeleteClick(event)`, and wire them to DOM events
    - `onDOMReady`: detect `localStorage` availability (try/catch); if unavailable, show compatibility banner listing Chrome/Firefox/Edge/Safari and disable the form; otherwise call `Storage.load()` (catch `StorageReadError` → call `Storage.clear()`, `UI.showError()`, init `state = []`), set `state`, then call `UI.renderList`, `UI.renderBalance`, `UI.renderChart`
    - `onFormSubmit`: call `event.preventDefault()`; read name/amount/category from form; call `Validator.validateForm()`; if invalid call `UI.showFieldErrors(errors)` and return; otherwise call `UI.clearFieldErrors()`, `addTransaction()`, `UI.renderList`, `UI.renderBalance`, `UI.renderChart`, `UI.resetForm()`; catch `StorageWriteError` → `UI.showError()` and do NOT add to state/list
    - `onDeleteClick`: use `event.target.closest('[data-delete-id]')` to get `id`; call `window.confirm()` for confirmation; if confirmed call `deleteTransaction(id)` then `UI.renderList`, `UI.renderBalance`, `UI.renderChart`; catch `StorageWriteError` → `UI.showError()` and restore transaction to state
    - Attach `DOMContentLoaded` listener for `onDOMReady`, `submit` listener on the form for `onFormSubmit`, and delegated `click` listener on the Transaction_List container for `onDeleteClick`
    - _Requirements: 1.2, 1.5, 1.6, 3.2, 3.3, 3.4, 3.5, 3.6, 6.3, 6.4, 6.5, 6.6, 9.3_

  - [ ]* 8.2 Write property test for form reset after valid submission
    - **Property 3: Form resets after valid submission**
    - Generate arbitrary valid transaction inputs; simulate form submission via `onFormSubmit`; query the DOM; assert name field is empty, amount field is empty, and category dropdown is at its default unselected state
    - **Validates: Requirements 1.5**

  - [ ]* 8.3 Write property test for delete removes from list and storage
    - **Property 6: Delete removes transaction from list and storage**
    - Generate an arbitrary non-empty transaction list; pick an arbitrary transaction; simulate confirmed delete; assert the `id` is absent from the rendered Transaction_List DOM and from the array deserialized from `localStorage["transactions"]`
    - **Validates: Requirements 3.3, 3.4**

- [x] 9. Checkpoint — Ensure all wiring is correct
  - Ensure all event handlers work end-to-end: add a transaction, verify it appears in the list with correct balance and chart update; delete a transaction, verify it is removed and balance/chart update; verify empty-state messages render correctly; ask the user if questions arise.

- [x] 10. Implement CSS styling and responsive layout
  - [x] 10.1 Write `css/styles.css` with all layout, theming, and responsive rules
    - Define CSS custom properties for the color palette (background, surface, accent, error, text)
    - Style the Balance_Display, Input_Form fields and buttons (min 44×44px touch targets), Transaction_List (fixed height with `overflow-y: auto`), and Chart canvas container
    - Apply a two-column/two-row side-by-side layout (using CSS Grid or Flexbox) for viewports wider than 480px where each component occupies at least 40% of available horizontal width
    - Add a single `@media (max-width: 480px)` breakpoint that switches to a single-column stacked layout in the order: Balance_Display, Input_Form, Transaction_List, Chart
    - Style the toast notification (fixed, top of viewport, auto-dismiss animation) and inline field error messages
    - Style the compatibility banner (visible when `localStorage` is unavailable)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 11. Final checkpoint — Full smoke test
  - Open `index.html` via `file://` in the browser (Chrome or Firefox) and verify: no console errors on load; Chart.js CDN loads (`window.Chart` is defined); add 3 transactions across all three categories and verify list order, balance, and pie chart render correctly; delete one transaction and verify balance and chart update; reload the page and verify transactions persist; corrupt `localStorage["transactions"]` with an invalid string, reload, verify error toast and empty state; resize the viewport past the 480px breakpoint in both directions and verify layout switches correctly.
  - Ensure all automated property-based tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All code lives in exactly three files: `index.html`, `css/styles.css`, `js/app.js` — no additional files
- The entire IIFE in `js/app.js` uses `const`/`let`, arrow functions, template literals, optional chaining, and nullish coalescing (ES2020 — no transpilation needed)
- Chart.js UMD bundle from jsDelivr CDN is required because ES module imports do not work over `file://`
- Property tests use fast-check loaded via CDN; each test runs a minimum of 100 iterations
- The `crypto.randomUUID()` fallback ensures compatibility if the API is absent in older secure contexts
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 5, "tasks": ["7.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "10.1"] }
  ]
}
```
