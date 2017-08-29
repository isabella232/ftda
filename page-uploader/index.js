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

function showSelectDialog(event, files) {
    event.sender.send('files-exist', files);
}

ipcMain.on('show-dialog', event => {
    dialog.showOpenDialog(mainWindow, {properties: ['openDirectory', 'multiSelections']}, folders => {
        folderProcessor.reset();
        folderProcessor.readFolders(folders, files => {
            const existing = files;
            if(existing.length > 0) {
                showSelectDialog(event, existing);
            } else {
                folderProcessor.upload(null, () => {
                    console.log('DONE');
                    folderProcessor.reset();
                });
            }
        });
    });
});

ipcMain.on('exclude-files', (event, files) => {
    let excludedFolders = null;

    if(files !== null) {
        const folders = files.map(item => { return item.path});
        excludedFolders = Array.from(new Set(folders));
    }

    folderProcessor.upload(excludedFolders, () => {
        console.log('DONE');
        folderProcessor.reset();
    });
});