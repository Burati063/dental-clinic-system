// appointments.js - Enhanced Dental Clinic Appointment Management System

class AppointmentManager {
    constructor() {
        this.currentWeek = new Date();
        this.appointments = [];
        this.patients = [];
        this.filteredAppointments = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.totalPages = 1;
        this.currentFilters = {
            status: 'all',
            search: ''
        };
        this.availableTimeSlots = this.generateTimeSlots();
        this.apiBaseUrl = 'https://jsonplaceholder.typicode.com'; // Mock API base URL

        this.initializeEventListeners();
        this.loadInitialData();
    }

    // Generate available time slots (8 AM to 6 PM, 30-minute intervals)
    generateTimeSlots() {
        const slots = [];
        for (let hour = 8; hour <= 18; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                slots.push(timeString);
            }
        }
        return slots;
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Calendar navigation
        document.getElementById('prevWeek').addEventListener('click', () => this.navigateWeek(-1));
        document.getElementById('nextWeek').addEventListener('click', () => this.navigateWeek(1));
        document.getElementById('todayBtn').addEventListener('click', () => this.goToToday());

        // Search and filters
        document.getElementById('appointmentSearch').addEventListener('input', (e) => {
            this.currentFilters.search = e.target.value;
            this.filterAppointments();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.currentFilters.status = e.target.value;
            this.filterAppointments();
        });

