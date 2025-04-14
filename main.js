const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const ollamaService = require('./ollama-service.js');
const fs = require('fs');
const fetch = require('node-fetch');

const store = new Store();

// Keep a global reference of the window objects
let mainWindow;
let summaryWindow;
let controlsWindow;
let noteWindows = new Set();

// Track open notes and their content
const openNotes = new Map(); // Map of window ID to content

// Notes directory
const NOTES_DIR = path.join(app.getPath('userData'), 'notes');

// Ensure notes directory exists
if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
}

// Load saved settings
const settings = store.get('settings') || {
    model: 'llama3.2',
    directive: 'Summarize the following notes in a clear and concise way:'
};

// Check OLAMMA connection periodically
let connectionCheckInterval;

function checkOllamaConnection() {
    ollamaService.checkConnection().then(isConnected => {
        const status = ollamaService.connectionStatus;
        if (controlsWindow && !controlsWindow.isDestroyed()) {
            controlsWindow.webContents.send('connection-status', status);
        }
    });
}

function createNoteWindow() {
  // Calculate position based on number of open notes 
  const screenSize = require('electron').screen.getPrimaryDisplay().workAreaSize;
  const windowCount = noteWindows.size;
  
  // Create a grid-like positioning system
  // We'll use a 3x3 grid across the screen to position windows
  const cols = 3;
  const rows = 3;
  const positionIndex = windowCount % (cols * rows);
  
  const col = positionIndex % cols;
  const row = Math.floor(positionIndex / cols);
  
  // Calculate position based on grid cell
  const xOffset = Math.floor(col * (screenSize.width / cols)) + 50 * (col + 1);
  const yOffset = Math.floor(row * (screenSize.height / rows)) + 50 * (row + 1);
  
  // Generate a unique filename for this note
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const noteTitle = `note-${timestamp}`;
  
  const noteWindow = new BrowserWindow({
    width: 400,
    height: 500,
    x: xOffset,
    y: yOffset,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true
  });

  noteWindow.loadFile('index.html');
  noteWindows.add(noteWindow);
  
  // Add this note window to our tracking
  const noteWindowId = noteWindow.webContents.id;
  openNotes.set(noteWindowId, '');
  
  // Send the note title to the renderer
  noteWindow.webContents.on('did-finish-load', () => {
    noteWindow.webContents.send('set-note-title', noteTitle);
  });
  
  // Handle window closing
  noteWindow.on('closed', () => {
    handleWindowClose(noteWindowId);
    noteWindows.delete(noteWindow);
  });
  
  return noteWindow;
}

// Add window close handlers to all windows
function setupWindowHandlers() {
  // Clear any existing listeners to avoid duplicates
  mainWindow.removeAllListeners('closed');
  summaryWindow.removeAllListeners('closed');
  controlsWindow.removeAllListeners('closed');
  
  // Set up window close handlers for all main windows
  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });
  
  summaryWindow.on('closed', () => {
    console.log('Summary window closed');
    summaryWindow = null;
  });
  
  controlsWindow.on('closed', () => {
    console.log('Controls window closed');
    controlsWindow = null;
  });
  
  // Listen for all window closing events to handle minimize/maximize
  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });
  
  ipcMain.on('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });
  
  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const winId = win.webContents.id;
      console.log(`Closing window with ID: ${winId}`);
      handleWindowClose(winId);
      win.close();
    }
  });
}

// Create application menu (for macOS)
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createNoteWindow();
            updateNoteCount();
          }
        },
        {
          label: 'Force Summarize Now',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            updateSummary();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  // Create the main window (Notes) - now using our createNoteWindow function
  mainWindow = createNoteWindow();
  
  // Create the summary window
  summaryWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true
  });

  summaryWindow.loadFile('summary.html');
  
  // Create the controls window
  controlsWindow = new BrowserWindow({
    width: 550,
    height: 200, // Initial height, will be adjusted dynamically
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false
  });

  controlsWindow.loadFile('controls.html');

  // Send initial settings to controls window
  controlsWindow.webContents.on('did-finish-load', () => {
    controlsWindow.webContents.send('load-settings', settings);
    // Initial connection check
    checkOllamaConnection();
    // Set up periodic checks
    connectionCheckInterval = setInterval(checkOllamaConnection, 5000);
    // Update note count
    updateNoteCount();
  });
  
  // Set up window handlers
  setupWindowHandlers();
  
  // Create application menu
  createAppMenu();
}

// Handle content updates from note windows
ipcMain.on('update-content', (event, content) => {
  const windowId = event.sender.id;
  openNotes.set(windowId, content);
  updateNoteCount();
});

