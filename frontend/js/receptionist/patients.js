// Patients Management JavaScript

// Global variables
let patients = [];
let filteredPatients = [];
let currentPage = 1;
const patientsPerPage = 10;
let currentSort = 'name';
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const patientsTableBody = document.getElementById('patients-table-body');
const totalPatientsElement = document.getElementById('total-patients');
const newPatientsTodayElement = document.getElementById('new-patients-today');
const patientsAppointmentsTodayElement = document.getElementById('patients-appointments-today');
const followUpPatientsElement = document.getElementById('follow-up-patients');
const patientSearchElement = document.getElementById('patientSearch');
const statusFilterElement = document.getElementById('statusFilter');
const sortByElement = document.getElementById('sortBy');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const paginationNumbers = document.getElementById('pagination-numbers');
const paginationInfo = document.getElementById('pagination-info');

// Backend API Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // Replace with your actual backend URL
const API_ENDPOINTS = {
    PATIENTS: `${API_BASE_URL}/patients`,
    STATISTICS: `${API_BASE_URL}/patients/statistics`,
    CREATE_PATIENT: `${API_BASE_URL}/patients`
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
    loadPatientsData();
    loadStatistics();
    
    // Set up real-time updates
    setupRealTimeUpdates();
});

function initializePage() {
    // Set user info in header and sidebar
    const user = getCurrentUser();
    if (user) {
        document.getElementById('header-user-name').textContent = user.name;
        document.getElementById('header-user-role').textContent = 'Doctor';
        document.getElementById('sidebar-user-name').textContent = user.name;
        document.getElementById('sidebar-user-role').textContent = 'Doctor';
    }
    
    // Initialize notifications
    loadNotifications();
}

function setupEventListeners() {
    // Search functionality
    patientSearchElement.addEventListener('input', debounce(function() {
        searchQuery = patientSearchElement.value.toLowerCase();
        filterAndSortPatients();
    }, 300));
    
    // Filter and sort
    statusFilterElement.addEventListener('change', function() {
        currentFilter = statusFilterElement.value;
        filterAndSortPatients();
    });
    
    sortByElement.addEventListener('change', function() {
        currentSort = sortByElement.value;
        filterAndSortPatients();
    });
    
    // Pagination
    prevPageButton.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderPatientsTable();
        }
    });
    
    nextPageButton.addEventListener('click', function() {
        const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderPatientsTable();
        }
    });
    
    // Global search
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', debounce(function() {
            const query = globalSearch.value.toLowerCase();
            // This would typically search across the entire application
            console.log('Global search:', query);
        }, 500));
    }
    
    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            document.querySelector('.main-sidebar').classList.add('active');
            sidebarOverlay.classList.add('active');
        });
    }
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', function() {
            document.querySelector('.main-sidebar').classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            document.querySelector('.main-sidebar').classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }
}

