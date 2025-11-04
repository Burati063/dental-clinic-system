// Medical Records Management JavaScript

// Global variables
let medicalRecords = [];
let filteredRecords = [];
let patients = [];
let currentPage = 1;
const recordsPerPage = 10;
let currentSort = 'date';
let currentStatusFilter = 'all';
let searchQuery = '';

// DOM Elements
const recordsTableBody = document.getElementById('records-table-body');
const totalRecordsElement = document.getElementById('total-records');
const recordsTodayElement = document.getElementById('records-today');
const followUpNeededElement = document.getElementById('follow-up-needed');
const completedTreatmentsElement = document.getElementById('completed-treatments');
const recordSearchElement = document.getElementById('recordSearch');
const statusFilterElement = document.getElementById('statusFilter');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const paginationNumbers = document.getElementById('pagination-numbers');
const paginationInfo = document.getElementById('pagination-info');

// Backend API Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const API_ENDPOINTS = {
    RECORDS: `${API_BASE_URL}/medical-records`,
    STATISTICS: `${API_BASE_URL}/medical-records/statistics`,
    PATIENTS: `${API_BASE_URL}/patients`,
    CREATE_RECORD: `${API_BASE_URL}/medical-records`
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
    loadMedicalRecords();
    loadStatistics();
    loadPatients();
    
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
    recordSearchElement.addEventListener('input', debounce(function() {
        searchQuery = recordSearchElement.value.toLowerCase();
        filterAndSortRecords();
    }, 300));
    
    // Filter and sort
    statusFilterElement.addEventListener('change', function() {
        currentStatusFilter = statusFilterElement.value;
        filterAndSortRecords();
    });
    
    // Pagination
    prevPageButton.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderRecordsTable();
        }
    });
    
    nextPageButton.addEventListener('click', function() {
        const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderRecordsTable();
        }
    });
    
    // Global search
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', debounce(function() {
            const query = globalSearch.value.toLowerCase();
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

