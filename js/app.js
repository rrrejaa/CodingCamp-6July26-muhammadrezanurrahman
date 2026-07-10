/* Expense & Budget Visualizer — app.js */

(function () {
    'use strict';

    // ---------------------------------------------------------------------------
    // Error types (used by Storage)
    // ---------------------------------------------------------------------------

    class StorageReadError extends Error {
        constructor(message) {
            super(message);
            this.name = 'StorageReadError';
        }
    }

    class StorageWriteError extends Error {
        constructor(message) {
            super(message);
            this.name = 'StorageWriteError';
        }
    }

    // ---------------------------------------------------------------------------
    // Storage Module
    // ---------------------------------------------------------------------------

    const Storage = {
        KEY: 'transactions',

        /**
         * Reads and validates transactions from localStorage.
         * @returns {Array} Parsed transaction array.
         * @throws {StorageReadError} If reading or parsing fails, or data is invalid.
         */
        load() {
            let raw;
            try {
                raw = localStorage.getItem(this.KEY);
            } catch (e) {
                throw new StorageReadError('Failed to read from localStorage: ' + e.message);
            }

            if (raw === null) {
                return [];
            }

            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                throw new StorageReadError('Stored transactions value is not valid JSON.');
            }

            if (!Array.isArray(parsed)) {
                throw new StorageReadError('Stored transactions value is not an array.');
            }

            const isValidTransaction = (t) =>
                t !== null &&
                typeof t === 'object' &&
                typeof t.id === 'string' &&
                typeof t.name === 'string' &&
                typeof t.amount === 'number' &&
                typeof t.category === 'string' &&
                typeof t.createdAt === 'number';

            if (!parsed.every(isValidTransaction)) {
                throw new StorageReadError('Stored transactions array contains invalid entries.');
            }

            return parsed;
        },

        /**
         * Serializes and saves transactions to localStorage.
         * @param {Array} transactions
         * @returns {boolean} true on success.
         * @throws {StorageWriteError} If writing fails.
         */
        save(transactions) {
            try {
                localStorage.setItem(this.KEY, JSON.stringify(transactions));
                return true;
            } catch (e) {
                throw new StorageWriteError('Failed to write to localStorage: ' + e.message);
            }
        },

        /**
         * Removes the transactions key from localStorage.
         */
        clear() {
            localStorage.removeItem(this.KEY);
        },
    };

    // ---------------------------------------------------------------------------
    // Validator Module
    // ---------------------------------------------------------------------------

    const Validator = {
        /**
         * Validates the item name field.
         * @param {string} name
         * @returns {{ valid: boolean, message: string }}
         */
        validateName(name) {
            const trimmed = (name ?? '').trim();
            if (trimmed.length === 0) {
                return { valid: false, message: 'Item name is required' };
            }
            if (trimmed.length > 100) {
                return { valid: false, message: 'Item name must be 100 characters or fewer' };
            }
            return { valid: true, message: '' };
        },

        /**
         * Validates the amount field.
         * @param {string|number} amount
         * @returns {{ valid: boolean, message: string }}
         */
        validateAmount(amount) {
            const str = (amount ?? '').toString().trim();
            if (str.length === 0) {
                return { valid: false, message: 'Amount is required' };
            }
            const value = parseFloat(str);
            if (isNaN(value)) {
                return { valid: false, message: 'Amount must be a valid number' };
            }
            if (value < 0.01 || value > 999999999.99) {
                return { valid: false, message: 'Amount must be between $0.01 and $999,999,999.99' };
            }
            return { valid: true, message: '' };
        },

        /**
         * Validates the category field.
         * @param {string} category
         * @returns {{ valid: boolean, message: string }}
         */
        validateCategory(category) {
            const allowed = ['Food', 'Transport', 'Fun'];
            if (!allowed.includes(category)) {
                return { valid: false, message: 'Please select a category' };
            }
            return { valid: true, message: '' };
        },

        /**
         * Runs all three field validators and aggregates results.
         * @param {{ name: string, amount: string, category: string }} fields
         * @returns {{ isValid: boolean, errors: { name: string|null, amount: string|null, category: string|null } }}
         */
        validateForm({ name, amount, category }) {
            const nameResult = this.validateName(name);
            const amountResult = this.validateAmount(amount);
            const categoryResult = this.validateCategory(category);

            const isValid = nameResult.valid && amountResult.valid && categoryResult.valid;

            return {
                isValid,
                errors: {
                    name: nameResult.valid ? null : nameResult.message,
                    amount: amountResult.valid ? null : amountResult.message,
                    category: categoryResult.valid ? null : categoryResult.message,
                },
            };
        },
    };


    // ---------------------------------------------------------------------------
    // State Store
    // ---------------------------------------------------------------------------

    /**
     * In-memory single source of truth for all transactions.
     * @type {Array<{id: string, name: string, amount: number, category: string, createdAt: number}>}
     */
    let state = [];

    /**
     * Generates a UUID v4 string. Uses crypto.randomUUID() when available,
     * falling back to a Math.random()-based implementation.
     * @returns {string}
     */
    function generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        // Fallback: RFC 4122 v4 UUID using Math.random()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Creates a new transaction, prepends it to state, and persists to storage.
     * @param {{ name: string, amount: string|number, category: string }} fields
     * @throws {StorageWriteError} If Storage.save() fails.
     */
    function addTransaction({ name, amount, category }) {
        const transaction = {
            id: generateUUID(),
            name: (name ?? '').trim(),
            amount: parseFloat(amount),
            category: category,
            createdAt: Date.now(),
        };
        state.unshift(transaction);
        // Propagate any StorageWriteError to the caller
        Storage.save(state);
    }

    /**
     * Removes the transaction with the given id from state and persists to storage.
     * @param {string} id
     * @throws {StorageWriteError} If Storage.save() fails.
     */
    function deleteTransaction(id) {
        state = state.filter((t) => t.id !== id);
        // Propagate any StorageWriteError to the caller
        Storage.save(state);
    }


    // ---------------------------------------------------------------------------
    // UI Module
    // ---------------------------------------------------------------------------

    let chartInstance = null;

    const UI = {

        /**
         * Clears and re-renders the transaction list.
         * Sorts descending by createdAt (newest first).
         * @param {Array} transactions
         */
        renderList(transactions) {
            const list = document.getElementById('transaction-list');
            list.innerHTML = '';

            if (!transactions || transactions.length === 0) {
                const li = document.createElement('li');
                li.className = 'empty-state';
                li.textContent = 'No transactions yet';
                list.appendChild(li);
                return;
            }

            const sorted = [...transactions].sort((a, b) => b.createdAt - a.createdAt);

            sorted.forEach((transaction) => {
                const li = document.createElement('li');
                li.setAttribute('data-id', transaction.id);

                // Truncate name to 100 chars (defensive; validation already enforces this)
                const displayName = transaction.name.length > 100
                    ? transaction.name.slice(0, 100)
                    : transaction.name;

                // Format amount: "$X.XX" or "-$X.XX"
                const amount = transaction.amount;
                const formattedAmount = amount < 0
                    ? '-$' + Math.abs(amount).toFixed(2)
                    : '$' + amount.toFixed(2);

                const nameSpan = document.createElement('span');
                nameSpan.className = 'transaction-name';
                nameSpan.textContent = displayName;

                const amountSpan = document.createElement('span');
                amountSpan.className = 'transaction-amount';
                amountSpan.textContent = formattedAmount;

                const categorySpan = document.createElement('span');
                categorySpan.className = 'transaction-category';
                categorySpan.textContent = transaction.category;

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.setAttribute('data-delete-id', transaction.id);
                deleteBtn.setAttribute('aria-label', 'Delete ' + displayName);
                deleteBtn.textContent = 'Delete';

                li.appendChild(nameSpan);
                li.appendChild(amountSpan);
                li.appendChild(categorySpan);
                li.appendChild(deleteBtn);

                list.appendChild(li);
            });
        },

        /**
         * Updates the balance display.
         * @param {Array} transactions
         */
        renderBalance(transactions) {
            const balanceEl = document.getElementById('balance-amount');

            if (!transactions || transactions.length === 0) {
                balanceEl.textContent = '$0.00';
                return;
            }

            const total = transactions.reduce((sum, t) => sum + t.amount, 0);

            balanceEl.textContent = total < 0
                ? '-$' + Math.abs(total).toFixed(2)
                : '$' + total.toFixed(2);
        },

        /**
         * Shows a toast notification for the given error message.
         * Auto-dismisses after 5000ms.
         * @param {string} message
         */
        showError(message) {
            let toast = document.getElementById('error-toast');

            // Clear any previous content and pending auto-dismiss timer
            if (toast._dismissTimer) {
                clearTimeout(toast._dismissTimer);
                toast._dismissTimer = null;
            }
            toast.innerHTML = '';

            const msgSpan = document.createElement('span');
            msgSpan.textContent = message;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close-btn';
            closeBtn.setAttribute('aria-label', 'Close error notification');
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('visible');
                if (toast._dismissTimer) {
                    clearTimeout(toast._dismissTimer);
                    toast._dismissTimer = null;
                }
            });

            toast.appendChild(msgSpan);
            toast.appendChild(closeBtn);
            toast.classList.add('visible');

            toast._dismissTimer = setTimeout(() => {
                toast.classList.remove('visible');
                toast._dismissTimer = null;
            }, 5000);
        },

        /**
         * Shows inline field validation errors.
         * @param {{ name: string|null, amount: string|null, category: string|null }} errors
         */
        showFieldErrors(errors) {
            const fields = [
                { key: 'name', errorId: 'name-error' },
                { key: 'amount', errorId: 'amount-error' },
                { key: 'category', errorId: 'category-error' },
            ];

            fields.forEach(({ key, errorId }) => {
                const errorSpan = document.getElementById(errorId);
                const formGroup = errorSpan ? errorSpan.closest('.form-group') : null;
                const errorMessage = errors[key];

                if (errorMessage !== null && errorMessage !== undefined) {
                    if (errorSpan) errorSpan.textContent = errorMessage;
                    if (formGroup) formGroup.classList.add('has-error');
                } else {
                    if (errorSpan) errorSpan.textContent = '';
                    if (formGroup) formGroup.classList.remove('has-error');
                }
            });
        },

        /**
         * Clears all inline field errors.
         */
        clearFieldErrors() {
            const errorIds = ['name-error', 'amount-error', 'category-error'];
            errorIds.forEach((id) => {
                const errorSpan = document.getElementById(id);
                if (errorSpan) {
                    errorSpan.textContent = '';
                    const formGroup = errorSpan.closest('.form-group');
                    if (formGroup) formGroup.classList.remove('has-error');
                }
            });
        },

        /**
         * Resets the transaction form to its default empty state.
         */
        resetForm() {
            const nameInput = document.getElementById('item-name');
            const amountInput = document.getElementById('item-amount');
            const categorySelect = document.getElementById('item-category');

            if (nameInput) nameInput.value = '';
            if (amountInput) amountInput.value = '';
            if (categorySelect) categorySelect.selectedIndex = 0;
        },

        /**
         * Creates or updates the Chart.js pie chart for spending by category.
         * @param {Array} transactions
         */
        renderChart(transactions) {
            // Guard: Chart.js CDN failed to load
            if (typeof window.Chart === 'undefined') {
                UI.showError('Chart library failed to load. Spending chart is unavailable.');
                return;
            }

            const canvas = document.getElementById('spending-chart');
            const placeholder = document.getElementById('chart-placeholder');

            // Empty state: destroy existing chart, show placeholder
            if (!transactions || transactions.length === 0) {
                if (chartInstance) {
                    chartInstance.destroy();
                    chartInstance = null;
                }
                if (canvas) canvas.style.display = 'none';
                if (placeholder) placeholder.style.display = 'block';
                return;
            }

            // Non-empty: show canvas, hide placeholder
            if (canvas) canvas.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';

            // Compute per-category totals
            const categoryColors = {
                Food: '#FF6384',
                Transport: '#36A2EB',
                Fun: '#FFCE56',
            };

            const totals = {};
            transactions.forEach((t) => {
                const amt = Math.abs(t.amount);
                if (amt > 0) {
                    totals[t.category] = (totals[t.category] || 0) + amt;
                }
            });

            const overallTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);

            const labels = [];
            const values = [];
            const backgroundColors = [];

            Object.entries(totals).forEach(([category, total]) => {
                if (total > 0) {
                    const pct = ((total / overallTotal) * 100).toFixed(1);
                    labels.push(category + ' ' + pct + '%');
                    values.push(total);
                    backgroundColors.push(categoryColors[category] || '#CCCCCC');
                }
            });

            if (chartInstance) {
                // Update existing instance — avoid destroy/recreate to prevent animation glitches
                chartInstance.data.labels = labels;
                chartInstance.data.datasets[0].data = values;
                chartInstance.data.datasets[0].backgroundColor = backgroundColors;
                chartInstance.update();
            } else {
                // Create new Chart instance
                chartInstance = new window.Chart(canvas, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                data: values,
                                backgroundColor: backgroundColors,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                            },
                            tooltip: {
                                callbacks: {
                                    label(context) {
                                        const label = context.label || '';
                                        const value = context.parsed;
                                        return label + ': $' + value.toFixed(2);
                                    },
                                },
                            },
                        },
                    },
                });
            }
        },

    };


    // ---------------------------------------------------------------------------
    // Event Handlers
    // ---------------------------------------------------------------------------

    /**
     * DOMContentLoaded bootstrap handler.
     * Detects localStorage support, loads persisted data, and renders the UI.
     */
    function onDOMReady() {
        // Check localStorage availability
        let localStorageAvailable = false;
        try {
            if (window.localStorage !== undefined) {
                // A quick probe write/read confirms it's actually usable
                window.localStorage.setItem('__ls_test__', '1');
                window.localStorage.removeItem('__ls_test__');
                localStorageAvailable = true;
            }
        } catch (e) {
            localStorageAvailable = false;
        }

        if (!localStorageAvailable) {
            const banner = document.getElementById('compatibility-banner');
            if (banner) banner.style.display = 'block';
            const form = document.getElementById('transaction-form');
            if (form) form.disabled = true;
            return;
        }

        // Attempt to load persisted state
        try {
            state = Storage.load();
        } catch (e) {
            if (e instanceof StorageReadError) {
                Storage.clear();
                UI.showError('Your saved data was corrupted and has been cleared.');
                state = [];
            } else {
                throw e;
            }
        }

        UI.renderList(state);
        UI.renderBalance(state);
        UI.renderChart(state);
    }

    /**
     * Form submit handler. Validates input, adds transaction, persists, and
     * updates the UI. Rolls back state if the storage write fails.
     * @param {Event} event
     */
    function onFormSubmit(event) {
        event.preventDefault();

        const name = (document.getElementById('item-name') || {}).value ?? '';
        const amount = (document.getElementById('item-amount') || {}).value ?? '';
        const category = (document.getElementById('item-category') || {}).value ?? '';

        const { isValid, errors } = Validator.validateForm({ name, amount, category });

        if (!isValid) {
            UI.showFieldErrors(errors);
            return;
        }

        UI.clearFieldErrors();

        try {
            addTransaction({ name, amount, category });
            UI.renderList(state);
            UI.renderBalance(state);
            UI.renderChart(state);
            UI.resetForm();
        } catch (e) {
            if (e instanceof StorageWriteError) {
                // Roll back the item that addTransaction already unshifted into state
                state.shift();
                UI.showError('Could not save your transaction. Please try again.');
            } else {
                throw e;
            }
        }
    }

    /**
     * Delegated click handler for the transaction list.
     * Handles delete button clicks, confirms with the user, removes the
     * transaction, and rolls back if the storage write fails.
     * @param {Event} event
     */
    function onDeleteClick(event) {
        const btn = event.target.closest('[data-delete-id]');
        if (!btn) return;

        const id = btn.getAttribute('data-delete-id');

        if (!window.confirm('Delete this transaction?')) return;

        const rollback = [...state];

        try {
            deleteTransaction(id);
            UI.renderList(state);
            UI.renderBalance(state);
            UI.renderChart(state);
        } catch (e) {
            if (e instanceof StorageWriteError) {
                state = rollback;
                UI.renderList(state);
                UI.showError('Could not delete the transaction. Please try again.');
            } else {
                throw e;
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Bootstrap — wire events
    // ---------------------------------------------------------------------------

    // Support both deferred scripts (DOM already ready) and inline placement
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMReady);
    } else {
        onDOMReady();
    }

    document.getElementById('transaction-form').addEventListener('submit', onFormSubmit);
    document.getElementById('transaction-list').addEventListener('click', onDeleteClick);

})();
