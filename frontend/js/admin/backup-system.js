class BackupSystem {
    constructor() {
        this.userData = null;
        this.backups = [];
        this.filteredBackups = [];
        this.selectedBackups = new Set();
        this.backupSettings = {};
        this.init();
    }

    async init() {
        await this.loadUserData();
        this.setupEventListeners();
        this.setupMobileMenu();
        await this.loadBackupData();
        await this.loadBackupSettings();
        await this.loadBackupStats();
    }

    async loadUserData() {
        try {
            this.userData = await API.getCurrentUser();
            this.updateUserInfo();
        } catch (error) {
            console.error('Error loading user data:', error);
            Utils.showNotification('Failed to load user data', 'error');
        }
    }

    updateUserInfo() {
        if (this.userData) {
            const sidebarUserName = document.getElementById('sidebar-user-name');
            const headerUserName = document.getElementById('header-user-name');
            const userRole = document.getElementById('header-user-role');

            if (sidebarUserName) sidebarUserName.textContent = `${this.userData.first_name} ${this.userData.last_name}`;
            if (headerUserName) headerUserName.textContent = `${this.userData.first_name} ${this.userData.last_name}`;
            if (userRole) userRole.textContent = this.userData.role;
        }
    }

    setupEventListeners() {
        // Global search
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            globalSearch.addEventListener('input', Utils.debounce((e) => {
                this.handleGlobalSearch(e.target.value);
            }, 300));
        }

        // Backup search
        const backupSearch = document.getElementById('backupSearch');
        if (backupSearch) {
            backupSearch.addEventListener('input', Utils.debounce((e) => {
                this.handleBackupSearch(e.target.value);
            }, 300));
        }

        // Backup filter
        const backupFilter = document.getElementById('backupFilter');
        if (backupFilter) {
            backupFilter.addEventListener('change', (e) => {
                this.handleBackupFilter(e.target.value);
            });
        }

        // Select all checkbox
        const selectAll = document.getElementById('select-all-backups');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }

        // Auto backup settings
        const enableAutoBackup = document.getElementById('enableAutoBackup');
        if (enableAutoBackup) {
            enableAutoBackup.addEventListener('change', (e) => {
                this.toggleAutoBackupSettings(e.target.checked);
            });
        }
    }

    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.querySelector('.main-sidebar');

        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
        }
    }

    async loadBackupData() {
        try {
            this.showLoadingState();
            const response = await API.getBackups();
            this.backups = response.backups || [];
            this.filteredBackups = [...this.backups];
            this.renderBackups();
        } catch (error) {
            console.error('Error loading backups:', error);
            Utils.showNotification('Failed to load backups', 'error');
        }
    }

    async loadBackupSettings() {
        try {
            const settings = await API.getBackupSettings();
            this.backupSettings = settings;
            this.updateBackupSettingsUI();
        } catch (error) {
            console.error('Error loading backup settings:', error);
        }
    }

    async loadBackupStats() {
        try {
            const stats = await API.getBackupStats();
            this.updateBackupStats(stats);
        } catch (error) {
            console.error('Error loading backup stats:', error);
        }
    }

    updateBackupStats(stats) {
        document.getElementById('total-backups').textContent = stats.totalBackups || '-';
        document.getElementById('total-storage').textContent = stats.totalStorageUsed || '-';
        document.getElementById('last-backup').textContent = this.formatLastBackupTime(stats.lastBackup);
        document.getElementById('auto-backup-status').textContent = stats.autoBackupEnabled ? 'Enabled' : 'Disabled';
        
        // Update history stats
        document.getElementById('successful-backups').textContent = stats.successfulBackups || '-';
        document.getElementById('failed-backups').textContent = stats.failedBackups || '-';
        document.getElementById('total-backup-size').textContent = stats.totalBackupSize || '-';
    }

    formatLastBackupTime(lastBackup) {
        if (!lastBackup) return 'Never';
        
        const backupDate = new Date(lastBackup);
        const now = new Date();
        const diffMs = now - backupDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return backupDate.toLocaleDateString();
    }

    updateBackupSettingsUI() {
        const enableAutoBackup = document.getElementById('enableAutoBackup');
        const backupFrequency = document.getElementById('backupFrequency');
        const backupTime = document.getElementById('backupTime');
        const retentionPeriod = document.getElementById('retentionPeriod');

        if (enableAutoBackup && this.backupSettings.autoBackupEnabled !== undefined) {
            enableAutoBackup.checked = this.backupSettings.autoBackupEnabled;
        }

        if (backupFrequency && this.backupSettings.frequency) {
            backupFrequency.value = this.backupSettings.frequency;
        }

        if (backupTime && this.backupSettings.backupTime) {
            backupTime.value = this.backupSettings.backupTime;
        }

        if (retentionPeriod && this.backupSettings.retentionPeriod) {
            retentionPeriod.value = this.backupSettings.retentionPeriod;
        }

        this.toggleAutoBackupSettings(enableAutoBackup?.checked || false);
    }

    toggleAutoBackupSettings(enabled) {
        const settings = document.querySelectorAll('#backupFrequency, #backupTime, #retentionPeriod');
        settings.forEach(setting => {
            setting.disabled = !enabled;
        });
    }

    showLoadingState() {
        const tableBody = document.getElementById('backups-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading backups...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    handleBackupSearch(query) {
        this.filteredBackups = this.backups.filter(backup => 
            backup.name.toLowerCase().includes(query.toLowerCase()) ||
            backup.type.toLowerCase().includes(query.toLowerCase())
        );
        this.renderBackups();
    }

    handleBackupFilter(filter) {
        if (filter === 'all') {
            this.filteredBackups = [...this.backups];
        } else {
            this.filteredBackups = this.backups.filter(backup => {
                if (filter === 'manual') return backup.type === 'manual';
                if (filter === 'auto') return backup.type === 'auto';
                if (filter === 'today') {
                    const backupDate = new Date(backup.created_at);
                    const today = new Date();
                    return backupDate.toDateString() === today.toDateString();
                }
                if (filter === 'week') {
                    const backupDate = new Date(backup.created_at);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return backupDate >= weekAgo;
                }
                if (filter === 'month') {
                    const backupDate = new Date(backup.created_at);
                    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    return backupDate >= monthAgo;
                }
                return true;
            });
        }
        this.renderBackups();
    }

    renderBackups() {
        const tableBody = document.getElementById('backups-table-body');
        if (!tableBody) return;

        if (this.filteredBackups.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="loading-state">
                            <i class="fas fa-database"></i>
                            <p>No backups found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = this.filteredBackups.map(backup => `
            <tr>
                <td>
                    <label class="checkbox">
                        <input type="checkbox" name="backup-select" value="${backup.id}" ${this.selectedBackups.has(backup.id) ? 'checked' : ''}>
                        <span></span>
                    </label>
                </td>
                <td>
                    <div class="backup-name">
                        <i class="fas fa-${this.getBackupIcon(backup.type)}"></i>
                        <span>${backup.name}</span>
                    </div>
                </td>
                <td>
                    <span class="backup-type ${backup.backup_type}">${this.getBackupTypeDisplay(backup.backup_type)}</span>
                </td>
                <td>${this.formatFileSize(backup.size)}</td>
                <td>${this.formatBackupDate(backup.created_at)}</td>
                <td>
                    <span class="status-badge ${backup.status}">${this.getStatusDisplay(backup.status)}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline" title="Download" ${backup.status !== 'completed' ? 'disabled' : ''} onclick="downloadBackup('${backup.id}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" title="Restore" ${backup.status !== 'completed' ? 'disabled' : ''} onclick="showRestoreModal('${backup.id}')">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" title="Delete" onclick="showDeleteModal('${backup.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Add event listeners to checkboxes
        const checkboxes = tableBody.querySelectorAll('input[name="backup-select"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleBackupSelection(e.target.value, e.target.checked);
            });
        });

        this.updateBulkActions();
    }

    getBackupIcon(type) {
        const icons = {
            full: 'database',
            auto: 'database',
            manual: 'database',
            patients: 'users',
            records: 'file-medical',
            users: 'user-friends'
        };
        return icons[type] || 'database';
    }

    getBackupTypeDisplay(type) {
        const types = {
            full: 'Full',
            auto: 'Auto',
            manual: 'Manual',
            patients: 'Patients',
            records: 'Records',
            users: 'Users'
        };
        return types[type] || type;
    }

    getStatusDisplay(status) {
        const statuses = {
            completed: 'Completed',
            processing: 'Processing',
            failed: 'Failed',
            queued: 'Queued'
        };
        return statuses[status] || status;
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatBackupDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
    }

    toggleSelectAll(selected) {
        if (selected) {
            this.filteredBackups.forEach(backup => this.selectedBackups.add(backup.id));
        } else {
            this.filteredBackups.forEach(backup => this.selectedBackups.delete(backup.id));
        }
        
        this.renderBackups();
    }

    toggleBackupSelection(backupId, selected) {
        if (selected) {
            this.selectedBackups.add(backupId);
        } else {
            this.selectedBackups.delete(backupId);
        }
        
        this.updateBulkActions();
    }

    updateBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        const selectedCount = document.getElementById('selected-backups-count');
        const selectAll = document.getElementById('select-all-backups');
        
        if (bulkActions && selectedCount) {
            selectedCount.textContent = this.selectedBackups.size;
            
            if (this.selectedBackups.size > 0) {
                bulkActions.classList.remove('hidden');
            } else {
                bulkActions.classList.add('hidden');
            }
        }

        if (selectAll) {
            const currentBackups = this.filteredBackups;
            const selectedCount = currentBackups.filter(backup => this.selectedBackups.has(backup.id)).length;
            
            selectAll.checked = selectedCount === currentBackups.length;
            selectAll.indeterminate = selectedCount > 0 && selectedCount < currentBackups.length;
        }
    }

    async createBackup(backupData) {
        try {
            this.showCreateBackupModal(backupData);
        } catch (error) {
            console.error('Error creating backup:', error);
            Utils.showNotification('Failed to create backup', 'error');
        }
    }

    showCreateBackupModal(backupData) {
        const modal = document.getElementById('createBackupModal');
        const backupType = document.getElementById('modal-backup-type');
        const compression = document.getElementById('modal-compression');
        const includeFiles = document.getElementById('modal-include-files');

        if (backupType) backupType.textContent = this.getBackupTypeDisplay(backupData.type);
        if (compression) compression.textContent = backupData.compression.charAt(0).toUpperCase() + backupData.compression.slice(1);
        if (includeFiles) includeFiles.textContent = backupData.includeFiles ? 'Yes' : 'No';

        modal.classList.remove('hidden');
    }

    async confirmCreateBackup() {
        const backupType = document.getElementById('backupType').value;
        const compressionLevel = document.getElementById('compressionLevel').value;
        const includeFiles = document.getElementById('includeFiles').checked;

        const backupData = {
            type: backupType,
            compression: compressionLevel,
            include_files: includeFiles
        };

        try {
            this.hideCreateBackupModal();
            this.showBackupProgress();
            
            const result = await API.createBackup(backupData);
            
            // Simulate progress updates
            this.simulateBackupProgress(result.backupId);
            
        } catch (error) {
            console.error('Error creating backup:', error);
            Utils.showNotification('Failed to create backup', 'error');
            this.hideBackupProgress();
        }
    }

    simulateBackupProgress(backupId) {
        let progress = 0;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                setTimeout(() => {
                    this.hideBackupProgress();
                    Utils.showNotification('Backup created successfully', 'success');
                    this.loadBackupData();
                    this.loadBackupStats();
                }, 500);
            }
            
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `Creating backup... ${Math.round(progress)}%`;
        }, 200);
    }

    showBackupProgress() {
        const progressSection = document.getElementById('backupProgress');
        const summarySection = document.getElementById('backupSummary');
        const confirmBtn = document.getElementById('confirmBackupBtn');
        
        if (progressSection) progressSection.classList.remove('hidden');
        if (summarySection) summarySection.classList.add('hidden');
        if (confirmBtn) confirmBtn.disabled = true;
    }

    hideBackupProgress() {
        const progressSection = document.getElementById('backupProgress');
        const summarySection = document.getElementById('backupSummary');
        const confirmBtn = document.getElementById('confirmBackupBtn');
        
        if (progressSection) progressSection.classList.add('hidden');
        if (summarySection) summarySection.classList.remove('hidden');
        if (confirmBtn) confirmBtn.disabled = false;
    }

    async downloadBackup(backupId) {
        try {
            Utils.showNotification('Preparing download...', 'info');
            await API.downloadBackup(backupId);
            Utils.showNotification('Download started', 'success');
        } catch (error) {
            console.error('Error downloading backup:', error);
            Utils.showNotification('Failed to download backup', 'error');
        }
    }

    async restoreBackup(backupId) {
        try {
            Utils.showNotification('Restoring backup...', 'info');
            await API.restoreBackup(backupId);
            Utils.showNotification('Backup restored successfully', 'success');
            this.hideRestoreBackupModal();
        } catch (error) {
            console.error('Error restoring backup:', error);
            Utils.showNotification('Failed to restore backup', 'error');
        }
    }

    async deleteBackup(backupId) {
        try {
            await API.deleteBackup(backupId);
            Utils.showNotification('Backup deleted successfully', 'success');
            this.hideDeleteBackupModal();
            this.loadBackupData();
            this.loadBackupStats();
        } catch (error) {
            console.error('Error deleting backup:', error);
            Utils.showNotification('Failed to delete backup', 'error');
        }
    }

    async bulkDownloadBackups() {
        if (this.selectedBackups.size === 0) return;
        
        try {
            Utils.showNotification(`Preparing ${this.selectedBackups.size} backups for download...`, 'info');
            await API.bulkDownloadBackups(Array.from(this.selectedBackups));
            Utils.showNotification('Downloads started', 'success');
        } catch (error) {
            console.error('Error downloading backups:', error);
            Utils.showNotification('Failed to download backups', 'error');
        }
    }

    async bulkRestoreBackups() {
        if (this.selectedBackups.size === 0) return;
        
        if (!confirm(`Are you sure you want to restore ${this.selectedBackups.size} backups? This will replace current data.`)) {
            return;
        }

        try {
            Utils.showNotification(`Restoring ${this.selectedBackups.size} backups...`, 'info');
            await API.bulkRestoreBackups(Array.from(this.selectedBackups));
            Utils.showNotification('Backups restored successfully', 'success');
            this.selectedBackups.clear();
            this.updateBulkActions();
        } catch (error) {
            console.error('Error restoring backups:', error);
            Utils.showNotification('Failed to restore backups', 'error');
        }
    }

    async bulkDeleteBackups() {
        if (this.selectedBackups.size === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${this.selectedBackups.size} backups? This action cannot be undone.`)) {
            return;
        }

        try {
            await API.bulkDeleteBackups(Array.from(this.selectedBackups));
            Utils.showNotification('Backups deleted successfully', 'success');
            this.selectedBackups.clear();
            this.loadBackupData();
            this.loadBackupStats();
            this.updateBulkActions();
        } catch (error) {
            console.error('Error deleting backups:', error);
            Utils.showNotification('Failed to delete backups', 'error');
        }
    }

    async saveBackupSettings() {
        const settings = {
            autoBackupEnabled: document.getElementById('enableAutoBackup').checked,
            frequency: document.getElementById('backupFrequency').value,
            backupTime: document.getElementById('backupTime').value,
            retentionPeriod: parseInt(document.getElementById('retentionPeriod').value)
        };

        try {
            await API.saveBackupSettings(settings);
            Utils.showNotification('Backup settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving backup settings:', error);
            Utils.showNotification('Failed to save backup settings', 'error');
        }
    }

    async testBackupConfiguration() {
        try {
            Utils.showNotification('Testing backup configuration...', 'info');
            await API.testBackupConfiguration();
            Utils.showNotification('Backup configuration test passed', 'success');
        } catch (error) {
            console.error('Error testing backup configuration:', error);
            Utils.showNotification('Backup configuration test failed', 'error');
        }
    }

    handleGlobalSearch(query) {
        if (query.length < 2) return;
        console.log('Global search:', query);
        Utils.showNotification(`Searching for "${query}"...`, 'info');
    }
}

