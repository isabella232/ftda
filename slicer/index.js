#!/usr/bin/env node

const dotenv = require('dotenv').config();
const fs = require('fs');
const co = require('co');
const uuid = require('uuid').v4;
const debug = require('debug')('slicer:index');

const imageProcessing = require('./lib/image-processing');

const database = require('./lib/database-interface');

const databaseConnectionDetails = {
	host : process.env.DATABASE_HOST,
	user : process.env.DATABASE_USERNAME,
	password : process.env.DATABASE_PASSWORD,
	port : process.env.DATABASE_PORT,
	database : process.env.MYSQL_DATABASE
};

const tmpPath = process.env.TMPPATH || '/tmp/';

const AWS = require('aws-sdk');
const S3 = new AWS.S3();

let isProcessing = false;
let currentJob = undefined;

function getJobFromSliceQueue(){
	// Get item from queue and return it
	return database.query(`SELECT * FROM slice WHERE status = 'available' AND attempts < 3 ORDER BY rand() LIMIT 1`)
		.then(function(data){
			return data.results[0];
		})
		.then(function(job){

			if(job !== undefined){

				return database.query(`UPDATE slice SET status = 'processing' WHERE id=${job.id}`)
					.then(function(){
						return job;
					})
				;
			} else {
				return job;
			}

		})
	;
}

function deleteJobFromSliceQueue(id){
	// Delete job from slice queue when it's been completed
	return database.query(`DELETE FROM slice WHERE id = ${id}`);
}

function resetJobInSliceQueue(job){
	debug('Job reset', job);
	return database.query(`UPDATE slice SET status = 'available', attempts = attempts + 1 WHERE id=${job.id}`);
}

function addJobToScanQueue(details){
	// Add new item to scan queue
	return database.query(`INSERT INTO scan (\`status\`, \`page-uuid\`, \`article-uuid\`, \`model-type\`) VALUES ("available", "${ details.parentID }", "${ details.articleID }", "default");`);
}

function deleteFileFromSystem(path){

	debug('Deleting file from system:', path);

	return new Promise( (resolve, reject) => {

		fs.unlink(path, function(err){
			if(err){
				debug('Failed to unlink file:', err);
				reject(err);
			} else {
				debug('File successfully deleted');
				resolve();
			}
		});

	});

}

function getListOfFilesInDirectory(directoryPath){

	return new Promise( (resolve, reject) => {

		fs.readdir(directoryPath, (err, files) => {

			if(err){
				reject(err);
			} else {
				resolve(files);
			}

		});

	});

}

function processAndSlice(data){

	isProcessing = true;
	currentJob = data;

	return new Promise( (resolve, reject) => {

		const random = uuid();
		
		// Example data.id
		// FTDA-1945-0108-0001
		const number = data['page-uuid'].replace('FTDA-', '');
		const noDash = number.replace(/-/g, '');
	
		const resourcePath = noDash.slice(0, noDash.length - 4); // 19450108
		const parentPageID = data['page-uuid'];
		const articleSections = data.slices;
	
		debug("resourcePath:", resourcePath, "parentPageID:", parentPageID, "articleSections:", articleSections);
	
		debug(`${resourcePath}/${parentPageID}.JPG`);
	
		const parentPageDestination = `${tmpPath}${random}.jpg`;
		const file = fs.createWriteStream(parentPageDestination);
		S3.getObject({
			Bucket : 'artefacts.ftlabs-ftda.pages',
			Key : `${resourcePath}/${parentPageID}.JPG`
		}).createReadStream().pipe(file);
	
		file.on('error', function(e){
			debug("error event");
			debug(e);
			file.destroy();
		});
	
		file.on('close', function(e){
			file.destroy();
			debug(`File recieved from S3 and written to ${parentPageDestination}`);
	
			const articlesToProcess = articleSections.map(function(article){
	
				/*
					// Example article object
					{"id":"FTDA-1945-0108-0001-001","coordinates":[["89","89","982","714"]]}
				*/
	
				return new Promise( function(resolve, reject){
	
					imageProcessing.process(parentPageDestination, article.coordinates)
						.then(img => {
							debug('img:', img);
							debug(data);
			
							fs.readFile(img.path, (err, file) => {
								if(err){
									debug("Error reading spliced image:", err);
									reject(err);
									return;
								} else {
									debug("Spliced image read from disk:", img.path);
			
									new AWS.S3({
										params : {
											Bucket : 'artefacts.ftlabs-ftda.articles',
											Key : `${article.id}.jpg`
										}
									}).upload({Body : file}, function(){
										debug(`Snippet ${article.id}.jpg successfully uploaded`);
										
										const cleanupJobsToComplete = [];
	
										cleanupJobsToComplete.push( addJobToScanQueue( { parentID : parentPageID, articleID : article.id } ) );
										cleanupJobsToComplete.push( deleteFileFromSystem(img.path) );
	
										Promise.all(cleanupJobsToComplete)
											.then(function(){
												resolve();
											})
											.catch(err => {
												reject(err);
											})
										;
										
									});
			
								}
			
							});
			
						})
						.catch(function(err){
							debug('Image processesing error');
							reject(err);
						})
					;
	
				});
	
	
			});
	
			Promise.all(articlesToProcess)
				.then(function(){
					deleteJobFromSliceQueue(data.id)
						.then(function(){
							resolve();
						})
						.catch(err => {
							debug('Err deleting job from slice queue');
							reject(err);
						})
					;
					
				})
				.catch(err => {
					reject(err);
				})
			;
	
		});

	} );
	
}

function getJobAndProcessIt(){

	if(!isProcessing){

		getJobFromSliceQueue()
			.then(job => {
	
				if(job !== undefined){
					job.slices = JSON.parse(job.slices);
					return processAndSlice(job);
				} else {
					throw 'No job retrieved from database';
				}
	
			})
			.then(function(){
				isProcessing = false;
				currentJob = undefined;
			})
			.catch(function(err){
				debug('An error occurred proccessing one of the articles in the page', err);
				resetJobInSliceQueue(currentJob)
					.then(function(){
						return getListOfFilesInDirectory('/tmp')
							.then(function(files){

								const cleanUp = files.filter(file => {
										return file.indexOf('tmp-') > -1;
									})
									.map(file => {
										return deleteFileFromSystem(file);
									})
								;

								return Promise.all(cleanUp);

							})
						;
					})
					.then(function(){
						isProcessing = false;
						currentJob = undefined;
					})
				;
			})
		;
	
	} else {
		debug('A job is already processing.');
	}

}

database.connect(databaseConnectionDetails)
	.then(function(){

		setInterval(function(){

			debug('Interval triggered');

			getJobAndProcessIt();

		}, 5000);

	})
	.catch(err => {
		debug('Unable to connect to database', err);
		process.exit();
	})
;