// Handle model requests
ipcMain.on('request-models', async (event) => {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (controlsWindow && !controlsWindow.isDestroyed()) {
            controlsWindow.webContents.send('update-models', data.models);
            
            // Auto-select first model if current model doesn't exist
            if (data.models && data.models.length > 0) {
                const modelExists = data.models.some(model => model.name === settings.model);
                if (!modelExists) {
                    settings.model = data.models[0].name;
                    store.set('settings', settings);
                    console.log('Auto-selected model:', settings.model);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching models:', error);
        if (controlsWindow && !controlsWindow.isDestroyed()) {
            controlsWindow.webContents.send('update-models', []);
        }
    }
});

// Handle settings updates with our new approach
ipcMain.on('update-settings', (event, updatedSettings) => {
    if (updatedSettings.model) {
        settings.model = updatedSettings.model;
    }
    if (updatedSettings.directive) {
        settings.directive = updatedSettings.directive;
    }
    store.set('settings', settings);
});

// Handle force summarize
ipcMain.on('force-summarize', (event) => {
    updateSummary();
});

// Handle new note creation
ipcMain.on('create-new-note', (event) => {
    createNoteWindow();
    updateNoteCount();
});

// Handle creating multiple notes
ipcMain.on('create-multiple-notes', (event, count) => {
    console.log(`Creating ${count} new notes...`);
    for (let i = 0; i < count; i++) {
        createNoteWindow();
    }
    updateNoteCount();
});

// Handle clearing all notes
ipcMain.on('clear-all-notes', (event) => {
    console.log('Clearing all notes...');
    
    // Close all note windows
    for (const win of noteWindows) {
        if (!win.isDestroyed()) {
            const winId = win.webContents.id;
            console.log(`Closing note window with ID: ${winId}`);
            win.close();
        }
    }
    
    // Clear the openNotes Map directly as a fallback
    openNotes.clear();
    
    console.log('After clearing, openNotes size:', openNotes.size);
    updateSummary();
    updateNoteCount();
});

// Handle settings requests
ipcMain.on('get-settings', (event) => {
    event.returnValue = settings;
});

// Handle directive updates
ipcMain.on('update-directive', (event, directive) => {
    settings.directive = directive;
    store.set('settings', settings);
});

// Update file counter
function updateNoteCount() {
    const count = openNotes.size;
    if (controlsWindow && !controlsWindow.isDestroyed()) {
        controlsWindow.webContents.send('update-file-count', count);
    }
    
    // Also update summary window with count
    if (summaryWindow && !summaryWindow.isDestroyed()) {
        summaryWindow.webContents.send('update-file-count', count);
    }
}

// Function to update the summary based on all open notes
function updateSummary() {
  // Debug the content of openNotes
  console.log('Current open notes:', openNotes.size);
  openNotes.forEach((content, id) => {
    console.log(`Note ${id} (${content.length} chars): ${content.substring(0, 30)}...`);
  });
  
  // Combine content from all open notes
  const allContent = Array.from(openNotes.values()).join('\n\n---\n\n');
  
  if (!allContent.trim()) return;
  
  // Also send the debugging info to the summary window
  if (summaryWindow && !summaryWindow.isDestroyed()) {
    // Create a debug overview of notes being included
    const noteDebug = Array.from(openNotes.entries()).map(([id, content]) => {
      return `Note ${id}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`;
    }).join('\n');
    
    summaryWindow.webContents.send('update-note-debug', noteDebug);
  }
  
  ollamaService.generateSummaryOnce(
    allContent,
    settings.model,
    settings.directive,
    (summary) => {
      if (summaryWindow && !summaryWindow.isDestroyed()) {
        summaryWindow.webContents.send('update-summary', summary);
      }
    }
  );
}

// Handle window close events to remove notes from tracking
function handleWindowClose(windowId) {
  console.log(`Handling window close for ID: ${windowId}`);
  console.log(`Before: openNotes has ${openNotes.size} entries`);
  
  if (openNotes.has(windowId)) {
    console.log(`Removing note with ID: ${windowId}`);
    openNotes.delete(windowId);
    updateSummary();
    updateNoteCount();
  } else {
    console.log(`Note with ID: ${windowId} not found in openNotes`);
  }
  
  console.log(`After: openNotes has ${openNotes.size} entries`);
  console.log('Current openNotes IDs:', Array.from(openNotes.keys()));
}

// Handle window height adjustment for controls window
ipcMain.on('resize-controls-window', (event, height) => {
    if (controlsWindow && !controlsWindow.isDestroyed()) {
        const currentSize = controlsWindow.getSize();
        controlsWindow.setSize(currentSize[0], height);
    }
});

app.whenReady().then(() => {
  // Clear any previous state
  openNotes.clear();
  noteWindows.clear();
  
  // Create the main windows
  createWindow();
  
  console.log('App ready, openNotes size:', openNotes.size);
});

app.on('window-all-closed', () => {
  console.log('All windows closed, cleaning up...');
  
  // Clear our tracking data structures
  openNotes.clear();
  noteWindows.clear();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up intervals when app is quitting
app.on('before-quit', () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
}); 