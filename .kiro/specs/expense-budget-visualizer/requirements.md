# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track daily spending by adding, viewing, and deleting transactions. The app displays a running total balance and a pie chart that visualizes spending distribution by category. It runs entirely in the browser with no backend server, using Local Storage for persistence. The project structure follows a strict single-file-per-folder rule: one HTML file, one CSS file inside `css/`, and one JavaScript file inside `js/`.

## Glossary

- **App**: The Expense & Budget Visualizer web application
- **Transaction**: A single spending record consisting of an item name, a monetary amount, and a category
- **Category**: A classification label for a transaction; one of: Food, Transport, or Fun
- **Transaction_List**: The scrollable UI component that displays all recorded transactions
- **Input_Form**: The HTML form used to enter a new transaction's name, amount, and category
- **Balance_Display**: The UI component that shows the current total of all transaction amounts
- **Chart**: The pie chart component that visualizes spending distribution by category
- **Local_Storage**: The browser's Web Storage API used to persist transaction data client-side
- **Validator**: The client-side logic that checks form inputs before a transaction is added

## Requirements

---

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to fill in a form with an item name, amount, and category and submit it, so that the transaction is recorded and visible in the list.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for item name (max 100 characters), a numeric field for amount (accepting values from 0.01 to 999,999,999.99), and a dropdown selector for category with options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled and a valid amount, THE App SHALL add the transaction to the top of the Transaction_List and persist it to Local_Storage within 1 second.
3. WHEN the user submits the Input_Form, THE Validator SHALL verify that the item name field is not empty and not exceeding 100 characters, the amount field contains a number between 0.01 and 999,999,999.99 inclusive, and a category is selected.
4. IF the Validator determines that one or more fields are invalid on form submission, THEN THE Input_Form SHALL display a descriptive inline error message adjacent to each invalid field identifying the specific violated rule, and SHALL NOT add a transaction.
5. WHEN a transaction is successfully added, THE Input_Form SHALL reset: the item name field to empty, the amount field to empty, and the category dropdown to its default unselected state.
6. IF Local_Storage is unavailable or throws an error when writing a transaction, THEN THE App SHALL display an error notification to the user and SHALL NOT add the transaction to the Transaction_List.

---

### Requirement 2: View Transaction List

**User Story:** As a user, I want to see a scrollable list of all my transactions, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored transactions, each showing the item name (truncated to 100 characters if needed), amount formatted with a currency symbol and 2 decimal places (e.g., "$12.50"), and category label.
2. IF Local_Storage contains no transactions on page load, THEN THE Transaction_List SHALL display an empty state message indicating no transactions have been added.
3. IF Local_Storage contains one or more transactions on page load, THEN THE Transaction_List SHALL render all of them in most-recent-first order without requiring user interaction.
4. WHEN the number of transactions exceeds the visible area of the Transaction_List container, THE Transaction_List SHALL become scrollable vertically without expanding beyond the container's fixed height.

---

### Requirement 3: Delete a Transaction

**User Story:** As a user, I want to delete a transaction from the list, so that I can correct mistakes or remove outdated entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL render a delete button for each transaction entry.
2. WHEN the user activates the delete button for a transaction, THE App SHALL display a confirmation prompt asking the user to confirm the deletion before proceeding.
3. IF the user confirms the deletion, THEN THE App SHALL remove that transaction from the Transaction_List within 300ms and delete it from Local_Storage.
4. WHEN a transaction is deleted, THE Balance_Display and THE Chart SHALL each update within 300ms to reflect the removal.
5. IF the user cancels the confirmation prompt, THEN THE App SHALL take no action and the transaction SHALL remain in the Transaction_List and Local_Storage unchanged.
6. IF Local_Storage throws an error when deleting a transaction, THEN THE App SHALL display an error notification and SHALL restore the transaction in the Transaction_List if it was already removed from the UI.

---

### Requirement 4: Display Total Balance

**User Story:** As a user, I want to see my total spending balance at the top of the page, so that I know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts, formatted with a currency symbol prefix and exactly 2 decimal places (e.g., "$42.75").
2. WHEN a transaction is added, THE Balance_Display SHALL recalculate and display the updated total within 100ms.
3. WHEN a transaction is deleted, THE Balance_Display SHALL recalculate and display the updated total within 100ms.
4. WHILE no transactions exist, THE Balance_Display SHALL show "$0.00".
5. IF the sum of transaction amounts is negative, THEN THE Balance_Display SHALL display the value with a negative sign prefix (e.g., "-$15.00").

---

