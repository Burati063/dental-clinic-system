// API Configuration
const API_BASE_URL = 'https://api.dentalclinic.com/v1';
const API_ENDPOINTS = {
    STATS: '/receptionist/stats',
    APPOINTMENTS: '/appointments',
    ASSIGNMENTS: '/assignments/pending',
    NOTIFICATIONS: '/notifications',
    PATIENTS: '/patients'
};

// Global State
let dashboardState = {
    isOnline: true,
    lastUpdate: null,
    refreshInterval: null,
    realTimeEnabled: true,
    dataCache: new Map()
};

// DOM Elements
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarClose = document.getElementById('sidebarClose');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebar = document.querySelector('.main-sidebar');
const globalSearch = document.getElementById('globalSearch');
const searchClear = document.getElementById('searchClear');
const currentDate = document.getElementById('current-date');
const welcomeUserName = document.getElementById('welcome-user-name');
const sidebarUserName = document.getElementById('sidebar-user-name');
const headerUserName = document.getElementById('header-user-name');
const lastUpdatedTime = document.getElementById('last-updated-time');
const connectionStatus = document.getElementById('connectionStatus');

// Chart variables
let appointmentsChart;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    startRealTimeUpdates();
});

// Initialize dashboard components
async function initializeDashboard() {
    try {
        // Set current date
        const now = new Date();
        currentDate.textContent = formatDate(now);
        
        // Set user name
        const user = await getCurrentUser();
        welcomeUserName.textContent = user.name;
        sidebarUserName.textContent = user.name;
        headerUserName.textContent = user.name;
        
        // Load initial data
        await loadDashboardData();
        
        // Initialize charts
        initializeCharts();
        
        // Update connection status
        updateConnectionStatus(true);
        
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showError('Failed to initialize dashboard. Please refresh the page.');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Mobile menu toggle
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    sidebarClose.addEventListener('click', toggleMobileMenu);
    sidebarOverlay.addEventListener('click', toggleMobileMenu);
    
    // Search functionality
    globalSearch.addEventListener('input', handleGlobalSearch);
    searchClear.addEventListener('click', clearSearch);
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
    });
    
    // Online/offline detection
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Period selector change
    document.getElementById('appointments-period').addEventListener('change', function(e) {
        updateChartData(e.target.value);
    });
    
    // Visibility change (for real-time updates when tab is active)
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Toggle mobile menu
function toggleMobileMenu() {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
}

// Handle global search
function handleGlobalSearch(e) {
    const searchTerm = e.target.value.trim();
    
    if (searchTerm) {
        searchClear.classList.remove('hidden');
        performGlobalSearch(searchTerm);
    } else {
        searchClear.classList.add('hidden');
        clearSearchResults();
    }
}

// Clear search
function clearSearch() {
    globalSearch.value = '';
    searchClear.classList.add('hidden');
    clearSearchResults();
}

// Perform global search with API
async function performGlobalSearch(searchTerm) {
    try {
        const results = await apiCall(`${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(searchTerm)}`);
        displaySearchResults(results);
    } catch (error) {
        console.error('Search failed:', error);
        showError('Search temporarily unavailable');
    }
}

// Clear search results
function clearSearchResults() {
    // Clear any search results display
}

// Close all dropdowns
function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(dropdown => {
        dropdown.style.opacity = '0';
        dropdown.style.visibility = 'hidden';
        dropdown.style.transform = 'translateY(-10px)';
    });
}