        // Global search
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            this.currentFilters.search = e.target.value;
            this.filterAppointments();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => this.previousPage());
        document.getElementById('next-page').addEventListener('click', () => this.nextPage());

        // Mobile menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => this.toggleMobileMenu());
        document.getElementById('sidebarClose').addEventListener('click', () => this.closeMobileMenu());
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeMobileMenu());

        // Form-specific event listeners
        document.getElementById('appointmentDate').addEventListener('change', () => {
            this.populateTimeSlots('appointmentTime');
        });
        
        document.getElementById('editAppointmentDate').addEventListener('change', () => {
            this.populateTimeSlots('editAppointmentTime');
        });
        
        document.getElementById('rescheduleDate').addEventListener('change', () => {
            this.populateTimeSlots('rescheduleTime');
        });

        // Real-time form validation
        document.getElementById('newAppointmentForm').addEventListener('input', (e) => {
            this.validateField(e.target);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!document.getElementById('newAppointmentModal').classList.contains('hidden')) {
                    this.hideNewAppointmentModal();
                }
                if (!document.getElementById('editAppointmentModal').classList.contains('hidden')) {
                    this.hideEditAppointmentModal();
                }
                if (!document.getElementById('rescheduleAppointmentModal').classList.contains('hidden')) {
                    this.hideRescheduleAppointmentModal();
                }
            }
        });

        // Close modal when clicking backdrop
        document.addEventListener('click', (e) => {
            if (e.target.id === 'newAppointmentModal') {
                this.hideNewAppointmentModal();
            }
            if (e.target.id === 'editAppointmentModal') {
                this.hideEditAppointmentModal();
            }
            if (e.target.id === 'rescheduleAppointmentModal') {
                this.hideRescheduleAppointmentModal();
            }
        });
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

    // Load initial data
    async loadInitialData() {
        try {
            this.showLoadingState();
            
            await Promise.all([
                this.loadAppointments(),
                this.loadPatients(),
                this.loadUserProfile(),
                this.loadNotifications()
            ]);
            
            this.initializeCalendar();
            this.updateStats();
            this.renderAppointmentsTable();
            this.hideLoadingState();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load data. Please refresh the page.');
            this.hideLoadingState();
        }
    }

    // Enhanced API data loading with real API integration
    async loadAppointments() {
        try {
            // Try to load from API first
            const appointments = await this.apiCall('/posts?_limit=20');
            
            // Transform API data to our format
            this.appointments = appointments.map((post, index) => {
                const appointmentDate = new Date();
                appointmentDate.setDate(appointmentDate.getDate() + Math.floor(index / 3));
                
                const statuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];
                const statusIndex = index % statuses.length;
                
                return {
                    id: post.id.toString(),
                    patientId: (index + 1).toString(),
                    date: appointmentDate.toISOString().split('T')[0],
                    time: this.availableTimeSlots[index % this.availableTimeSlots.length],
                    service: post.title.substring(0, 30) + '...',
                    status: statuses[statusIndex],
                    duration: 60, // Fixed duration of 60 minutes
                    notes: post.body.substring(0, 100) + '...',
                    patient: {
                        name: `Patient ${post.id}`,
                        email: `patient${post.id}@example.com`,
                        phone: `555-010${post.id}`
                    }
                };
            });

            this.filteredAppointments = [...this.appointments];
        } catch (error) {
            console.error('Error loading appointments from API, using mock data:', error);
            // Fallback to mock data
            this.appointments = this.getMockAppointments();
            this.filteredAppointments = [...this.appointments];
        }
    }

    async loadPatients() {
        try {
            // Try to load from API
            const users = await this.apiCall('/users?_limit=8');
            
            // Transform API data
            this.patients = users.map(user => ({
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone || '555-0000',
                username: user.username
            }));
            
            this.populatePatientSelect();
        } catch (error) {
            console.error('Error loading patients from API, using mock data:', error);
            // Fallback to mock data
            this.patients = this.getMockPatients();
            this.populatePatientSelect();
        }
    }

    async loadUserProfile() {
        try {
            // Try to load from API
            const user = await this.apiCall('/users/1');
            
            document.getElementById('sidebar-user-name').textContent = user.name;
            document.getElementById('header-user-name').textContent = user.name;
            document.getElementById('sidebar-user-role').textContent = ' Doctor';
            document.getElementById('header-user-role').textContent = 'Doctor';
        } catch (error) {
            console.error('Error loading user profile from API:', error);
            // Fallback to mock data
            const user = { name: 'Dr. Doctor User', role: 'Doctor' };
            document.getElementById('sidebar-user-name').textContent = user.name;
            document.getElementById('header-user-name').textContent = user.name;
            document.getElementById('sidebar-user-role').textContent = user.role;
            document.getElementById('header-user-role').textContent = user.role;
        }
    }

    async loadNotifications() {
        try {
            // Try to load from API
            const notifications = await this.apiCall('/posts?_limit=3');
            
            const transformedNotifications = notifications.map((post, index) => ({
                id: post.id,
                title: `Appointment ${index + 1}`,
                message: post.title.substring(0, 50) + '...',
                read: index > 0,
                createdAt: new Date(Date.now() - index * 3600000)
            }));
            
            this.updateNotificationBadge(transformedNotifications);
            this.renderNotifications(transformedNotifications);
        } catch (error) {
            console.error('Error loading notifications from API:', error);
            // Fallback to mock data
            const notifications = [
                { id: 1, title: 'New Appointment', message: 'John Smith scheduled a checkup', read: false, createdAt: new Date(Date.now() - 300000) },
                { id: 2, title: 'Appointment Reminder', message: 'Maria Garcia has an appointment in 1 hour', read: true, createdAt: new Date(Date.now() - 3600000) }
            ];
            this.updateNotificationBadge(notifications);
            this.renderNotifications(notifications);
        }
    }

    // Enhanced modal show function
    showNewAppointmentModal() {
        this.populateFormSelects();
        this.setDefaultDateTime();
        this.populateTimeSlots('appointmentTime');
        
        // Reset form
        document.getElementById('newAppointmentForm').reset();
        
        // Show modal with animation
        const modal = document.getElementById('newAppointmentModal');
        modal.classList.remove('hidden');
        
        // Focus on first field
        setTimeout(() => {
            document.getElementById('patientSelect').focus();
        }, 300);
    }

    hideNewAppointmentModal() {
        document.getElementById('newAppointmentModal').classList.add('hidden');
        document.getElementById('newAppointmentForm').reset();
    }

    // Show edit appointment modal
    showEditAppointmentModal(appointmentId) {
        const appointment = this.appointments.find(apt => apt.id === appointmentId);
        if (!appointment) return;

        // Populate form with appointment data
        document.getElementById('editAppointmentId').value = appointment.id;
        document.getElementById('editPatientSelect').value = appointment.patientId;
        document.getElementById('editAppointmentDate').value = appointment.date;
        document.getElementById('editServiceType').value = appointment.service;
        document.getElementById('editAppointmentNotes').value = appointment.notes || '';
        document.getElementById('editAppointmentStatus').value = appointment.status;

        // Populate patient select
        this.populatePatientSelect('editPatientSelect');
        
        // Populate time slots for the selected date
        this.populateTimeSlots('editAppointmentTime', appointment.date, appointment.id);
        
        // Set the current time as selected
        setTimeout(() => {
            document.getElementById('editAppointmentTime').value = appointment.time;
        }, 100);

        // Show modal
        document.getElementById('editAppointmentModal').classList.remove('hidden');
    }

    hideEditAppointmentModal() {
        document.getElementById('editAppointmentModal').classList.add('hidden');
        document.getElementById('editAppointmentForm').reset();
    }

    // Show reschedule appointment modal
    showRescheduleAppointmentModal(appointmentId) {
        const appointment = this.appointments.find(apt => apt.id === appointmentId);
        if (!appointment) return;

        // Populate form with appointment data
        document.getElementById('rescheduleAppointmentId').value = appointment.id;
        document.getElementById('rescheduleDate').value = appointment.date;
        
        // Populate time slots for the selected date
        this.populateTimeSlots('rescheduleTime', appointment.date, appointment.id);
        
        // Set the current time as selected
        setTimeout(() => {
            document.getElementById('rescheduleTime').value = appointment.time;
        }, 100);

        // Show modal
        document.getElementById('rescheduleAppointmentModal').classList.remove('hidden');
    }

    hideRescheduleAppointmentModal() {
        document.getElementById('rescheduleAppointmentModal').classList.add('hidden');
        document.getElementById('rescheduleAppointmentForm').reset();
    }

    // Set default date and time
    setDefaultDateTime() {
        const now = new Date();
        const defaultDate = new Date(now);
        defaultDate.setDate(now.getDate() + 1); // Default to tomorrow
        
        document.getElementById('appointmentDate').valueAsDate = defaultDate;
        document.getElementById('appointmentDate').min = new Date().toISOString().split('T')[0];
    }

    // Populate time slots based on selected date
    populateTimeSlots(timeSelectId, dateValue = null, excludeAppointmentId = null) {
        const dateSelect = document.getElementById(timeSelectId.replace('Time', 'Date'));
        const timeSelect = document.getElementById(timeSelectId);
        
        const selectedDate = dateValue || dateSelect.value;
        
        if (!selectedDate) {
            timeSelect.innerHTML = '<option value="">Select Date First</option>';
            return;
        }

        timeSelect.innerHTML = '<option value="">Select Time</option>';

        // Get existing appointments for the selected date
        const existingAppointments = this.appointments.filter(apt => 
            apt.date === selectedDate &&
            apt.status !== 'cancelled' &&
            apt.id !== excludeAppointmentId // Exclude current appointment when editing/rescheduling
        );

        this.availableTimeSlots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot;
            
            const slotTime = new Date(`${selectedDate}T${slot}`);
            const isAvailable = !existingAppointments.some(apt => {
                const aptTime = new Date(`${apt.date}T${apt.time}`);
                const slotEnd = new Date(slotTime.getTime() + 60 * 60000); // Fixed 60 minutes duration
                const aptEnd = new Date(aptTime.getTime() + 60 * 60000); // Fixed 60 minutes duration
                return this.isTimeOverlap(slotTime, slotEnd, aptTime, aptEnd);
            });

            if (isAvailable) {
                option.textContent = `${slot} - Available`;
                option.className = 'time-slot-available';
            } else {
                option.textContent = `${slot} - Booked`;
                option.disabled = true;
                option.className = 'time-slot-unavailable';
            }
            
            timeSelect.appendChild(option);
        });
    }

    // Check for time overlap
    isTimeOverlap(start1, end1, start2, end2) {
        return start1 < end2 && end1 > start2;
    }

    // Enhanced form population
    populatePatientSelect(selectId = 'patientSelect') {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select Patient</option>' +
            this.patients.map(patient => 
                `<option value="${patient.id}">${patient.name} - ${patient.phone || 'No phone'} - ${patient.email}</option>`
            ).join('');
    }

    populateFormSelects() {
        this.populatePatientSelect();
    }

    // Enhanced appointment creation with API integration
    async createNewAppointment() {
        const form = document.getElementById('newAppointmentForm');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = {
            patientId: document.getElementById('patientSelect').value,
            date: document.getElementById('appointmentDate').value,
            time: document.getElementById('appointmentTime').value,
            service: document.getElementById('serviceType').value,
            duration: 60, // Fixed duration of 60 minutes
            notes: document.getElementById('appointmentNotes').value,
            status: 'scheduled'
        };

        // Validate time slot availability
        if (!this.validateTimeSlot(formData.date, formData.time, formData.duration)) {
            this.showError('Selected time slot is no longer available. Please choose another time.');
            this.populateTimeSlots('appointmentTime');
            return;
        }

        // Show loading state
        const button = document.querySelector('#newAppointmentModal .btn-primary');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
        button.disabled = true;

        try {
            const success = await this.createNewAppointmentAPI(formData);
            if (success) {
                this.hideNewAppointmentModal();
                this.showSuccess('Appointment scheduled successfully! 🎉');
            }
        } finally {
            // Restore button state
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async createNewAppointmentAPI(formData) {
        try {
            // Find patient details
            const patient = this.patients.find(p => p.id === formData.patientId);

            if (!patient) {
                throw new Error('Patient not found');
            }

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Create new appointment
            const newAppointment = {
                id: String(Date.now()), // Use timestamp as unique ID
                ...formData,
                patient: patient
            };

            this.appointments.push(this.formatAppointment(newAppointment));
            this.filteredAppointments = [...this.appointments];
            
            // Update UI
            this.updateStats();
            this.renderAppointmentsTable();
            this.initializeCalendar();
            
            return true;
        } catch (error) {
            console.error('Error creating appointment:', error);
            this.showError('Failed to schedule appointment. Please try again.');
            return false;
        }
    }

    // Update appointment
    async updateAppointment() {
        const form = document.getElementById('editAppointmentForm');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const appointmentId = document.getElementById('editAppointmentId').value;
        const formData = {
            patientId: document.getElementById('editPatientSelect').value,
            date: document.getElementById('editAppointmentDate').value,
            time: document.getElementById('editAppointmentTime').value,
            service: document.getElementById('editServiceType').value,
            duration: 60, // Fixed duration of 60 minutes
            notes: document.getElementById('editAppointmentNotes').value,
            status: document.getElementById('editAppointmentStatus').value
        };

        // Validate time slot availability (excluding current appointment)
        if (!this.validateTimeSlot(formData.date, formData.time, formData.duration, appointmentId)) {
            this.showError('Selected time slot is no longer available. Please choose another time.');
            this.populateTimeSlots('editAppointmentTime', formData.date, appointmentId);
            return;
        }

        // Show loading state
        const button = document.querySelector('#editAppointmentModal .btn-primary');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        button.disabled = true;

        try {
            const success = await this.updateAppointmentAPI(appointmentId, formData);
            if (success) {
                this.hideEditAppointmentModal();
                this.hideAppointmentDetailsModal();
                this.showSuccess('Appointment updated successfully! ✅');
            }
        } finally {
            // Restore button state
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async updateAppointmentAPI(appointmentId, formData) {
        try {
            // Find patient details
            const patient = this.patients.find(p => p.id === formData.patientId);

            if (!patient) {
                throw new Error('Patient not found');
            }

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Update appointment
            const appointmentIndex = this.appointments.findIndex(apt => apt.id === appointmentId);
            if (appointmentIndex !== -1) {
                this.appointments[appointmentIndex] = this.formatAppointment({
                    ...this.appointments[appointmentIndex],
                    ...formData,
                    patient: patient
                });
                
                this.filteredAppointments = [...this.appointments];
                
                // Update UI
                this.updateStats();
                this.renderAppointmentsTable();
                this.initializeCalendar();
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error updating appointment:', error);
            this.showError('Failed to update appointment. Please try again.');
            return false;
        }
    }

    // Reschedule appointment
    async rescheduleAppointment() {
        const form = document.getElementById('rescheduleAppointmentForm');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const appointmentId = document.getElementById('rescheduleAppointmentId').value;
        const newDate = document.getElementById('rescheduleDate').value;
        const newTime = document.getElementById('rescheduleTime').value;
        const reason = document.getElementById('rescheduleReason').value;

        // Validate time slot availability (excluding current appointment)
        if (!this.validateTimeSlot(newDate, newTime, 60, appointmentId)) {
            this.showError('Selected time slot is no longer available. Please choose another time.');
            this.populateTimeSlots('rescheduleTime', newDate, appointmentId);
            return;
        }

        // Show loading state
        const button = document.querySelector('#rescheduleAppointmentModal .btn-primary');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rescheduling...';
        button.disabled = true;

        try {
            const success = await this.rescheduleAppointmentAPI(appointmentId, newDate, newTime, reason);
            if (success) {
                this.hideRescheduleAppointmentModal();
                this.hideAppointmentDetailsModal();
                this.showSuccess('Appointment rescheduled successfully! 📅');
            }
        } finally {
            // Restore button state
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async rescheduleAppointmentAPI(appointmentId, newDate, newTime, reason) {
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Update appointment
            const appointmentIndex = this.appointments.findIndex(apt => apt.id === appointmentId);
            if (appointmentIndex !== -1) {
                const originalAppointment = this.appointments[appointmentIndex];
                
                this.appointments[appointmentIndex] = this.formatAppointment({
                    ...originalAppointment,
                    date: newDate,
                    time: newTime,
                    notes: reason ? `${originalAppointment.notes}\n\nRescheduled: ${reason}` : originalAppointment.notes
                });
                
                this.filteredAppointments = [...this.appointments];
                
                // Update UI
                this.updateStats();
                this.renderAppointmentsTable();
                this.initializeCalendar();
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error rescheduling appointment:', error);
            this.showError('Failed to reschedule appointment. Please try again.');
            return false;
        }
    }

    validateTimeSlot(date, time, duration, excludeAppointmentId = null) {
        const slotTime = new Date(`${date}T${time}`);
        const slotEnd = new Date(slotTime.getTime() + duration * 60000);
        
        const conflictingAppointments = this.appointments.filter(apt => 
            apt.date === date &&
            apt.status !== 'cancelled' &&
            apt.id !== excludeAppointmentId
        );

        return !conflictingAppointments.some(apt => {
            const aptTime = new Date(`${apt.date}T${apt.time}`);
            const aptEnd = new Date(aptTime.getTime() + 60 * 60000); // Fixed 60 minutes duration
            return this.isTimeOverlap(slotTime, slotEnd, aptTime, aptEnd);
        });
    }

    validateField(field) {
        if (field.value.trim() === '') {
            field.classList.add('error');
        } else {
            field.classList.remove('error');
        }
    }

    // Calendar Management
    initializeCalendar() {
        this.updateCalendarHeader();
        this.generateCalendarSlots();
        this.renderCalendarAppointments();
    }

    updateCalendarHeader() {
        const monday = this.getMonday(this.currentWeek);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const options = { month: 'short', day: 'numeric' };
        const weekDisplay = 
            `${monday.toLocaleDateString('en-US', options)} - ${sunday.toLocaleDateString('en-US', options)}`;
        
        document.getElementById('currentWeek').textContent = weekDisplay;
    }

    getMonday(date) {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    }

    generateCalendarSlots() {
        const calendarBody = document.getElementById('calendarBody');
        calendarBody.innerHTML = '';

        // Generate time slots from 8 AM to 6 PM
        for (let hour = 8; hour <= 18; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'calendar-slot';

            // Time column
            const timeColumn = document.createElement('div');
            timeColumn.className = 'time-slot';
            timeColumn.textContent = `${hour.toString().padStart(2, '0')}:00`;
            timeSlot.appendChild(timeColumn);

            // Day columns (Monday to Saturday)
            for (let day = 0; day < 6; day++) {
                const daySlot = document.createElement('div');
                daySlot.className = 'day-slot';
                daySlot.dataset.day = day;
                daySlot.dataset.hour = hour;
                timeSlot.appendChild(daySlot);
            }

            calendarBody.appendChild(timeSlot);
        }
    }

    renderCalendarAppointments() {
        const weekStart = this.getMonday(new Date(this.currentWeek));
        
        this.appointments.forEach(appointment => {
            if (appointment.status === 'cancelled') return;

            const appointmentDate = new Date(appointment.date);
            const dayOfWeek = (appointmentDate.getDay() + 6) % 7; // Convert to Monday-based week (0-6)
            const hour = parseInt(appointment.time.split(':')[0]);

            if (this.isDateInWeek(appointmentDate, weekStart)) {
                const daySlot = document.querySelector(`.day-slot[data-day="${dayOfWeek}"][data-hour="${hour}"]`);
                if (daySlot) {
                    const eventElement = document.createElement('div');
                    eventElement.className = `appointment-event ${appointment.status}`;
                    eventElement.innerHTML = `
                        <strong>${appointment.patientName}</strong>
                        <div>${appointment.service}</div>
                        <small>${appointment.time}</small>
                    `;
                    eventElement.addEventListener('click', () => this.showAppointmentDetails(appointment.id));
                    daySlot.appendChild(eventElement);
                }
            }
        });
    }

    isDateInWeek(date, weekStart) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return date >= weekStart && date <= weekEnd;
    }

    navigateWeek(direction) {
        this.currentWeek.setDate(this.currentWeek.getDate() + (direction * 7));
        this.initializeCalendar();
    }

    goToToday() {
        this.currentWeek = new Date();
        this.initializeCalendar();
    }

    // Table and Data Management
    filterAppointments() {
        let filtered = this.appointments;

        // Apply status filter
        if (this.currentFilters.status !== 'all') {
            filtered = filtered.filter(apt => apt.status === this.currentFilters.status);
        }

        // Apply search filter
        if (this.currentFilters.search) {
            const searchTerm = this.currentFilters.search.toLowerCase();
            filtered = filtered.filter(apt => 
                apt.patientName.toLowerCase().includes(searchTerm) ||
                apt.service.toLowerCase().includes(searchTerm) ||
                apt.notes.toLowerCase().includes(searchTerm)
            );
        }

        this.filteredAppointments = filtered;
        this.currentPage = 1;
        this.renderAppointmentsTable();
    }

    renderAppointmentsTable() {
        const tbody = document.getElementById('appointments-table-body');
        
        if (this.filteredAppointments.length === 0) {
            tbody.innerHTML = this.getEmptyStateHTML();
            this.updatePagination();
            return;
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedAppointments = this.filteredAppointments.slice(startIndex, endIndex);

        tbody.innerHTML = paginatedAppointments.map(appointment => `
            <tr>
                <td>
                    <div class="patient-cell">
                        <div class="patient-avatar">
                            ${appointment.patientName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div class="patient-details">
                            <div class="patient-name">${appointment.patientName}</div>
                            <div class="patient-email">${appointment.patientEmail}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <strong>${this.formatDate(appointment.date)}</strong><br>
                    <small>${appointment.time}</small>
                </td>
                <td>
                    <span class="service-badge" title="${appointment.service}">${appointment.service}</span>
                </td>
                <td>
                    <span class="status-badge ${appointment.status}">${appointment.status}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="appointmentManager.showAppointmentDetails('${appointment.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="appointmentManager.showEditAppointmentModal('${appointment.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="appointmentManager.showRescheduleAppointmentModal('${appointment.id}')" title="Reschedule">
                            <i class="fas fa-calendar-alt"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="appointmentManager.cancelAppointment('${appointment.id}')" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.updatePagination();
    }

    updatePagination() {
        this.totalPages = Math.ceil(this.filteredAppointments.length / this.itemsPerPage);
        
        document.getElementById('current-page').textContent = this.currentPage;
        document.getElementById('total-pages').textContent = this.totalPages;
        
        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage === this.totalPages;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderAppointmentsTable();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderAppointmentsTable();
        }
    }

    // Cancel appointment
    async cancelAppointment(appointmentId) {
        if (!confirm('Are you sure you want to cancel this appointment?')) {
            return;
        }

        try {
            const success = await this.cancelAppointmentAPI(appointmentId);
            if (success) {
                this.showSuccess('Appointment cancelled successfully.');
            }
        } catch (error) {
            this.showError('Failed to cancel appointment. Please try again.');
        }
    }

    async cancelAppointmentAPI(appointmentId) {
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update appointment status
            const appointmentIndex = this.appointments.findIndex(apt => apt.id === appointmentId);
            if (appointmentIndex !== -1) {
                this.appointments[appointmentIndex].status = 'cancelled';
                this.filteredAppointments = [...this.appointments];
                
                // Update UI
                this.updateStats();
                this.renderAppointmentsTable();
                this.initializeCalendar();
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            throw error;
        }
    }

    // Stats and Analytics
    updateStats() {
        const stats = this.calculateStats();
        
        document.getElementById('totalAppointments').textContent = stats.total;
        document.getElementById('scheduledAppointments').textContent = stats.scheduled;
        document.getElementById('confirmedAppointments').textContent = stats.confirmed;
        document.getElementById('completedAppointments').textContent = stats.completed;
        document.getElementById('cancelledAppointments').textContent = stats.cancelled;
    }

    calculateStats() {
        return {
            total: this.appointments.length,
            scheduled: this.appointments.filter(apt => apt.status === 'scheduled').length,
            confirmed: this.appointments.filter(apt => apt.status === 'confirmed').length,
            completed: this.appointments.filter(apt => apt.status === 'completed').length,
            cancelled: this.appointments.filter(apt => apt.status === 'cancelled').length
        };
    }

    // Utility Methods
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    formatAppointment(appointment) {
        return {
            ...appointment,
            patientName: appointment.patient?.name || 'Unknown Patient',
            patientEmail: appointment.patient?.email || 'No email',
            patientPhone: appointment.patient?.phone || 'No phone'
        };
    }

    getEmptyStateHTML() {
        return `
            <tr>
                <td colspan="5" class="empty-state">
                    <div class="empty-state-content">
                        <i class="fas fa-calendar-times"></i>
                        <h3>No Appointments Found</h3>
                        <p>No appointments match your current filters.</p>
                        <button class="btn btn-primary" onclick="appointmentManager.showNewAppointmentModal()">
                            <i class="fas fa-plus"></i> Schedule New Appointment
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Mock data generators
    getMockAppointments() {
        // ... (keep existing mock data generation)
        return []; // Placeholder
    }

    getMockPatients() {
        // ... (keep existing mock patient data generation)
        return []; // Placeholder
    }

    // UI State Management
    showLoadingState() {
        document.body.classList.add('loading');
    }

    hideLoadingState() {
        document.body.classList.remove('loading');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Mobile menu management
    toggleMobileMenu() {
        document.getElementById('sidebar').classList.add('active');
        document.getElementById('sidebarOverlay').classList.add('active');
    }

    closeMobileMenu() {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
    }

    // Notification management
    updateNotificationBadge(notifications) {
        const unreadCount = notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;

        container.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                <div class="notification-icon">
                    <i class="fas fa-bell"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${this.formatRelativeTime(notification.createdAt)}</div>
                </div>
                ${!notification.read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `).join('');
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
}

// Global functions for HTML event handlers
function showNewAppointmentModal() {
    appointmentManager.showNewAppointmentModal();
}

function hideNewAppointmentModal() {
    appointmentManager.hideNewAppointmentModal();
}

function hideEditAppointmentModal() {
    appointmentManager.hideEditAppointmentModal();
}

function hideRescheduleAppointmentModal() {
    appointmentManager.hideRescheduleAppointmentModal();
}

function createNewAppointment() {
    appointmentManager.createNewAppointment();
}

function updateAppointment() {
    appointmentManager.updateAppointment();
}

function rescheduleAppointment() {
    appointmentManager.rescheduleAppointment();
}

// Initialize the appointment manager when DOM is loaded
let appointmentManager;

document.addEventListener('DOMContentLoaded', function() {
    appointmentManager = new AppointmentManager();
});