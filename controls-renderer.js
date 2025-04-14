const { ipcRenderer } = require('electron');

// Window dragging
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);

function dragStart(e) {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === document.body || e.target.classList.contains('controls')) {
        isDragging = true;
    }
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, document.body);
    }
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

// Control updates
const modelSelect = document.getElementById('model');
const directiveInput = document.getElementById('directive');
const connectionStatus = document.getElementById('connectionStatus');
const minimizeBtn = document.querySelector('.minimize');
const maximizeBtn = document.querySelector('.maximize');
const closeBtn = document.querySelector('.close');
const fileCounter = document.getElementById('fileCounter');

// Initialize with saved settings
ipcRenderer.on('load-settings', (event, settings) => {
    console.log('Loading settings:', settings);
    if (settings.directive) {
        directiveInput.value = settings.directive;
    }
    // Store the model selection to use when models are loaded
    if (settings.model) {
        window.selectedModel = settings.model;
    }
    
    // Adjust window height after settings are loaded
    setTimeout(adjustWindowHeight, 100);
});

// Update available models and connection status
ipcRenderer.on('connection-status', (event, status) => {
    console.log('Connection status:', status);
    connectionStatus.textContent = status;
    connectionStatus.className = `connection-status ${status.toLowerCase()}`;
    
    if (status === 'connected') {
        // Request available models
        ipcRenderer.send('request-models');
    } else if (status === 'disconnected') {
        // Clear models and show error
        modelSelect.innerHTML = '<option value="" disabled>OLAMMA not available</option>';
        modelSelect.disabled = true;
    } else {
        // Checking connection
        modelSelect.innerHTML = '<option value="" disabled>Checking connection...</option>';
        modelSelect.disabled = true;
    }
});

// Populate models dropdown
ipcRenderer.on('update-models', (event, models) => {
    console.log('Updating models:', models);
    // Clear existing options
    modelSelect.innerHTML = '';
    modelSelect.disabled = false;
    
    if (models && models.length > 0) {
        // Add available models
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
        
        // Try to select the previously selected model or use the one from settings
        const settings = ipcRenderer.sendSync('get-settings');
        const preferredModel = window.selectedModel || (settings && settings.model);
        
        // Check if the preferred model exists in the available models
        const modelExists = Array.from(modelSelect.options).some(option => option.value === preferredModel);
        
        if (modelExists && preferredModel) {
            modelSelect.value = preferredModel;
        } else {
            // Default to first available model
            modelSelect.value = models[0].name;
            // Update the settings with the selected model
            ipcRenderer.send('update-settings', { model: models[0].name });
        }
        
        // Trigger a change event to update the model
        const changeEvent = new Event('change');
        modelSelect.dispatchEvent(changeEvent);
    } else {
        // No models available
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        option.disabled = true;
        modelSelect.appendChild(option);
        modelSelect.disabled = true;
    }
    
    // Adjust window height after models are updated
    setTimeout(adjustWindowHeight, 100);
});

// Handle model selection
modelSelect.addEventListener('change', (e) => {
    console.log('Model changed to:', e.target.value);
    window.selectedModel = e.target.value;
    ipcRenderer.send('update-settings', { model: e.target.value });
});

// Handle directive input
directiveInput.addEventListener('input', (e) => {
    ipcRenderer.send('update-settings', { directive: e.target.value });
});

// Also adjust height when directive is resized
directiveInput.addEventListener('mouseup', adjustWindowHeight);

// Receive file count updates
ipcRenderer.on('update-file-count', (event, count) => {
    fileCounter.textContent = `${count} note${count !== 1 ? 's' : ''}`;
    
    // Adjust height when count changes (may affect layout)
    setTimeout(adjustWindowHeight, 100);
});

// Window controls
minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

maximizeBtn.addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// After all DOM elements are loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for all dynamic content to load
    setTimeout(adjustWindowHeight, 100);
});

// Function to adjust window height based on content
function adjustWindowHeight() {
    const container = document.querySelector('.controls-container');
    // Add a small padding to ensure everything fits
    const height = container.offsetHeight + 30; // draggable area height
    ipcRenderer.send('resize-controls-window', height);
} 