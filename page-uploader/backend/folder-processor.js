const fs = require('fs');
const path = require('path');
const bucketUpload = require('./s3-upload.js');
let filesToUpload = [];
let trackFolders = 0;
let processedFolders = 0;
let processedFiles = 0;
let filesTotal = 0;

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
				++filesTotal;
				issueData.xml = folder + '/' + file;
			} else if(path.extname(file) === '.JPG'){
				++filesTotal;
				issueData.jpgs.push(folder + '/' + file);
			}
		});

		filesToUpload.push(issueData);
		--trackFolders;

		if (trackFolders === 0) {
			bucketUpload.checkFiles(filesToUpload, files => {
				callback(files, filesTotal);
			});
		}
	});
}

function uploadFiles(excludeFiles, callback) {
	if(excludeFiles !== null) {
		filesTotal -= excludeFiles.length;

		filesToUpload = filesToUpload.map(obj => {
		    obj.jpgs = obj.jpgs.map(file => {

		        let shouldUpload = true;

		        excludeFiles.forEach(item => {
		            if(item.file === file){
		                shouldUpload = false;
		            }
		        });

		        return shouldUpload ? file : false;

		    }).filter(item => {
		        return item !== false;
		    });

		    return obj;
		});
	}

	if(filesToUpload.length > 0) {
		for(let i = 0; i < filesToUpload.length; ++i) {
			bucketUpload.uploadFiles(filesToUpload[i], false, done => {
				++processedFiles;

				if(done) {
					++processedFolders;
				}

				callback({amount: processedFolders, total: filesToUpload.length, files: processedFiles, filesTotal: filesTotal, ignored: excludeFiles}, (processedFolders === filesToUpload.length));
			});
		}
	} else {
		callback(null, true);
	}
}

function resetFileUpload() {
	processedFiles = 0;
	filesTotal = 0;
	processedFolders = 0;
	trackFolders = 0;
	filesToUpload = [];
}

module.exports = {
	readFolders: processFolderContents,
	reset: resetFileUpload,
	upload: uploadFiles
}