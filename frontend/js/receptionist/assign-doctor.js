// API Configuration
const API_BASE_URL = 'https://api.dentalclinic.com/v1';
const API_ENDPOINTS = {
    ASSIGNMENTS: '/assignments',
    ASSIGNMENTS_STATS: '/assignments/stats',
    DOCTORS: '/doctors',
    DOCTORS_AVAILABLE: '/doctors/available',
    APPOINTMENTS: '/appointments',
    NOTIFICATIONS: '/notifications',
    AUTO_ASSIGN: '/assignments/auto-assign'
};

// Global State
let assignDoctorState = {
    currentPage: 1,
    itemsPerPage: 10,
    filters: {
        priority: 'all',
        service: 'all',
        time: 'all'
    },
    selectedAssignment: null,
    selectedDoctor: null,
    isOnline: true,
    refreshInterval: null,
    dataCache: new Map(),
    lastUpdate: null,
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

// Initialize assign doctor page
document.addEventListener('DOMContentLoaded', function() {
    initializeAssignDoctorPage();
    setupEventListeners();
    initializeWebSocket();
    startRealTimeUpdates();
});

// Initialize assign doctor page
async function initializeAssignDoctorPage() {
    try {
        // Set current user
        const user = await getCurrentUser();
        document.getElementById('sidebar-user-name').textContent = user.name;
        document.getElementById('header-user-name').textContent = user.name;
        
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
    document.getElementById('priorityFilter').addEventListener('change', updateFilters);
    document.getElementById('serviceFilter').addEventListener('change', updateFilters);
    document.getElementById('timeFilter').addEventListener('change', updateFilters);
    
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
        await loadPendingAssignments();
    }
}

// Clear search
function clearSearch() {
    globalSearch.value = '';
    searchClear.classList.add('hidden');
    loadPendingAssignments();
}

// Perform search with API
async function performSearch(searchTerm) {
    try {
        const results = await apiCall(`${API_ENDPOINTS.ASSIGNMENTS}/search?q=${encodeURIComponent(searchTerm)}`);
        displayPendingAssignments(results.data || results);
        
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
            loadPendingAssignments(),
            loadAvailableDoctors(),
            loadRecentAssignments(),
            loadAssignmentsStats(),
            loadServices(),
            loadNotifications()
        ]);
        
        assignDoctorState.lastUpdate = new Date();
        updateLastUpdatedTime();
        
        hideLoadingState();
        
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showError('Failed to load data. Please try again.');
        hideLoadingState();
    }
}