// Initialize charts
function initializeCharts() {
    const ctx = document.getElementById('appointmentsChart').getContext('2d');
    
    appointmentsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Scheduled',
                    data: [],
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Completed',
                    data: [],
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Cancelled',
                    data: [],
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 5
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Load dashboard data from API
async function loadDashboardData() {
    try {
        showLoadingState();
        
        // Load all data in parallel
        const [stats, appointments, assignments, notifications] = await Promise.all([
            loadStatsData(),
            loadTodayAppointments(),
            loadPendingAssignments(),
            loadNotifications()
        ]);
        
        dashboardState.lastUpdate = new Date();
        updateLastUpdatedTime();
        
        hideLoadingState();
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError('Failed to load dashboard data. Please try again.');
        hideLoadingState();
    }
}

// Load stats data from API
async function loadStatsData() {
    try {
        const stats = await apiCall(API_ENDPOINTS.STATS);
        
        // Update DOM with stats
        document.getElementById('total-appointments-today').textContent = stats.todayAppointments;
        document.getElementById('total-patients').textContent = stats.totalPatients;
        document.getElementById('pending-assignments').textContent = stats.pendingAssignments;
        document.getElementById('cancelled-appointments').textContent = stats.cancelledToday;
        
        document.getElementById('appointments-trend').textContent = formatTrend(stats.appointmentsTrend);
        document.getElementById('patients-trend').textContent = formatTrend(stats.patientsTrend);
        document.getElementById('pending-trend').textContent = formatTrend(stats.pendingTrend);
        document.getElementById('cancelled-trend').textContent = formatTrend(stats.cancelledTrend);
        
        // Update trend colors
        updateTrendColors('appointments-trend', stats.appointmentsTrend);
        updateTrendColors('patients-trend', stats.patientsTrend);
        updateTrendColors('pending-trend', stats.pendingTrend);
        updateTrendColors('cancelled-trend', stats.cancelledTrend);
        
        return stats;
        
    } catch (error) {
        console.error('Failed to load stats:', error);
        throw error;
    }
}

// Load today's appointments from API
async function loadTodayAppointments() {
    const appointmentsList = document.getElementById('today-appointments-list');
    
    try {
        const appointments = await apiCall(`${API_ENDPOINTS.APPOINTMENTS}/today`);
        
        let html = '';
        
        if (appointments.length === 0) {
            html = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h4>No appointments today</h4>
                    <p>All appointments for today have been completed or cancelled.</p>
                </div>
            `;
        } else {
            appointments.forEach(appointment => {
                html += `
                    <div class="appointment-item" data-id="${appointment.id}">
                        <div class="appointment-time">${formatTime(appointment.time)}</div>
                        <div class="appointment-details">
                            <div class="appointment-patient">${appointment.patientName}</div>
                            <div class="appointment-service">${appointment.service}</div>
                            ${appointment.doctorName ? `<div class="appointment-doctor">Dr. ${appointment.doctorName}</div>` : ''}
                        </div>
                        <div class="appointment-status ${appointment.status}">
                            ${appointment.status}
                        </div>
                    </div>
                `;
            });
        }
        
        appointmentsList.innerHTML = html;
        return appointments;
        
    } catch (error) {
        console.error('Failed to load appointments:', error);
        appointmentsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Failed to load appointments</h4>
                <p>Please try refreshing the page.</p>
                <button class="btn btn-sm btn-outline" onclick="loadTodayAppointments()">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
        throw error;
    }
}

// Load pending assignments from API
async function loadPendingAssignments() {
    const assignmentsList = document.getElementById('pending-assignments-list');
    
    try {
        const assignments = await apiCall(API_ENDPOINTS.ASSIGNMENTS);
        
        let html = '';
        
        if (assignments.length === 0) {
            html = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h4>All caught up!</h4>
                    <p>There are no pending doctor assignments at the moment.</p>
                </div>
            `;
        } else {
            assignments.forEach(assignment => {
                html += `
                    <div class="assignment-item" data-id="${assignment.id}">
                        <div class="assignment-details">
                            <div class="assignment-patient">${assignment.patientName}</div>
                            <div class="assignment-service">${assignment.service}</div>
                            <div class="assignment-arrival">Arrived: ${formatTime(assignment.arrivalTime)}</div>
                        </div>
                        <div class="assignment-urgency ${assignment.urgency}">
                            ${assignment.urgency}
                        </div>
                    </div>
                `;
            });
        }
        
        assignmentsList.innerHTML = html;
        return assignments;
        
    } catch (error) {
        console.error('Failed to load assignments:', error);
        assignmentsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Failed to load assignments</h4>
                <p>Please try refreshing the page.</p>
                <button class="btn btn-sm btn-outline" onclick="loadPendingAssignments()">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
        throw error;
    }
}

// Load notifications from API
async function loadNotifications() {
    const notificationList = document.getElementById('notificationList');
    const notificationCount = document.getElementById('notificationCount');
    
    try {
        const notifications = await apiCall(API_ENDPOINTS.NOTIFICATIONS);
        
        const unreadCount = notifications.filter(n => !n.read).length;
        
        // Update notification badge
        if (unreadCount > 0) {
            notificationCount.textContent = unreadCount;
            notificationCount.classList.remove('hidden');
        } else {
            notificationCount.classList.add('hidden');
        }
        
        // Update notification list
        let html = '';
        
        if (notifications.length === 0) {
            html = `
                <div class="notification-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No new notifications</p>
                </div>
            `;
        } else {
            notifications.forEach(notification => {
                html += `
                    <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
                        <div class="notification-content">
                            <div class="notification-title">${notification.title}</div>
                            <div class="notification-desc">${notification.description}</div>
                            <div class="notification-time">${formatRelativeTime(notification.timestamp)}</div>
                        </div>
                    </div>
                `;
            });
        }
        
        notificationList.innerHTML = html;
        return notifications;
        
    } catch (error) {
        console.error('Failed to load notifications:', error);
        notificationList.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load notifications</p>
            </div>
        `;
        throw error;
    }
}

// API Call wrapper with error handling
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Check cache first
    if (dashboardState.dataCache.has(cacheKey)) {
        const cached = dashboardState.dataCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30000) { // 30 second cache
            return cached.data;
        }
    }
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cache successful response
        dashboardState.dataCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        
        return data;
        
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        
        // Return cached data if available (even if expired)
        if (dashboardState.dataCache.has(cacheKey)) {
            console.log('Returning cached data due to API failure');
            return dashboardState.dataCache.get(cacheKey).data;
        }
        
        throw error;
    }
}

// Real-time updates
function startRealTimeUpdates() {
    // Set up WebSocket connection for real-time updates
    setupWebSocket();
    
    // Set up periodic refresh
    dashboardState.refreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && dashboardState.isOnline) {
            refreshDashboardData();
        }
    }, 30000); // Refresh every 30 seconds
}

// WebSocket setup for real-time updates
function setupWebSocket() {
    // In a real implementation, this would connect to your WebSocket server
    console.log('Setting up WebSocket connection for real-time updates...');
    
    // Simulate real-time updates for demonstration
    setInterval(() => {
        if (Math.random() < 0.3 && dashboardState.isOnline) { // 30% chance of update
            simulateRealTimeUpdate();
        }
    }, 10000);
}

// Simulate real-time updates (for demonstration)
function simulateRealTimeUpdate() {
    const updates = [
        { type: 'new_appointment', message: 'New appointment scheduled' },
        { type: 'appointment_update', message: 'Appointment status updated' },
        { type: 'assignment', message: 'New doctor assignment required' }
    ];
    
    const update = updates[Math.floor(Math.random() * updates.length)];
    showRealTimeUpdate(update);
    
    // Refresh relevant data
    switch (update.type) {
        case 'new_appointment':
        case 'appointment_update':
            refreshTodayAppointments();
            break;
        case 'assignment':
            refreshPendingAssignments();
            break;
    }
}

// Show real-time update notification
function showRealTimeUpdate(update) {
    const notification = document.createElement('div');
    notification.className = `update-notification info show`;
    notification.innerHTML = `
        <i class="fas fa-bell"></i>
        <span>${update.message}</span>
        <button class="btn-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Refresh dashboard data
async function refreshDashboardData() {
    if (!dashboardState.isOnline) return;
    
    try {
        await loadDashboardData();
        showUpdateNotification('Dashboard updated successfully', 'success');
    } catch (error) {
        console.error('Dashboard refresh failed:', error);
    }
}

// Refresh today's appointments
async function refreshTodayAppointments() {
    const btn = event?.target?.closest('.btn');
    if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
    }
    
    try {
        await loadTodayAppointments();
        if (btn) {
            showUpdateNotification('Appointments refreshed', 'success');
        }
    } catch (error) {
        if (btn) {
            showUpdateNotification('Failed to refresh appointments', 'error');
        }
    } finally {
        if (btn) {
            btn.classList.remove('syncing');
            btn.disabled = false;
        }
    }
}

// Refresh pending assignments
async function refreshPendingAssignments() {
    const btn = event?.target?.closest('.btn');
    if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
    }
    
    try {
        await loadPendingAssignments();
        if (btn) {
            showUpdateNotification('Assignments refreshed', 'success');
        }
    } catch (error) {
        if (btn) {
            showUpdateNotification('Failed to refresh assignments', 'error');
        }
    } finally {
        if (btn) {
            btn.classList.remove('syncing');
            btn.disabled = false;
        }
    }
}

// Update chart data based on period
async function updateChartData(period) {
    try {
        const chartData = await apiCall(`${API_ENDPOINTS.STATS}/chart?period=${period}`);
        
        appointmentsChart.data.labels = chartData.labels;
        appointmentsChart.data.datasets[0].data = chartData.scheduled;
        appointmentsChart.data.datasets[1].data = chartData.completed;
        appointmentsChart.data.datasets[2].data = chartData.cancelled;
        appointmentsChart.update();
        
    } catch (error) {
        console.error('Failed to update chart:', error);
        showError('Failed to load chart data');
    }
}

// Handle online/offline status
function handleOnlineStatus() {
    const isOnline = navigator.onLine;
    dashboardState.isOnline = isOnline;
    updateConnectionStatus(isOnline);
    
    if (isOnline) {
        // Try to sync data when coming back online
        refreshDashboardData();
    }
}

// Update connection status display
function updateConnectionStatus(isOnline) {
    if (isOnline) {
        connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Connected</span>';
        connectionStatus.className = 'connection-status';
    } else {
        connectionStatus.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Offline</span>';
        connectionStatus.className = 'connection-status offline';
    }
}

// Update last updated time
function updateLastUpdatedTime() {
    if (dashboardState.lastUpdate) {
        lastUpdatedTime.textContent = formatRelativeTime(dashboardState.lastUpdate);
    }
}

// Handle visibility change
function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && dashboardState.isOnline) {
        // Refresh data when tab becomes active
        refreshDashboardData();
    }
}

