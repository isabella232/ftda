const fs = require('fs');
const path = require('path');
let filesToUpload = [];

function processFolderContents(folders) {
	if(folders === undefined) return;

	folders.forEach(folder => {
		fs.readdir(folder, (err, contents) => {
			if(err) {
				throw err;
			}

		  	fs.stat(folder + '/' + contents[0], (err, stats) => {
		  		if (err) {
		  			throw err;
		  		}

		  		if(stats.isDirectory()) {
		  			let nestedFolders = [];
		  			contents.forEach(content => {
		  				nestedFolders.push(folder + '/' + content);
		  			});

		  			processFolderContents(nestedFolders);
		  		} else {
		  			saveFolderData(folder);
		  		}
		  	});
		});
	});
}

function saveFolderData(folder) {
	const folderID = folder.split('/').pop();
	const issueData = {};
	issueData.jpgs = [];
	issueData.issueDate = folderID;

	fs.readdir(folder, (err, files) => {
		files.forEach(file => {
			if(path.extname(file) === '.xml') {
				issueData.xml = folder + '/' + file;
			} else {
				issueData.jpgs.push(folder + '/' + file);
			}
		});
		
		filesToUpload.push(issueData);
		console.log(filesToUpload);
	});
}

function resetFileUpload() {
	filesToUpload = [];
}

module.exports = {
	readFolders: processFolderContents
}