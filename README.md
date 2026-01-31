# Reference Manager

**A modern, local dashboard for organizing your AI Reference Repositories.**
This application wraps your PowerShell management scripts in a premium React UI, allowing you to "Smart Clone" repositories and visualize your library status.

![Dashboard Preview](https://via.placeholder.com/800x450?text=Reference+Manager+UI)

## Features
- **Smart Clone:** Paste a GitHub URL, and the system automatically categorizes it (Agent, Skill, Tool, etc.) and clones it to the right folder.
- **Visual Dashboard:** See your repository counts by category.
- **Real-time Logs:** Watch the analysis logic happen in the terminal window.
- **Portability:** Can manage any repository folder (Defaults to `D:\Projects\reference-repos`).

## Installation

1.  **Clone this repo:**
    ```bash
    git clone https://github.com/your-username/reference-manager.git
    cd reference-manager
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    cd client
    npm install
    cd ..
    ```

## Usage

**Option 1: Windows Batch**
Double-click `start.bat`.

**Option 2: Command Line**
```bash
npm start
```
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3001](http://localhost:3001)

## Configuration
By default, the app manages `D:\Projects\reference-repos`.
To change this, edit `server/index.js`:
```javascript
let REPOS_ROOT = "D:\\Projects\\reference-repos"; // Change this path
```

## License
MIT
