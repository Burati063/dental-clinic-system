class UserManagement {
    constructor() {
        this.userData = null;
        this.users = [];
        this.filteredUsers = [];
        this.selectedUsers = new Set();
        this.currentPage = 1;
        this.usersPerPage = 10;
        this.filters = {
            search: '',
            role: 'all',
            status: 'all'
        };
        this.init();
    }

    async init() {
        await this.loadUserData();
        this.setupEventListeners();
        this.setupMobileMenu();
        await this.loadUsers();
        await this.loadUserStats();
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

        // User search
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', Utils.debounce((e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
            }, 300));
        }

        // Role filter
        const roleFilter = document.getElementById('roleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', (e) => {
                this.filters.role = e.target.value;
                this.applyFilters();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
            });
        }

        // Select all checkbox
        const selectAll = document.getElementById('select-all-users');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }

        // Pagination
        const prevPageBtn = document.getElementById('prev-page');
        const nextPageBtn = document.getElementById('next-page');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                this.previousPage();
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                this.nextPage();
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

    async loadUsers() {
        try {
            this.showLoadingState();
            const response = await API.getUsers();
            this.users = response.users || [];
            this.filteredUsers = [...this.users];
            this.renderUsers();
            this.updatePagination();
        } catch (error) {
            console.error('Error loading users:', error);
            Utils.showNotification('Failed to load users', 'error');
        }
    }

    async loadUserStats() {
        try {
            const stats = await API.getUserStats();
            this.updateStats(stats);
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('total-users').textContent = stats.totalUsers || '-';
        document.getElementById('active-users').textContent = stats.activeUsers || '-';
        document.getElementById('doctor-count').textContent = stats.doctorCount || '-';
        document.getElementById('receptionist-count').textContent = stats.receptionistCount || '-';
    }

    showLoadingState() {
        const tableBody = document.getElementById('users-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading users...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    applyFilters() {
        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = !this.filters.search || 
                user.first_name.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                user.last_name.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                user.email.toLowerCase().includes(this.filters.search.toLowerCase());

            const matchesRole = this.filters.role === 'all' || user.role === this.filters.role;
            const matchesStatus = this.filters.status === 'all' || user.status === this.filters.status;

            return matchesSearch && matchesRole && matchesStatus;
        });

        this.currentPage = 1;
        this.renderUsers();
        this.updatePagination();
    }

    renderUsers() {
        const tableBody = document.getElementById('users-table-body');
        if (!tableBody) return;

        if (this.filteredUsers.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="loading-state">
                            <i class="fas fa-users"></i>
                            <p>No users found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.usersPerPage;
        const endIndex = startIndex + this.usersPerPage;
        const currentUsers = this.filteredUsers.slice(startIndex, endIndex);

        tableBody.innerHTML = currentUsers.map(user => `
            <tr>
                <td>
                    <label class="checkbox">
                        <input type="checkbox" name="user-select" value="${user.id}" ${this.selectedUsers.has(user.id) ? 'checked' : ''}>
                        <span></span>
                    </label>
                </td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm">
                            <i class="fas fa-${this.getUserIcon(user.role)}"></i>
                        </div>
                        <div class="user-details">
                            <div class="user-name">${user.first_name} ${user.last_name}</div>
                            <div class="user-email">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge ${user.role}">${this.getRoleDisplayName(user.role)}</span>
                </td>
                <td>
                    <div class="contact-info">
                        <div class="phone">${user.phone || 'N/A'}</div>
                        <div class="email">${user.email}</div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${user.status}">${user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span>
                </td>
                <td>${this.formatLastLogin(user.last_login)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline" title="Edit" onclick="editUser('${user.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" title="View" onclick="viewUser('${user.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" title="Delete" onclick="showDeleteModal('${user.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Add event listeners to checkboxes
        const checkboxes = tableBody.querySelectorAll('input[name="user-select"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleUserSelection(e.target.value, e.target.checked);
            });
        });
    }

    getUserIcon(role) {
        const icons = {
            admin: 'user-shield',
            doctor: 'user-md',
            receptionist: 'user-headset'
        };
        return icons[role] || 'user';
    }

    getRoleDisplayName(role) {
        const names = {
            admin: 'Administrator',
            doctor: 'Doctor',
            receptionist: 'Receptionist'
        };
        return names[role] || role;
    }

    formatLastLogin(lastLogin) {
        if (!lastLogin) return 'Never';
        
        const loginDate = new Date(lastLogin);
        const now = new Date();
        const diffMs = now - loginDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return loginDate.toLocaleDateString();
    }

    toggleSelectAll(selected) {
        const currentUsers = this.getCurrentPageUsers();
        
        if (selected) {
            currentUsers.forEach(user => this.selectedUsers.add(user.id));
        } else {
            currentUsers.forEach(user => this.selectedUsers.delete(user.id));
        }
        
        this.renderUsers();
        this.updateBulkActions();
    }

    toggleUserSelection(userId, selected) {
        if (selected) {
            this.selectedUsers.add(userId);
        } else {
            this.selectedUsers.delete(userId);
        }
        
        this.updateSelectAllCheckbox();
        this.updateBulkActions();
    }

    updateSelectAllCheckbox() {
        const selectAll = document.getElementById('select-all-users');
        if (!selectAll) return;

        const currentUsers = this.getCurrentPageUsers();
        const selectedCount = currentUsers.filter(user => this.selectedUsers.has(user.id)).length;
        
        selectAll.checked = selectedCount === currentUsers.length;
        selectAll.indeterminate = selectedCount > 0 && selectedCount < currentUsers.length;
    }

    updateBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        const selectedCount = document.getElementById('selected-users-count');
        
        if (bulkActions && selectedCount) {
            selectedCount.textContent = this.selectedUsers.size;
            
            if (this.selectedUsers.size > 0) {
                bulkActions.classList.remove('hidden');
            } else {
                bulkActions.classList.add('hidden');
            }
        }
    }

    getCurrentPageUsers() {
        const startIndex = (this.currentPage - 1) * this.usersPerPage;
        const endIndex = startIndex + this.usersPerPage;
        return this.filteredUsers.slice(startIndex, endIndex);
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredUsers.length / this.usersPerPage);
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const numbersContainer = document.getElementById('pagination-numbers');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        }

        if (numbersContainer) {
            numbersContainer.innerHTML = '';
            
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            
            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('span');
                pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => {
                    this.goToPage(i);
                });
                numbersContainer.appendChild(pageBtn);
            }
        }
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderUsers();
        this.updatePagination();
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredUsers.length / this.usersPerPage);
        if (this.currentPage < totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    handleGlobalSearch(query) {
        if (query.length < 2) return;
        console.log('Global search:', query);
        Utils.showNotification(`Searching for "${query}"...`, 'info');
    }

    async addNewUser() {
        const form = document.getElementById('addUserForm');
        if (!form.checkValidity()) {
            Utils.showNotification('Please fill all required fields', 'error');
            return;
        }

        const userData = {
            first_name: document.getElementById('firstName').value,
            last_name: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            role: document.getElementById('role').value,
            password: document.getElementById('password').value
        };

        try {
            await API.createUser(userData);
            Utils.showNotification('User created successfully', 'success');
            this.hideAddUserModal();
            await this.loadUsers();
            await this.loadUserStats();
        } catch (error) {
            console.error('Error creating user:', error);
            Utils.showNotification('Failed to create user', 'error');
        }
    }

    async deleteUser(userId) {
        try {
            await API.deleteUser(userId);
            Utils.showNotification('User deleted successfully', 'success');
            this.hideDeleteModal();
            await this.loadUsers();
            await this.loadUserStats();
        } catch (error) {
            console.error('Error deleting user:', error);
            Utils.showNotification('Failed to delete user', 'error');
        }
    }

    async bulkActivateUsers() {
        if (this.selectedUsers.size === 0) return;
        
        try {
            await API.bulkUpdateUsers(Array.from(this.selectedUsers), { status: 'active' });
            Utils.showNotification('Users activated successfully', 'success');
            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadUserStats();
        } catch (error) {
            console.error('Error activating users:', error);
            Utils.showNotification('Failed to activate users', 'error');
        }
    }

    async bulkDeactivateUsers() {
        if (this.selectedUsers.size === 0) return;
        
        try {
            await API.bulkUpdateUsers(Array.from(this.selectedUsers), { status: 'inactive' });
            Utils.showNotification('Users deactivated successfully', 'success');
            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadUserStats();
        } catch (error) {
            console.error('Error deactivating users:', error);
            Utils.showNotification('Failed to deactivate users', 'error');
        }
    }

    async bulkDeleteUsers() {
        if (this.selectedUsers.size === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${this.selectedUsers.size} users?`)) {
            return;
        }

        try {
            await API.bulkDeleteUsers(Array.from(this.selectedUsers));
            Utils.showNotification('Users deleted successfully', 'success');
            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadUserStats();
        } catch (error) {
            console.error('Error deleting users:', error);
            Utils.showNotification('Failed to delete users', 'error');
        }
    }
}

