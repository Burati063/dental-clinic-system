class Auth {
    constructor() {
        this.tokenKey = 'dental_clinic_token';
        this.userKey = 'dental_clinic_user';
    }

    setToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    setCurrentUser(user) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    getCurrentUser() {
        const user = localStorage.getItem(this.userKey);
        return user ? JSON.parse(user) : null;
    }

    isLoggedIn() {
        return this.getToken() !== null;
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }
}