// Load patients data from Backend API
async function loadPatientsData() {
    try {
        showLoadingState();
        const response = await fetch(API_ENDPOINTS.PATIENTS, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        patients = data.patients || data; // Handle different response formats
        filterAndSortPatients();
    } catch (error) {
        console.error('Error loading patients:', error);
        showErrorState('Failed to load patients. Please check your connection and try again.');
    }
}

// Load statistics from Backend API
async function loadStatistics() {
    try {
        const response = await fetch(API_ENDPOINTS.STATISTICS, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stats = await response.json();
        updateStatistics(stats);
    } catch (error) {
        console.error('Error loading statistics:', error);
        showNotification('Failed to load statistics', 'error');
    }
}

// Update statistics display
function updateStatistics(stats) {
    if (totalPatientsElement) totalPatientsElement.textContent = stats.totalPatients?.toLocaleString() || '0';
    if (newPatientsTodayElement) newPatientsTodayElement.textContent = stats.newPatientsToday || '0';
    if (patientsAppointmentsTodayElement) patientsAppointmentsTodayElement.textContent = stats.appointmentsToday || '0';
    if (followUpPatientsElement) followUpPatientsElement.textContent = stats.followUpRequired || '0';
    
    // Update trends from API data
    document.getElementById('patients-trend').textContent = stats.patientsTrend || '+0%';
    document.getElementById('new-patients-trend').textContent = stats.newPatientsTrend || '+0%';
    document.getElementById('appointments-trend').textContent = stats.appointmentsTrend || '+0%';
    document.getElementById('follow-up-trend').textContent = stats.followUpTrend || '+0%';
}

// Filter and sort patients based on current criteria
function filterAndSortPatients() {
    // Reset to first page when filtering
    currentPage = 1;
    
    // Filter by search query
    filteredPatients = patients.filter(patient => {
        const matchesSearch = 
            patient.firstName?.toLowerCase().includes(searchQuery) ||
            patient.lastName?.toLowerCase().includes(searchQuery) ||
            patient.phone?.includes(searchQuery) ||
            patient.patientId?.toLowerCase().includes(searchQuery) ||
            patient.crNumber?.toLowerCase().includes(searchQuery);
        
        const matchesFilter = currentFilter === 'all' || patient.status === currentFilter;
        
        return matchesSearch && matchesFilter;
    });
    
    // Sort patients
    filteredPatients.sort((a, b) => {
        switch (currentSort) {
            case 'name':
                return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
            case 'recent':
                return new Date(b.registerDate) - new Date(a.registerDate);
            case 'appointments':
                return (b.appointmentCount || 0) - (a.appointmentCount || 0);
            default:
                return 0;
        }
    });
    
    renderPatientsTable();
}

// Render patients table
function renderPatientsTable() {
    if (!patientsTableBody) return;
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);
    const startIndex = (currentPage - 1) * patientsPerPage;
    const endIndex = Math.min(startIndex + patientsPerPage, filteredPatients.length);
    const currentPatients = filteredPatients.slice(startIndex, endIndex);
    
    // Update pagination info
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredPatients.length} patients`;
    }
    
    // Update pagination buttons
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
    
    // Generate pagination numbers
    if (paginationNumbers) {
        paginationNumbers.innerHTML = '';
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        // Adjust if we're near the end
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `pagination-number ${i === currentPage ? 'active' : ''}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                renderPatientsTable();
            });
            paginationNumbers.appendChild(pageButton);
        }
    }
    
    // Render table rows
    if (currentPatients.length === 0) {
        patientsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading-state">
                        <i class="fas fa-search"></i>
                        <p>No patients found matching your criteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let tableHTML = '';
    
    currentPatients.forEach(patient => {
        const fullName = `${patient.firstName} ${patient.lastName}`;
        const initials = `${patient.firstName?.charAt(0) || ''}${patient.lastName?.charAt(0) || ''}`.toUpperCase();
        const age = patient.age || 'N/A';
        const registerDate = patient.registerDate ? formatDate(patient.registerDate) : 'N/A';
        const lastVisit = patient.lastVisit ? formatDate(patient.lastVisit) : 'Never';
        const crNumber = patient.crNumber || patient.patientId || 'N/A';
        
        tableHTML += `
            <tr>
                <td>
                    <div class="patient-info">
                        <div class="patient-avatar">${initials}</div>
                        <div class="patient-details">
                            <div class="patient-name">${fullName}</div>
                            <div class="patient-id">CR: ${crNumber}</div>
                        </div>
                    </div>
                </td>
                <td>${patient.phone || 'N/A'}</td>
                <td>${age} years</td>
                <td>${registerDate}</td>
                <td>${lastVisit}</td>
                <td>
                    <span class="status-badge ${patient.status || 'active'}">${patient.status || 'active'}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon primary" onclick="viewPatientDetails('${patient.id || patient._id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon warning" onclick="editPatient('${patient.id || patient._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="deletePatient('${patient.id || patient._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    patientsTableBody.innerHTML = tableHTML;
}

// Show loading state in table
function showLoadingState() {
    if (patientsTableBody) {
        patientsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading patients...</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Show error state in table
function showErrorState(message) {
    if (patientsTableBody) {
        patientsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${message}</p>
                        <button class="btn btn-primary mt-2" onclick="loadPatientsData()">Retry</button>
                    </div>
                </td>
            </tr>
        `;
    }
}

// View patient details
function viewPatientDetails(patientId) {
    const patient = patients.find(p => (p.id === patientId) || (p._id === patientId));
    if (!patient) return;
    
    const modal = document.getElementById('patientDetailsModal');
    const detailsContainer = document.getElementById('patientDetails');
    
    if (!modal || !detailsContainer) return;
    
    const fullName = `${patient.firstName} ${patient.lastName}`;
    const age = patient.age || 'N/A';
    const registerDate = patient.registerDate ? formatDate(patient.registerDate) : 'N/A';
    const lastVisit = patient.lastVisit ? formatDate(patient.lastVisit) : 'Never';
    const nextAppointment = patient.nextAppointment ? formatDate(patient.nextAppointment) : 'None scheduled';
    const crNumber = patient.crNumber || patient.patientId || 'N/A';
    
    detailsContainer.innerHTML = `
        <div class="detail-section">
            <h4>Personal Information</h4>
            <div class="detail-row">
                <div class="detail-label">Full Name:</div>
                <div class="detail-value">${fullName}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Patient CR:</div>
                <div class="detail-value">${crNumber}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Age:</div>
                <div class="detail-value">${age} years</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Gender:</div>
                <div class="detail-value">${patient.gender || 'Not provided'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Register Date:</div>
                <div class="detail-value">${registerDate}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Contact Information</h4>
            <div class="detail-row">
                <div class="detail-label">Phone:</div>
                <div class="detail-value">${patient.phone || 'Not provided'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Address:</div>
                <div class="detail-value">${patient.address || 'Not provided'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Woreda:</div>
                <div class="detail-value">${patient.woreda || 'Not provided'}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Medical Information</h4>
            <div class="detail-row">
                <div class="detail-label">Medical History:</div>
                <div class="detail-value">${patient.medicalHistory || 'None recorded'}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Visit Information</h4>
            <div class="detail-row">
                <div class="detail-label">Status:</div>
                <div class="detail-value"><span class="status-badge ${patient.status || 'active'}">${patient.status || 'active'}</span></div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Last Visit:</div>
                <div class="detail-value">${lastVisit}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Next Appointment:</div>
                <div class="detail-value">${nextAppointment}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Total Appointments:</div>
                <div class="detail-value">${patient.appointmentCount || 0}</div>
            </div>
        </div>
    `;
    
    // Set up action buttons
    document.getElementById('editPatientBtn').onclick = () => editPatient(patientId);
    document.getElementById('scheduleAppointmentBtn').onclick = () => scheduleAppointment(patientId);
    document.getElementById('deactivatePatientBtn').onclick = () => deactivatePatient(patientId);
    
    modal.classList.remove('hidden');
}

// Hide patient details modal
function hidePatientDetailsModal() {
    const modal = document.getElementById('patientDetailsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Edit patient
async function editPatient(patientId) {
    const patient = patients.find(p => (p.id === patientId) || (p._id === patientId));
    if (!patient) return;

    // In a real application, this would open an edit form with current data
    // For now, we'll show a simple prompt for demonstration
    const newAge = prompt('Enter new age:', patient.age);
    if (newAge && !isNaN(newAge)) {
        try {
            const response = await fetch(`${API_ENDPOINTS.PATIENTS}/${patientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ age: parseInt(newAge) })
            });

            if (response.ok) {
                showNotification('Patient updated successfully', 'success');
                loadPatientsData(); // Refresh the data
            } else {
                throw new Error('Failed to update patient');
            }
        } catch (error) {
            console.error('Error updating patient:', error);
            showNotification('Failed to update patient', 'error');
        }
    }
    hidePatientDetailsModal();
}

// Schedule appointment for patient
function scheduleAppointment(patientId) {
    // Redirect to appointments page with patient pre-selected
    window.location.href = `appointments.html?patientId=${patientId}`;
}

// Deactivate patient
async function deactivatePatient(patientId) {
    if (confirm('Are you sure you want to deactivate this patient? They will no longer be able to schedule appointments.')) {
        try {
            const response = await fetch(`${API_ENDPOINTS.PATIENTS}/${patientId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ status: 'inactive' })
            });

            if (response.ok) {
                showNotification('Patient deactivated successfully', 'success');
                loadPatientsData(); // Refresh the list
            } else {
                throw new Error('Failed to deactivate patient');
            }
        } catch (error) {
            console.error('Error deactivating patient:', error);
            showNotification('Failed to deactivate patient', 'error');
        }
        hidePatientDetailsModal();
    }
}

// Delete patient
async function deletePatient(patientId) {
    if (confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
        try {
            const response = await fetch(`${API_ENDPOINTS.PATIENTS}/${patientId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            if (response.ok) {
                showNotification('Patient deleted successfully', 'success');
                loadPatientsData(); // Refresh the list
            } else {
                throw new Error('Failed to delete patient');
            }
        } catch (error) {
            console.error('Error deleting patient:', error);
            showNotification('Failed to delete patient', 'error');
        }
    }
}

// Show new patient modal
function showNewPatientModal() {
    const modal = document.getElementById('newPatientModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('newPatientForm').reset();
    }
}

// Hide new patient modal
function hideNewPatientModal() {
    const modal = document.getElementById('newPatientModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Create new patient
async function createNewPatient() {
    const form = document.getElementById('newPatientForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const newPatient = {
        firstName: document.getElementById('patientFirstName').value,
        lastName: document.getElementById('patientLastName').value,
        phone: document.getElementById('patientPhone').value,
        age: parseInt(document.getElementById('patientAge').value),
        gender: document.getElementById('patientGender').value,
        address: document.getElementById('patientAddress').value,
        woreda: document.getElementById('patientWoreda').value,
        medicalHistory: document.getElementById('patientMedicalHistory').value,
        status: 'active'
    };
    
    try {
        const response = await fetch(API_ENDPOINTS.CREATE_PATIENT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(newPatient)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const createdPatient = await response.json();
        hideNewPatientModal();
        loadPatientsData(); // Refresh the list
        loadStatistics(); // Refresh statistics
        showNotification('Patient added successfully', 'success');
        
    } catch (error) {
        console.error('Error creating patient:', error);
        showNotification(`Failed to add patient: ${error.message}`, 'error');
    }
}

// Refresh patients list
function refreshPatients() {
    loadPatientsData();
    loadStatistics();
    showNotification('Patients list refreshed', 'info');
}

// Export patients
async function exportPatients() {
    try {
        const response = await fetch(`${API_ENDPOINTS.PATIENTS}/export`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'patients-export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showNotification('Patients exported successfully', 'success');
        } else {
            throw new Error('Failed to export patients');
        }
    } catch (error) {
        console.error('Error exporting patients:', error);
        showNotification('Failed to export patients', 'error');
    }
}

// Set up real-time updates
function setupRealTimeUpdates() {
    // Refresh data every 30 seconds for real-time updates
    setInterval(() => {
        loadStatistics();
        // Optionally refresh patient list if needed
        // loadPatientsData();
    }, 30000);
}

// Utility function to format dates
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Debounce function for search
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

// Get authentication token
function getAuthToken() {
    // Replace with your actual token retrieval logic
    return localStorage.getItem('authToken') || 'your-auth-token-here';
}

// Load notifications from API
async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const notifications = await response.json();
            updateNotificationDisplay(notifications);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Update notification display
function updateNotificationDisplay(notifications) {
    const notificationList = document.getElementById('notificationList');
    const notificationCount = document.getElementById('notificationCount');
    
    if (!notificationList || !notificationCount) return;
    
    const unreadCount = notifications.filter(n => n.unread).length;
    
    if (unreadCount > 0) {
        notificationCount.textContent = unreadCount;
        notificationCount.classList.remove('hidden');
    } else {
        notificationCount.classList.add('hidden');
    }
    
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-bell-slash"></i>
                <p>No new notifications</p>
            </div>
        `;
        return;
    }
    
    let notificationsHTML = '';
    
    notifications.forEach(notification => {
        notificationsHTML += `
            <div class="notification-item ${notification.unread ? 'unread' : ''}">
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-desc">${notification.description}</div>
                    <div class="notification-time">${formatTime(notification.timestamp)}</div>
                </div>
            </div>
        `;
    });
    
    notificationList.innerHTML = notificationsHTML;
}

// Format time for notifications
function formatTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
}

// Mark all notifications as read
async function markAllNotificationsRead() {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (response.ok) {
            const notificationCount = document.getElementById('notificationCount');
            if (notificationCount) {
                notificationCount.classList.add('hidden');
            }
            
            const notificationItems = document.querySelectorAll('.notification-item');
            notificationItems.forEach(item => {
                item.classList.remove('unread');
            });
            
            showNotification('All notifications marked as read', 'info');
        }
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
}

// Show notification toast
function showNotification(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-toast-styles';
        styles.textContent = `
            .notification-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                padding: 1rem 1.5rem;
                z-index: 1200;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                border-left: 4px solid var(--primary);
                animation: slideInRight 0.3s ease;
            }
            .notification-toast.success {
                border-left-color: var(--secondary);
            }
            .notification-toast.error {
                border-left-color: var(--danger);
            }
            .notification-toast.info {
                border-left-color: var(--info);
            }
            .toast-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            .toast-close {
                background: none;
                border: none;
                color: var(--gray);
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 4px;
            }
            .toast-close:hover {
                background: var(--gray-light);
            }
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Mock user function (replace with actual user management)
function getCurrentUser() {
    // This should be replaced with actual user data from your auth system
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        return JSON.parse(userData);
    }
    
    return {
        name: 'Receptionist',
        role: 'Receptionist'
    };
}

// Mock logout function
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear authentication data
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        
        // Redirect to login page
        window.location.href = '../../index.html';
    }
}