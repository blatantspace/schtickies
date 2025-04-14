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
    if (e.target.id === 'summary') return;
    
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

// Content updates
const summary = document.getElementById('summary');
const summaryContent = document.getElementById('summaryContent');
const debugSection = document.getElementById('debugSection');
const minimizeBtn = document.querySelector('.minimize');
const maximizeBtn = document.querySelector('.maximize');
const closeBtn = document.querySelector('.close');
const fileCounter = document.getElementById('fileCounter');

// Receive summary updates
ipcRenderer.on('update-summary', (event, content) => {
    console.log('Received summary update:', content);
    if (content && content.trim()) {
        summaryContent.textContent = content;
    } else {
        summaryContent.textContent = 'No notes to summarize yet. Start typing in your note to see a summary here.';
    }
});

// Receive debug info about notes being included
ipcRenderer.on('update-note-debug', (event, debug) => {
    console.log('Note debug info:', debug);
    debugSection.textContent = 'Notes included in this summary:\n' + debug;
});

// Receive file count updates
ipcRenderer.on('update-file-count', (event, count) => {
    fileCounter.textContent = `${count} note${count !== 1 ? 's' : ''}`;
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