// Load pending assignments from API
async function loadPendingAssignments() {
    const assignmentsList = document.getElementById('pending-assignments-list');
    
    try {
        // Build query parameters
        const params = new URLSearchParams();
        
        // Add filters (excluding 'all' values)
        if (assignDoctorState.filters.priority !== 'all') {
            params.append('priority', assignDoctorState.filters.priority);
        }
        if (assignDoctorState.filters.service !== 'all') {
            params.append('service', assignDoctorState.filters.service);
        }
        if (assignDoctorState.filters.time !== 'all') {
            params.append('maxWaitTime', assignDoctorState.filters.time);
        }
        
        const endpoint = params.toString() 
            ? `${API_ENDPOINTS.ASSIGNMENTS}/pending?${params.toString()}`
            : `${API_ENDPOINTS.ASSIGNMENTS}/pending`;
            
        const assignments = await apiCall(endpoint);
        displayPendingAssignments(assignments.data || assignments);
        
    } catch (error) {
        console.error('Failed to load pending assignments:', error);
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

// Display pending assignments
function displayPendingAssignments(assignments) {
    const assignmentsList = document.getElementById('pending-assignments-list');
    
    if (assignments.length === 0) {
        assignmentsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h4>All caught up!</h4>
                <p>There are no pending assignments at the moment.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    assignments.forEach(assignment => {
        const waitingTime = calculateWaitingTime(assignment.arrivalTime);
        
        html += `
            <div class="assignment-item priority-${assignment.priority}" 
                 onclick="openAssignDoctorModal('${assignment.id}')">
                <div class="assignment-content">
                    <div class="assignment-patient-name">${assignment.patientName}</div>
                    <div class="assignment-service">${assignment.service}</div>
                    <div class="assignment-meta">
                        <span class="waiting-time">
                            <i class="fas fa-clock"></i>
                            ${waitingTime}
                        </span>
                        <span class="priority">
                            <span class="priority-badge ${assignment.priority}">
                                ${assignment.priority} priority
                            </span>
                        </span>
                    </div>
                </div>
                <div class="assignment-actions">
                    <button class="btn btn-icon btn-outline" 
                            onclick="event.stopPropagation(); openAssignDoctorModal('${assignment.id}')"
                            title="Assign Doctor">
                        <i class="fas fa-user-md"></i>
                    </button>
                    <button class="btn btn-icon btn-outline" 
                            onclick="event.stopPropagation(); viewAssignmentDetails('${assignment.id}')"
                            title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    assignmentsList.innerHTML = html;
}

// Load available doctors from API
async function loadAvailableDoctors() {
    const doctorsList = document.getElementById('available-doctors-list');
    
    try {
        const doctors = await apiCall(API_ENDPOINTS.DOCTORS_AVAILABLE);
        displayAvailableDoctors(doctors.data || doctors);
        
    } catch (error) {
        console.error('Failed to load available doctors:', error);
        doctorsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Failed to load doctors</h4>
                <p>Please try refreshing the page.</p>
                <button class="btn btn-sm btn-outline" onclick="loadAvailableDoctors()">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
        throw error;
    }
}

// Display available doctors
function displayAvailableDoctors(doctors) {
    const doctorsList = document.getElementById('available-doctors-list');
    
    if (doctors.length === 0) {
        doctorsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-md"></i>
                <h4>No doctors available</h4>
                <p>All doctors are currently busy or offline.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    doctors.forEach(doctor => {
        const workloadPercentage = calculateWorkloadPercentage(doctor.currentPatients, doctor.maxPatients);
        const workloadClass = getWorkloadClass(workloadPercentage);
        
        html += `
            <div class="doctor-item" onclick="viewDoctorDetails('${doctor.id}')">
                <div class="doctor-avatar-small">
                    ${getDoctorInitials(doctor.name)}
                </div>
                <div class="doctor-info">
                    <div class="doctor-name">Dr. ${doctor.name}</div>
                    <div class="doctor-specialty">${doctor.specialization}</div>
                    <div class="doctor-availability">
                        <span class="availability-dot ${doctor.status}"></span>
                        <span>${formatDoctorStatus(doctor.status)}</span>
                    </div>
                </div>
                <div class="doctor-workload">
                    <div class="workload-bar">
                        <div class="workload-fill ${workloadClass}" style="width: ${workloadPercentage}%"></div>
                    </div>
                    <div class="workload-text">${doctor.currentPatients}/${doctor.maxPatients} patients</div>
                </div>
            </div>
        `;
    });
    
    doctorsList.innerHTML = html;
}

// Load recent assignments from API
async function loadRecentAssignments() {
    const tableBody = document.getElementById('assignmentsTableBody');
    
    try {
        const assignments = await apiCall(`${API_ENDPOINTS.ASSIGNMENTS}/recent?limit=10`);
        displayRecentAssignments(assignments.data || assignments);
        
    } catch (error) {
        console.error('Failed to load recent assignments:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>Failed to load recent assignments</h4>
                        <p>Please try refreshing the page.</p>
                        <button class="btn btn-sm btn-outline" onclick="loadRecentAssignments()">
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

// Display recent assignments in table
function displayRecentAssignments(assignments) {
    const tableBody = document.getElementById('assignmentsTableBody');
    
    if (assignments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <h4>No recent assignments</h4>
                        <p>Recent assignments will appear here.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    assignments.forEach(assignment => {
        html += `
            <tr>
                <td>${assignment.patientName}</td>
                <td>${assignment.service}</td>
                <td>${assignment.doctorName ? `Dr. ${assignment.doctorName}` : 'Not Assigned'}</td>
                <td>${formatRelativeTime(assignment.assignedAt)}</td>
                <td>
                    <span class="status-badge ${assignment.status}">
                        ${assignment.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-outline" 
                                onclick="reassignDoctor('${assignment.id}')"
                                title="Reassign">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="btn btn-icon btn-outline" 
                                onclick="viewAssignmentDetails('${assignment.id}')"
                                title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Load assignments statistics from API
async function loadAssignmentsStats() {
    try {
        const stats = await apiCall(API_ENDPOINTS.ASSIGNMENTS_STATS);
        
        document.getElementById('total-pending').textContent = stats.pending || 0;
        document.getElementById('high-priority').textContent = stats.highPriority || 0;
        document.getElementById('assigned-today').textContent = stats.assignedToday || 0;
        document.getElementById('available-doctors').textContent = stats.availableDoctors || 0;
        
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load services for filter
async function loadServices() {
    try {
        const services = await apiCall('/services');
        const serviceSelect = document.getElementById('serviceFilter');
        
        let options = '<option value="all">All Services</option>';
        
        services.forEach(service => {
            options += `<option value="${service.id}">${service.name}</option>`;
        });
        
        serviceSelect.innerHTML = options;
        
    } catch (error) {
        console.error('Failed to load services:', error);
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

// Open assign doctor modal
async function openAssignDoctorModal(assignmentId) {
    try {
        const [assignment, availableDoctors] = await Promise.all([
            apiCall(`${API_ENDPOINTS.ASSIGNMENTS}/${assignmentId}`),
            apiCall(API_ENDPOINTS.DOCTORS_AVAILABLE)
        ]);
        
        assignDoctorState.selectedAssignment = assignment;
        displayAssignmentDetails(assignment);
        displayDoctorSelection(availableDoctors.data || availableDoctors);
        
        document.getElementById('assignDoctorModal').classList.add('show');
        
    } catch (error) {
        console.error('Failed to open assign doctor modal:', error);
        showError('Failed to load assignment details');
    }
}

// Close assign doctor modal
function closeAssignDoctorModal() {
    document.getElementById('assignDoctorModal').classList.remove('show');
    assignDoctorState.selectedAssignment = null;
    assignDoctorState.selectedDoctor = null;
}

// Display assignment details in modal
function displayAssignmentDetails(assignment) {
    const modalContent = document.getElementById('assignmentDetailsContent');
    const waitingTime = calculateWaitingTime(assignment.arrivalTime);
    
    modalContent.innerHTML = `
        <div class="assignment-info">
            <div class="assignment-patient">
                <div class="patient-avatar">
                    ${getPatientInitials(assignment.patientName)}
                </div>
                <div class="patient-details">
                    <h4>${assignment.patientName}</h4>
                    <p>${assignment.patientPhone} • ${assignment.patientAge || 'N/A'} years old</p>
                </div>
            </div>
            <div class="assignment-meta">
                <div class="meta-item">
                    <div class="meta-label">Service</div>
                    <div class="meta-value">${assignment.service}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Priority</div>
                    <div class="meta-value">
                        <span class="priority-badge ${assignment.priority}">
                            ${assignment.priority}
                        </span>
                    </div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Waiting Time</div>
                    <div class="meta-value">${waitingTime}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Arrival Time</div>
                    <div class="meta-value">${formatTime(assignment.arrivalTime)}</div>
                </div>
            </div>
            ${assignment.notes ? `
            <div class="assignment-notes">
                <div class="meta-label">Notes</div>
                <div class="meta-value">${assignment.notes}</div>
            </div>
            ` : ''}
        </div>
    `;
}

// Display doctor selection in modal
function displayDoctorSelection(doctors) {
    const doctorsGrid = document.getElementById('doctorsSelectionGrid');
    
    let html = '';
    doctors.forEach(doctor => {
        const workloadPercentage = calculateWorkloadPercentage(doctor.currentPatients, doctor.maxPatients);
        const workloadClass = getWorkloadClass(workloadPercentage);
        const isSelected = assignDoctorState.selectedDoctor?.id === doctor.id;
        
        html += `
            <div class="doctor-card ${isSelected ? 'selected' : ''}" 
                 onclick="selectDoctor('${doctor.id}')">
                <div class="doctor-avatar">
                    ${getDoctorInitials(doctor.name)}
                </div>
                <div class="doctor-name">Dr. ${doctor.name}</div>
                <div class="doctor-specialization">${doctor.specialization}</div>
                <div class="doctor-status ${doctor.status}">
                    ${formatDoctorStatus(doctor.status)}
                </div>
                <div class="doctor-workload">
                    Workload: ${workloadPercentage}%
                    <div class="workload-bar">
                        <div class="workload-fill ${workloadClass}" style="width: ${workloadPercentage}%"></div>
                    </div>
                </div>
                ${doctor.currentAppointment ? `
                <div class="doctor-current">
                    Current: ${doctor.currentAppointment.service}
                </div>
                ` : ''}
            </div>
        `;
    });
    
    doctorsGrid.innerHTML = html;
}

// Select doctor for assignment
function selectDoctor(doctorId) {
    const doctorCards = document.querySelectorAll('.doctor-card');
    doctorCards.forEach(card => card.classList.remove('selected'));
    
    const selectedCard = document.querySelector(`.doctor-card[onclick="selectDoctor('${doctorId}')"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Find the selected doctor
    const doctors = Array.from(doctorCards).map(card => {
        const match = card.getAttribute('onclick').match(/selectDoctor\('([^']+)'\)/);
        return match ? match[1] : null;
    }).filter(id => id === doctorId);
    
    if (doctors.length > 0) {
        assignDoctorState.selectedDoctor = { id: doctorId };
    }
}

// Confirm assignment
async function confirmAssignment() {
    if (!assignDoctorState.selectedAssignment || !assignDoctorState.selectedDoctor) {
        showError('Please select a doctor to assign');
        return;
    }
    
    try {
        await apiCall(`${API_ENDPOINTS.ASSIGNMENTS}/${assignDoctorState.selectedAssignment.id}/assign`, {
            method: 'POST',
            body: JSON.stringify({
                doctorId: assignDoctorState.selectedDoctor.id
            })
        });
        
        closeAssignDoctorModal();
        
        // Refresh data
        await Promise.all([
            loadPendingAssignments(),
            loadAvailableDoctors(),
            loadRecentAssignments(),
            loadAssignmentsStats()
        ]);
        
        showUpdateNotification('Doctor assigned successfully', 'success');
        
    } catch (error) {
        console.error('Failed to assign doctor:', error);
        showError('Failed to assign doctor. Please try again.');
    }
}

// Auto assign all pending assignments
async function autoAssignAll() {
    if (!confirm('Are you sure you want to auto-assign all pending assignments?')) {
        return;
    }
    
    const btn = event?.target?.closest('.btn');
    if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
    }
    
    try {
        await apiCall(API_ENDPOINTS.AUTO_ASSIGN, {
            method: 'POST'
        });
        
        // Refresh data
        await Promise.all([
            loadPendingAssignments(),
            loadAvailableDoctors(),
            loadRecentAssignments(),
            loadAssignmentsStats()
        ]);
        
        if (btn) {
            showUpdateNotification('All assignments processed successfully', 'success');
        }
    } catch (error) {
        console.error('Failed to auto-assign:', error);
        if (btn) {
            showUpdateNotification('Failed to auto-assign assignments', 'error');
        }
    } finally {
        if (btn) {
            btn.classList.remove('syncing');
            btn.disabled = false;
        }
    }
}

// View assignment details
async function viewAssignmentDetails(assignmentId) {
    try {
        const assignment = await apiCall(`${API_ENDPOINTS.ASSIGNMENTS}/${assignmentId}`);
        
        // For now, just show a notification with basic info
        showUpdateNotification(`Assignment details: ${assignment.patientName} - ${assignment.service}`, 'info');
        
    } catch (error) {
        console.error('Failed to load assignment details:', error);
        showError('Failed to load assignment details');
    }
}

// View doctor details
async function viewDoctorDetails(doctorId) {
    try {
        const doctor = await apiCall(`${API_ENDPOINTS.DOCTORS}/${doctorId}`);
        const modalContent = document.getElementById('doctorDetailsContent');
        
        const workloadPercentage = calculateWorkloadPercentage(doctor.currentPatients, doctor.maxPatients);
        const workloadClass = getWorkloadClass(workloadPercentage);
        
        modalContent.innerHTML = `
            <div class="doctor-details">
                <div class="doctor-header" style="text-align: center; margin-bottom: 2rem;">
                    <div class="doctor-avatar" style="width: 100px; height: 100px; font-size: 2.5rem; margin: 0 auto 1rem;">
                        ${getDoctorInitials(doctor.name)}
                    </div>
                    <h3>Dr. ${doctor.name}</h3>
                    <p class="doctor-specialization">${doctor.specialization}</p>
                    <span class="doctor-status ${doctor.status}">
                        ${formatDoctorStatus(doctor.status)}
                    </span>
                </div>
                
                <div class="doctor-info-grid" style="display: grid; gap: 1.5rem;">
                    <div class="info-section">
                        <h4>Workload Information</h4>
                        <div class="workload-display">
                            <div class="workload-bar" style="width: 100%; height: 10px;">
                                <div class="workload-fill ${workloadClass}" style="width: ${workloadPercentage}%"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                                <span>Current Patients: ${doctor.currentPatients}</span>
                                <span>Max Capacity: ${doctor.maxPatients}</span>
                            </div>
                            <div style="text-align: center; margin-top: 0.5rem; font-weight: 600;">
                                ${workloadPercentage}% Utilization
                            </div>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h4>Specialization & Skills</h4>
                        <p>${doctor.specialization}</p>
                        ${doctor.skills ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                            ${doctor.skills.map(skill => `
                                <span style="background: var(--primary); color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">
                                    ${skill}
                                </span>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="info-section">
                        <h4>Contact Information</h4>
                        <p><strong>Email:</strong> ${doctor.email}</p>
                        <p><strong>Extension:</strong> ${doctor.extension || 'N/A'}</p>
                    </div>
                    
                    ${doctor.currentAppointment ? `
                    <div class="info-section">
                        <h4>Current Appointment</h4>
                        <p><strong>Patient:</strong> ${doctor.currentAppointment.patientName}</p>
                        <p><strong>Service:</strong> ${doctor.currentAppointment.service}</p>
                        <p><strong>Started:</strong> ${formatRelativeTime(doctor.currentAppointment.startTime)}</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('doctorDetailsModal').classList.add('show');
        
    } catch (error) {
        console.error('Failed to load doctor details:', error);
        showError('Failed to load doctor details');
    }
}

// Close doctor details modal
function closeDoctorDetailsModal() {
    document.getElementById('doctorDetailsModal').classList.remove('show');
}

// Reassign doctor
async function reassignDoctor(assignmentId) {
    await openAssignDoctorModal(assignmentId);
}

// Update filters and reload data
function updateFilters() {
    assignDoctorState.filters = {
        priority: document.getElementById('priorityFilter').value,
        service: document.getElementById('serviceFilter').value,
        time: document.getElementById('timeFilter').value
    };
    
    loadPendingAssignments();
}

// Apply filters
function applyFilters() {
    updateFilters();
    showUpdateNotification('Filters applied successfully', 'success');
}

// Clear all filters
function clearFilters() {
    document.getElementById('priorityFilter').value = 'all';
    document.getElementById('serviceFilter').value = 'all';
    document.getElementById('timeFilter').value = 'all';
    
    assignDoctorState.filters = {
        priority: 'all',
        service: 'all',
        time: 'all'
    };
    
    loadPendingAssignments();
    
    showUpdateNotification('Filters cleared', 'info');
}

// Refresh assignments
async function refreshAssignments() {
    const btn = event?.target?.closest('.btn');
    if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
    }
    
    try {
        await Promise.all([
            loadPendingAssignments(),
            loadRecentAssignments(),
            loadAssignmentsStats()
        ]);
        
        assignDoctorState.lastUpdate = new Date();
        updateLastUpdatedTime();
        
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

// Refresh doctors
async function refreshDoctors() {
    const btn = event?.target?.closest('.btn');
    if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
    }
    
    try {
        await loadAvailableDoctors();
        
        if (btn) {
            showUpdateNotification('Doctors list refreshed', 'success');
        }
    } catch (error) {
        if (btn) {
            showUpdateNotification('Failed to refresh doctors', 'error');
        }
    } finally {
        if (btn) {
            btn.classList.remove('syncing');
            btn.disabled = false;
        }
    }
}

// Export assignments
async function exportAssignments() {
    try {
        const response = await apiCall(`${API_ENDPOINTS.ASSIGNMENTS}/export`);
        
        // Create download link
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assignments-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showUpdateNotification('Assignments exported successfully', 'success');
        
    } catch (error) {
        console.error('Failed to export assignments:', error);
        showError('Failed to export assignments');
    }
}

// WebSocket for real-time updates
function initializeWebSocket() {
    try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/assignments`;
        
        assignDoctorState.websocket = new WebSocket(wsUrl);
        
        assignDoctorState.websocket.onopen = function() {
            console.log('WebSocket connection established for assignments');
            updateConnectionStatus(true);
        };
        
        assignDoctorState.websocket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            handleRealTimeUpdate(data);
        };
        
        assignDoctorState.websocket.onclose = function() {
            console.log('WebSocket connection closed');
            setTimeout(initializeWebSocket, 5000);
        };
        
        assignDoctorState.websocket.onerror = function(error) {
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
        case 'ASSIGNMENT_CREATED':
        case 'ASSIGNMENT_UPDATED':
        case 'ASSIGNMENT_COMPLETED':
            showRealTimeNotification(update);
            refreshAssignments();
            break;
        case 'DOCTOR_STATUS_CHANGED':
            showRealTimeNotification(update);
            refreshDoctors();
            break;
        case 'STATS_UPDATED':
            loadAssignmentsStats();
            break;
        case 'NEW_NOTIFICATION':
            loadNotifications();
            break;
    }
}

// Show real-time notification
function showRealTimeNotification(update) {
    const messages = {
        'ASSIGNMENT_CREATED': 'New assignment requires doctor',
        'ASSIGNMENT_UPDATED': 'Assignment updated',
        'ASSIGNMENT_COMPLETED': 'Assignment completed',
        'DOCTOR_STATUS_CHANGED': 'Doctor status changed'
    };
    
    showUpdateNotification(messages[update.type] || 'Update received', 'info');
}

// Real-time updates with periodic refresh
function startRealTimeUpdates() {
    // Set up periodic refresh as fallback
    assignDoctorState.refreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && assignDoctorState.isOnline) {
            refreshAssignments();
        }
    }, 60000); // Refresh every 60 seconds as fallback
}

// Handle online/offline status
function handleOnlineStatus() {
    const isOnline = navigator.onLine;
    assignDoctorState.isOnline = isOnline;
    updateConnectionStatus(isOnline);
    
    if (isOnline) {
        // Try to sync data when coming back online
        refreshAssignments();
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
    if (assignDoctorState.lastUpdate) {
        lastUpdatedTime.textContent = formatRelativeTime(assignDoctorState.lastUpdate);
    }
}

// Handle visibility change
function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && assignDoctorState.isOnline) {
        // Refresh data when tab becomes active
        refreshAssignments();
    }
}

// Utility Functions

function calculateWaitingTime(arrivalTime) {
    const arrival = new Date(arrivalTime);
    const now = new Date();
    const diffMs = now - arrival;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
        return `${diffMins} min`;
    } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    }
}

function calculateWorkloadPercentage(current, max) {
    return Math.round((current / max) * 100);
}

function getWorkloadClass(percentage) {
    if (percentage < 60) return 'low';
    if (percentage < 85) return 'medium';
    return 'high';
}

function getDoctorInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function getPatientInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function formatDoctorStatus(status) {
    const statusMap = {
        'available': 'Available',
        'busy': 'Busy',
        'offline': 'Offline'
    };
    return statusMap[status] || status;
}

// API Call wrapper (reuse from appointments.js)
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Check cache first for GET requests
    if (!options.method || options.method === 'GET') {
        if (assignDoctorState.dataCache.has(cacheKey)) {
            const cached = assignDoctorState.dataCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 30000) {
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
            assignDoctorState.dataCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
        }
        
        return data;
        
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        
        // Return cached data if available
        if (assignDoctorState.dataCache.has(cacheKey)) {
            console.log('Returning cached data due to API failure');
            return assignDoctorState.dataCache.get(cacheKey).data;
        }
        
        throw error;
    }
}

// Reuse utility functions from appointments.js
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
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

async function getCurrentUser() {
    try {
        return await apiCall('/user/me');
    } catch (error) {
        const stored = localStorage.getItem('userData');
        if (stored) return JSON.parse(stored);
        return { name: 'Receptionist', role: 'receptionist' };
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
        if (assignDoctorState.refreshInterval) {
            clearInterval(assignDoctorState.refreshInterval);
        }
        if (assignDoctorState.websocket) {
            assignDoctorState.websocket.close();
        }
        
        // Clear user session
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        
        // Redirect to login page
        window.location.href = '../../index.html';
    }
}

// Mark all notifications as read
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
window.assignDoctorPage = {
    openAssignDoctorModal,
    closeAssignDoctorModal,
    selectDoctor,
    confirmAssignment,
    autoAssignAll,
    viewAssignmentDetails,
    viewDoctorDetails,
    closeDoctorDetailsModal,
    reassignDoctor,
    refreshAssignments,
    refreshDoctors,
    exportAssignments,
    clearFilters,
    applyFilters,
    handleLogout,
    markAllNotificationsRead
};