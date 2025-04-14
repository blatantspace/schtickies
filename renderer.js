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
    if (e.target.id === 'editor') return;
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === document.body) {
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

// Content handling
const editor = document.getElementById('editor');
const noteTitleElement = document.getElementById('note-title');

// Load saved content
ipcRenderer.on('load-content', (event, content) => {
    editor.value = content;
});

// Set note title
ipcRenderer.on('set-note-title', (event, title) => {
    noteTitleElement.textContent = title;
});

// Update title based on content
function updateTitleFromContent() {
    const firstLine = editor.value.split('\n')[0].trim();
    if (firstLine && firstLine.length > 0) {
        // Use the first line as the title if it's not empty
        const title = firstLine.substring(0, 25) + (firstLine.length > 25 ? '...' : '');
        noteTitleElement.textContent = title;
    }
}

// Send content updates
let debounceTimeout;
editor.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        ipcRenderer.send('update-content', editor.value);
        
        // Also update the title based on content
        updateTitleFromContent();
    }, 500); // Debounce for 500ms
});

// Window controls
const minimizeBtn = document.querySelector('.minimize');
const maximizeBtn = document.querySelector('.maximize');
const closeBtn = document.querySelector('.close');

minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

maximizeBtn.addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-window');
}); 