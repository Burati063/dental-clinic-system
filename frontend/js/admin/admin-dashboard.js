class AdminDashboard {
    constructor() {
        this.userData = null;
        this.dashboardData = null;
        this.patients = [];
        this.filteredPatients = [];
        this.currentPage = 1;
        this.patientsPerPage = 5;
        this.init();
    }

    async init() {
        await this.loadUserData();
        this.setupEventListeners();
        this.setupMobileMenu();
        await this.loadDashboardData();
        await this.loadNotifications();
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
            const welcomeMessage = document.getElementById('welcome-message');

            if (sidebarUserName) sidebarUserName.textContent = `${this.userData.first_name} ${this.userData.last_name}`;
            if (headerUserName) headerUserName.textContent = `${this.userData.first_name} ${this.userData.last_name}`;
            if (userRole) userRole.textContent = this.userData.role;
            if (welcomeMessage) welcomeMessage.textContent = `Welcome back, ${this.userData.first_name}! Here's what's happening today.`;
        }
    }

    setupEventListeners() {
        // Global search functionality
        const searchInput = document.getElementById('globalSearch');
        const searchClear = document.getElementById('searchClear');
        
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.handleGlobalSearch(e.target.value);
                searchClear?.classList.toggle('hidden', !e.target.value);
            }, 300));
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                searchClear.classList.add('hidden');
                this.handleGlobalSearch('');
            });
        }

        // Patient search functionality
        const patientSearch = document.getElementById('patientSearch');
        if (patientSearch) {
            patientSearch.addEventListener('input', Utils.debounce((e) => {
                this.handlePatientSearch(e.target.value);
            }, 300));
        }

        // Pagination controls
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

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.action-item')) {
                this.closeAllDropdowns();
            }
        });
    }

    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.querySelector('.main-sidebar');
        const sidebarClose = document.getElementById('sidebarClose');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.add('mobile-open');
                sidebarOverlay.classList.add('active');
            });
        }

        if (sidebarClose) {
            sidebarClose.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            });
        }
    }

    closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
        });
    }

    async loadDashboardData() {
        try {
            this.showLoadingStates();
            
            const [stats, recentPatients] = await Promise.all([
                this.fetchDashboardStats(),
                this.fetchRecentPatients()
            ]);

            this.updateStats(stats);
            this.updateRecentPatients(recentPatients);
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            Utils.showNotification('Failed to load dashboard data', 'error');
        }
    }

    showLoadingStates() {
        // Stats loading
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(stat => {
            stat.textContent = '-';
            stat.style.color = 'var(--gray)';
        });

        const trends = document.querySelectorAll('.stat-trend span');
        trends.forEach(trend => {
            trend.textContent = 'Loading...';
        });

        // Patients loading
        const patientsContainer = document.getElementById('recent-patients');
        if (patientsContainer) {
            patientsContainer.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading patients...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    async fetchDashboardStats() {
        try {
            return await API.getDashboardStats();
        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error;
        }
    }

    async fetchRecentPatients() {
        try {
            const response = await API.getRecentPatients();
            return response.patients || [];
        } catch (error) {
            console.error('Error fetching patients:', error);
            throw error;
        }
    }

    updateStats(stats) {
        // Update numbers
        document.getElementById('total-users').textContent = stats.totalUsers || '-';
        document.getElementById('total-patients').textContent = stats.totalPatients ? stats.totalPatients.toLocaleString() : '-';
        document.getElementById('today-appointments').textContent = stats.todayAppointments || '-';
        document.getElementById('pending-tasks').textContent = stats.pendingTasks || '-';

        // Update trends
        this.updateTrend('users-trend', stats.usersTrend);
        this.updateTrend('patients-trend', stats.patientsTrend);
        this.updateTrend('appointments-trend', stats.appointmentsTrend);
        this.updateTrend('tasks-trend', stats.tasksTrend);
    }

    updateTrend(elementId, trend) {
        const element = document.getElementById(elementId);
        if (element && trend) {
            const icon = element.previousElementSibling;
            if (trend.direction === 'up') {
                icon.className = 'fas fa-arrow-up trend-up';
                element.textContent = `${trend.value}% from last month`;
            } else if (trend.direction === 'down') {
                icon.className = 'fas fa-arrow-down trend-down';
                element.textContent = `${trend.value}% from last month`;
            } else {
                icon.className = 'fas fa-minus trend-neutral';
                element.textContent = 'No change';
            }
        } else if (element) {
            element.previousElementSibling.className = 'fas fa-minus trend-neutral';
            element.textContent = 'No data';
        }
    }

    updateRecentPatients(patients) {
        this.patients = patients;
        this.filteredPatients = [...patients];
        this.currentPage = 1;
        this.renderPatients();
        this.updatePagination();
    }

    renderPatients() {
        const container = document.getElementById('recent-patients');
        if (!container) return;

        if (this.filteredPatients.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="loading-state">
                            <i class="fas fa-user-injured"></i>
                            <p>No patients found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.patientsPerPage;
        const endIndex = startIndex + this.patientsPerPage;
        const currentPatients = this.filteredPatients.slice(startIndex, endIndex);

        container.innerHTML = currentPatients.map(patient => `
            <tr>
                <td>
                    <div class="patient-cell">
                        <div class="patient-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="patient-details">
                            <div class="patient-name">${patient.first_name} ${patient.last_name}</div>
                            <div class="patient-id">#${patient.id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="contact-info">
                        <div class="phone">${patient.phone || 'N/A'}</div>
                        <div class="email">${patient.email}</div>
                    </div>
                </td>
                <td>${this.formatLastVisit(patient.last_visit)}</td>
                <td>
                    <span class="status-badge ${patient.status}">${patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline" title="View" onclick="viewPatient('${patient.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    formatLastVisit(lastVisit) {
        if (!lastVisit) return 'Never';
        
        const visitDate = new Date(lastVisit);
        const now = new Date();
        const diffMs = now - visitDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return visitDate.toLocaleDateString();
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredPatients.length / this.patientsPerPage);
        const infoElement = document.getElementById('pagination-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const numbersContainer = document.getElementById('pagination-numbers');

        if (infoElement) {
            const startIndex = (this.currentPage - 1) * this.patientsPerPage + 1;
            const endIndex = Math.min(this.currentPage * this.patientsPerPage, this.filteredPatients.length);
            infoElement.textContent = `Showing ${startIndex}-${endIndex} of ${this.filteredPatients.length} patients`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        }

        if (numbersContainer) {
            numbersContainer.innerHTML = '';
            
            // Show up to 5 page numbers
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            
            // Adjust if we're near the end
            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `pagination-number ${i === this.currentPage ? 'active' : ''}`;
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
        this.renderPatients();
        this.updatePagination();
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredPatients.length / this.patientsPerPage);
        if (this.currentPage < totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    handlePatientSearch(query) {
        if (query.trim() === '') {
            this.filteredPatients = [...this.patients];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredPatients = this.patients.filter(patient => 
                patient.first_name.toLowerCase().includes(searchTerm) ||
                patient.last_name.toLowerCase().includes(searchTerm) ||
                patient.phone?.includes(searchTerm) ||
                patient.email.toLowerCase().includes(searchTerm) ||
                patient.id.toLowerCase().includes(searchTerm)
            );
        }
        
        this.currentPage = 1;
        this.renderPatients();
        this.updatePagination();
    }

    async loadNotifications() {
        try {
            const notifications = await this.fetchNotifications();
            this.updateNotifications(notifications);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    async fetchNotifications() {
        try {
            const response = await API.getNotifications();
            return response.notifications || [];
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    }

    updateNotifications(notifications) {
        const container = document.getElementById('notificationList');
        const countElement = document.getElementById('notificationCount');

        if (!container) return;

        const unreadCount = notifications.filter(n => n.unread).length;

        // Update badge
        if (countElement) {
            countElement.textContent = unreadCount;
            countElement.classList.toggle('hidden', unreadCount === 0);
        }

        // Update list
        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="notification-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No new notifications</p>
                </div>
            `;
            return;
        }

        container.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.unread ? 'unread' : ''}">
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-desc">${notification.description}</div>
                    <div class="notification-time">${this.formatNotificationTime(notification.created_at)}</div>
                </div>
            </div>
        `).join('');
    }

    formatNotificationTime(createdAt) {
        if (!createdAt) return 'Just now';
        
        const createdDate = new Date(createdAt);
        const now = new Date();
        const diffMs = now - createdDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        
        return createdDate.toLocaleDateString();
    }

    handleGlobalSearch(query) {
        if (query.length < 2) return;
        
        console.log('Searching for:', query);
        Utils.showNotification(`Searching for "${query}"...`, 'info');
    }

    refreshDashboard() {
        this.loadDashboardData();
        this.loadNotifications();
        Utils.showNotification('Dashboard refreshed', 'success');
    }
}

// Global functions for HTML onclick handlers
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        Utils.showNotification('Logging out...', 'info');
        setTimeout(() => {
            window.location.href = '../../login.html';
        }, 1000);
    }
}

function markAllNotificationsRead() {
    Utils.showNotification('Marking all notifications as read...', 'info');
    // Implement mark as read functionality
    const badge = document.getElementById('notificationCount');
    if (badge) {
        badge.classList.add('hidden');
    }
}

function viewPatient(patientId) {
    Utils.showNotification(`Viewing patient ${patientId}...`, 'info');
    // Navigate to patient details
}

function refreshDashboard() {
    if (window.adminDashboard) {
        window.adminDashboard.refreshDashboard();
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
                    role: 'administrator',
                    email: 'admin@dentalclinic.com'
                });
            }, 500);
        });
    },

    getDashboardStats: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    totalUsers: 24,
                    totalPatients: 1247,
                    todayAppointments: 18,
                    pendingTasks: 7,
                    usersTrend: { value: 12, direction: 'up' },
                    patientsTrend: { value: 8, direction: 'up' },
                    appointmentsTrend: { value: 3, direction: 'down' },
                    tasksTrend: { value: 2, direction: 'up' }
                });
            }, 1000);
        });
    },

    getRecentPatients: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    patients: [
                        {
                            id: 'PT-001',
                            first_name: 'John',
                            last_name: 'Doe',
                            phone: '+1 (555) 123-4567',
                            email: 'john.doe@email.com',
                            last_visit: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                            status: 'active'
                        },
                        {
                            id: 'PT-002',
                            first_name: 'Sarah',
                            last_name: 'Smith',
                            phone: '+1 (555) 234-5678',
                            email: 'sarah.smith@email.com',
                            last_visit: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                            status: 'active'
                        },
                        {
                            id: 'PT-003',
                            first_name: 'Mike',
                            last_name: 'Johnson',
                            phone: '+1 (555) 345-6789',
                            email: 'mike.johnson@email.com',
                            last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                            status: 'pending'
                        },
                        {
                            id: 'PT-004',
                            first_name: 'Emily',
                            last_name: 'Davis',
                            phone: '+1 (555) 456-7890',
                            email: 'emily.davis@email.com',
                            last_visit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                            status: 'active'
                        },
                        {
                            id: 'PT-005',
                            first_name: 'Robert',
                            last_name: 'Wilson',
                            phone: '+1 (555) 567-8901',
                            email: 'robert.wilson@email.com',
                            last_visit: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                            status: 'active'
                        },
                        {
                            id: 'PT-006',
                            first_name: 'Jennifer',
                            last_name: 'Brown',
                            phone: '+1 (555) 678-9012',
                            email: 'jennifer.brown@email.com',
                            last_visit: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                            status: 'inactive'
                        }
                    ]
                });
            }, 1200);
        });
    },

    getNotifications: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    notifications: [
                        {
                            id: 1,
                            title: 'New Appointment',
                            description: 'John Doe scheduled for tomorrow 10:00 AM',
                            created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                            unread: true,
                            type: 'appointment'
                        },
                        {
                            id: 2,
                            title: 'Patient Registration',
                            description: 'New patient Sarah Smith registered',
                            created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                            unread: true,
                            type: 'patient'
                        },
                        {
                            id: 3,
                            title: 'System Notice',
                            description: 'Scheduled maintenance tonight at 2:00 AM',
                            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                            unread: false,
                            type: 'system'
                        }
                    ]
                });
            }, 500);
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

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});