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

function append(image, append){
	if (!image){
		return gm(append);
	}
	return image.append(to);
}

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
	process: co.wrap(function * (filePath, coordinates) {

		let pic = filePath;
		console.log(pic);
		let tempFiles = [];
		for ( let i = 0; i < coordinates.length; i += 1 ) {
			let bounds = coordinates[i];
			console.log(bounds);
			let cropped = crop(pic, bounds);
			let tempFile = tmp.fileSync({
				dir : '/tmp'
			});
			yield cropped.writeAsync(tempFile.name);
			tempFiles.push(tempFile.name);
		}

		let image = gm(tempFiles[0]);
		for (let i = 1 ; i < tempFiles.length ; i++){
			image.append(tempFiles[i]);
		}

		const finalName = random();
		const stitchOutputPath = `/tmp/${finalName}.jpg`;
		yield image.writeAsync(stitchOutputPath);
		console.log("We've been stitched up at:", stitchOutputPath);
		tempFiles.forEach(t => { 
			fs.unlinkSync(t);
		});
		return {
			path : stitchOutputPath
		};
	})
};
