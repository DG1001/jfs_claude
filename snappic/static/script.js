// Global variables
let uploadForm, fileInput, previewContainer, previewImage, removePreview, commentInput, charCount, uploadBtn, messageDiv;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeEventListeners();
    registerServiceWorker();
});

function initializeElements() {
    uploadForm = document.getElementById('uploadForm');
    fileInput = document.getElementById('fileInput');
    previewContainer = document.getElementById('previewContainer');
    previewImage = document.getElementById('previewImage');
    removePreview = document.getElementById('removePreview');
    commentInput = document.getElementById('comment');
    charCount = document.getElementById('charCount');
    uploadBtn = document.getElementById('uploadBtn');
    messageDiv = document.getElementById('message');
}

function initializeEventListeners() {
    // Only initialize upload form listeners if elements exist (on upload page)
    if (uploadForm) {
        fileInput.addEventListener('change', handleFileSelect);
        removePreview.addEventListener('click', clearPreview);
        commentInput.addEventListener('input', updateCharCount);
        uploadForm.addEventListener('submit', handleSubmit);
        
        // Drag and drop functionality
        const fileLabel = document.querySelector('.file-label');
        fileLabel.addEventListener('dragover', handleDragOver);
        fileLabel.addEventListener('dragleave', handleDragLeave);
        fileLabel.addEventListener('drop', handleDrop);
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        showPreview(file);
        enableUploadButton();
    }
}

function showPreview(file) {
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function clearPreview() {
    previewContainer.style.display = 'none';
    previewImage.src = '';
    fileInput.value = '';
    disableUploadButton();
}

function updateCharCount() {
    const count = commentInput.value.length;
    charCount.textContent = count;
    
    if (count > 100) {
        charCount.style.color = '#f44336';
    } else if (count > 80) {
        charCount.style.color = '#ff9800';
    } else {
        charCount.style.color = '#666';
    }
}

function enableUploadButton() {
    uploadBtn.disabled = false;
}

function disableUploadButton() {
    uploadBtn.disabled = true;
}

function handleSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData();
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Bitte wähle ein Foto aus', 'error');
        return;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showMessage('Datei zu groß. Maximal 5MB erlaubt.', 'error');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showMessage('Ungültiger Dateityp. Nur JPG, PNG und WEBP erlaubt.', 'error');
        return;
    }
    
    formData.append('file', file);
    formData.append('comment', commentInput.value.trim());
    
    // Show loading state
    showLoading();
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.success) {
            showMessage('Foto erfolgreich hochgeladen!', 'success');
            resetForm();
            
            // Redirect to gallery after 1.5 seconds
            setTimeout(() => {
                window.location.href = '/gallery';
            }, 1500);
        } else {
            showMessage(data.error || 'Fehler beim Hochladen', 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Upload error:', error);
        showMessage('Netzwerkfehler beim Hochladen', 'error');
    });
}

function showLoading() {
    const btnText = uploadBtn.querySelector('.btn-text');
    const spinner = uploadBtn.querySelector('.loading-spinner');
    
    btnText.textContent = 'Wird hochgeladen...';
    spinner.style.display = 'block';
    uploadBtn.disabled = true;
}

function hideLoading() {
    const btnText = uploadBtn.querySelector('.btn-text');
    const spinner = uploadBtn.querySelector('.loading-spinner');
    
    btnText.textContent = 'Foto teilen';
    spinner.style.display = 'none';
    uploadBtn.disabled = false;
}

function resetForm() {
    uploadForm.reset();
    clearPreview();
    commentInput.value = '';
    updateCharCount();
}

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// Drag and drop handlers
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        showPreview(files[0]);
        enableUploadButton();
    }
}

// PWA Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully');
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// PWA Install Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    
    // Show install button if desired
    // For now, we'll keep it simple and not show a custom install button
});

// Handle PWA installation
window.addEventListener('appinstalled', (event) => {
    console.log('SnapPic PWA installed successfully');
});

// Utility functions for image validation
function isValidImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return allowedTypes.includes(file.type);
}

function isValidFileSize(file, maxSizeMB = 5) {
    return file.size <= maxSizeMB * 1024 * 1024;
}

// Network status handling
window.addEventListener('online', () => {
    showMessage('Verbindung wiederhergestellt', 'success');
});

window.addEventListener('offline', () => {
    showMessage('Keine Internetverbindung', 'error');
});

// Prevent zoom on iOS when focusing input fields
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
});

// Handle iOS Safari viewport issues
function handleViewportResize() {
    // Fix for iOS Safari address bar resizing
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }
}

// Call on load and orientation change
window.addEventListener('load', handleViewportResize);
window.addEventListener('orientationchange', handleViewportResize);