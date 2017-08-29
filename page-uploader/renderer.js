const { ipcRenderer } = require('electron');
const trigger = document.getElementById('trigger');

trigger.addEventListener('click', () => {
	let fileList = document.querySelector('#existingFiles ul');
	if(fileList) {
		fileList.remove();
	}

	ipcRenderer.send('show-dialog');
});

ipcRenderer.on('files-exist', (event, files) => {
	const existingFiles = document.createElement('ul');
	const submit = document.querySelector('#existingFiles input[type="submit"]'); 

	for(i in files) {
		const container = document.createElement('li');

		const file = document.createElement('input');
		file.setAttribute('type', 'checkbox');
		file.setAttribute('checked', 'checked');
		file.setAttribute('disabled', 'disabled');
		file.setAttribute('id', i);
		file.setAttribute('class', 'file');
		file.setAttribute('data-origin', JSON.stringify(files[i]));

		const fileName = document.createElement('label');
		fileName.setAttribute('for', i);
		fileName.textContent = files[i].file.split('/').pop();


		container.appendChild(file);
		container.appendChild(fileName);
		existingFiles.appendChild(container);
	}

	const fileSubmit = document.getElementById('existingFiles');
	fileSubmit.style.display = 'inherit';

	const checkall = document.getElementById('checkall');
	checkall.addEventListener('click', e => {
		document.querySelectorAll('.file').forEach(input => {
			if(e.target.checked) {
				input.setAttribute('checked', 'checked');
			} else {
				input.removeAttribute('checked');
			}
		});
	});

	fileSubmit.addEventListener('submit', e => {
		e.preventDefault();

		const filesToExclude = checkall.checked?null:files;
		ipcRenderer.send('exclude-files', filesToExclude);
		fileSubmit.style.display = 'none';
	});

	fileSubmit.insertBefore(existingFiles, submit);
});

ipcRenderer.on('upload-progress', (event, values) => {
	const progress = document.getElementById('progress');

	if(values === null) {
		progress.textContent = 'No issues to update';
	} else {
		progress.textContent = `Uploaded: ${values.amount} issue${values.amount > 1?'s':''} out of ${values.total}`;
	}
});