// Mark all notifications as read
async function markAllNotificationsRead() {
    try {
        await apiCall(`${API_ENDPOINTS.NOTIFICATIONS}/read-all`, { method: 'POST' });
        loadNotifications(); // Reload notifications
        showUpdateNotification('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Failed to mark notifications as read:', error);
        showError('Failed to update notifications');
    }
}

// View all appointments
function viewAllAppointments() {
    window.location.href = 'appointments.html';
}

// View all assignments
function viewAllAssignments() {
    window.location.href = 'assign-doctor.html';
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear intervals
        if (dashboardState.refreshInterval) {
            clearInterval(dashboardState.refreshInterval);
        }
        
        // Clear user session
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        
        // Redirect to login page
        window.location.href = '../../index.html';
    }
}

// Utility Functions

// Format date
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Format time
function formatTime(timeString) {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Format relative time
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return formatDate(new Date(date));
}

// Format trend percentage
function formatTrend(value) {
    if (value > 0) return `+${value}%`;
    if (value < 0) return `${value}%`;
    return '0%';
}

// Update trend colors
function updateTrendColors(elementId, trend) {
    const element = document.getElementById(elementId);
    const trendElement = element.closest('.stat-trend');
    
    trendElement.className = 'stat-trend';
    if (trend > 0) {
        trendElement.classList.add('positive');
    } else if (trend < 0) {
        trendElement.classList.add('negative');
    }
}

// Get current user (simulated API call)
async function getCurrentUser() {
    try {
        // In a real app, this would be an API call
        return await apiCall('/user/me');
    } catch (error) {
        // Fallback to localStorage or default
        const stored = localStorage.getItem('userData');
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            id: 1,
            name: 'Emily Johnson',
            role: 'receptionist',
            email: 'emily.johnson@dentalclinic.com'
        };
    }
}

// Get auth token
function getAuthToken() {
    return localStorage.getItem('userToken') || 'demo-token';
}

// Show loading state
function showLoadingState() {
    document.body.classList.add('loading');
}

// Hide loading state
function hideLoadingState() {
    document.body.classList.remove('loading');
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'update-notification error show';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
        <button class="btn-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// Show update notification
function showUpdateNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `update-notification ${type} show`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
        <span>${message}</span>
        <button class="btn-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// Export functions for use in other modules
window.receptionistDashboard = {
    toggleMobileMenu,
    handleLogout,
    markAllNotificationsRead,
    viewAllAppointments,
    viewAllAssignments,
    refreshTodayAppointments,
    refreshPendingAssignments,
    refreshDashboardData
};