class ModalComponent {
    constructor() {
        this.modals = new Map();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupEscapeKey();
    }

    setupEventListeners() {
        // Close modal when clicking overlay
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeCurrentModal();
            }
        });

        // Close modal when clicking close button
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-close')) {
                this.closeCurrentModal();
            }
        });

        // Prevent modal content click from closing modal
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal') && e.target.closest('.modal-backdrop')) {
                e.stopPropagation();
            }
        });
    }

    setupEscapeKey() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCurrentModal();
            }
        });
    }

    createModal(id, options = {}) {
        const defaultOptions = {
            title: 'Modal',
            content: '',
            size: 'medium', // small, medium, large, fullscreen
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            buttons: [],
            onOpen: null,
            onClose: null,
            onConfirm: null,
            backdrop: true
        };

        const config = { ...defaultOptions, ...options };

        const modalHTML = this.generateModalHTML(id, config);
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = {
            id,
            element: document.getElementById(`${id}-modal`),
            config,
            isOpen: false
        };

        this.modals.set(id, modal);
        this.setupModalEvents(modal);

        return modal;
    }

    generateModalHTML(id, config) {
        const sizeClass = `modal-${config.size}`;
        const backdropClass = config.backdrop ? 'modal-backdrop' : 'modal-backdrop no-backdrop';

        return `
            <div id="${id}-modal" class="${backdropClass} hidden">
                <div class="modal ${sizeClass}">
                    <div class="modal-header">
                        <h3>${config.title}</h3>
                        ${config.showCloseButton ? 
                            '<button class="modal-close"><i class="fas fa-times"></i></button>' : 
                            ''
                        }
                    </div>
                    <div class="modal-body">
                        ${config.content}
                    </div>
                    ${config.buttons.length > 0 ? `
                        <div class="modal-footer">
                            ${config.buttons.map(button => `
                                <button class="btn ${button.class || 'btn-outline'}" 
                                        data-action="${button.action || 'close'}"
                                        ${button.disabled ? 'disabled' : ''}>
                                    ${button.text}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    setupModalEvents(modal) {
        const modalElement = modal.element;
        const closeBtn = modalElement.querySelector('.modal-close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal(modal.id));
        }

        // Setup button events
        const buttons = modalElement.querySelectorAll('.modal-footer .btn');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                this.handleModalAction(modal.id, action);
            });
        });

        // Call onOpen callback if provided
        if (modal.config.onOpen) {
            modalElement.addEventListener('modal-open', modal.config.onOpen);
        }

        // Call onClose callback if provided
        if (modal.config.onClose) {
            modalElement.addEventListener('modal-close', modal.config.onClose);
        }
    }

    openModal(id) {
        const modal = this.modals.get(id);
        if (!modal) {
            console.error(`Modal with id '${id}' not found`);
            return;
        }

        if (modal.isOpen) return;

        modal.element.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        modal.isOpen = true;

        // Trigger open event
        const openEvent = new CustomEvent('modal-open', { detail: { modalId: id } });
        modal.element.dispatchEvent(openEvent);

        // Focus trap
        this.setupFocusTrap(modal.element);

        Utils.showNotification(`Modal ${id} opened`, 'info');
    }

    closeModal(id) {
        const modal = this.modals.get(id);
        if (!modal || !modal.isOpen) return;

        modal.element.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scrolling
        modal.isOpen = false;

        // Trigger close event
        const closeEvent = new CustomEvent('modal-close', { detail: { modalId: id } });
        modal.element.dispatchEvent(closeEvent);

        Utils.showNotification(`Modal ${id} closed`, 'info');
    }

    closeCurrentModal() {
        const openModal = Array.from(this.modals.values()).find(modal => modal.isOpen);
        if (openModal) {
            this.closeModal(openModal.id);
        }
    }

    handleModalAction(modalId, action) {
        const modal = this.modals.get(modalId);
        if (!modal) return;

        switch (action) {
            case 'confirm':
                if (modal.config.onConfirm) {
                    modal.config.onConfirm();
                }
                this.closeModal(modalId);
                break;
            case 'close':
                this.closeModal(modalId);
                break;
            default:
                console.log(`Modal action: ${action}`);
                this.closeModal(modalId);
        }
    }

    setupFocusTrap(modalElement) {
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        modalElement.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });

        firstElement.focus();
    }

    // Predefined modal types
    confirm(options) {
        const modalId = `confirm-${Utils.generateId()}`;
        
        const confirmOptions = {
            title: options.title || 'Confirm Action',
            content: options.message || 'Are you sure you want to proceed?',
            size: 'small',
            buttons: [
                {
                    text: 'Cancel',
                    action: 'close',
                    class: 'btn-outline'
                },
                {
                    text: 'Confirm',
                    action: 'confirm',
                    class: 'btn-primary'
                }
            ],
            onConfirm: options.onConfirm || null
        };

        const modal = this.createModal(modalId, confirmOptions);
        this.openModal(modalId);

        return modal;
    }

    alert(options) {
        const modalId = `alert-${Utils.generateId()}`;
        
        const alertOptions = {
            title: options.title || 'Alert',
            content: options.message || 'This is an alert message.',
            size: 'small',
            buttons: [
                {
                    text: 'OK',
                    action: 'close',
                    class: 'btn-primary'
                }
            ]
        };

        const modal = this.createModal(modalId, alertOptions);
        this.openModal(modalId);

        return modal;
    }

    prompt(options) {
        const modalId = `prompt-${Utils.generateId()}`;
        const inputId = `prompt-input-${Utils.generateId()}`;

        const promptContent = `
            <p>${options.message || 'Please enter your input:'}</p>
            <div class="form-group">
                <input type="${options.inputType || 'text'}" 
                       id="${inputId}" 
                       class="form-control" 
                       placeholder="${options.placeholder || ''}"
                       value="${options.defaultValue || ''}">
            </div>
        `;

        const promptOptions = {
            title: options.title || 'Input Required',
            content: promptContent,
            size: 'small',
            buttons: [
                {
                    text: 'Cancel',
                    action: 'close',
                    class: 'btn-outline'
                },
                {
                    text: 'Submit',
                    action: 'confirm',
                    class: 'btn-primary'
                }
            ],
            onConfirm: () => {
                const input = document.getElementById(inputId);
                if (options.onSubmit) {
                    options.onSubmit(input.value);
                }
            }
        };

        const modal = this.createModal(modalId, promptOptions);
        this.openModal(modalId);

        // Focus input when modal opens
        setTimeout(() => {
            const input = document.getElementById(inputId);
            if (input) input.focus();
        }, 100);

        return modal;
    }

    loading(message = 'Loading...') {
        const modalId = `loading-${Utils.generateId()}`;
        
        const loadingContent = `
            <div class="loading-modal-content">
                <div class="spinner-large"></div>
                <p>${message}</p>
            </div>
        `;

        const loadingOptions = {
            title: '',
            content: loadingContent,
            size: 'small',
            showCloseButton: false,
            closeOnBackdrop: false,
            closeOnEscape: false,
            backdrop: true
        };

        const modal = this.createModal(modalId, loadingOptions);
        this.openModal(modalId);

        return modal;
    }

    // Utility methods
    destroyModal(id) {
        const modal = this.modals.get(id);
        if (modal) {
            if (modal.element) {
                modal.element.remove();
            }
            this.modals.delete(id);
        }
    }

    destroyAllModals() {
        this.modals.forEach((modal, id) => {
            this.destroyModal(id);
        });
    }

    getOpenModals() {
        return Array.from(this.modals.values()).filter(modal => modal.isOpen);
    }

    isModalOpen(id) {
        const modal = this.modals.get(id);
        return modal ? modal.isOpen : false;
    }
}

// Add modal styles dynamically
const modalStyles = `
<style>
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    padding: 2rem;
}

.modal-backdrop.no-backdrop {
    background: transparent;
    pointer-events: none;
}

.modal-backdrop.no-backdrop .modal {
    pointer-events: all;
}

.modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    max-width: 90%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.modal-small {
    width: 400px;
}

.modal-medium {
    width: 600px;
}

.modal-large {
    width: 800px;
}

.modal-fullscreen {
    width: 95vw;
    height: 95vh;
}

.modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    position: sticky;
    top: 0;
    z-index: 1;
}

.modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--dark);
}

.modal-close {
    background: none;
    border: none;
    color: var(--gray);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.3s ease;
    font-size: 1rem;
}

.modal-close:hover {
    background: var(--gray-light);
    color: var(--dark);
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    background: var(--gray-light);
}

.loading-modal-content {
    text-align: center;
    padding: 2rem;
}

.spinner-large {
    width: 50px;
    height: 50px;
    border: 4px solid var(--gray-light);
    border-top: 4px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

.loading-modal-content p {
    margin: 0;
    color: var(--gray);
    font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
    .modal-backdrop {
        padding: 1rem;
    }
    
    .modal-small,
    .modal-medium,
    .modal-large {
        width: 100%;
        max-width: none;
    }
    
    .modal-footer {
        flex-direction: column;
    }
    
    .modal-footer .btn {
        width: 100%;
    }
}
</style>
`;

// Add styles to document
document.head.insertAdjacentHTML('beforeend', modalStyles);

// Initialize modal system
document.addEventListener('DOMContentLoaded', () => {
    window.Modal = new ModalComponent();
});