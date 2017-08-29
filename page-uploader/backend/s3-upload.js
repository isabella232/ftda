require('dotenv').config();
const s3 = require('@monolambda/s3');

//TODO: check if file exists in s3 first, give a full list in dialog with options to select individuals or all/none
//TODO:add stats: x amount uploaded, y amount to go (issues + pages)
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

function uploadFiles(pageData, isXML, callback) {
	const files = pageData.jpgs;
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
				callback();	
			} else {
				uploadFiles(pageData, true, callback);
			}
		}
	});

}

module.exports = {
	uploadFiles: uploadFiles
}