/**
 * Institutional UI Framework for BIT Portal
 * Replaces native browser dialogs with branded, professional components.
 */

const InstitutionalUI = {
    /**
     * Show a branded alert/confirm modal
     */
    alert: function(title, message, callback) {
        return this._showModal(title, message, 'alert', callback);
    },

    confirm: function(title, message, callback) {
        return this._showModal(title, message, 'confirm', callback);
    },

    /**
     * Show a branded prompt modal for remarks/input
     */
    prompt: function(title, label, callback) {
        return this._showModal(title, label, 'prompt', callback);
    },

    /**
     * Show a generic notification toast
     */
    toast: function(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `bit-toast bit-toast-${type} animate-in`;
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    _showModal: function(title, content, type, callback) {
        return new Promise((resolve) => {
            // Remove existing if any
            const existing = document.getElementById('bit-institutional-modal');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'bit-institutional-modal';
            overlay.className = 'modal-overlay';
            overlay.style.display = 'flex';
            overlay.style.zIndex = '9999';

            let inputHTML = '';
            if (type === 'prompt') {
                inputHTML = `<input type="text" id="bit-modal-input" placeholder="${content}..." style="width:100%; margin-top:15px; padding:12px; border:1px solid var(--border-color); border-radius:8px;">`;
            }

            overlay.innerHTML = `
                <div class="modal-content animate-pop" style="max-width:400px; padding:30px; text-align:center; border-top:5px solid var(--primary); position:relative;">
                    <button id="bit-modal-close" style="position:absolute; right:15px; top:10px; background:none; border:none; color:var(--text-color); font-size:24px; cursor:pointer; opacity:0.5;">&times;</button>
                    <img src="hero-campus.png" alt="BIT Campus" style="width:70px; height:70px; border-radius:50%; object-fit:cover; margin-bottom:15px; border:2px solid var(--primary); box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                    <h3 style="margin-bottom:10px; font-family:var(--font-head); color:var(--primary);">${title}</h3>
                    <p style="font-size:14px; opacity:0.8; line-height:1.5;">${type === 'prompt' ? '' : content}</p>
                    ${inputHTML}
                    <div style="display:flex; justify-content:center; gap:15px; margin-top:25px;">
                        ${type === 'confirm' || type === 'prompt' ? `<button id="bit-modal-cancel" style="background:var(--secondary); color:var(--text-color); width:auto; padding:8px 25px;">Cancel</button>` : ''}
                        <button id="bit-modal-ok" style="width:auto; padding:8px 35px; background:var(--primary);">Confirm</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            // Trigger show animation
            requestAnimationFrame(() => {
                overlay.classList.add('show');
            });

            const okBtn = overlay.querySelector('#bit-modal-ok');
            const cancelBtn = overlay.querySelector('#bit-modal-cancel');
            const closeBtn = overlay.querySelector('#bit-modal-close');

            const closeModal = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.remove();
                    if (callback) callback(result);
                    resolve(result);
                }, 300);
            };

            okBtn.onclick = () => {
                if (type === 'prompt') {
                    const val = overlay.querySelector('#bit-modal-input').value;
                    closeModal(val);
                } else {
                    closeModal(true);
                }
            };

            if (cancelBtn) {
                cancelBtn.onclick = () => closeModal(null);
            }
            
            if (closeBtn) {
                closeBtn.onclick = () => closeModal(null);
            }
        });
    }
};

window.BIT = InstitutionalUI;
