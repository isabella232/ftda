const fs = require('fs');
const path = require('path');
const bucketUpload = require('./s3-upload.js');
let filesToUpload = [];
let trackFolders = 0;
let processedFolders = 0;

function processFolderContents(folders) {
	if (folders === undefined) return;

	folders.forEach(folder => {
		++trackFolders;
		fs.readdir(folder, (err, contents) => {
			if(err) {
				throw err;
			}

		  	fs.stat(folder + '/' + contents[0], (err, stats) => {
		  		if (err) {
		  			throw err;
		  		}

		  		if (stats.isDirectory()) {
		  			let nestedFolders = [];
		  			contents.forEach(content => {
		  				nestedFolders.push(folder + '/' + content);
		  			});
		  			--trackFolders;
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
			} else if(path.extname(file) === '.JPG'){
				issueData.jpgs.push(folder + '/' + file);
			}
		});

		filesToUpload.push(issueData);
		--trackFolders;

		if (trackFolders === 0) {
			for(let i = 0; i < filesToUpload.length; ++i) {
				bucketUpload.uploadFiles(filesToUpload[i], false, () => {
					++processedFolders;
					if (processedFolders === filesToUpload.length) {
						resetFileUpload();
					}
				});
			}
		}
	});
}

function resetFileUpload() {
	processedFolders = 0;
	filesToUpload = [];
}

module.exports = {
	readFolders: processFolderContents
}