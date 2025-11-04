// API Configuration
const API_BASE_URL = 'https://api.dentalclinic.com/v1';
const API_ENDPOINTS = {
    APPOINTMENTS: '/appointments',
    APPOINTMENTS_STATS: '/appointments/stats',
    DOCTORS: '/doctors',
    NOTIFICATIONS: '/notifications',
    SEARCH: '/search/appointments'
};

// Global State
let appointmentsState = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    filters: {
        status: 'all',
        doctor: 'all',
        date: new Date().toISOString().split('T')[0]
    },
    sort: {
        field: 'appointmentDate',
        direction: 'asc'
    },
    selectedAppointments: new Set(),
    isOnline: true,
    refreshInterval: null,
    dataCache: new Map(),
    lastUpdate: null,
    currentEditingAppointment: null,
    websocket: null
};

// DOM Elements
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarClose = document.getElementById('sidebarClose');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebar = document.querySelector('.main-sidebar');
const globalSearch = document.getElementById('globalSearch');
const searchClear = document.getElementById('searchClear');
const connectionStatus = document.getElementById('connectionStatus');
const lastUpdatedTime = document.getElementById('last-updated-time');

// Initialize appointments page
document.addEventListener('DOMContentLoaded', function() {
    initializeAppointmentsPage();
    setupEventListeners();
    initializeWebSocket();
    startRealTimeUpdates();
});

// Initialize appointments page
async function initializeAppointmentsPage() {
    try {
        // Set current user
        const user = await getCurrentUser();
        document.getElementById('sidebar-user-name').textContent = user.name;
        document.getElementById('header-user-name').textContent = user.name;
        
        // Set default date filter to today
        document.getElementById('dateFilter').value = appointmentsState.filters.date;
        
        // Load initial data
        await loadInitialData();
        
        // Update connection status
        updateConnectionStatus(true);
        
    } catch (error) {
        console.error('Page initialization failed:', error);
        showError('Failed to initialize page. Please refresh.');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Mobile menu toggle
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    sidebarClose.addEventListener('click', toggleMobileMenu);
    sidebarOverlay.addEventListener('click', toggleMobileMenu);
    
    // Search functionality
    globalSearch.addEventListener('input', debounce(handleGlobalSearch, 300));
    searchClear.addEventListener('click', clearSearch);
    
    // Filter events
    document.getElementById('statusFilter').addEventListener('change', updateFilters);
    document.getElementById('doctorFilter').addEventListener('change', updateFilters);
    document.getElementById('dateFilter').addEventListener('change', updateFilters);
    
    // Pagination
    document.getElementById('prevPage').addEventListener('click', goToPreviousPage);
    document.getElementById('nextPage').addEventListener('click', goToNextPage);
    
    // Select all checkbox
    document.getElementById('selectAll').addEventListener('change', toggleSelectAll);
    
    // Online/offline detection
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
    });
    
    // Visibility change for real-time updates
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Toggle mobile menu
function toggleMobileMenu() {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
}

// Handle global search with debouncing
async function handleGlobalSearch(e) {
    const searchTerm = e.target.value.trim();
    
    if (searchTerm) {
        searchClear.classList.remove('hidden');
        await performSearch(searchTerm);
    } else {
        searchClear.classList.add('hidden');
        await loadAppointments();
    }
}

// Clear search
function clearSearch() {
    globalSearch.value = '';
    searchClear.classList.add('hidden');
    loadAppointments();
}

