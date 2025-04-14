# Schtickies 🧠

A minimal, distraction-free Electron app for managing sticky notes with automatic summarization.

## Features

- **Notes Schtickies (Yellow)**: Create as many notes as you need, all markdown-based
- **Summary Schticky (Blue)**: Automatically summarizes all your open notes
- **Controls Schticky (Grey)**: Configure the AI model and customize the summary directive

## Built With

- Electron
- OLAMMA local AI for summarization
- DANK MONO font styling

## Getting Started

### Prerequisites

- Node.js
- npm/yarn
- [Ollama](https://ollama.ai/) installed and running locally

### Installation

1. Clone the repository
```
git clone https://github.com/blatantspace/schtickies.git
```

2. Install dependencies
```
cd schtickies
npm install
```

3. Run the application
```
npm start
```

## Usage

- Create new notes from the File menu
- Type in your notes - the first line will become the title
- Adjust the AI model and summary directive in the Controls panel
- View the automatically generated summary in the blue Summary schticky

## License

MIT 