require('dotenv').config( { silent : false } );
const debug = require('debug')('test');
const database = require('./index');

database.connect({
		host : process.env.MYSQL_HOST,
		user : process.env.MYSQL_USERNAME,
		password : process.env.MYSQL_PASSWORD,
		database : process.env.MYSQL_DATABASE,
		port : process.env.MYSQL_PORT 
	})
	.then(function(){

		database.query('SELECT * FROM slice')
			.then(data => {
				debug(data.results);
				database.disconnect();
			})
			.catch(err => {
				debug(err);
				database.disconnect();
			})
		;
		
	})
;
