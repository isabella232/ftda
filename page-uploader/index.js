const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, shell } = electron;
const path = require('path');
const url = require('url');
const { paste } = require('copy-paste');

const folderProcessor = require('./backend/folder-processor.js');
const KEYS = require('./keys.js');

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

function showSelectDialog(event, files, ignored, invalid) {
    event.sender.send('files-exist', files, ignored, invalid);
}

function showProgress(event, values, done) {
    event.sender.send('upload-progress', values, done);
}

function showError(event, error) {
    event.sender.send('error', error.error, error.code);
}

ipcMain.on('show-dialog', event => {
    dialog.showOpenDialog(mainWindow, {properties: ['openDirectory', 'multiSelections']}, folders => {
        if(folders === undefined) {
            event.sender.send('reset-select');
            return;
        }

        folderProcessor.reset();
        folderProcessor.readFolders(folders, (files, ignored, invalid) => {
            if(files.error) {
               return showError(event, files);
            }

            const existing = files;
            if(existing.length > 0 || invalid.length > 0) {
                showSelectDialog(event, existing, ignored, invalid);
            } else {
                folderProcessor.upload(null, (progress, allDone) => {
                    showProgress(event, progress, allDone);

                    if(allDone) {
                        folderProcessor.reset();
                    }
                });
            }
        });
    });
});

ipcMain.on('exclude-files', (event, files) => {
    let excludedFolders = null;

    folderProcessor.upload(files, (progress, allDone) => {
        showProgress(event, progress, allDone);

        if(allDone) {
            folderProcessor.reset();
        }
    });
});

ipcMain.on('get-keys', event => {
    shell.openExternal(process.env.KEY_FETCH_URL);
});

ipcMain.on('set-keys', (event, data) => {
    if(data !== null) {
        KEYS.set(JSON.parse(data));
    } else {
        paste((err, data) => {
            const keys = JSON.parse(data);
            KEYS.set(keys);
            event.sender.send('save-keys', data);
        });
    }
});