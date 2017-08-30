require('dotenv').config();
const s3 = require('@monolambda/s3');

//TODO: handle errors

const client = s3.createClient({
	maxAsyncS3: 20,
	s3RetryCount: 3,
	s3RetryDelay: 1000,
	multipartUploadThreshold: 20971520,
	multipartUploadSize: 15728640,
	s3Options: {
		accessKeyId: process.env.AWS_KEY,
		secretAccessKey: process.env.AWS_SECRET,
		region: process.env.AWS_REGION
	}
});

function checkFiles(archiveData, callback) {
	const files = [];

	for(i in archiveData) {
		const pageData = archiveData[i];
		for(j in pageData.jpgs) {
			files.push({ file: pageData.jpgs[j], path: pageData.issueDate });
		}

		files.push({ file: pageData.xml, path: pageData.issueDate });
	}


	const filesFound = Array.from(files).map((fileObject, i) => {
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
					resolve(null);
				}
			});
		});
	});

	Promise.all(filesFound).then(data => callback(data.filter(item => {
		return item !== null;
	})));
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
		console.error("unable to upload:", err.stack);
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
	uploadFiles: uploadFiles
}