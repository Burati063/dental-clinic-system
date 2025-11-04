class DentalClinicApp {
    constructor() {
        this.currentUser = null;
        this.router = new Router();
        this.api = new API();
        this.auth = new Auth();
        
        this.init();
    }

    init() {
        // Check if user is already logged in
        if (this.auth.isLoggedIn()) {
            this.currentUser = this.auth.getCurrentUser();
            this.loadMainApp();
        } else {
            this.loadLoginPage();
        }

        // Setup event listeners
        this.setupEventListeners();
    }

    loadLoginPage() {
        fetch('login.html')
            .then(response => response.text())
            .then(html => {
                document.getElementById('login-page').innerHTML = html;
                document.getElementById('login-page').classList.add('active');
                document.getElementById('main-app').classList.remove('active');
                this.setupLoginForm();
            });
    }

    loadMainApp() {
        const role = this.currentUser.role;
        const dashboardPath = `pages/${role}/dashboard.html`;
        
        fetch(dashboardPath)
            .then(response => response.text())
            .then(html => {
                document.getElementById('main-app').innerHTML = html;
                document.getElementById('main-app').classList.add('active');
                document.getElementById('login-page').classList.remove('active');
                
                // Load appropriate dashboard based on role
                this.loadDashboard(role);
            });
    }

    loadDashboard(role) {
        const script = document.createElement('script');
        script.src = `js/${role}/${role}-dashboard.js`;
        script.onload = () => {
            // Initialize the dashboard
            if (typeof window[`${role}Dashboard`] !== 'undefined') {
                new window[`${role}Dashboard`]();
            }
        };
        document.head.appendChild(script);
    }

    setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const result = await this.api.post('auth/login.php', { username, password });
            
            if (result.success) {
                this.auth.setToken(result.data.token);
                this.currentUser = result.data.user;
                this.loadMainApp();
            }
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    }

    setupEventListeners() {
        // Global logout handler
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logout-btn') {
                this.auth.logout();
                this.loadLoginPage();
            }
        });
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DentalClinicApp();
});