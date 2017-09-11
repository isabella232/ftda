// Imagemagick binary acquired from:
// https://github.com/DoubleDor/imagemagick-prebuilt/releases

/*const gmPaths = [
	`/tmp/resources/imagemagick/lib`,
	`/tmp/resources/imagemagick/bin`,
];

debug("PATH:", process.env['PATH']);
process.env['PATH'] += `:${gmPaths.join(':')}`;
debug("ADJ PATH:", process.env['PATH']);*/

const Promise = require('bluebird');
const debug = require('debug')('image-processing');
const gm = require('gm');
const tmp = require('tmp');
const random = require('uuid').v4;

const fs = Promise.promisifyAll(require('fs'));
Promise.promisifyAll(gm.prototype);

function crop(pic, pos){
	debug("CROP:", pic);
	return gm(pic).crop(
		pos[2] - pos[0],
		pos[3] - pos[1],
		pos[0],
		pos[1]
	);
}

module.exports = {
	process : function(filePath, coordinates){
		debug('Processing image:',filePath, coordinates);
		return new Promise(function(resolve, reject){

			const pic = filePath;
			
			debug('Mapping over coordinates...');
			const tempFiles = coordinates.map(function(coords){
				debug(coords);
				const bounds = coords;
				const cropped = crop(pic, bounds);
				const tempFile = tmp.fileSync({
					dir : '/tmp'
				});

				debug('Returning temporary file:', tempFile.name);
				return cropped.writeAsync(tempFile.name)
					.then(function(){
						return tempFile.name;
					})
				;

			});

			Promise.all(tempFiles)
				.then(function(files){

					debug('Temporary files all generated. Appending now...', files);

					const image = gm(files.shift());

					debug('Origin image:', image);

					debug('Iterating over additional images and appending to original image...');
					files.forEach(function(additionalImage){
						debug(additionalImage);
						image.append(additionalImage);
					});

					const finalName = random();
					const stitchOutputPath = `/tmp/${finalName}.jpg`;

					debug('Creating write destination:', stitchOutputPath);

					return image.writeAsync(stitchOutputPath)
						.then(function(){
							debug('Image written to:', stitchOutputPath);
							return {
								imagePath : stitchOutputPath,
								tempFiles : files
							};
						})

				})
				.then(function(data){
					debug('Final output path is:', data.imagePath);

					debug('Unlinking temporary files...');
					data.tempFiles.forEach(function(t){
						debug('Unlinking:', t);
						fs.unlinkSync(t);
					});

					debug('Resolving original Promise');

					resolve({
						path : data.imagePath
					});

				})
				.catch(function(err){
					debug('An error occurred processing the files', err);
					reject(err);
				})
			;

		});

	}
}