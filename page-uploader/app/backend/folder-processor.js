const fs = require('fs');
const path = require('path');
const bucketUpload = require('./s3-upload.js');
let filesToUpload = [];
let invalidFiles = [];
let trackFolders = 0;
let processedFolders = 0;
let processedFiles = 0;
let filesTotal = 0;
let foldersTotal = 0;

function processFolderContents(folders, callback) {
	if (folders === undefined) {
		return;
	}

	bucketUpload.setClient();

	folders.forEach(folder => {
		++trackFolders;

		fs.readdir(folder, (err, contents) => {
			if(err) {
				return callback({'error': err.message}, null, null);
			}

			if(contents[0] === '.DS_Store') {
				contents.shift();
			}

		  	fs.stat(folder + '/' + contents[0], (err, stats) => {
		  		if (err) {
		  			return callback({'error': err.message}, null, null);
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
				if((/(FTDA)-[0-9]{4}-[0-9]{4}(.xml)/g).test(file)) {	
					++filesTotal;
					issueData.xml = folder + '/' + file;
				} else {
					invalidFiles.push(folder + '/' + file);
				}
			} else if(path.extname(file) === '.JPG'){
				if((/(FTDA)-[0-9]{4}-[0-9]{4}-[0-9]{4}(.JPG)/g).test(file)) {
					++filesTotal;
					issueData.jpgs.push(folder + '/' + file);
				} else {
					invalidFiles.push(folder + '/' + file);
				}
				
			}
		});

		filesToUpload.push(issueData);
		--trackFolders;

		if (trackFolders === 0) {
			bucketUpload.checkFiles(filesToUpload, files => {
				if(files.error) {
					callback(files, null, null);
				} else {
					callback(files, filesTotal, invalidFiles);	
				}
			});
		}
	});
}

function prepUpload(excludeFiles, callback) {
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

	foldersTotal = filesToUpload.length;
	uploadFiles(excludeFiles, callback, true);
}

function uploadFiles(excludeFiles, callback, originalCall) {
	if(filesToUpload.length > 0) {
		bucketUpload.uploadFiles(filesToUpload[0], false, done => {
			++processedFiles;

			if(done) {
				++processedFolders;
				filesToUpload.shift();
				uploadFiles(excludeFiles, callback, false);
			}

			callback({amount: processedFolders, total: foldersTotal, files: processedFiles, filesTotal: filesTotal, ignored: excludeFiles, invalid: invalidFiles}, (processedFolders === foldersTotal));
		});
	} else {
		if(originalCall) {
			callback(null, true);	
		}
	}
}

function resetFileUpload() {
	processedFiles = 0;
	filesTotal = 0;
	processedFolders = 0;
	foldersTotal = 0;
	trackFolders = 0;
	filesToUpload = [];
	invalidFiles = [];
}

module.exports = {
	readFolders: processFolderContents,
	reset: resetFileUpload,
	upload: prepUpload
}