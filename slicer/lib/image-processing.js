// Imagemagick binary acquired from:
// https://github.com/DoubleDor/imagemagick-prebuilt/releases

/*const gmPaths = [
	`/tmp/resources/imagemagick/lib`,
	`/tmp/resources/imagemagick/bin`,
];

console.log("PATH:", process.env['PATH']);
process.env['PATH'] += `:${gmPaths.join(':')}`;
console.log("ADJ PATH:", process.env['PATH']);*/

const Promise = require('bluebird');
const gm = require('gm');
const co = require('co');
const tmp = require('tmp');
const random = require('uuid').v4;

const fs = Promise.promisifyAll(require('fs'));
Promise.promisifyAll(gm.prototype);

function crop(pic, pos){
	console.log("CROP:", pic);
	return gm(pic).crop(
		pos[2] - pos[0],
		pos[3] - pos[1],
		pos[0],
		pos[1]
	);
}

module.exports = {
	process : function(filePath, coordinates){
		console.log('Processing image:',filePath, coordinates);
		return new Promise(function(resolve){

			const pic = filePath;
			
			console.log('Mapping over coordinates...');
			const tempFiles = coordinates.map(function(coords){
				console.log(coords);
				const bounds = coords;
				const cropped = crop(pic, bounds);
				const tempFile = tmp.fileSync({
					dir : '/tmp'
				});

				console.log('Returning temporary file:', tempFile.name);
				return cropped.writeAsync(tempFile.name)
					.then(function(){
						return tempFile.name;
					})
				;

			});

			return Promise.all(tempFiles)
				.then(function(files){

					console.log('Temporary files all generated. Appending now...', files);

					const image = gm(files.shift());

					console.log('Origin image:', image);

					console.log('Iterating over additional images and appending to original image...');
					files.forEach(function(additionalImage){
						console.log(additionalImage);
						image.append(additionalImage);
					});

					const finalName = random();
					const stitchOutputPath = `/tmp/${finalName}.jpg`;

					console.log('Creating write destination:', stitchOutputPath);

					return image.writeAsync(stitchOutputPath)
						.then(function(){
							console.log('Image written to:', stitchOutputPath);
							return {
								imagePath : stitchOutputPath,
								tempFiles : files
							};
						})

				})
				.then(function(data){
					console.log('Final output path is:', data.imagePath);

					console.log('Unlinking temporary files...');
					data.tempFiles.forEach(function(t){
						console.log('Unlinking:', t);
						fs.unlinkSync(t);
					});

					console.log('Resolving original Promise');

					resolve({
						path : data.imagePath
					});

				})
			;

		});

	}
}