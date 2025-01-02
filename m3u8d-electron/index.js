const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { exec, execFile } = require('child_process')
const fs = require('fs')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  })

  mainWindow.loadFile('index.html')
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handlers
ipcMain.handle('open-directory-dialog', async (event, defaultPath) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    defaultPath: defaultPath || app.getPath('downloads')
  })
  return result.filePaths[0]
})

let downloadProcess = null
let isMerging = false

ipcMain.on('start-download', (event, options) => {
  // Build command arguments
  const args = [
    'download',
    '--M3u8Url', options.url,
    '--SaveDir', options.saveDir,
    '--FileName', options.fileName,
    '--SkipTsExpr', options.skipTs,
    '--ThreadCount', options.threadCount.toString(),
    '--SetProxy', options.proxy || '',
    '--TsTempDir', options.tempDir || '',
  ]
  
  if (options.insecure) args.push('--Insecure')
  if (options.skipRemoveTs) args.push('--SkipRemoveTs')
  if (options.skipMerge) args.push('--SkipMergeTs')
  if (options.debugLog) args.push('--DebugLog')
  if (options.useServerTime) args.push('--UseServerSideTime')

  // Start the download process
  downloadProcess = execFile('./m3u8d', args, { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      mainWindow.webContents.send('download-error', error.message)
      return
    }
    
    // Check for errors in stderr
    if (stderr) {
      mainWindow.webContents.send('download-error', stderr)
      return
    }
    
    // Send completion message
    mainWindow.webContents.send('download-complete')
    
    // Automatically merge files if not skipped
    if (!options.skipMerge) {
      mergeFiles(options)
    }
  })

  // Handle process output
  downloadProcess.stdout.on('data', (data) => {
    const output = data.toString()
    
    // Parse progress updates
    const progressMatch = output.match(/Progress: (\d+)%/)
    if (progressMatch) {
      const percent = parseInt(progressMatch[1])
      mainWindow.webContents.send('download-progress', {
        percent: percent,
        status: output.trim()
      })
    }
  })

  downloadProcess.stderr.on('data', (data) => {
    mainWindow.webContents.send('download-error', data.toString())
  })
})

function updateStatus(message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', message)
  }
}

function mergeFiles(options) {
  const outputFile = path.join(options.saveDir, options.fileName || 'output.mp4')
  const inputDir = options.tempDir || options.saveDir
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true })
  }

  // Merging is handled by backend, just notify completion
  mainWindow.webContents.send('merge-complete')
}

ipcMain.on('stop-download', () => {
  if (downloadProcess) {
    // Kill the process and all its child processes
    downloadProcess.kill('SIGTERM')
    
    // Clean up
    downloadProcess = null
    
    // Notify renderer
    mainWindow.webContents.send('download-stopped')
    updateStatus('Download stopped by user')
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
