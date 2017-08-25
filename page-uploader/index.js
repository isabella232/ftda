const electron = require('electron');
const { app } = electron;
const { BrowserWindow } = electron;
const { ipcMain } = electron;
const { dialog } = electron;
const path = require('path');
const url = require('url');

const folderProcessor = require('./backend/folder-processor.js');

let mainWindow;

function createWindow () {
    mainWindow = new BrowserWindow({width: 800, height: 600, x: 560, y: -1057});

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.on('show-dialog', () => {
    dialog.showOpenDialog(mainWindow, {properties: ['openDirectory', 'multiSelections']}, folders => {
        folderProcessor.readFolders(folders);
    });
});