// Perform search with API
async function performSearch(searchTerm) {
    try {
        const results = await apiCall(`${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(searchTerm)}`);
        displayAppointments(results.data || results);
        updateAppointmentsStats(results.data || results);
        
    } catch (error) {
        console.error('Search failed:', error);
        showError('Search temporarily unavailable');
    }
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

// Load initial data
async function loadInitialData() {
    try {
        showLoadingState();
        
        // Load data in parallel
        await Promise.all([
            loadAppointments(),
            loadDoctors(),
            loadNotifications(),
            loadAppointmentsStats()
        ]);
        
        appointmentsState.lastUpdate = new Date();
        updateLastUpdatedTime();
        
        hideLoadingState();
        
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showError('Failed to load data. Please try again.');
        hideLoadingState();
    }
}

// Load appointments with pagination and filters from API
async function loadAppointments() {
    const tableBody = document.getElementById('appointmentsTableBody');
    
    try {
        // Build query parameters
        const params = new URLSearchParams({
            page: appointmentsState.currentPage,
            limit: appointmentsState.itemsPerPage,
            sort: appointmentsState.sort.field,
            order: appointmentsState.sort.direction
        });
        
        // Add filters (excluding 'all' values)
        if (appointmentsState.filters.status !== 'all') {
            params.append('status', appointmentsState.filters.status);
        }
        if (appointmentsState.filters.doctor !== 'all') {
            params.append('doctorId', appointmentsState.filters.doctor);
        }
        if (appointmentsState.filters.date) {
            params.append('date', appointmentsState.filters.date);
        }
        
        const response = await apiCall(`${API_ENDPOINTS.APPOINTMENTS}?${params.toString()}`);
        
        appointmentsState.totalItems = response.total || response.data.length;
        displayAppointments(response.data || response);
        updatePagination();
        
    } catch (error) {
        console.error('Failed to load appointments:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>Failed to load appointments</h4>
                        <p>Please try refreshing the page.</p>
                        <button class="btn btn-sm btn-outline" onclick="loadAppointments()">
                            <i class="fas fa-sync-alt"></i>
                            Retry
                        </button>
                    </div>
                </td>
            </tr>
        `;
        throw error;
    }
}

// Display appointments in table
function displayAppointments(appointments) {
    const tableBody = document.getElementById('appointmentsTableBody');
    
    if (appointments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-calendar-times"></i>
                        <h4>No appointments found</h4>
                        <p>No appointments match your current filters.</p>
                        <button class="btn btn-sm btn-outline" onclick="clearFilters()">
                            Clear Filters
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    appointments.forEach(appointment => {
        const isSelected = appointmentsState.selectedAppointments.has(appointment.id);
        
        html += `
            <tr data-appointment-id="${appointment.id}">
                <td data-label="Select">
                    <input type="checkbox" 
                           class="appointment-checkbox" 
                           value="${appointment.id}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleAppointmentSelection('${appointment.id}')">
                </td>
                <td data-label="Patient">
                    <div class="patient-info">
                        <div class="patient-name">${appointment.patientName}</div>
                        <div class="patient-contact">${appointment.patientPhone}</div>
                    </div>
                </td>
                <td data-label="Service">${appointment.service}</td>
                <td data-label="Doctor">
                    ${appointment.doctorName ? `Dr. ${appointment.doctorName}` : 'Not Assigned'}
                </td>
                <td data-label="Date & Time">
                    <div class="datetime-info">
                        <div class="appointment-date">${formatDate(appointment.appointmentDate)}</div>
                        <div class="appointment-time">${formatTime(appointment.appointmentTime)}</div>
                    </div>
                </td>
                <td data-label="Status">
                    <span class="status-badge ${appointment.status}">
                        ${appointment.status}
                    </span>
                </td>
                <td data-label="Actions">
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-outline" 
                                onclick="viewAppointmentDetails('${appointment.id}')"
                                title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon btn-outline" 
                                onclick="editAppointment('${appointment.id}')"
                                title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon btn-outline" 
                                onclick="cancelAppointment('${appointment.id}')"
                                title="Cancel"
                                ${appointment.status === 'cancelled' || appointment.status === 'completed' ? 'disabled' : ''}>
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Load doctors from API
async function loadDoctors() {
    try {
        const doctors = await apiCall(API_ENDPOINTS.DOCTORS);
        const doctorSelect = document.getElementById('doctorFilter');
        const editDoctorSelect = document.getElementById('editDoctor');
        
        let options = '<option value="all">All Doctors</option>';
        let editOptions = '<option value="">Not Assigned</option>';
        
        doctors.forEach(doctor => {
            options += `<option value="${doctor.id}">Dr. ${doctor.name} - ${doctor.specialization}</option>`;
            editOptions += `<option value="${doctor.id}">Dr. ${doctor.name} - ${doctor.specialization}</option>`;
        });
        
        doctorSelect.innerHTML = options;
        editDoctorSelect.innerHTML = editOptions;
        
    } catch (error) {
        console.error('Failed to load doctors:', error);
    }
}

// Load appointments statistics from API
async function loadAppointmentsStats() {
    try {
        const stats = await apiCall(API_ENDPOINTS.APPOINTMENTS_STATS);
        
        document.getElementById('total-appointments').textContent = stats.total || 0;
        document.getElementById('confirmed-appointments').textContent = stats.confirmed || 0;
        document.getElementById('pending-appointments').textContent = stats.pending || 0;
        document.getElementById('cancelled-appointments').textContent = stats.cancelled || 0;
        
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load notifications from API
async function loadNotifications() {
    try {
        const notifications = await apiCall(API_ENDPOINTS.NOTIFICATIONS);
        const notificationList = document.getElementById('notificationList');
        const notificationCount = document.getElementById('notificationCount');
        
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
            html = '<div class="notification-empty"><i class="fas fa-bell-slash"></i><p>No new notifications</p></div>';
        } else {
            notifications.forEach(notification => {
                html += `
                    <div class="notification-item ${notification.read ? '' : 'unread'}">
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
        
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

// Update filters and reload appointments
function updateFilters() {
    appointmentsState.filters = {
        status: document.getElementById('statusFilter').value,
        doctor: document.getElementById('doctorFilter').value,
        date: document.getElementById('dateFilter').value
    };
    
    appointmentsState.currentPage = 1;
    loadAppointments();
}

// Apply filters
function applyFilters() {
    updateFilters();
    showUpdateNotification('Filters applied successfully', 'success');
}

// Clear all filters
function clearFilters() {
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('doctorFilter').value = 'all';
    document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
    
    appointmentsState.filters = {
        status: 'all',
        doctor: 'all',
        date: new Date().toISOString().split('T')[0]
    };
    
    appointmentsState.currentPage = 1;
    loadAppointments();
    
    showUpdateNotification('Filters cleared', 'info');
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(appointmentsState.totalItems / appointmentsState.itemsPerPage);
    const currentPage = appointmentsState.currentPage;
    
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

// Go to previous page
function goToPreviousPage() {
    if (appointmentsState.currentPage > 1) {
        appointmentsState.currentPage--;
        loadAppointments();
    }
}

// Go to next page
function goToNextPage() {
    const totalPages = Math.ceil(appointmentsState.totalItems / appointmentsState.itemsPerPage);
    if (appointmentsState.currentPage < totalPages) {
        appointmentsState.currentPage++;
        loadAppointments();
    }
}

// Toggle select all appointments
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.appointment-checkbox');
    
    if (selectAll.checked) {
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            appointmentsState.selectedAppointments.add(checkbox.value);
        });
    } else {
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        appointmentsState.selectedAppointments.clear();
    }
}

// Toggle individual appointment selection
function toggleAppointmentSelection(appointmentId) {
    if (appointmentsState.selectedAppointments.has(appointmentId)) {
        appointmentsState.selectedAppointments.delete(appointmentId);
    } else {
        appointmentsState.selectedAppointments.add(appointmentId);
    }
    
    // Update select all checkbox state
    const checkboxes = document.querySelectorAll('.appointment-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    document.getElementById('selectAll').checked = allChecked;
}

// View appointment details from API
async function viewAppointmentDetails(appointmentId) {
    try {
        const appointment = await apiCall(`${API_ENDPOINTS.APPOINTMENTS}/${appointmentId}`);
        const modalContent = document.getElementById('appointmentDetailsContent');
        
        modalContent.innerHTML = `
            <div class="detail-section">
                <h4>Appointment Information</h4>
                <div class="detail-row">
                    <span class="detail-label">Patient</span>
                    <span class="detail-value">${appointment.patientName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Service</span>
                    <span class="detail-value">${appointment.service}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Doctor</span>
                    <span class="detail-value">${appointment.doctorName ? `Dr. ${appointment.doctorName}` : 'Not Assigned'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date & Time</span>
                    <span class="detail-value">${formatDate(appointment.appointmentDate)} at ${formatTime(appointment.appointmentTime)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">
                        <span class="status-badge ${appointment.status}">${appointment.status}</span>
                    </span>
                </div>
                ${appointment.notes ? `
                <div class="detail-row">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value">${appointment.notes}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="detail-section">
                <h4>Patient Information</h4>
                <div class="detail-row">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${appointment.patientPhone}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${appointment.patientEmail || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date of Birth</span>
                    <span class="detail-value">${appointment.patientDOB ? formatDate(appointment.patientDOB) : 'N/A'}</span>
                </div>
            </div>
        `;
        
        // Store current appointment ID for actions
        modalContent.dataset.appointmentId = appointmentId;
        
        document.getElementById('appointmentDetailsModal').classList.add('show');
        
    } catch (error) {
        console.error('Failed to load appointment details:', error);
        showError('Failed to load appointment details');
    }
}

// Close appointment details modal
function closeAppointmentDetailsModal() {
    document.getElementById('appointmentDetailsModal').classList.remove('show');
}

// Edit appointment - load data into modal
async function editAppointment(appointmentId = null) {
    const actualAppointmentId = appointmentId || document.getElementById('appointmentDetailsContent').dataset.appointmentId;
    
    try {
        const appointment = await apiCall(`${API_ENDPOINTS.APPOINTMENTS}/${actualAppointmentId}`);
        appointmentsState.currentEditingAppointment = appointment;
        
        // Populate form
        document.getElementById('editPatientName').value = appointment.patientName;
        document.getElementById('editService').value = appointment.service;
        document.getElementById('editAppointmentDate').value = appointment.appointmentDate;
        document.getElementById('editAppointmentTime').value = appointment.appointmentTime;
        document.getElementById('editDoctor').value = appointment.doctorId || '';
        document.getElementById('editStatus').value = appointment.status;
        document.getElementById('editNotes').value = appointment.notes || '';
        
        document.getElementById('editAppointmentModal').classList.add('show');
        
    } catch (error) {
        console.error('Failed to load appointment for editing:', error);
        showError('Failed to load appointment details');
    }
}

// Close edit appointment modal
function closeEditAppointmentModal() {
    document.getElementById('editAppointmentModal').classList.remove('show');
    appointmentsState.currentEditingAppointment = null;
}

// Save appointment changes to API
async function saveAppointmentChanges() {
    const form = document.getElementById('editAppointmentForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    try {
        const appointmentData = {
            patientName: document.getElementById('editPatientName').value,
            service: document.getElementById('editService').value,
            appointmentDate: document.getElementById('editAppointmentDate').value,
            appointmentTime: document.getElementById('editAppointmentTime').value,
            doctorId: document.getElementById('editDoctor').value || null,
            status: document.getElementById('editStatus').value,
            notes: document.getElementById('editNotes').value
        };
        
        await apiCall(`${API_ENDPOINTS.APPOINTMENTS}/${appointmentsState.currentEditingAppointment.id}`, {
            method: 'PUT',
            body: JSON.stringify(appointmentData)
        });
        
        closeEditAppointmentModal();
        closeAppointmentDetailsModal();
        
        // Refresh data
        await Promise.all([
            loadAppointments(),
            loadAppointmentsStats()
        ]);
        
        showUpdateNotification('Appointment updated successfully', 'success');
        
    } catch (error) {
        console.error('Failed to update appointment:', error);
        showError('Failed to update appointment. Please try again.');
    }
}

// Cancel appointment via API
async function cancelAppointment(appointmentId = null) {
    const actualAppointmentId = appointmentId || document.getElementById('appointmentDetailsContent').dataset.appointmentId;
    
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }
    
    try {
        await apiCall(`${API_ENDPOINTS.APPOINTMENTS}/${actualAppointmentId}/cancel`, {
            method: 'PUT'
        });
        
        await Promise.all([
            loadAppointments(),
            loadAppointmentsStats()
        ]);
        
        showUpdateNotification('Appointment cancelled successfully', 'success');
        
        // Close details modal if open
        closeAppointmentDetailsModal();
        
    } catch (error) {
        console.error('Failed to cancel appointment:', error);
        showError('Failed to cancel appointment');
    }
}

// Refresh appointments
async function refreshAppointments() {
    const btn = event?.target?.closest('.btn');
    if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
    }
    
    try {
        await Promise.all([
            loadAppointments(),
            loadAppointmentsStats(),
            loadNotifications()
        ]);
        
        appointmentsState.lastUpdate = new Date();
        updateLastUpdatedTime();
        
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

// Export appointments
async function exportAppointments() {
    try {
        const response = await apiCall(`${API_ENDPOINTS.APPOINTMENTS}/export`);
        
        // Create download link
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appointments-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showUpdateNotification('Appointments exported successfully', 'success');
        
    } catch (error) {
        console.error('Failed to export appointments:', error);
        showError('Failed to export appointments');
    }
}

// WebSocket for real-time updates
function initializeWebSocket() {
    try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/appointments`;
        
        appointmentsState.websocket = new WebSocket(wsUrl);
        
        appointmentsState.websocket.onopen = function() {
            console.log('WebSocket connection established');
            updateConnectionStatus(true);
        };
        
        appointmentsState.websocket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            handleRealTimeUpdate(data);
        };
        
        appointmentsState.websocket.onclose = function() {
            console.log('WebSocket connection closed');
            // Attempt to reconnect after 5 seconds
            setTimeout(initializeWebSocket, 5000);
        };
        
        appointmentsState.websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            updateConnectionStatus(false);
        };
        
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
    }
}

// Handle real-time updates from WebSocket
function handleRealTimeUpdate(update) {
    switch (update.type) {
        case 'APPOINTMENT_CREATED':
        case 'APPOINTMENT_UPDATED':
        case 'APPOINTMENT_CANCELLED':
            showRealTimeNotification(update);
            refreshAppointments();
            break;
        case 'STATS_UPDATED':
            loadAppointmentsStats();
            break;
        case 'NEW_NOTIFICATION':
            loadNotifications();
            break;
    }
}

// Show real-time notification
function showRealTimeNotification(update) {
    const messages = {
        'APPOINTMENT_CREATED': 'New appointment scheduled',
        'APPOINTMENT_UPDATED': 'Appointment updated',
        'APPOINTMENT_CANCELLED': 'Appointment cancelled'
    };
    
    showUpdateNotification(messages[update.type] || 'Update received', 'info');
}

// Real-time updates with periodic refresh
function startRealTimeUpdates() {
    // Set up periodic refresh as fallback
    appointmentsState.refreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && appointmentsState.isOnline) {
            refreshAppointments();
        }
    }, 60000); // Refresh every 60 seconds as fallback
}

// Handle online/offline status
function handleOnlineStatus() {
    const isOnline = navigator.onLine;
    appointmentsState.isOnline = isOnline;
    updateConnectionStatus(isOnline);
    
    if (isOnline) {
        // Try to sync data when coming back online
        refreshAppointments();
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
    if (appointmentsState.lastUpdate) {
        lastUpdatedTime.textContent = formatRelativeTime(appointmentsState.lastUpdate);
    }
}

// Handle visibility change
function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && appointmentsState.isOnline) {
        // Refresh data when tab becomes active
        refreshAppointments();
    }
}

// API Call wrapper with error handling and caching
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Check cache first for GET requests
    if (!options.method || options.method === 'GET') {
        if (appointmentsState.dataCache.has(cacheKey)) {
            const cached = appointmentsState.dataCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 30000) { // 30 second cache
                return cached.data;
            }
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
        
        // Cache successful GET responses
        if (!options.method || options.method === 'GET') {
            appointmentsState.dataCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
        }
        
        return data;
        
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        
        // Return cached data if available (even if expired)
        if (appointmentsState.dataCache.has(cacheKey)) {
            console.log('Returning cached data due to API failure');
            return appointmentsState.dataCache.get(cacheKey).data;
        }
        
        throw error;
    }
}

// Utility Functions

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

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

async function getCurrentUser() {
    try {
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

function getAuthToken() {
    return localStorage.getItem('userToken') || 'demo-token';
}

function showLoadingState() {
    document.body.classList.add('loading');
}

function hideLoadingState() {
    document.body.classList.remove('loading');
}

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
    setTimeout(() => errorDiv.remove(), 5000);
}

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
    setTimeout(() => notification.remove(), 3000);
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear intervals and WebSocket
        if (appointmentsState.refreshInterval) {
            clearInterval(appointmentsState.refreshInterval);
        }
        if (appointmentsState.websocket) {
            appointmentsState.websocket.close();
        }
        
        // Clear user session
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        
        // Redirect to login page
        window.location.href = '../../index.html';
    }
}

// Mark all notifications as read via API
async function markAllNotificationsRead() {
    try {
        await apiCall(`${API_ENDPOINTS.NOTIFICATIONS}/read-all`, { method: 'POST' });
        await loadNotifications();
        showUpdateNotification('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Failed to mark notifications as read:', error);
        showError('Failed to update notifications');
    }
}

// Export functions for global access
window.appointmentsPage = {
    viewAppointmentDetails,
    closeAppointmentDetailsModal,
    editAppointment,
    closeEditAppointmentModal,
    saveAppointmentChanges,
    cancelAppointment,
    refreshAppointments,
    exportAppointments,
    clearFilters,
    applyFilters,
    handleLogout,
    markAllNotificationsRead
};