### Requirement 5: Visualize Spending with a Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending grouped by category, so that I can understand how my money is distributed across categories.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart displaying the proportion of total spending for each category that has at least one transaction, with each category represented by a distinct color and labeled with its name and percentage to 1 decimal place (e.g., "Food 45.2%").
2. WHEN a transaction is added, THE Chart SHALL update to reflect the new category distribution within 500ms.
3. WHEN a transaction is deleted, THE Chart SHALL update to reflect the revised category distribution within 500ms.
4. WHILE no transactions exist, THE Chart SHALL display a visible placeholder message (e.g., "No data to display") and SHALL NOT render any segments, zero-value slices, or undefined entries.
5. THE Chart SHALL use a charting library loaded via a CDN script tag and SHALL NOT require a local build step or package installation.
6. WHEN only one category has transactions, THE Chart SHALL render that category as a full circle (100%) with its label and percentage displayed correctly.

---

### Requirement 6: Persist Data Across Sessions

**User Story:** As a user, I want my transactions to be saved when I close and reopen the browser, so that I do not lose my spending history.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL write the full list of transactions to Local_Storage under the key `"transactions"` as a serialized JSON string.
2. WHEN a transaction is deleted, THE App SHALL write the updated list of transactions to Local_Storage under the key `"transactions"` as a serialized JSON string.
3. WHEN the App initializes on page load, THE App SHALL read and deserialize the value stored under the `"transactions"` key in Local_Storage before rendering the Transaction_List, Balance_Display, and Chart.
4. IF Local_Storage contains no value for the `"transactions"` key on page load (including when the key is explicitly set to `[]`), THEN THE App SHALL initialize with an empty transaction list without throwing an error.
5. IF Local_Storage contains a value for `"transactions"` that cannot be parsed as JSON, THEN THE App SHALL remove the `"transactions"` key from Local_Storage, display an error notification to the user, and initialize with an empty transaction list.
6. IF Local_Storage contains a value for `"transactions"` that is valid JSON but does not deserialize to a valid array of transaction objects, THEN THE App SHALL remove the `"transactions"` key from Local_Storage, display an error notification to the user, and initialize with an empty transaction list.

---

### Requirement 7: Project File Structure

**User Story:** As a developer, I want the project to follow a strict single-file-per-folder structure, so that the codebase remains clean and easy to navigate.

#### Acceptance Criteria

1. THE App SHALL be structured with exactly one HTML file at the project root, exactly one CSS file inside a `css/` directory, and exactly one JavaScript file inside a `js/` directory; no additional HTML, CSS, or JS files shall exist anywhere in the project.
2. WHEN the HTML file is opened in a browser, THE App SHALL load the CSS file using a `<link>` tag and the JavaScript file using a `<script>` tag, both referencing relative paths from the root HTML file.
3. THE App SHALL function as a standalone web page using only static assets, requiring no build step, no package installation, and no local server to open and run correctly in a browser.
4. IF any required file (the root HTML, the CSS file in `css/`, or the JS file in `js/`) is missing, THEN THE App SHALL fail gracefully with a browser-native resource-load error rather than silently degrading with unstyled or non-functional output.

---

### Requirement 8: Responsive and Mobile-Friendly Layout

**User Story:** As a user, I want to use the app on my phone, so that I can log expenses on the go.

#### Acceptance Criteria

1. THE App SHALL include a `<meta name="viewport" content="width=device-width, initial-scale=1">` tag that enables proper scaling on mobile devices.
2. THE App SHALL render the Balance_Display, Input_Form, Transaction_List, and Chart stacked in that order in a single-column layout on screen widths of 480 pixels or fewer.
3. WHILE the screen width is greater than 480 pixels, THE App SHALL arrange UI components in a two-row side-by-side layout where each component occupies at least 40% of the available horizontal width.
4. THE Input_Form fields and buttons SHALL have touch-friendly tap targets with a minimum height of 44 pixels and a minimum width of 44 pixels.
5. WHEN the viewport width crosses the 480-pixel breakpoint (in either direction), THE App's layout SHALL update dynamically to match the appropriate layout without requiring a page reload.

---

### Requirement 9: Browser Compatibility

**User Story:** As a user, I want the app to work in any modern browser, so that I am not restricted to a specific browser.

#### Acceptance Criteria

1. THE App SHALL produce identical functional results (same transactions stored, same balance calculated, same chart rendered) and shall display without visual breakage or console errors caused by unsupported APIs in the current stable versions of Chrome, Firefox, Edge, and Safari.
2. THE App SHALL use only Web APIs and JavaScript language features that are natively supported in Chrome, Firefox, Edge, and Safari without requiring polyfills or browser-specific workarounds.
3. IF the App is opened in a browser that does not support a required Web API (e.g., Local_Storage), THEN THE App SHALL display a visible message identifying the unsupported feature and listing the supported browsers (Chrome, Firefox, Edge, Safari).