// Global functions
function createNewBackup() {
    const backupType = document.getElementById('backupType').value;
    const compressionLevel = document.getElementById('compressionLevel').value;
    const includeFiles = document.getElementById('includeFiles').checked;

    backupSystem.createBackup({
        type: backupType,
        compression: compressionLevel,
        includeFiles: includeFiles
    });
}

function createCustomBackup() {
    createNewBackup();
}

function showBackupSettings() {
    // Could show a detailed settings modal here
    Utils.showNotification('Backup settings opened', 'info');
}

function refreshBackupList() {
    backupSystem.loadBackupData();
    backupSystem.loadBackupStats();
    Utils.showNotification('Backup list refreshed', 'success');
}

function exportBackupList() {
    Utils.showNotification('Exporting backup list...', 'info');
    // Implement export functionality
}

function showRestoreModal(backupId) {
    const backup = backupSystem.backups.find(b => b.id === backupId);
    if (!backup) return;

    const modal = document.getElementById('restoreBackupModal');
    const backupName = document.getElementById('restore-backup-name');
    const backupSize = document.getElementById('restore-backup-size');
    const backupDate = document.getElementById('restore-backup-date');
    const confirmBtn = document.getElementById('confirmRestoreBtn');

    if (backupName) backupName.textContent = backup.name;
    if (backupSize) backupSize.textContent = backupSystem.formatFileSize(backup.size);
    if (backupDate) backupDate.textContent = backupSystem.formatBackupDate(backup.created_at);
    if (confirmBtn) {
        confirmBtn.onclick = () => backupSystem.restoreBackup(backupId);
    }

    modal.classList.remove('hidden');
}

