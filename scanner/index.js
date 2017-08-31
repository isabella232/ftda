require('node-babel')();

const dotenv = require('dotenv').config();

const debug = require('debug')('scanner');
const AWS = require('aws-sdk');

const fs = require('fs');
const tmpPath = process.env.TMPPATH || '/tmp';

const tesseract = require('./lib/tesseract');
const database = require('./lib/database-interface');

AWS.config.update({
  region: 'us-west-2'
});

const databaseConnectionDetails = {
	host : process.env.DATABASE_HOST,
	user : process.env.DATABASE_USERNAME,
	password : process.env.DATABASE_PASSWORD,
	port : process.env.DATABASE_PORT
};

const S3 = new AWS.S3();

let isProcessing = false;
let currentJob;

function getJobFromScanQueue(){
	// Get item from queue and return it
	return database.query(`SELECT * FROM scan WHERE status = 'available' ORDER BY rand() LIMIT 1`)
		.then(function(data){
			return data.results[0];
		})
		.then(function(job){
			return database.query(`UPDATE scan SET status = 'processing' WHERE id=${job.id}`)
				.then(function(){
					return job;
				})
		})
	;
}

function deleteJobFromScanQueue(id){
	// Delete job from scan queue when it's been completed
	return database.query(`DELETE * FROM scan WHERE id = ${id}`);
}

function resetJobInScanQueue(job){
	return database.query(`UPDATE scan SET status = 'available' WHERE id=${job.id}`);
}

function scan(doc, bounds){
	debug('Attempting scan of:', doc);

	bounds = bounds || false;

	return tesseract.scan(doc, bounds)
		.then(res => {

			debug('Scan(s) completed.');

			const formattedText = res[0].replace(/-\n/g, ' ').replace(/\n/g, ' ');
			let boundedText = undefined;

			if(res.length > 1){

				boundedText = res[1].split('\n');

				boundedText.pop();
				boundedText = boundedText.map(letterData => {
					letterData = letterData.split(' ');
					letterData.pop();
					return {
						'letter' : letterData.shift(),
						'bounds' : letterData
					};
				});

			}

			const results = {
				plain : formattedText,
				bounds : boundedText || []
			};
			
			return results;

		})
		.catch(err => {
			debug('An error was thrown whilst scanning the document', err);
		})
	;

}

function processJob(data){

	isProcessing = true;
	currentJob = data;

	const resource = `${data['article-uuid']}.jpg`;
	
	debug('Resource:', resource);
	
	tesseract.configure({
		tessPath : process.env.TESSPATH
	});
	
	if(resource !== undefined){
		// FTDA-1940-0706-0002-003
		// Go and get the image from the URL, store it locally, and then pass it to tesseract
		
		return new Promise( function(resolve, reject){

			const destination = `${tmpPath}/${resource}`;
			const file = fs.createWriteStream(destination);
			debug(destination)
			S3.getObject({
				Bucket : 'ftlabs-archives-snippets',
				Key : resource
			}).createReadStream().pipe(file);
	
			file.on('error', function(err){
				debug('Error writing file', err);
				debug(err);
				reject(err)
			});
	
			file.on('close', function(){
				debug(`File recieved from S3 and written to ${destination}`);
				
				scan(destination, true)
					.then(results => {
	
						const plainSize = Buffer.byteLength(results.plain, 'utf8') / 1000;
						const boundSize = Buffer.byteLength( JSON.stringify( results.bounds ), 'utf8') / 1000;
	
						debug('Tesseract thinks it completed.');
						debug('The plain results size is:', plainSize, 'kb');
						debug('The bounds results size is:', boundSize, 'kb');
						
						const plainTextStorage = new Promise( function(resolve, reject){

							new AWS.S3({
								params : {
									Bucket : 'artefacts.ftlabs-ftda.output-text',
									Key : `${data.id}.txt`
								}
							}).upload({Body : JSON.stringify(data)}, function(err){

								if(err){
									reject(err);
								} else{
									debug('Plain text successfully added to S3 Bucket');
									fs.unlinkSync(destination);
									resolve();
								}

							});
							
						} );

						const lettersStorage = Promise.all( results.bounds.map( function( item ){
							return Promise.resolve(item);
						} ) );

						Promise.all([plainTextStorage, lettersStorage])
							.then(function(){
								debug('All data stored successfully');
								resolve();
							})
							.catch(function(err){
								debug('An error occurred trying to store the scan results', err);
							})
						;

						// Send the data off to a database
	
					})
					.catch(err => {
						debug(`Tesseract didn't like that...`, err);
						reject(err);
					})
				;
			});

		});
		
	} else {
		return Promise.reject(`'resource' is undefined`);
	}

}

database.connect(databaseConnectionDetails)
	.then(function(){

		setInterval(function(){
		
			if(!isProcessing){
				getJobFromScanQueue()
					.then(function(job){

						if(job !== undefined){
							processJob(job)
								.then(function(){
									isProcessing = false;
									currentJob = undefined;
								})
							;
						}

					})
				;
			}
		
		}, 1000);

	})
	.catch(function(err){
		debug('Top level error', err);
		if(currentJob){
			resetJobInScanQueue(currentJob)
				.then(function(){
					currentJob = undefined;
					isProcessing = false;
				})
				.catch(function(err){
					debug('Catastrophic error. Exiting process', err);
					process.exit();
				})
			;
		}
	})
;




