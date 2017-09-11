require('dotenv').config();
const s3 = require('@monolambda/s3');
const KEYS = require('./../keys.js');

let client; 

function setClient() {
	client = s3.createClient({
		maxAsyncS3: 20,
		s3RetryCount: 3,
		s3RetryDelay: 1000,
		multipartUploadThreshold: 20971520,
		multipartUploadSize: 15728640,
		s3Options: {
			accessKeyId: KEYS.key(),
			secretAccessKey: KEYS.secret(),
			region: process.env.AWS_REGION
		}
	});
}

function checkFiles(archiveData, callback) {
	const files = [];

	for(i in archiveData) {
		const pageData = archiveData[i];
		for(j in pageData.jpgs) {
			files.push({ file: pageData.jpgs[j], path: pageData.issueDate });
		}

		files.push({ file: pageData.xml, path: pageData.issueDate });
	}


	const filesFound = Array.from(files).map(fileObject => {
		const path = fileObject.path;
		const file = fileObject.file.split('/').pop();

		return new Promise((resolve, reject) => {
			client.s3.headObject({
			  Bucket: process.env.AWS_BUCKET,
			  Key: path + '/' + file
			}, (err, data) => {
				if (!err) {
					resolve(fileObject);
				} else {
					// console.log('checkfile', err);
					if(err.statusCode === 404) {
						resolve(null);	
					} else {
						reject(err);
					}
				}
			});
		});
	});

	Promise.all(filesFound)
	.then(data => callback(data.filter(item => {
		return item !== null;
	})))
	.catch(err => {
		let errorMessage;

		switch(err.code) {
			case 'AccessDenied':
			case 'Forbidden':
				errorMessage = 'You must be on the internal network at OSB to upload files';
			break;

			case 'CredentialsError':
				errorMessage = 'You have invalid credentials, please authenticate again.';
			break;

			default:
				errorMessage = 'There was an error processing the files, please contact the administrator, quoting the following message: ' + err.code;
		}
		
		callback({'error': errorMessage, 'code': err.code});
	});
}


function uploadFiles(pageData, isXML, callback) {
	const files = pageData.jpgs;
	
	if(files.length === 0) {
		isXML = true;
	}

	const path = pageData.issueDate;
	const file = isXML?pageData.xml:files[0];

	const params = {
		localFile: file,

		s3Params: {
			Bucket: process.env.AWS_BUCKET,
			Key: path + '/' + file.split('/').pop()
		}
	};

	const uploader = client.uploadFile(params);
	uploader.on('error', function(err) {
		console.error("unable to upload:", err);
	});

	uploader.on('progress', function() {
		// console.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal);
	});

	uploader.on('end', function() {
		files.shift();
		if(files.length > 0) {
			uploadFiles(pageData, false, callback);	
		} else {
			if(isXML) {
				return callback(true);	
			} else {
				uploadFiles(pageData, true, callback);
			}
		}

		callback(false);
	});

}

module.exports = {
	checkFiles: checkFiles,
	uploadFiles: uploadFiles,
	setClient: setClient
}