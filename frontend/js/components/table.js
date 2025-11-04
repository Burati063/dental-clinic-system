class TableComponent {
    constructor(tableId, options = {}) {
        this.tableId = tableId;
        this.options = {
            searchable: true,
            sortable: true,
            pagination: true,
            selectable: false,
            actions: true,
            pageSize: 10,
            ...options
        };
        
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.selectedRows = new Set();
        this.data = [];
        this.filteredData = [];
        
        this.init();
    }

    init() {
        this.tableElement = document.getElementById(this.tableId);
        if (!this.tableElement) {
            console.error(`Table with id '${this.tableId}' not found`);
            return;
        }

        this.setupTableStructure();
        this.setupEventListeners();
        this.render();
    }

    setupTableStructure() {
        // Add table wrapper and controls if they don't exist
        if (!this.tableElement.parentElement.classList.contains('table-container')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-container';
            this.tableElement.parentNode.insertBefore(wrapper, this.tableElement);
            wrapper.appendChild(this.tableElement);
        }

        // Add table controls
        this.addTableControls();
    }

    addTableControls() {
        const tableContainer = this.tableElement.parentElement;
        
        // Add search box if searchable
        if (this.options.searchable) {
            const searchBox = document.createElement('div');
            searchBox.className = 'table-search';
            searchBox.innerHTML = `
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Search..." id="${this.tableId}-search">
                    <button class="search-clear hidden">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            tableContainer.insertBefore(searchBox, this.tableElement);
        }

        // Add table actions
        if (this.options.actions) {
            const actionsBar = document.createElement('div');
            actionsBar.className = 'table-actions';
            actionsBar.innerHTML = `
                <div class="table-info">
                    Showing <span id="${this.tableId}-info">0</span> entries
                </div>
                <div class="table-buttons">
                    ${this.options.selectable ? `
                        <button class="btn btn-sm btn-outline" id="${this.tableId}-select-all">
                            Select All
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline" id="${this.tableId}-refresh">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                    <button class="btn btn-sm btn-outline" id="${this.tableId}-export">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            `;
            tableContainer.insertBefore(actionsBar, this.tableElement);
        }

        // Add pagination if enabled
        if (this.options.pagination) {
            const pagination = document.createElement('div');
            pagination.className = 'table-pagination';
            pagination.id = `${this.tableId}-pagination`;
            tableContainer.appendChild(pagination);
        }
    }

    setupEventListeners() {
        // Search functionality
        if (this.options.searchable) {
            const searchInput = document.getElementById(`${this.tableId}-search`);
            const searchClear = searchInput?.nextElementSibling;
            
            if (searchInput) {
                searchInput.addEventListener('input', Utils.debounce((e) => {
                    this.handleSearch(e.target.value);
                    searchClear?.classList.toggle('hidden', !e.target.value);
                }, 300));
            }

            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    searchInput.value = '';
                    searchClear.classList.add('hidden');
                    this.handleSearch('');
                });
            }
        }

        // Sort functionality
        if (this.options.sortable) {
            this.tableElement.addEventListener('click', (e) => {
                const th = e.target.closest('th[data-sortable]');
                if (th) {
                    this.handleSort(th);
                }
            });
        }

        // Row selection
        if (this.options.selectable) {
            this.tableElement.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.name === 'row-select') {
                    this.handleRowSelection(e.target);
                }
            });

            // Select all functionality
            const selectAllBtn = document.getElementById(`${this.tableId}-select-all`);
            if (selectAllBtn) {
                selectAllBtn.addEventListener('click', () => {
                    this.toggleSelectAll();
                });
            }
        }

        // Refresh button
        const refreshBtn = document.getElementById(`${this.tableId}-refresh`);
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }

        // Export button
        const exportBtn = document.getElementById(`${this.tableId}-export`);
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }
    }

    async setData(data) {
        this.data = Array.isArray(data) ? data : [];
        this.filteredData = [...this.data];
        this.currentPage = 1;
        this.render();
    }

    render() {
        this.renderTableHead();
        this.renderTableBody();
        this.renderPagination();
        this.updateTableInfo();
    }

    renderTableHead() {
        const thead = this.tableElement.querySelector('thead');
        if (!thead) return;

        // Add sort indicators and select all checkbox
        const headers = thead.querySelectorAll('th');
        headers.forEach((th, index) => {
            // Clear existing classes and content
            th.className = '';
            th.innerHTML = th.textContent;

            // Make sortable if enabled
            if (this.options.sortable && index > 0) { // Skip first column if it has checkboxes
                th.setAttribute('data-sortable', 'true');
                th.style.cursor = 'pointer';
                
                // Add sort indicator
                if (this.sortColumn === index) {
                    th.classList.add('sorting', `sorting-${this.sortDirection}`);
                    const icon = document.createElement('i');
                    icon.className = `fas fa-sort-${this.sortDirection === 'asc' ? 'up' : 'down'}`;
                    th.appendChild(icon);
                } else {
                    th.classList.add('sorting');
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-sort';
                    th.appendChild(icon);
                }
            }

            // Add select all checkbox in first column
            if (this.options.selectable && index === 0) {
                th.innerHTML = `
                    <label class="checkbox">
                        <input type="checkbox" id="${this.tableId}-select-all-checkbox">
                        <span></span>
                    </label>
                `;
            }
        });
    }

    renderTableBody() {
        const tbody = this.tableElement.querySelector('tbody');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.options.pageSize;
        const endIndex = startIndex + this.options.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        if (pageData.length === 0) {
            tbody.innerHTML = this.renderEmptyState();
            return;
        }

        tbody.innerHTML = pageData.map((row, rowIndex) => this.renderTableRow(row, startIndex + rowIndex)).join('');
    }

    renderTableRow(rowData, absoluteIndex) {
        const cells = Object.values(rowData).map((value, cellIndex) => {
            if (cellIndex === 0 && this.options.selectable) {
                return `
                    <td>
                        <label class="checkbox">
                            <input type="checkbox" name="row-select" value="${absoluteIndex}" 
                                   ${this.selectedRows.has(absoluteIndex) ? 'checked' : ''}>
                            <span></span>
                        </label>
                    </td>
                `;
            }
            return `<td>${this.formatCellValue(value)}</td>`;
        }).join('');

        // Add action buttons if enabled
        const actions = this.options.actions ? this.renderActionButtons(rowData) : '';

        return `
            <tr data-id="${rowData.id || absoluteIndex}" 
                ${this.selectedRows.has(absoluteIndex) ? 'class="selected"' : ''}>
                ${cells}
                ${actions}
            </tr>
        `;
    }

    renderActionButtons(rowData) {
        return `
            <td>
                <div class="table-action-buttons">
                    <button class="btn btn-sm btn-outline" onclick="tableComponent.handleView(${rowData.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="tableComponent.handleEdit(${rowData.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="tableComponent.handleDelete(${rowData.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
    }

    renderEmptyState() {
        const colCount = this.tableElement.querySelector('thead tr').cells.length;
        return `
            <tr>
                <td colspan="${colCount}" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No data found</h3>
                        <p>${this.filteredData.length === 0 ? 'No records available' : 'Try adjusting your search criteria'}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    renderPagination() {
        if (!this.options.pagination) return;

        const paginationElement = document.getElementById(`${this.tableId}-pagination`);
        if (!paginationElement) return;

        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        
        if (totalPages <= 1) {
            paginationElement.innerHTML = '';
            return;
        }

        paginationElement.innerHTML = `
            <div class="pagination-info">
                Page ${this.currentPage} of ${totalPages}
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                        onclick="tableComponent.previousPage()">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                
                <div class="pagination-pages">
                    ${this.generatePageNumbers(totalPages)}
                </div>
                
                <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
                        onclick="tableComponent.nextPage()">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    generatePageNumbers(totalPages) {
        const pages = [];
        const maxVisiblePages = 5;
        
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(`
                <button class="page-number ${i === this.currentPage ? 'active' : ''}" 
                        onclick="tableComponent.goToPage(${i})">
                    ${i}
                </button>
            `);
        }

        return pages.join('');
    }

    formatCellValue(value) {
        if (value === null || value === undefined) return '-';
        
        // Format dates
        if (value instanceof Date) {
            return Utils.formatDate(value);
        }
        
        // Format booleans
        if (typeof value === 'boolean') {
            return value ? 
                '<span class="badge badge-success">Yes</span>' : 
                '<span class="badge badge-danger">No</span>';
        }
        
        // Format status strings
        if (typeof value === 'string' && value.match(/^(active|inactive|pending|completed|cancelled)$/i)) {
            const status = value.toLowerCase();
            const statusClass = {
                active: 'success',
                inactive: 'danger',
                pending: 'warning',
                completed: 'info',
                cancelled: 'danger'
            }[status] || 'secondary';
            
            return `<span class="badge badge-${statusClass}">${Utils.capitalizeFirst(status)}</span>`;
        }

        return Utils.truncateText(String(value), 100);
    }

    // Event handlers
    handleSearch(query) {
        if (!query.trim()) {
            this.filteredData = [...this.data];
        } else {
            this.filteredData = this.data.filter(row => 
                Object.values(row).some(value => 
                    String(value).toLowerCase().includes(query.toLowerCase())
                )
            );
        }
        this.currentPage = 1;
        this.render();
    }

    handleSort(columnHeader) {
        const columnIndex = Array.from(columnHeader.parentElement.children).indexOf(columnHeader);
        
        if (this.sortColumn === columnIndex) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = columnIndex;
            this.sortDirection = 'asc';
        }

        this.filteredData.sort((a, b) => {
            const aValue = Object.values(a)[columnIndex];
            const bValue = Object.values(b)[columnIndex];
            
            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;
            
            return this.sortDirection === 'desc' ? -comparison : comparison;
        });

        this.render();
    }

    handleRowSelection(checkbox) {
        const rowIndex = parseInt(checkbox.value);
        
        if (checkbox.checked) {
            this.selectedRows.add(rowIndex);
        } else {
            this.selectedRows.delete(rowIndex);
        }
        
        this.updateRowSelectionUI();
        this.updateSelectAllCheckbox();
    }

    toggleSelectAll() {
        const allCheckboxes = this.tableElement.querySelectorAll('input[name="row-select"]');
        const allSelected = allCheckboxes.length === this.selectedRows.size;
        
        if (allSelected) {
            this.selectedRows.clear();
        } else {
            allCheckboxes.forEach((checkbox, index) => {
                this.selectedRows.add(parseInt(checkbox.value));
            });
        }
        
        this.render();
    }

    updateRowSelectionUI() {
        const rows = this.tableElement.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            const absoluteIndex = (this.currentPage - 1) * this.options.pageSize + index;
            if (this.selectedRows.has(absoluteIndex)) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById(`${this.tableId}-select-all-checkbox`);
        if (selectAllCheckbox) {
            const allCheckboxes = this.tableElement.querySelectorAll('input[name="row-select"]');
            const allChecked = allCheckboxes.length > 0 && 
                             Array.from(allCheckboxes).every(checkbox => checkbox.checked);
            
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = !allChecked && this.selectedRows.size > 0;
        }
    }

    updateTableInfo() {
        const infoElement = document.getElementById(`${this.tableId}-info`);
        if (infoElement) {
            const start = (this.currentPage - 1) * this.options.pageSize + 1;
            const end = Math.min(this.currentPage * this.options.pageSize, this.filteredData.length);
            const total = this.filteredData.length;
            
            infoElement.textContent = `${start}-${end} of ${total}`;
        }
    }

    // Pagination methods
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.render();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.render();
        }
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.render();
        }
    }

    // Action handlers (to be overridden by specific implementations)
    handleView(id) {
        console.log('View item:', id);
        Utils.showNotification(`Viewing item ${id}`, 'info');
    }

    handleEdit(id) {
        console.log('Edit item:', id);
        Utils.showNotification(`Editing item ${id}`, 'info');
    }

    handleDelete(id) {
        Modal.confirm({
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this item? This action cannot be undone.',
            onConfirm: () => {
                console.log('Delete item:', id);
                Utils.showNotification('Item deleted successfully', 'success');
                this.refresh();
            }
        });
    }

    // Utility methods
    refresh() {
        // This would typically reload data from the server
        Utils.showNotification('Refreshing data...', 'info');
        console.log('Refreshing table data');
        // In a real implementation, you would fetch new data and call setData()
    }

    exportData() {
        const dataToExport = this.filteredData.length > 0 ? this.filteredData : this.data;
        
        if (dataToExport.length === 0) {
            Utils.showNotification('No data to export', 'warning');
            return;
        }

        // Simple CSV export
        const headers = Object.keys(dataToExport[0]);
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(row => 
                headers.map(header => 
                    `"${String(row[header] || '').replace(/"/g, '""')}"`
                ).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.tableId}-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showNotification('Data exported successfully', 'success');
    }

    getSelectedRows() {
        return Array.from(this.selectedRows).map(index => this.filteredData[index]);
    }

    clearSelection() {
        this.selectedRows.clear();
        this.render();
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this.render();
    }

    destroy() {
        // Clean up event listeners and DOM elements
        const tableContainer = this.tableElement.parentElement;
        if (tableContainer.classList.contains('table-container')) {
            tableContainer.remove();
        }
    }
}