// Load medical records from Backend API
async function loadMedicalRecords() {
    try {
        showLoadingState();
        const response = await fetch(API_ENDPOINTS.RECORDS, {
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
        medicalRecords = data.records || data;
        filterAndSortRecords();
    } catch (error) {
        console.error('Error loading medical records:', error);
        showErrorState('Failed to load medical records. Please check your connection and try again.');
    }
}

// Load patients for the dropdown
async function loadPatients() {
    try {
        const response = await fetch(API_ENDPOINTS.PATIENTS, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            patients = data.patients || data;
            populatePatientDropdown();
        }
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

// Populate patient dropdown in new record form
function populatePatientDropdown() {
    const patientSelect = document.getElementById('patientSelect');
    if (!patientSelect) return;
    
    patientSelect.innerHTML = '<option value="">Select Patient</option>';
    
    patients.forEach(patient => {
        const option = document.createElement('option');
        option.value = patient.id || patient._id;
        option.textContent = `${patient.firstName} ${patient.lastName} (${patient.phone})`;
        patientSelect.appendChild(option);
    });
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
    if (totalRecordsElement) totalRecordsElement.textContent = stats.totalRecords?.toLocaleString() || '0';
    if (recordsTodayElement) recordsTodayElement.textContent = stats.recordsToday || '0';
    if (followUpNeededElement) followUpNeededElement.textContent = stats.followUpNeeded || '0';
    if (completedTreatmentsElement) completedTreatmentsElement.textContent = stats.completedTreatments || '0';
    
    // Update trends from API data
    document.getElementById('records-trend').textContent = stats.recordsTrend || '+0%';
    document.getElementById('today-trend').textContent = stats.todayTrend || '+0%';
    document.getElementById('follow-up-trend').textContent = stats.followUpTrend || '+0%';
    document.getElementById('treatments-trend').textContent = stats.treatmentsTrend || '+0%';
}

// Filter and sort records based on current criteria
function filterAndSortRecords() {
    // Reset to first page when filtering
    currentPage = 1;
    
    // Filter by search query
    filteredRecords = medicalRecords.filter(record => {
        const patient = patients.find(p => p.id === record.patientId || p._id === record.patientId);
        const patientName = patient ? `${patient.firstName} ${patient.lastName}`.toLowerCase() : '';
        
        const matchesSearch = 
            patientName.includes(searchQuery) ||
            record.treatmentDescription?.toLowerCase().includes(searchQuery) ||
            record.diagnosis?.toLowerCase().includes(searchQuery) ||
            record.treatmentPlan?.toLowerCase().includes(searchQuery);
        
        const matchesStatus = currentStatusFilter === 'all' || record.status === currentStatusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    // Sort records
    filteredRecords.sort((a, b) => {
        switch (currentSort) {
            case 'date':
                return new Date(b.treatmentDate) - new Date(a.treatmentDate);
            case 'patient':
                const patientA = patients.find(p => p.id === a.patientId || p._id === a.patientId);
                const patientB = patients.find(p => p.id === b.patientId || p._id === b.patientId);
                const nameA = patientA ? `${patientA.firstName} ${patientA.lastName}` : '';
                const nameB = patientB ? `${patientB.firstName} ${patientB.lastName}` : '';
                return nameA.localeCompare(nameB);
            default:
                return 0;
        }
    });
    
    renderRecordsTable();
}

// Render records table
function renderRecordsTable() {
    if (!recordsTableBody) return;
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, filteredRecords.length);
    const currentRecords = filteredRecords.slice(startIndex, endIndex);
    
    // Update pagination info
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredRecords.length} records`;
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
                renderRecordsTable();
            });
            paginationNumbers.appendChild(pageButton);
        }
    }
    
    // Render table rows
    if (currentRecords.length === 0) {
        recordsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="loading-state">
                        <i class="fas fa-search"></i>
                        <p>No medical records found matching your criteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let tableHTML = '';
    
    currentRecords.forEach(record => {
        const patient = patients.find(p => p.id === record.patientId || p._id === record.patientId);
        const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
        const patientId = patient ? (patient.crNumber || patient.patientId || 'N/A') : 'N/A';
        const initials = patient ? `${patient.firstName?.charAt(0) || ''}${patient.lastName?.charAt(0) || ''}`.toUpperCase() : '??';
        const treatmentDate = record.treatmentDate ? formatDate(record.treatmentDate) : 'N/A';
        const doctorName = record.doctorName || 'Dr. Unknown';
        const treatmentDescription = record.treatmentDescription || 'No description provided';
        
        tableHTML += `
            <tr>
                <td>
                    <div class="patient-info">
                        <div class="patient-avatar">${initials}</div>
                        <div class="patient-details">
                            <div class="patient-name">${patientName}</div>
                            <div class="patient-id">CR: ${patientId}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="treatment-description" title="${treatmentDescription}">
                        ${treatmentDescription}
                    </div>
                </td>
                <td>${treatmentDate}</td>
                <td>
                    <span class="status-badge ${record.status}">${record.status}</span>
                </td>
                <td>${doctorName}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon primary" onclick="viewRecordDetails('${record.id || record._id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon warning" onclick="editRecord('${record.id || record._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="deleteRecord('${record.id || record._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    recordsTableBody.innerHTML = tableHTML;
}

// Show loading state in table
function showLoadingState() {
    if (recordsTableBody) {
        recordsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading medical records...</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Show error state in table
function showErrorState(message) {
    if (recordsTableBody) {
        recordsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="loading-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${message}</p>
                        <button class="btn btn-primary mt-2" onclick="loadMedicalRecords()">Retry</button>
                    </div>
                </td>
            </tr>
        `;
    }
}

// View record details
function viewRecordDetails(recordId) {
    const record = medicalRecords.find(r => (r.id === recordId) || (r._id === recordId));
    if (!record) return;
    
    const modal = document.getElementById('recordDetailsModal');
    const detailsContainer = document.getElementById('recordDetails');
    
    if (!modal || !detailsContainer) return;
    
    const patient = patients.find(p => p.id === record.patientId || p._id === record.patientId);
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
    const patientId = patient ? (patient.crNumber || patient.patientId || 'N/A') : 'N/A';
    const treatmentDate = record.treatmentDate ? formatDate(record.treatmentDate) : 'N/A';
    const nextAppointment = record.nextAppointment ? formatDate(record.nextAppointment) : 'Not scheduled';
    const doctorName = record.doctorName || 'Dr. Unknown';
    const treatmentDescription = record.treatmentDescription || 'No description provided';
    
    detailsContainer.innerHTML = `
        <div class="detail-section">
            <h4>Patient Information</h4>
            <div class="detail-row">
                <div class="detail-label">Patient Name:</div>
                <div class="detail-value">${patientName}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Patient CR:</div>
                <div class="detail-value">${patientId}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Phone:</div>
                <div class="detail-value">${patient?.phone || 'N/A'}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Treatment Information</h4>
            <div class="detail-row">
                <div class="detail-label">Treatment Description:</div>
                <div class="detail-value">${treatmentDescription}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Treatment Date:</div>
                <div class="detail-value">${treatmentDate}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Status:</div>
                <div class="detail-value"><span class="status-badge ${record.status}">${record.status}</span></div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Medical Details</h4>
            <div class="detail-row">
                <div class="detail-label">Diagnosis:</div>
                <div class="detail-value">${record.diagnosis || 'No diagnosis recorded'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Treatment Plan:</div>
                <div class="detail-value">${record.treatmentPlan || 'No treatment plan recorded'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Medications:</div>
                <div class="detail-value">${record.medications || 'No medications prescribed'}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Additional Information</h4>
            <div class="detail-row">
                <div class="detail-label">Attending Doctor:</div>
                <div class="detail-value">${doctorName}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Notes:</div>
                <div class="detail-value">${record.notes || 'No additional notes'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Next Appointment:</div>
                <div class="detail-value">${nextAppointment}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Record Created:</div>
                <div class="detail-value">${formatDate(record.createdAt)}</div>
            </div>
        </div>
    `;
    
    // Set up action buttons
    document.getElementById('editRecordBtn').onclick = () => editRecord(recordId);
    document.getElementById('printRecordBtn').onclick = () => printRecord(recordId);
    document.getElementById('deleteRecordBtn').onclick = () => deleteRecord(recordId);
    
    modal.classList.remove('hidden');
}

// Hide record details modal
function hideRecordDetailsModal() {
    const modal = document.getElementById('recordDetailsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Edit record
async function editRecord(recordId) {
    const record = medicalRecords.find(r => (r.id === recordId) || (r._id === recordId));
    if (!record) return;

    // In a real application, this would open an edit form with current data
    // For now, we'll show a simple prompt for demonstration
    const newStatus = prompt('Enter new status (active/completed/follow-up/cancelled):', record.status);
    if (newStatus && ['active', 'completed', 'follow-up', 'cancelled'].includes(newStatus)) {
        try {
            const response = await fetch(`${API_ENDPOINTS.RECORDS}/${recordId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                showNotification('Record updated successfully', 'success');
                loadMedicalRecords(); // Refresh the data
            } else {
                throw new Error('Failed to update record');
            }
        } catch (error) {
            console.error('Error updating record:', error);
            showNotification('Failed to update record', 'error');
        }
    }
    hideRecordDetailsModal();
}

// Print record
function printRecord(recordId) {
    // In a real application, this would generate a printable version
    // For now, we'll just show an alert
    alert(`Printing record: ${recordId}`);
}

// Delete record
async function deleteRecord(recordId) {
    if (confirm('Are you sure you want to delete this medical record? This action cannot be undone.')) {
        try {
            const response = await fetch(`${API_ENDPOINTS.RECORDS}/${recordId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });

            if (response.ok) {
                showNotification('Record deleted successfully', 'success');
                loadMedicalRecords(); // Refresh the list
            } else {
                throw new Error('Failed to delete record');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            showNotification('Failed to delete record', 'error');
        }
    }
}

// Show new record modal
function showNewRecordModal() {
    const modal = document.getElementById('newRecordModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('newRecordForm').reset();
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('treatmentDate').value = today;
    }
}

// Hide new record modal
function hideNewRecordModal() {
    const modal = document.getElementById('newRecordModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Create new medical record
async function createNewRecord() {
    const form = document.getElementById('newRecordForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const newRecord = {
        patientId: document.getElementById('patientSelect').value,
        treatmentDate: document.getElementById('treatmentDate').value,
        treatmentDescription: document.getElementById('treatmentDescription').value,
        status: document.getElementById('recordStatus').value,
        diagnosis: document.getElementById('diagnosis').value,
        treatmentPlan: document.getElementById('treatmentPlan').value,
        medications: document.getElementById('medications').value,
        notes: document.getElementById('notes').value,
        nextAppointment: document.getElementById('nextAppointment').value || null,
        doctorName: getCurrentUser().name
    };
    
    try {
        const response = await fetch(API_ENDPOINTS.CREATE_RECORD, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(newRecord)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const createdRecord = await response.json();
        hideNewRecordModal();
        loadMedicalRecords(); // Refresh the list
        loadStatistics(); // Refresh statistics
        showNotification('Medical record created successfully', 'success');
        
    } catch (error) {
        console.error('Error creating medical record:', error);
        showNotification(`Failed to create record: ${error.message}`, 'error');
    }
}

// Refresh records list
function refreshRecords() {
    loadMedicalRecords();
    loadStatistics();
    showNotification('Medical records refreshed', 'info');
}

// Export records
async function exportRecords() {
    try {
        const response = await fetch(`${API_ENDPOINTS.RECORDS}/export`, {
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
            a.download = 'medical-records-export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showNotification('Medical records exported successfully', 'success');
        } else {
            throw new Error('Failed to export records');
        }
    } catch (error) {
        console.error('Error exporting medical records:', error);
        showNotification('Failed to export medical records', 'error');
    }
}

// Set up real-time updates
function setupRealTimeUpdates() {
    // Refresh statistics every 30 seconds for real-time updates
    setInterval(() => {
        loadStatistics();
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

// Mock user function
function getCurrentUser() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        return JSON.parse(userData);
    }
    
    return {
        name: 'Dr. Sarah Johnson',
        role: 'doctor'
    };
}

// Mock logout function
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        window.location.href = '../../index.html';
    }
    // File upload functionality
let selectedFiles = [];

function handleFileSelection(files) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    for (let file of files) {
        // Check file size
        if (file.size > maxSize) {
            showNotification(`File "${file.name}" is too large. Maximum size is 10MB.`, 'error');
            continue;
        }

        // Check file type
        if (!allowedTypes.includes(file.type)) {
            showNotification(`File type not supported for "${file.name}"`, 'error');
            continue;
        }

        // Add to selected files if not already present
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
            addFilePreview(file);
        }
    }

    updateFileUploadDisplay();
}

function addFilePreview(file) {
    const container = document.getElementById('filePreviewContainer');
    const fileId = 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const fileIcon = getFileIcon(fileExtension, file.type);
    
    const previewHTML = `
        <div class="file-preview" id="${fileId}">
            <div class="file-preview-icon">
                <i class="${fileIcon}"></i>
            </div>
            <div class="file-preview-info">
                <div class="file-preview-name">${file.name}</div>
                <div class="file-preview-size">${formatFileSize(file.size)}</div>
                <div class="file-progress">
                    <div class="file-progress-bar" style="width: 0%"></div>
                </div>
            </div>
            <button type="button" class="file-preview-remove" onclick="removeFile('${fileId}', '${file.name}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', previewHTML);
}

function getFileIcon(extension, mimeType) {
    const iconMap = {
        pdf: 'fas fa-file-pdf',
        jpg: 'fas fa-file-image',
        jpeg: 'fas fa-file-image',
        png: 'fas fa-file-image',
        doc: 'fas fa-file-word',
        docx: 'fas fa-file-word',
        xls: 'fas fa-file-excel',
        xlsx: 'fas fa-file-excel'
    };
    
    return iconMap[extension] || 'fas fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile(fileId, fileName) {
    // Remove from DOM
    const element = document.getElementById(fileId);
    if (element) {
        element.remove();
    }
    
    // Remove from selected files array
    selectedFiles = selectedFiles.filter(file => file.name !== fileName);
    
    updateFileUploadDisplay();
}

function updateFileUploadDisplay() {
    const container = document.getElementById('filePreviewContainer');
    const uploadArea = document.getElementById('fileUploadArea');
    
    if (selectedFiles.length > 0) {
        container.classList.add('has-files');
        uploadArea.style.display = 'none';
    } else {
        container.classList.remove('has-files');
        uploadArea.style.display = 'block';
    }
}

function clearFileUploads() {
    selectedFiles = [];
    const container = document.getElementById('filePreviewContainer');
    container.innerHTML = '';
    updateFileUploadDisplay();
}

// Drag and drop functionality
function setupFileDragAndDrop() {
    const uploadArea = document.getElementById('fileUploadArea');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        uploadArea.classList.add('dragover');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('dragover');
    }
    
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFileSelection(files);
    }
}

// Update the createNewRecord function to handle file uploads
async function createNewRecord() {
    const form = document.getElementById('newRecordForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData();
    
    // Add text fields
    formData.append('patientId', document.getElementById('patientSelect').value);
    formData.append('treatmentDate', document.getElementById('treatmentDate').value);
    formData.append('treatmentDescription', document.getElementById('treatmentDescription').value);
    formData.append('status', document.getElementById('recordStatus').value);
    formData.append('diagnosis', document.getElementById('diagnosis').value);
    formData.append('treatmentPlan', document.getElementById('treatmentPlan').value);
    formData.append('medications', document.getElementById('medications').value);
    formData.append('notes', document.getElementById('notes').value);
    formData.append('nextAppointment', document.getElementById('nextAppointment').value || '');
    formData.append('doctorName', getCurrentUser().name);
    
    // Add files
    selectedFiles.forEach((file, index) => {
        formData.append(`files`, file);
    });
    
    try {
        // Show upload progress for files
        if (selectedFiles.length > 0) {
            showFileUploadProgress();
        }
        
        const response = await fetch(API_ENDPOINTS.CREATE_RECORD, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const createdRecord = await response.json();
        hideNewRecordModal();
        clearFileUploads();
        loadMedicalRecords();
        loadStatistics();
        showNotification('Medical record created successfully', 'success');
        
    } catch (error) {
        console.error('Error creating medical record:', error);
        showNotification(`Failed to create record: ${error.message}`, 'error');
    }
}

function showFileUploadProgress() {
    const filePreviews = document.querySelectorAll('.file-preview');
    filePreviews.forEach(preview => {
        preview.classList.add('progress');
        const progressBar = preview.querySelector('.file-progress-bar');
        if (progressBar) {
            // Simulate progress - in real implementation, you'd update this based on actual upload progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    preview.classList.remove('progress');
                    preview.classList.add('success');
                }
                progressBar.style.width = progress + '%';
            }, 100);
        }
    });
}

// Update the initializePage function to set up drag and drop
function initializePage() {
    // ... existing code ...
    
    // Set up file drag and drop
    setupFileDragAndDrop();
    
    // ... existing code ...
}

// Update the hideNewRecordModal function to clear files
function hideNewRecordModal() {
    const modal = document.getElementById('newRecordModal');
    if (modal) {
        modal.classList.add('hidden');
        clearFileUploads();
    }
}
}