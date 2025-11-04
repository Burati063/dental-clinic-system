class FooterComponent {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFooterStats();
    }

    setupEventListeners() {
        // Smooth scrolling for anchor links
        document.addEventListener('click', (e) => {
            if (e.target.matches('.footer-links a, .footer-links-bottom a')) {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                if (href && href.startsWith('#')) {
                    this.scrollToSection(href);
                } else if (href && href.endsWith('.html')) {
                    app.navigateTo(href);
                }
            }
        });

        // Social media links
        document.addEventListener('click', (e) => {
            if (e.target.closest('.social-link')) {
                e.preventDefault();
                this.handleSocialClick(e.target.closest('.social-link'));
            }
        });

        // Contact info interactions
        this.setupContactInteractions();
    }

    scrollToSection(sectionId) {
        const target = document.querySelector(sectionId);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    handleSocialClick(socialLink) {
        const platform = socialLink.querySelector('i').className;
        const platforms = {
            'fa-facebook-f': 'Facebook',
            'fa-twitter': 'Twitter',
            'fa-linkedin-in': 'LinkedIn',
            'fa-instagram': 'Instagram'
        };

        const platformName = Object.keys(platforms).find(key => platform.includes(key));
        const platformDisplay = platforms[platformName] || 'Social Media';

        Utils.showNotification(`Opening ${platformDisplay}...`, 'info');
        
        // In a real application, this would redirect to actual social media URLs
        setTimeout(() => {
            console.log(`Redirecting to ${platformDisplay}`);
            // window.open(socialLink.href, '_blank');
        }, 1000);
    }

    setupContactInteractions() {
        // Phone number click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.contact-item') && e.target.closest('.contact-item').textContent.includes('+1')) {
                const phoneNumber = '+1 (555) 123-4567';
                if (confirm(`Would you like to call ${phoneNumber}?`)) {
                    window.open(`tel:${phoneNumber}`, '_self');
                }
            }
        });

        // Email click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.contact-item') && e.target.closest('.contact-item').textContent.includes('@')) {
                const email = 'info@dentalclinic.com';
                if (confirm(`Would you like to email ${email}?`)) {
                    window.open(`mailto:${email}`, '_self');
                }
            }
        });
    }

    async loadFooterStats() {
        try {
            // Simulate loading system statistics for footer
            const stats = await this.getSystemStats();
            this.updateFooterStats(stats);
        } catch (error) {
            console.error('Error loading footer stats:', error);
        }
    }

    async getSystemStats() {
        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    totalPatients: 1247,
                    activeAppointments: 23,
                    systemUptime: '99.9%',
                    lastBackup: '2 hours ago'
                });
            }, 1000);
        });
    }

    updateFooterStats(stats) {
        // You can add dynamic stats to footer if needed
        console.log('System Stats:', stats);
    }

    // Method to update copyright year dynamically
    updateCopyrightYear() {
        const copyrightElement = document.querySelector('.copyright');
        if (copyrightElement) {
            const currentYear = new Date().getFullYear();
            copyrightElement.textContent = `© ${currentYear} Dental Clinic Management System. All rights reserved.`;
        }
    }

    // Method to handle newsletter subscription (if added later)
    setupNewsletterSubscription() {
        const newsletterForm = document.getElementById('newsletter-form');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNewsletterSubscription(newsletterForm);
            });
        }
    }

    async handleNewsletterSubscription(form) {
        const email = form.querySelector('input[type="email"]').value;
        
        if (!Utils.validateEmail(email)) {
            Utils.showNotification('Please enter a valid email address.', 'error');
            return;
        }

        try {
            // Simulate API call
            await this.subscribeToNewsletter(email);
            Utils.showNotification('Successfully subscribed to newsletter!', 'success');
            form.reset();
        } catch (error) {
            Utils.showNotification('Subscription failed. Please try again.', 'error');
        }
    }

    async subscribeToNewsletter(email) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate random success/failure
                Math.random() > 0.2 ? resolve() : reject(new Error('Subscription failed'));
            }, 1500);
        });
    }

    // Method to handle feedback submission
    setupFeedbackSystem() {
        const feedbackLink = document.querySelector('a[href="feedback.html"]');
        if (feedbackLink) {
            feedbackLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showFeedbackModal();
            });
        }
    }

    showFeedbackModal() {
        // This would open a feedback modal
        Utils.showNotification('Feedback system would open here', 'info');
    }

    // Method to track footer interactions for analytics
    trackFooterInteraction(action, label) {
        console.log('Footer Interaction:', { action, label, timestamp: new Date().toISOString() });
        // In a real application, this would send data to analytics service
    }
}

// Initialize footer when component is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.footerComponent = new FooterComponent();
});