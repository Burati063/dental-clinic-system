// dashboard.js - Simplified Dental Clinic Dashboard

class DashboardManager {
    constructor() {
        this.apiBaseUrl = 'https://jsonplaceholder.typicode.com';
        this.charts = {};
        this.data = {
            appointments: [],
            patients: [],
            metrics: {},
            trends: {}
        };

        this.initializeEventListeners();
        this.loadDashboardData();
        this.initializeCharts();
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Mobile menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => this.toggleMobileMenu());
        document.getElementById('sidebarClose').addEventListener('click', () => this.closeMobileMenu());
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeMobileMenu());

        // Chart period selector
        document.getElementById('appointments-period').addEventListener('change', (e) => {
            this.updateAppointmentsChart(e.target.value);
        });

        // Global search
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            this.handleGlobalSearch(e.target.value);
        });

        // Refresh data every 5 minutes
        setInterval(() => {
            this.refreshDashboardData();
        }, 300000);
    }

    // API Integration Methods
    async apiCall(endpoint, options = {}) {
        try {
            const url = `${this.apiBaseUrl}${endpoint}`;
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    // Load all dashboard data
    async loadDashboardData() {
        try {
            this.showLoadingStates();
            
            await Promise.all([
                this.loadUserProfile(),
                this.loadAppointmentsData(),
                this.loadPatientsData(),
                this.loadMetricsData(),
                this.loadNotifications()
            ]);

            this.updateDashboardUI();
            this.hideLoadingStates();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data. Using sample data.');
            this.loadSampleData();
        }
    }

    // Refresh data periodically
    async refreshDashboardData() {
        try {
            await Promise.all([
                this.loadAppointmentsData(),
                this.loadMetricsData()
            ]);
            this.updateDashboardUI();
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    // Load user profile data
    async loadUserProfile() {
        try {
            const user = await this.apiCall('/users/1');
            this.updateUserProfile(user);
        } catch (error) {
            console.error('Error loading user profile:', error);
            // Fallback to mock data
            this.updateUserProfile({
                name: 'Dr. Sarah Johnson',
                email: 'sarah.johnson@dentalclinic.com'
            });
        }
    }

    // Load appointments data
    async loadAppointmentsData() {
        try {
            const appointments = await this.apiCall('/posts?_limit=6');
            this.data.appointments = appointments.map((post, index) => ({
                id: post.id,
                patientName: `Patient ${post.id}`,
                time: this.generateAppointmentTime(index),
                service: post.title.substring(0, 30) + '...',
                status: ['confirmed', 'pending', 'confirmed', 'pending', 'cancelled', 'confirmed'][index % 6],
                date: new Date().toISOString().split('T')[0]
            }));
        } catch (error) {
            console.error('Error loading appointments:', error);
            this.data.appointments = this.getSampleAppointments();
        }
    }

    // Load patients data
    async loadPatientsData() {
        try {
            const patients = await this.apiCall('/users?_limit=5');
            this.data.patients = patients.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                lastVisit: this.generateLastVisitDate(user.id),
                phone: user.phone || '555-0000'
            }));
        } catch (error) {
            console.error('Error loading patients:', error);
            this.data.patients = this.getSamplePatients();
        }
    }

    // Load metrics and trends data
    async loadMetricsData() {
        try {
            // Simulate metrics API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.data.metrics = {
                totalAppointmentsToday: Math.floor(Math.random() * 15) + 8,
                totalPatients: Math.floor(Math.random() * 400) + 150,
                pendingAppointments: Math.floor(Math.random() * 8) + 2,
                cancelledAppointments: Math.floor(Math.random() * 5) + 1
            };

            this.data.trends = {
                appointments: (Math.random() * 15 + 5).toFixed(1),
                patients: (Math.random() * 12 + 3).toFixed(1),
                pending: (Math.random() * 10 - 8).toFixed(1),
                cancelled: (Math.random() * 5 - 3).toFixed(1)
            };
        } catch (error) {
            console.error('Error loading metrics:', error);
            this.data.metrics = this.getSampleMetrics();
            this.data.trends = this.getSampleTrends();
        }
    }

    // Load notifications
    async loadNotifications() {
        try {
            const notifications = await this.apiCall('/posts?_limit=4');
            this.updateNotifications(notifications);
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.updateNotifications(this.getSampleNotifications());
        }
    }

    // Initialize charts
    initializeCharts() {
        this.initializeAppointmentsChart();
    }

    // Initialize appointments chart
    initializeAppointmentsChart() {
        const ctx = document.getElementById('appointmentsChart').getContext('2d');
        
        this.charts.appointments = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Appointments',
                    data: [12, 19, 15, 17, 14, 8, 5],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Completed',
                    data: [10, 15, 12, 14, 12, 6, 4],
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Update appointments chart based on period
    updateAppointmentsChart(period) {
        // Simulate data update based on period
        const dataMap = {
            '7d': [12, 19, 15, 17, 14, 8, 5],
            '30d': [45, 52, 48, 55, 50, 42, 38, 45, 52, 48, 55, 50, 42, 38, 45, 52, 48, 55, 50, 42, 38, 45, 52, 48, 55, 50, 42, 38, 45, 52],
            '90d': Array.from({length: 12}, (_, i) => Math.floor(Math.random() * 20) + 30)
        };

        const labelsMap = {
            '7d': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            '30d': Array.from({length: 30}, (_, i) => `Day ${i + 1}`),
            '90d': Array.from({length: 12}, (_, i) => `Week ${i + 1}`)
        };

        this.charts.appointments.data.labels = labelsMap[period] || labelsMap['30d'];
        this.charts.appointments.data.datasets[0].data = dataMap[period] || dataMap['30d'];
        this.charts.appointments.update();
    }

    // Update dashboard UI with loaded data
    updateDashboardUI() {
        this.updateWelcomeSection();
        this.updateMetrics();
        this.updateAppointmentsList();
        this.updatePatientsList();
        this.updateCurrentDate();
    }

    // Update welcome section
    updateWelcomeSection() {
        const welcomeName = document.getElementById('welcome-user-name');
        if (welcomeName) {
            welcomeName.textContent = this.data.user?.name?.split(' ')[0] || 'Admin';
        }
    }

    // Update metrics cards
    updateMetrics() {
        const metrics = this.data.metrics;
        const trends = this.data.trends;

        // Update metric values
        this.updateMetricElement('total-appointments-today', metrics.totalAppointmentsToday);
        this.updateMetricElement('total-patients', metrics.totalPatients.toLocaleString());
        this.updateMetricElement('pending-appointments', metrics.pendingAppointments);
        this.updateMetricElement('cancelled-appointments', metrics.cancelledAppointments);

        // Update trends
        this.updateTrendElement('appointments-trend', `${trends.appointments}%`);
        this.updateTrendElement('patients-trend', `${trends.patients}%`);
        this.updateTrendElement('pending-trend', `${trends.pending}%`);
        this.updateTrendElement('cancelled-trend', `${trends.cancelled}%`);
    }

    // Update appointments list
    updateAppointmentsList() {
        const container = document.getElementById('today-appointments-list');
        if (!container) return;

        if (this.data.appointments.length === 0) {
            container.innerHTML = this.getEmptyStateHTML('No appointments today');
            return;
        }

        container.innerHTML = this.data.appointments.map(appointment => `
            <div class="appointment-item">
                <div class="appointment-time">${appointment.time}</div>
                <div class="appointment-details">
                    <div class="appointment-patient">${appointment.patientName}</div>
                    <div class="appointment-service">${appointment.service}</div>
                </div>
                <div class="appointment-status ${appointment.status}">${appointment.status}</div>
            </div>
        `).join('');
    }

    // Update patients list
    updatePatientsList() {
        const container = document.getElementById('recent-patients-list');
        if (!container) return;

        if (this.data.patients.length === 0) {
            container.innerHTML = this.getEmptyStateHTML('No recent patients');
            return;
        }

        container.innerHTML = this.data.patients.map(patient => `
            <div class="patient-item">
                <div class="patient-avatar">
                    ${patient.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div class="patient-details">
                    <div class="patient-name">${patient.name}</div>
                    <div class="patient-info">${patient.email}</div>
                </div>
                <div class="patient-date">${patient.lastVisit}</div>
            </div>
        `).join('');
    }

    // Update user profile in sidebar and header
    updateUserProfile(user) {
        this.data.user = user;

        const elements = [
            'sidebar-user-name',
            'header-user-name'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = user.name;
            }
        });

        const roleElements = [
            'sidebar-user-role',
            'header-user-role'
        ];

        roleElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = user.role || 'Administrator';
            }
        });
    }

    // Update notifications
    updateNotifications(notifications) {
        const container = document.getElementById('notificationList');
        const badge = document.getElementById('notificationCount');

        if (!container) return;

        const unreadCount = notifications.filter(n => !n.read).length;

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

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
            <div class="notification-item ${notification.read ? '' : 'unread'}">
                <div class="notification-content">
                    <div class="notification-title">${notification.title || 'Notification'}</div>
                    <div class="notification-desc">${notification.body || notification.message || 'New update'}</div>
                    <div class="notification-time">${this.formatTimeAgo(new Date())}</div>
                </div>
            </div>
        `).join('');
    }

    // Update current date display
    updateCurrentDate() {
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            const now = new Date();
            dateElement.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    // Utility methods
    updateMetricElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateTrendElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    generateAppointmentTime(index) {
        const hours = [9, 10, 11, 14, 15, 16];
        const hour = hours[index % hours.length];
        return `${hour}:00`;
    }

    generateLastVisitDate(patientId) {
        const daysAgo = (patientId % 30) + 1;
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }

    getEmptyStateHTML(message) {
        return `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>${message}</p>
            </div>
        `;
    }

    showLoadingStates() {
        const loadingHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading data...</p>
            </div>
        `;

        const containers = [
            'today-appointments-list',
            'recent-patients-list'
        ];

        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = loadingHTML;
            }
        });
    }

    hideLoadingStates() {
        // Loading states are replaced when data is loaded
    }

    // Sample data for fallback
    getSampleAppointments() {
        return [
            {
                id: 1,
                patientName: 'John Smith',
                time: '09:00',
                service: 'Regular dental checkup and cleaning',
                status: 'confirmed',
                date: new Date().toISOString().split('T')[0]
            },
            {
                id: 2,
                patientName: 'Maria Garcia',
                time: '10:30',
                service: 'Teeth whitening consultation',
                status: 'pending',
                date: new Date().toISOString().split('T')[0]
            },
            {
                id: 3,
                patientName: 'Robert Wilson',
                time: '14:00',
                service: 'Wisdom tooth extraction',
                status: 'confirmed',
                date: new Date().toISOString().split('T')[0]
            },
            {
                id: 4,
                patientName: 'Sarah Johnson',
                time: '15:30',
                service: 'Dental filling',
                status: 'cancelled',
                date: new Date().toISOString().split('T')[0]
            }
        ];
    }

    getSamplePatients() {
        return [
            {
                id: 1,
                name: 'John Smith',
                email: 'john.smith@example.com',
                lastVisit: 'Sep 15',
                phone: '555-0101'
            },
            {
                id: 2,
                name: 'Maria Garcia',
                email: 'maria.garcia@example.com',
                lastVisit: 'Sep 18',
                phone: '555-0102'
            },
            {
                id: 3,
                name: 'Robert Wilson',
                email: 'robert.wilson@example.com',
                lastVisit: 'Sep 20',
                phone: '555-0103'
            }
        ];
    }

    getSampleMetrics() {
        return {
            totalAppointmentsToday: 12,
            totalPatients: 342,
            pendingAppointments: 3,
            cancelledAppointments: 2
        };
    }

    getSampleTrends() {
        return {
            appointments: '12.5',
            patients: '8.2',
            pending: '-3.1',
            cancelled: '2.3'
        };
    }

    getSampleNotifications() {
        return [
            {
                id: 1,
                title: 'New Appointment',
                body: 'John Smith scheduled a checkup for tomorrow',
                read: false
            },
            {
                id: 2,
                title: 'Patient Registration',
                body: 'New patient Maria Garcia registered',
                read: true
            }
        ];
    }

    loadSampleData() {
        this.data.appointments = this.getSampleAppointments();
        this.data.patients = this.getSamplePatients();
        this.data.metrics = this.getSampleMetrics();
        this.data.trends = this.getSampleTrends();
        this.updateDashboardUI();
    }

    // UI Interaction Methods
    toggleMobileMenu() {
        document.querySelector('.main-sidebar').classList.add('mobile-open');
        document.getElementById('sidebarOverlay').classList.add('active');
    }

    closeMobileMenu() {
        document.querySelector('.main-sidebar').classList.remove('mobile-open');
        document.getElementById('sidebarOverlay').classList.remove('active');
    }

    handleGlobalSearch(query) {
        if (query.length > 2) {
            // Implement search functionality
            console.log('Searching for:', query);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }
}

// Global functions for HTML integration
let dashboardManager;

// Navigation functions
function viewAllAppointments() {
    window.location.href = 'appointments.html';
}

function viewAllPatients() {
    window.location.href = 'patients.html';
}

function markAllNotificationsRead() {
    dashboardManager.showSuccess('All notifications marked as read!');
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        dashboardManager.showSuccess('Logged out successfully!');
        // In real app: window.location.href = 'login.html';
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    dashboardManager = new DashboardManager();
});