function showDeleteModal(backupId) {
    const backup = backupSystem.backups.find(b => b.id === backupId);
    if (!backup) return;

    const modal = document.getElementById('deleteBackupModal');
    const backupName = document.getElementById('delete-backup-name');
    const backupSize = document.getElementById('delete-backup-size');
    const backupDate = document.getElementById('delete-backup-date');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    if (backupName) backupName.textContent = backup.name;
    if (backupSize) backupSize.textContent = backupSystem.formatFileSize(backup.size);
    if (backupDate) backupDate.textContent = backupSystem.formatBackupDate(backup.created_at);
    if (confirmBtn) {
        confirmBtn.onclick = () => backupSystem.deleteBackup(backupId);
    }

    modal.classList.remove('hidden');
}

function hideCreateBackupModal() {
    document.getElementById('createBackupModal').classList.add('hidden');
    backupSystem.hideBackupProgress();
}

function hideRestoreBackupModal() {
    document.getElementById('restoreBackupModal').classList.add('hidden');
}

function hideDeleteBackupModal() {
    document.getElementById('deleteBackupModal').classList.add('hidden');
}

function downloadBackup(backupId) {
    backupSystem.downloadBackup(backupId);
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        Utils.showNotification('Logging out...', 'info');
        setTimeout(() => {
            window.location.href = '../../login.html';
        }, 1000);
    }
}

