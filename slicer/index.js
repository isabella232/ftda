#!/usr/bin/env node

const fs = require('fs');
const co = require('co');
const dotenv = require('dotenv').config();
const uuid = require('uuid').v4;

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

let currentJob;
let isProcessing = false;

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
	console.log('Job reset', job);
	return database.query(`UPDATE slice SET status = 'available', attempts = attempts + 1 WHERE id=${job.id}`);
}

function addJobToScanQueue(details){
	// Add new item to scan queue
	return database.query(`INSERT INTO scan (\`status\`, \`page-uuid\`, \`article-uuid\`, \`model-type\`) VALUES ("available", "${ details.parentID }", "${ details.articleID }", "default");`);
}

function processAndSlice(data){

	isProcessing = true;
	currentJob = data;

	const random = uuid();

	// Example data.id
	// FTDA-1945-0108-0001
	const number = data['page-uuid'].replace('FTDA-', '');
	const noDash = number.replace(/-/g, '');

	const resourcePath = noDash.slice(0, noDash.length - 4); // 19450108
	const parentPageID = data['page-uuid'];
	const articleSections = data.slices;

	console.log("resourcePath:", resourcePath, "parentPageID:", parentPageID, "articleSections:", articleSections);

	console.log(`${resourcePath}/${parentPageID}.JPG`);

	const parentPageDestination = `${tmpPath}${random}.jpg`;
	const file = fs.createWriteStream(parentPageDestination);
	S3.getObject({
		Bucket : 'artefacts.ftlabs-ftda.pages',
		Key : `${resourcePath}/${parentPageID}.JPG`
	}).createReadStream().pipe(file);

	file.on('error', function(e){
		console.log("error event");
		console.log(e);
	});

	file.on('close', function(e){
		console.log(`File recieved from S3 and written to ${parentPageDestination}`);

		const articlesToProcess = articleSections.map(function(article){

			/*
				// Example article object
				{"id":"FTDA-1945-0108-0001-001","coordinates":[["89","89","982","714"]]}
			*/

			return new Promise( function(resolve, reject){

				imageProcessing.process(parentPageDestination, article.coordinates)
					.then(img => {
						console.log('img:', img);
						console.log(data);
		
						fs.readFile(img.path, (err, file) => {
							if(err){
								console.log("Error reading spliced image:", err);
							} else {
								console.log("Spliced image read from disk:", img.path);
		
								new AWS.S3({
									params : {
										Bucket : 'artefacts.ftlabs-ftda.articles',
										Key : `${article.id}.jpg`
									}
								}).upload({Body : file}, function(){
									console.log(`Snippet ${article.id}.jpg successfully uploaded`);
		
									addJobToScanQueue( { parentID : parentPageID, articleID : article.id } )
										.then(function(){
											return deleteJobFromSliceQueue(data.id);
										})
										.then(function(){
											resolve(true);
										})
										.catch(function(err){
											console.log('An error occurred adding a job to the queue', err);
											reject(data);
										})
									;
									
								});
		
							}
		
						});
		
					})
				;

			});


		});

		Promise.all(articlesToProcess)
			.then(function(){
				isProcessing = false;
			})
			.catch(function(err){
				console.log('An error occurred proccessing one of the articles in the page', err);
				resetJobInSliceQueue(currentJob);
			})
		;

	});

}

database.connect(databaseConnectionDetails)
	.then(function(){

		setInterval(function(){
		
			if(!isProcessing){
				getJobFromSliceQueue()
					.then(function(job){

						if(job !== undefined){
							job.slices = JSON.parse(job.slices);
							processAndSlice(job);
						}

					})
				;
			}
		
		}, 1000);

	})
	.catch(function(err){
		console.log('Top level error', err);
		if(currentJob){
			resetJobInSliceQueue(currentJob)
				.then(function(){
					currentJob = undefined;
					isProcessing = false;
				})
				.catch(function(err){
					console.log('Catastrophic error. Exiting process', err);
					process.exit();
				})
			;
		} else {
			isProcessing = false;
			currentJob = undefined;
		}
	})
;


// process.stdin.resume();
