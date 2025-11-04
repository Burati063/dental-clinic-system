class SidebarComponent {
    constructor() {
        this.isOpen = false;
        this.currentRole = null;
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.setupNavigation();
        this.hideUnauthorizedItems();
        this.setActiveMenuItem();
    }

    loadUserData() {
        const user = Auth.currentUser;
        if (user) {
            this.currentRole = user.role;
            
            // Update sidebar user info
            const userNameElements = document.querySelectorAll('#sidebar-user-name');
            const userRoleElements = document.querySelectorAll('#sidebar-user-role');
            
            userNameElements.forEach(el => {
                if (el) el.textContent = `${user.first_name} ${user.last_name}`;
            });
            
            userRoleElements.forEach(el => {
                if (el) el.textContent = user.role;
            });
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const sidebarClose = document.getElementById('sidebarClose');
        
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                this.openSidebar();
            });
        }

        if (sidebarClose) {
            sidebarClose.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Logout functionality
        const logoutButtons = document.querySelectorAll('.sidebar-logout, .logout-btn');
        logoutButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        });

        // Window resize handling
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });
    }

    setupNavigation() {
        // Handle navigation links
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('.nav-link[data-nav]');
            if (navLink) {
                e.preventDefault();
                const href = navLink.getAttribute('href');
                this.handleNavigation(href, navLink);
            }
        });
    }

    handleNavigation(href, navLink) {
        // Update active menu item
        this.setActiveMenuItem(navLink);
        
        // Close sidebar on mobile after navigation
        if (window.innerWidth < 1024) {
            this.closeSidebar();
        }
        
        // Navigate to page
        if (href && href.endsWith('.html')) {
            app.navigateTo(href);
        }
    }

    setActiveMenuItem(activeLink = null) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));

        if (activeLink) {
            activeLink.classList.add('active');
        } else {
            // Find active link based on current page
            const currentPage = window.location.pathname.split('/').pop();
            const matchingLink = document.querySelector(`.nav-link[href="${currentPage}"]`);
            if (matchingLink) {
                matchingLink.classList.add('active');
            } else {
                // Fallback to dashboard
                const dashboardLink = document.querySelector('.nav-link[href="dashboard.html"]');
                if (dashboardLink) {
                    dashboardLink.classList.add('active');
                }
            }
        }
    }

    hideUnauthorizedItems() {
        if (!this.currentRole) return;

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const roles = item.dataset.roles;
            if (roles && !roles.includes(this.currentRole)) {
                item.style.display = 'none';
            }
        });
    }

    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (sidebar && sidebarOverlay) {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
            this.isOpen = true;
            document.body.style.overflow = 'hidden';
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (sidebar && sidebarOverlay) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            this.isOpen = false;
            document.body.style.overflow = '';
        }
    }

    toggleSidebar() {
        if (this.isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    handleResize() {
        if (window.innerWidth >= 1024) {
            // On desktop, ensure sidebar is open and overlay is hidden
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            
            if (sidebar) sidebar.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
            this.isOpen = false;
        }
    }

    async handleLogout() {
        const confirmed = await this.showLogoutConfirmation();
        if (confirmed) {
            Auth.handleLogout();
        }
    }

    async showLogoutConfirmation() {
        return new Promise((resolve) => {
            Modal.confirm({
                title: 'Logout Confirmation',
                message: 'Are you sure you want to logout?',
                onConfirm: () => resolve(true)
            });
            
            // If user closes the modal without confirming, resolve as false
            const modal = Modal.getOpenModals()[0];
            if (modal) {
                modal.element.addEventListener('modal-close', () => resolve(false), { once: true });
            }
        });
    }

    // Method to update sidebar with dynamic content
    updateSidebarStats(stats) {
        // You can add dynamic stats to sidebar if needed
        console.log('Sidebar Stats:', stats);
    }

    // Method to highlight menu items based on user activity
    highlightMenuItem(menuItem) {
        const navLink = document.querySelector(`.nav-link[href="${menuItem}"]`);
        if (navLink) {
            navLink.classList.add('highlight');
            setTimeout(() => {
                navLink.classList.remove('highlight');
            }, 3000);
        }
    }

    // Method to add custom menu items dynamically
    addCustomMenuItem(itemConfig) {
        const navList = document.querySelector('.nav-list');
        if (!navList) return;

        const li = document.createElement('li');
        li.className = 'nav-item';
        li.setAttribute('data-roles', itemConfig.roles || 'admin,doctor,receptionist');
        
        li.innerHTML = `
            <a href="${itemConfig.href}" class="nav-link" data-nav="true">
                <i class="${itemConfig.icon} nav-icon"></i>
                <span class="nav-text">${itemConfig.text}</span>
                ${itemConfig.badge ? `<span class="menu-badge">${itemConfig.badge}</span>` : ''}
            </a>
        `;

        if (itemConfig.position === 'start') {
            navList.insertBefore(li, navList.firstChild);
        } else {
            navList.appendChild(li);
        }

        // Re-setup event listeners for the new item
        this.setupNavigation();
    }

    // Method to track sidebar interactions for analytics
    trackSidebarInteraction(action, menuItem) {
        console.log('Sidebar Interaction:', { 
            action, 
            menuItem, 
            role: this.currentRole,
            timestamp: new Date().toISOString() 
        });
        // In a real application, this would send data to analytics service
    }

    // Method to collapse/expand sidebar (for future enhancement)
    toggleCollapse() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            // You would need additional CSS for collapsed state
        }
    }
}

// Add sidebar enhancement styles
const sidebarStyles = `
<style>
.menu-badge {
    background: var(--danger);
    color: white;
    border-radius: 10px;
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    margin-left: auto;
}

.nav-link.highlight {
    animation: highlightPulse 3s ease;
}

@keyframes highlightPulse {
    0%, 100% {
        background: transparent;
    }
    50% {
        background: #fff3cd;
        border-left-color: var(--warning);
    }
}

/* Collapsed sidebar styles */
.main-sidebar.collapsed {
    width: 70px;
}

.main-sidebar.collapsed .logo-text,
.main-sidebar.collapsed .nav-text,
.main-sidebar.collapsed .user-details,
.main-sidebar.collapsed .sidebar-logout span {
    display: none;
}

.main-sidebar.collapsed .nav-link {
    justify-content: center;
    padding: 0.75rem;
}

.main-sidebar.collapsed .nav-icon {
    margin: 0;
    font-size: 1.25rem;
}

.main-sidebar.collapsed .sidebar-footer {
    padding: 1rem;
}

.main-sidebar.collapsed .user-profile {
    justify-content: center;
}
</style>
`;

// Add styles to document
document.head.insertAdjacentHTML('beforeend', sidebarStyles);

// Initialize sidebar when component is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sidebarComponent = new SidebarComponent();
});