// API Methods (Mock implementation - replace with actual API calls)
window.API = {
    getCurrentUser: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    first_name: 'Admin',
                    last_name: 'User',
                    role: 'admin',
                    email: 'admin@dentalclinic.com'
                });
            }, 500);
        });
    },

    getBackups: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    backups: [
                        {
                            id: '1',
                            name: 'backup_2024_01_15_143022.sql',
                            type: 'manual',
                            backup_type: 'full',
                            size: 256901120, // 245 MB in bytes
                            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                            status: 'completed'
                        },
                        {
                            id: '2',
                            name: 'backup_2024_01_14_020000.sql',
                            type: 'auto',
                            backup_type: 'auto',
                            size: 249561088, // 238 MB in bytes
                            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                            status: 'completed'
                        },
                        {
                            id: '3',
                            name: 'users_backup_2024_01_13.sql',
                            type: 'manual',
                            backup_type: 'partial',
                            size: 47185920, // 45 MB in bytes
                            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                            status: 'completed'
                        },
                        {
                            id: '4',
                            name: 'records_backup_2024_01_12.sql',
                            type: 'manual',
                            backup_type: 'partial',
                            size: 163577856, // 156 MB in bytes
                            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                            status: 'completed'
                        },
                        {
                            id: '5',
                            name: 'backup_2024_01_11_020000.sql',
                            type: 'auto',
                            backup_type: 'auto',
                            size: 245366784, // 234 MB in bytes
                            created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                            status: 'processing'
                        }
                    ]
                });
            }, 1000);
        });
    },

    getBackupStats: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    totalBackups: 15,
                    totalStorageUsed: '2.4 GB',
                    lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    autoBackupEnabled: true,
                    successfulBackups: 14,
                    failedBackups: 1,
                    totalBackupSize: '2.4 GB'
                });
            }, 800);
        });
    },

    getBackupSettings: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    autoBackupEnabled: true,
                    frequency: 'weekly',
                    backupTime: '02:00',
                    retentionPeriod: 30
                });
            }, 600);
        });
    },

    createBackup: async (backupData) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Creating backup:', backupData);
                resolve({ 
                    success: true,
                    backupId: 'backup_' + Date.now()
                });
            }, 500);
        });
    },

    downloadBackup: async (backupId) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Downloading backup:', backupId);
                resolve({ success: true });
            }, 1000);
        });
    },

    restoreBackup: async (backupId) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Restoring backup:', backupId);
                resolve({ success: true });
            }, 2000);
        });
    },

    deleteBackup: async (backupId) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Deleting backup:', backupId);
                resolve({ success: true });
            }, 800);
        });
    },

    bulkDownloadBackups: async (backupIds) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Bulk downloading backups:', backupIds);
                resolve({ success: true });
            }, 1500);
        });
    },

    bulkRestoreBackups: async (backupIds) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Bulk restoring backups:', backupIds);
                resolve({ success: true });
            }, 3000);
        });
    },

    bulkDeleteBackups: async (backupIds) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Bulk deleting backups:', backupIds);
                resolve({ success: true });
            }, 1200);
        });
    },

    saveBackupSettings: async (settings) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Saving backup settings:', settings);
                resolve({ success: true });
            }, 800);
        });
    },

    testBackupConfiguration: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Testing backup configuration');
                resolve({ success: true });
            }, 1500);
        });
    }
};

// Utility functions
window.Utils = {
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showNotification: (message, type = 'info') => {
        // Simple notification implementation
        console.log(`${type.toUpperCase()}: ${message}`);
        // In a real app, you would show a toast notification
        alert(`${type.toUpperCase()}: ${message}`);
    }
};

// Initialize backup system when page loads
let backupSystem;
document.addEventListener('DOMContentLoaded', () => {
    backupSystem = new BackupSystem();
});