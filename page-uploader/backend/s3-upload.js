require('dotenv').config();
const s3 = require('@monolambda/s3');

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

function uploadFiles(file, path) {
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
		console.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal);
	});

	uploader.on('end', function() {
		console.log("done uploading");
	});

}

module.exports = {
	uploadFiles: uploadFiles
}