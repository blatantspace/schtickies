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
const directivePresets = document.getElementById('directivePresets');
const directiveInput = document.getElementById('directive');
const connectionStatus = document.getElementById('connectionStatus');
const minimizeBtn = document.querySelector('.minimize');
const maximizeBtn = document.querySelector('.maximize');
const closeBtn = document.querySelector('.close');
const fileCounter = document.getElementById('fileCounter');

// Define preset directives
const presetDirectives = {
    custom: "",
    tasks: "Extract all actionable tasks from these notes. Format as a prioritized list with clear next steps. Remove duplicates. Group related items. Highlight urgent items first.",
    keypoints: "Distill these notes into a bulleted list of key points. Focus on facts, insights, and core ideas only. Use concise language. Maximum 10 points. Include only the most important information.",
    meeting: "Structure these meeting notes into sections: 1) Key Decisions 2) Action Items (with owners if mentioned) 3) Main Discussion Points. Format as headers with brief bullet points under each. Be concise and direct.",
    ideas: "Extract and organize creative concepts from these notes. Highlight novel ideas. Group related concepts. Suggest potential applications or extensions of each idea. Present as a structured outline.",
    research: "Synthesize these research notes into a coherent summary. Include: key findings, methodologies mentioned, open questions, and potential next steps. Organize logically. Use clear headings. Highlight gaps in information."
};

// Initialize with saved settings
ipcRenderer.on('load-settings', (event, settings) => {
    console.log('Loading settings:', settings);
    if (settings.directive) {
        directiveInput.value = settings.directive;
        
        // Check if current directive matches any preset
        const presetEntry = Object.entries(presetDirectives).find(([key, value]) => 
            value === settings.directive
        );
        
        if (presetEntry) {
            directivePresets.value = presetEntry[0];
        } else {
            directivePresets.value = 'custom';
        }
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

// Handle directive presets selection
directivePresets.addEventListener('change', (e) => {
    const selectedPreset = e.target.value;
    const presetText = presetDirectives[selectedPreset];
    
    // Update the directive input with the preset text
    directiveInput.value = presetText;
    
    // Save the new directive setting
    ipcRenderer.send('update-settings', { directive: presetText });
});

// Handle directive input - update to custom when user manually edits
directiveInput.addEventListener('input', (e) => {
    // Set preset selector to custom when user edits the directive
    directivePresets.value = 'custom';
    
    // Update the directive setting
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