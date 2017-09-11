const { ipcRenderer } = require('electron');
const auth = document.getElementById('auth');
const trigger = document.getElementById('trigger');
const fileSubmit = document.getElementById('existingFiles');
const proceed = document.getElementById('proceed');
const progress = document.getElementById('progress');
let currentFiles = null;

const keys = window.localStorage.getItem('hasKeys');

if(keys === null) {
	ipcRenderer.send('get-keys');
	setTimeout(() => {
		auth.style.display = 'inherit';
	}, 200);
} else {
	ipcRenderer.send('set-keys', keys);
	progress.innerHTML = '';
	auth.style.display = 'none';
	trigger.style.display = 'inherit';
}

auth.addEventListener('click', () => {
	ipcRenderer.send('set-keys', null);
	auth.style.display = 'none';
})

trigger.addEventListener('click', () => {
	let fileList = document.querySelector('#existingFiles ul');
	if(fileList) {
		fileList.remove();
	}

	progress.innerHTML = '';
	fileSubmit.style.display = 'none';
	proceed.style.display = 'none';
	trigger.disabled = true;
	ipcRenderer.send('show-dialog');
});

fileSubmit.addEventListener('submit', proceedWithUpload);
proceed.addEventListener('click', proceedWithUpload);

function proceedWithUpload(e) {
	e.preventDefault();
	
	const filesToExclude = checkall.checked?null:checkExcludeFiles();

	ipcRenderer.send('exclude-files', filesToExclude);

	fileSubmit.querySelector('ul').remove();
	fileSubmit.style.display = 'none';
	proceed.style.display = 'none';
	currentFiles = null;
	progress.innerHTML = 'Preparing...';
	trigger.disabled = true;
}

function checkExcludeFiles() {
	const fileSelection = fileSubmit.querySelectorAll('.file');
	const excludeFiles = [];
	trigger.disabled = false;

	Array.from(fileSelection).forEach(file => {
		if(!file.checked) {
			excludeFiles.push(JSON.parse(file.getAttribute('data-origin')));	
		}
	});

	return (excludeFiles.length > 0)?excludeFiles:null;
}

ipcRenderer.on('reset-select', event => {
	trigger.disabled = false;
});

ipcRenderer.on('files-exist', (event, files, total, invalid) => {
	const existingFiles = document.createElement('ul');
	const submit = document.querySelector('#existingFiles input[type="submit"]');
	const checkall = document.getElementById('checkall');
	checkall.checked = true;
	trigger.disabled = false;
	progress.innerHTML = `<p>You have chosen ${total + invalid.length} files to upload, ${files.length} files already exist.</p>`;
	
	if(invalid.length > 0) {
		progress.innerHTML += `<p>${invalid.length} file${invalid.length > 1?'s':''} are invalid and will be ignored:<ul>`;
		for(i in invalid) {
			progress.innerHTML += `<li>${invalid[i]}</li>`;
		}
		progress.innerHTML += '</ul></p>';
	}

	if(files.length > 0) {
		progress.innerHTML += `<p>Please select files to override before proceeding:</p>`;
	}
	currentFiles = files;

	for(i in files) {
		const container = document.createElement('li');

		const file = document.createElement('input');
		file.setAttribute('type', 'checkbox');
		file.checked = true;
		file.setAttribute('id', i);
		file.setAttribute('class', 'file');
		file.setAttribute('data-origin', JSON.stringify(files[i]));
		
		if(files[i].file.split('.').pop() === 'xml') {
			file.setAttribute('disabled', 'disabled');
		}

		file.addEventListener('click', e => {
			if(!e.target.checked) {
				checkall.checked = false;
			} else {
				checkall.checked = (checkExcludeFiles() === null);
			}
		});

		const fileName = document.createElement('label');
		fileName.setAttribute('for', i);
		fileName.textContent = files[i].file.split('/').pop();


		container.appendChild(file);
		container.appendChild(fileName);
		existingFiles.appendChild(container);
	}

	if(files.length > 0) {
		fileSubmit.style.display = 'inherit';
	} else {
		proceed.style.display = 'inherit';
	}

	checkall.addEventListener('click', e => {
		const allChecked = e.target.checked;
		Array.from(fileSubmit.querySelectorAll('.file:not(:disabled)')).forEach(input => {
			if(allChecked) {
				input.checked = true;
			} else {
				input.checked = false;
			}
		});
	});

	fileSubmit.insertBefore(existingFiles, submit);
});

ipcRenderer.on('upload-progress', (event, values, done) => {
	if(values === null) {
		progress.textContent = 'No issues to update';
	} else {
		progress.innerHTML = `<p>Uploaded: ${values.amount} issue${values.amount > 1?'s':''} out of ${values.total}; ${values.files} file${values.files > 1?'s':''} out of ${values.filesTotal}</p>`;
		if(values.ignored !== null || values.invalid.length > 0) {
			const ignoredTotal = (values.ignored !== null)?values.ignored.length:0 + values.invalid.length;
			progress.innerHTML += `<p>Ignored: ${ignoredTotal} file${ ignoredTotal > 1?'s':''}</p>`;
		}
	}

	if(done) {
		progress.innerHTML += `Upload done.`
		trigger.disabled = false;
	}
});

ipcRenderer.on('error', (event, message, code) => {
	alert(message);
	trigger.disabled = false;

	if(code === 'CredentialsError') {
		window.localStorage.removeItem('hasKeys');
		progress.innerHTML = 'Authentication Required';
		trigger.style.display = 'none';
		fileSubmit.display = 'none';

		ipcRenderer.send('get-keys');
		setTimeout(() => {
			auth.style.display = 'inherit';
		}, 200);
	} else if(code === 'BadJSON') {
		auth.style.display = 'inherit';
	}
});

ipcRenderer.on('save-keys', (event, keys) =>{
	window.localStorage.setItem('hasKeys', keys);
	progress.innerHTML = '';
	auth.style.display = 'none';
	trigger.style.display = 'inherit';
})