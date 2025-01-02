const { ipcRenderer } = require('electron')
const path = require('path')

// DOM Elements
const m3u8UrlInput = document.getElementById('m3u8-url')
const saveDirInput = document.getElementById('save-dir')
const fileNameInput = document.getElementById('file-name')
const skipTsInput = document.getElementById('skip-ts')
const tempDirInput = document.getElementById('temp-dir')
const threadCountInput = document.getElementById('thread-count')
const proxyInput = document.getElementById('proxy')
const insecureCheckbox = document.getElementById('insecure')
const skipRemoveTsCheckbox = document.getElementById('skip-remove-ts')
const skipMergeCheckbox = document.getElementById('skip-merge')
const debugLogCheckbox = document.getElementById('debug-log')
const useServerTimeCheckbox = document.getElementById('use-server-time')
const browseDirButton = document.getElementById('browse-dir')
const browseTempDirButton = document.getElementById('browse-temp-dir')
const startButton = document.getElementById('start-download')
const stopButton = document.getElementById('stop-download')
const mergeButton = document.getElementById('merge-ts')
const progressBar = document.getElementById('download-progress')
const progressText = document.getElementById('progress-text')
const statusBar = document.getElementById('status-bar')

// Event Listeners
browseDirButton.addEventListener('click', async () => {
  const dir = await ipcRenderer.invoke('open-directory-dialog')
  if (dir) {
    saveDirInput.value = dir
  }
})

browseTempDirButton.addEventListener('click', async () => {
  const dir = await ipcRenderer.invoke('open-directory-dialog', saveDirInput.value)
  if (dir) {
    tempDirInput.value = dir
  }
})

startButton.addEventListener('click', () => {
  const downloadOptions = {
    url: m3u8UrlInput.value,
    saveDir: saveDirInput.value || path.join(process.cwd(), 'downloads'),
    fileName: fileNameInput.value,
    skipTs: skipTsInput.value,
    tempDir: tempDirInput.value,
    threadCount: parseInt(threadCountInput.value),
    proxy: proxyInput.value,
    insecure: insecureCheckbox.checked,
    skipRemoveTs: skipRemoveTsCheckbox.checked,
    skipMerge: skipMergeCheckbox.checked,
    debugLog: debugLogCheckbox.checked,
    useServerTime: useServerTimeCheckbox.checked
  }

  if (!validateInputs(downloadOptions)) return

  ipcRenderer.send('start-download', downloadOptions)
  toggleControls(true)
  updateStatus('Starting download...')
})

stopButton.addEventListener('click', () => {
  ipcRenderer.send('stop-download')
  updateStatus('Stopping download...')
})

mergeButton.addEventListener('click', () => {
  const mergeOptions = {
    inputDir: tempDirInput.value || saveDirInput.value,
    outputFile: fileNameInput.value
  }

  if (!validateMergeInputs(mergeOptions)) return

  ipcRenderer.send('start-merge', mergeOptions)
  toggleControls(true)
  updateStatus('Starting merge...')
})

// IPC Listeners
ipcRenderer.on('download-progress', (event, progress) => {
  progressBar.value = progress.percent
  progressText.textContent = `${progress.percent}% - ${progress.status}`
  updateStatus(progress.status)
})

ipcRenderer.on('download-complete', () => {
  toggleControls(false)
  updateStatus('Download complete!')
  progressText.textContent = '100% - Complete'
})

ipcRenderer.on('download-error', (event, error) => {
  toggleControls(false)
  updateStatus(`Error: ${error}`)
  alert(`Download error: ${error}`)
})

ipcRenderer.on('merge-progress', (event, progress) => {
  progressBar.value = progress.percent
  progressText.textContent = `${progress.percent}% - ${progress.status}`
  updateStatus(progress.status)
})

ipcRenderer.on('merge-complete', () => {
  toggleControls(false)
  updateStatus('Merge complete!')
  new Notification('Merge Complete', {
    body: 'TS files have been successfully merged into MP4'
  })
})

ipcRenderer.on('merge-error', (event, error) => {
  toggleControls(false)
  updateStatus(`Merge error: ${error}`)
  alert(`Merge error: ${error}`)
})

ipcRenderer.on('ffmpeg-missing', () => {
  toggleControls(false)
  alert('FFmpeg is required for merging but was not found. Please install FFmpeg and try again.')
})

// Helper Functions
function validateInputs(options) {
  if (!options.url) {
    alert('Please enter a valid M3U8 URL')
    return false
  }
  if (options.threadCount < 1 || options.threadCount > 100) {
    alert('Thread count must be between 1 and 100')
    return false
  }
  return true
}

function validateMergeInputs(options) {
  if (!options.inputDir) {
    alert('Please select an input directory')
    return false
  }
  if (!options.outputFile) {
    alert('Please enter an output file name')
    return false
  }
  return true
}

function toggleControls(isDownloading) {
  startButton.disabled = isDownloading
  stopButton.disabled = !isDownloading
  mergeButton.disabled = isDownloading
  m3u8UrlInput.disabled = isDownloading
  saveDirInput.disabled = isDownloading
  fileNameInput.disabled = isDownloading
  skipTsInput.disabled = isDownloading
  tempDirInput.disabled = isDownloading
  threadCountInput.disabled = isDownloading
  proxyInput.disabled = isDownloading
  insecureCheckbox.disabled = isDownloading
  skipRemoveTsCheckbox.disabled = isDownloading
  skipMergeCheckbox.disabled = isDownloading
  debugLogCheckbox.disabled = isDownloading
  useServerTimeCheckbox.disabled = isDownloading
  browseDirButton.disabled = isDownloading
  browseTempDirButton.disabled = isDownloading
}

function updateStatus(message) {
  statusBar.textContent = message
}