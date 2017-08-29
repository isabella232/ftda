const fs = require('fs');
const path = require('path');
const bucketUpload = require('./s3-upload.js');
let filesToUpload = [];
let trackFolders = 0;
let processedFolders = 0;
let existingFiles;

function processFolderContents(folders, callback) {
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
		  			processFolderContents(nestedFolders, callback);
		  		} else {
		  			saveFolderData(folder, callback);
		  		}
		  	});
		});
	});
}

function saveFolderData(folder, callback) {
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
			bucketUpload.checkFiles(filesToUpload, files => {
				callback(files);
			});
		}
	});
}

function uploadFiles(excludes, callback) {
	if(excludes !== null) {
		//TODO later: when non exclude-all option, rem individual files
		for(i in excludes) {
			const folder = excludes[i];
			filesToUpload = filesToUpload.filter((item) => {
				return item.issueDate !== excludes[i];
			});
		}
	}

	if(filesToUpload.length > 0) {
		for(let i = 0; i < filesToUpload.length; ++i) {
			bucketUpload.uploadFiles(filesToUpload[i], false, () => {
				++processedFolders;
				if (processedFolders === filesToUpload.length) {
					callback();
				}
			});
		}
	} else {
		callback();
	}
}

function resetFileUpload() {
	processedFolders = 0;
	trackFolders = 0;
	existingFiles = [];
	filesToUpload = [];
}

module.exports = {
	readFolders: processFolderContents,
	reset: resetFileUpload,
	upload: uploadFiles
}