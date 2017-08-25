const { ipcRenderer } = require('electron');
const trigger = document.getElementById('trigger');

trigger.addEventListener('click', () => {
	ipcRenderer.send('show-dialog');
})