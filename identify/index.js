require('node-babel')();

const dotenv = require('dotenv').config();

const debug = require('debug')('identify:index');
const AWS = require('aws-sdk');
const argv = require('yargs').argv;
const uuid = require('uuid').v4;
const co = require('co');
const fs = require('fs');
const tmpPath = process.env.TMPPATH || '/tmp/';

const xmlParser = require('./xml-parser');
const database = require('./database-interface/');

const S3 = new AWS.S3();

const databaseConnectionDetails = {
	host : process.env.MYSQL_HOST,
	user : process.env.MYSQL_USERNAME,
	password : process.env.MYSQL_PASSWORD,
	database : process.env.MYSQL_DATABASE,
	port : process.env.MYSQL_PORT
};

function lambda( event, context, callback, local ){
	
	database.connect(databaseConnectionDetails)
		.then(function(){

			console.log(event);
		
			const random = uuid();
		
			const destination = `${tmpPath}${random}.xml`;
			const file = fs.createWriteStream(destination);

			if(local){
				
				if(argv.xmlFile){

					const readStream = fs.createReadStream(argv.xmlFile);
					
					readStream.on('open', function () {
						readStream.pipe(file);
					});

				} else{

					console.log('No XML file specified.');
					process.exit();

				}

			} else {

				const XMLSrc = event.Records[0].s3.object.key;
				const XMLPath = XMLSrc.substring(0, XMLSrc.lastIndexOf("/") + 1);	
				const XMLName = XMLSrc.substring(XMLSrc.lastIndexOf("/") + 1);
			
				console.log("Source:", XMLSrc, "Path:", XMLPath, "Name:", XMLName);
			
				console.log(destination);
				S3.getObject({
					Bucket : 'artefacts.ftlabs-ftda.pages',
					Key : XMLSrc
				}).createReadStream().pipe(file);

			}

			file.on('error', function(e){
				console.log("error event");
				console.log(e);
			});
		
			file.on('close', function(e){
				console.log(`File recieved from S3 and written to ${destination}`);
				
				const databaseWrites = [];
		
				co(function * (){
					const data = yield xmlParser.run(destination);
					console.log('PAGES:', data.pages);
					data.pages.forEach(page => {

						if(page.articles !== undefined){

							console.log("This page has", page.articles.length, 'articles');
							const pageID = page.id;
							const articlesToSliceOnPage = [];
			
							page.articles.forEach(article => {
			
								debug(article);
			
								if(article.text){
			
									articlesToSliceOnPage.push({
										id : xmlParser.unwrap(article.id),
										coordinates : xmlParser.unwrap(article.text)['text.cr'].map(t => {
											return xmlParser.coordinates(t);
										})
									});
			
								}
			
							});
	
							const insertQuery = `INSERT INTO slice (\`status\`, \`page-uuid\`, \`slices\`) VALUES ("available", "${pageID}", '${ JSON.stringify( articlesToSliceOnPage ) }');`;
							databaseWrites.push( database.query( insertQuery ) );

						}

				
					})
		
					Promise.all(databaseWrites)
						.then(function(){
							database.disconnect()
								.then(function(){
									callback();
								})
							;
						})
						.catch(err => {
							console.log('Script failed to complete all writes to database', err);
						})
					;
		
				});
		
			});
		})
		.catch(function(err){
			debug('Err:', err);
		})
	;

}

exports.handle = lambda;