// Global functions
function showAddUserModal() {
    document.getElementById('addUserModal').classList.remove('hidden');
}

function hideAddUserModal() {
    document.getElementById('addUserModal').classList.add('hidden');
    document.getElementById('addUserForm').reset();
}

function showDeleteModal(userId) {
    const modal = document.getElementById('deleteModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    
    confirmBtn.onclick = () => userManagement.deleteUser(userId);
    modal.classList.remove('hidden');
}

function hideDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
}

function viewUser(userId) {
    Utils.showNotification(`Viewing user ${userId}...`, 'info');
    // Navigate to user details page
}

function editUser(userId) {
    Utils.showNotification(`Editing user ${userId}...`, 'info');
    // Navigate to user edit page or show edit modal
}

function exportUsers() {
    Utils.showNotification('Exporting users...', 'info');
    // Implement export functionality
}

function refreshUsers() {
    userManagement.loadUsers();
    userManagement.loadUserStats();
    Utils.showNotification('Refreshing users...', 'info');
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

    getUsers: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    users: [
                        {
                            id: '1',
                            first_name: 'Admin',
                            last_name: 'User',
                            email: 'admin@dentalclinic.com',
                            phone: '+1 (555) 123-4567',
                            role: 'admin',
                            status: 'active',
                            last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
                        },
                        {
                            id: '2',
                            first_name: 'Sarah',
                            last_name: 'Johnson',
                            email: 's.johnson@dentalclinic.com',
                            phone: '+1 (555) 234-5678',
                            role: 'doctor',
                            status: 'active',
                            last_login: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                        },
                        {
                            id: '3',
                            first_name: 'Emily',
                            last_name: 'Davis',
                            email: 'e.davis@dentalclinic.com',
                            phone: '+1 (555) 345-6789',
                            role: 'receptionist',
                            status: 'active',
                            last_login: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
                        },
                        {
                            id: '4',
                            first_name: 'Michael',
                            last_name: 'Brown',
                            email: 'm.brown@dentalclinic.com',
                            phone: '+1 (555) 456-7890',
                            role: 'doctor',
                            status: 'inactive',
                            last_login: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
                        }
                    ]
                });
            }, 1000);
        });
    },

    getUserStats: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    totalUsers: 24,
                    activeUsers: 21,
                    doctorCount: 8,
                    receptionistCount: 5
                });
            }, 800);
        });
    },

    createUser: async (userData) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Creating user:', userData);
                resolve({ success: true });
            }, 1000);
        });
    },

    deleteUser: async (userId) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Deleting user:', userId);
                resolve({ success: true });
            }, 1000);
        });
    },

    bulkUpdateUsers: async (userIds, updates) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Bulk updating users:', userIds, updates);
                resolve({ success: true });
            }, 1000);
        });
    },

    bulkDeleteUsers: async (userIds) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Bulk deleting users:', userIds);
                resolve({ success: true });
            }, 1000);
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

// Initialize user management when page loads
let userManagement;
document.addEventListener('DOMContentLoaded', () => {
    userManagement = new UserManagement();
});