// Add table styles
const tableStyles = `
<style>
.table-container {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow);
}

.table-search {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
}

.table-actions {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--gray-light);
}

.table-info {
    font-size: 0.875rem;
    color: var(--gray);
}

.table-buttons {
    display: flex;
    gap: 0.5rem;
}

.table-action-buttons {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
}

.table-action-buttons .btn {
    padding: 0.25rem 0.5rem;
}

.table-pagination {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--gray-light);
}

.pagination-info {
    font-size: 0.875rem;
    color: var(--gray);
}

.pagination-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.pagination-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

.pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.pagination-pages {
    display: flex;
    gap: 0.25rem;
}

.page-number {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.3s ease;
}

.page-number:hover {
    background: var(--gray-light);
}

.page-number.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

/* Table sorting */
th[data-sortable] {
    position: relative;
    user-select: none;
}

th[data-sortable] i {
    margin-left: 0.5rem;
    opacity: 0.5;
}

th.sorting-asc i,
th.sorting-desc i {
    opacity: 1;
}

/* Row selection */
tr.selected {
    background: #e3f2fd !important;
}

/* Empty state */
.empty-state {
    padding: 3rem 2rem;
    text-align: center;
    color: var(--gray);
}

.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.3;
}

.empty-state h3 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: var(--dark);
}

.empty-state p {
    margin-bottom: 1.5rem;
}
</style>
`;

// Add styles to document
document.head.insertAdjacentHTML('beforeend', tableStyles);

// Global table component instance
window.tableComponent = null;

// Helper function to initialize tables
function initializeTable(tableId, options = {}) {
    window.tableComponent = new TableComponent(tableId, options);
    return window.tableComponent;
}