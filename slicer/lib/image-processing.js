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

const wait = function(time = Math.random() * 20000){

	debug('Waiting for:', time);

	return new Promise( resolve => {

		setInterval(function(){
			resolve();
		}, time);

	});

}

module.exports = {
	process : function(filePath, coordinates){
		debug('Processing image:',filePath, coordinates);

		return wait()
			.then(function(){

				return new Promise(function(resolve, reject){
		
					const pic = filePath;
					
					debug('Mapping over coordinates...');
					const tempFiles = coordinates.map(function(coords){
						debug(coords);
						const bounds = coords;
						const cropped = crop(pic, bounds);

						const tempFilePath = `/tmp/${random()}.tmp`;
						fs.openSync(tempFilePath, "w");
						debug('cropped:', cropped);
						debug('Returning temporary file:', tempFilePath);
						return cropped.writeAsync(tempFilePath)
							.then(function(){
								return tempFilePath;
							})
						;
		
					});
		
					Promise.all(tempFiles)
						.then(function(files){
		
							debug('Temporary files all generated. Appending now...', files);
							const fileList = [...files];
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
										tempFiles : fileList
									};
								})
		
						})
						.then(function(data){
							debug('Final output path is:', data.imagePath);
		
							debug('Unlinking temporary files...');
							const cleanUp = data.tempFiles.map(function(t){
								debug('Unlinking:', t);

								return new Promise( (resolve, reject) => {
									fs.unlink(t, err => {
										if(err){
											debug('There was an error unlinking:', t);
											reject(err);
										} else {
											resolve();
										}
									})
								});

							});
							
							Promise.all(cleanUp)
								.then(function(){

									debug('Resolving original Promise');
									
									resolve({
										path : data.imagePath
									});
				
								})
							;

						})
						.catch(function(err){
							debug('An error occurred processing the files', err);
							reject(err);
						})
					;
		
				});
			})
		;

	}
}