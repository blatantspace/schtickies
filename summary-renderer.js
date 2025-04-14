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

// Helper function to safely convert plain text to HTML
function convertToFormattedHTML(text) {
    if (!text) return '';
    
    // Replace consecutive newlines with paragraph breaks
    let html = text.replace(/\n\s*\n/g, '</p><p>');
    
    // Replace single newlines with line breaks
    html = html.replace(/\n/g, '<br>');
    
    // Detect and format headers (e.g., # Header)
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    
    // Detect and format bold text
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Detect and format italic text
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Detect and format bullet points
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    
    // Wrap in paragraph tags if not already done
    if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
    }
    
    return html;
}

// Content updates
const summary = document.getElementById('summary');
const summaryContent = document.getElementById('summaryContent');
const debugSection = document.getElementById('debugSection');
const minimizeBtn = document.querySelector('.minimize');
const maximizeBtn = document.querySelector('.maximize');
const closeBtn = document.querySelector('.close');
const fileCounter = document.getElementById('fileCounter');
const refreshButton = document.getElementById('refreshButton');

// Receive summary updates
ipcRenderer.on('update-summary', (event, content) => {
    console.log('Received summary update:', content);
    if (content && content.trim()) {
        const formattedContent = convertToFormattedHTML(content);
        summaryContent.innerHTML = formattedContent;
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

// Add refresh button event listener
refreshButton.addEventListener('click', () => {
    console.log('Manual refresh requested');
    ipcRenderer.send('force-summarize');
    
    // Optional: Show loading indicator
    summaryContent.innerHTML = '<p>Updating summary...</p>';
    
    // Add a visual feedback for the button
    refreshButton.style.transform = 'rotate(360deg)';
    refreshButton.style.transition = 'transform 0.5s ease-in-out';
    
    setTimeout(() => {
        refreshButton.style.transform = 'rotate(0deg)';
    }, 500);
}); 