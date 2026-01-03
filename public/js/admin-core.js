/**
 * Admin Core JS
 * Shared logic for Table Management, Bulk Actions, and Filtering
 */

class TableManager {
    constructor(config) {
        this.config = Object.assign({
            checkboxSelector: '.row-checkbox',
            selectAllSelector: '#selectAll',
            bulkDeleteBtnSelector: '#bulkDeleteBtn',
            selectedCountSelector: '#selectedCount',
            deleteUrl: null, // REQUIRED: e.g. '/users/delete-bulk'
            confirmMessage: 'Are you sure you want to delete these items?'
        }, config);

        this.lastCheckedIndex = null;
        this.checkboxes = document.querySelectorAll(this.config.checkboxSelector);
        this.selectAll = document.querySelector(this.config.selectAllSelector);
        this.bulkBtn = document.querySelector(this.config.bulkDeleteBtnSelector);
        this.countSpan = document.querySelector(this.config.selectedCountSelector);

        this.init();
    }

    init() {
        if (this.selectAll) {
            this.selectAll.addEventListener('change', () => this.toggleSelectAll());
        }

        this.checkboxes.forEach((cb, index) => {
            cb.addEventListener('click', (e) => this.handleRowSelect(cb, e, index));
        });

        if (this.bulkBtn) {
            this.bulkBtn.addEventListener('click', () => this.deleteSelected());
        }
    }

    updateUI() {
        // Re-query checkboxes in case DOM changed (though for now static)
        const checked = Array.from(document.querySelectorAll(`${this.config.checkboxSelector}:checked`));
        const total = document.querySelectorAll(this.config.checkboxSelector).length;

        if (this.countSpan) this.countSpan.innerText = checked.length;

        if (this.bulkBtn) {
            this.bulkBtn.style.display = checked.length > 0 ? 'flex' : 'none';
        }

        if (this.selectAll) {
            this.selectAll.checked = checked.length === total && total > 0;
            this.selectAll.indeterminate = checked.length > 0 && checked.length < total;
        }
    }

    toggleSelectAll() {
        const isChecked = this.selectAll.checked;
        this.checkboxes.forEach(cb => cb.checked = isChecked);
        this.updateUI();
    }

    handleRowSelect(checkbox, event, index) {
        if (event.shiftKey && this.lastCheckedIndex !== null) {
            const start = Math.min(this.lastCheckedIndex, index);
            const end = Math.max(this.lastCheckedIndex, index);
            for (let i = start; i <= end; i++) {
                this.checkboxes[i].checked = checkbox.checked;
            }
        }
        this.lastCheckedIndex = index;
        this.updateUI();
    }

    async deleteSelected() {
        const checked = document.querySelectorAll(`${this.config.checkboxSelector}:checked`);
        const ids = Array.from(checked).map(cb => cb.value);

        if (ids.length === 0) return;

        if (!confirm(this.config.confirmMessage.replace('{count}', ids.length))) {
            return;
        }

        try {
            const res = await fetch(this.config.deleteUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            const data = await res.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert('Error: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while deleting.');
        }
    }
}

// Global helper for formatting currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}
