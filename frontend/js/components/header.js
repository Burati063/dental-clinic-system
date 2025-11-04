class HeaderComponent {
    constructor() {
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.loadNotifications();
    }

    loadUserData() {
        const user = Auth.currentUser;
        if (user) {
            // Update header user info
            const userElements = document.querySelectorAll('#current-user, #sidebar-user-name');
            userElements.forEach(el => {
                if (el) el.textContent = `${user.first_name} ${user.last_name}`;
            });

            // Update user roles
            const roleElements = document.querySelectorAll('#user-role, #sidebar-user-role');
            roleElements.forEach(el => {
                if (el) el.textContent = user.role;
            });
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
            });
        }

        // Sidebar close
        const sidebarClose = document.getElementById('sidebarClose');
        if (sidebarClose) {
            sidebarClose.addEventListener('click', () => {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Overlay click
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Global search
        const globalSearch = document.getElementById('globalSearch');
        const searchClear = document.getElementById('searchClear');
        
        if (globalSearch) {
            globalSearch.addEventListener('input', Utils.debounce((e) => {
                this.handleGlobalSearch(e.target.value);
                searchClear.classList.toggle('hidden', !e.target.value);
            }, 300));

            globalSearch.addEventListener('focus', () => {
                // Show search suggestions if needed
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                globalSearch.value = '';
                searchClear.classList.add('hidden');
                this.handleGlobalSearch('');
            });
        }

        // Logout functionality
        const logoutButtons = document.querySelectorAll('.logout-btn');
        logoutButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.handleLogout();
            });
        });
    }

    handleGlobalSearch(query) {
        if (query.length < 2) return;
        
        // Implement global search functionality
        console.log('Searching for:', query);
        // This would typically make an API call to search across patients, appointments, etc.
    }

    async loadNotifications() {
        try {
            // Simulate API call for notifications
            const notifications = [
                {
                    id: 1,
                    title: 'New Appointment',
                    description: 'John Doe scheduled an appointment for tomorrow',
                    time: '5 minutes ago',
                    unread: true
                },
                {
                    id: 2,
                    title: 'System Update',
                    description: 'System maintenance scheduled for tonight',
                    time: '1 hour ago',
                    unread: true
                }
            ];

            this.renderNotifications(notifications);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    renderNotifications(notifications) {
        const notificationList = document.getElementById('notificationList');
        const notificationCount = document.getElementById('notificationCount');
        
        if (!notificationList) return;

        const unreadCount = notifications.filter(n => n.unread).length;
        
        if (notificationCount) {
            notificationCount.textContent = unreadCount;
            notificationCount.classList.toggle('hidden', unreadCount === 0);
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

        notificationList.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.unread ? 'unread' : ''}">
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-desc">${notification.description}</div>
                    <div class="notification-time">${notification.time}</div>
                </div>
            </div>
        `).join('');
    }

    showToast(title, message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        const toastTitle = document.getElementById('toastTitle');
        const toastBody = document.getElementById('toastBody');
        
        if (!toast || !toastTitle || !toastBody) return;

        // Set toast content
        toastTitle.textContent = title;
        toastBody.textContent = message;

        // Set toast color based on type
        const colors = {
            info: '#3498db',
            success: '#2ecc71',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        
        toast.style.borderLeftColor = colors[type] || colors.info;

        // Show toast
        toast.classList.remove('hidden');

        // Auto hide after 5 seconds
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 5000);

        // Close button
        const toastClose = document.getElementById('toastClose');
        if (toastClose) {
            toastClose.onclick = () => toast.classList.add('hidden');
        }
    }
}

// Initialize header when component is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.headerComponent = new HeaderComponent();
});