const debug = require('debug')('database-interface');
const mysql = require('mysql');

let connection;

function connectToSQLServer(connectionOptions){

	connection = mysql.createConnection(connectionOptions);

	return new Promise( (resolve, reject) => {

		connection.connect(err => {
			if(err){
				debug('Failed to connect to database', err);
				reject(err);
			} else {
				debug('Connected to database with settings', JSON.stringify(connectionOptions));
				resolve();
			}
		})

	} );

}

function closeConnectionToSQLServer(){

	if(!connection){
		debug('There is no active database connection to close');
		return Promise.resolve();
	}

	return new Promise( (resolve, reject) => {

		connection.end(err => {

			if(err){
				debug('Unable to successfully close connection to database', err);
				reject(err);
			} else {
				debug('Database connection successfully closed');
				connection = undefined;
				resolve();
			}
			
		});

	} );

}

function queryTheSQLDatabase(query){

	if(!connection){
		debug('There is no active database connection to query');
		return Promise.resolve();
	}

	return new Promise( (resolve, reject) => {

		connection.query(query, (err, results, fields) => {

			if(err){
				debug('Error querying database', err);
				reject(err);
			} else {
				debug('Database successfully queried', results);
				resolve({
					results,
					fields
				});
			}

		});	

	} );

}

module.exports = {
	connect : connectToSQLServer,
	disconnect : closeConnectionToSQLServer,
	query : queryTheSQLDatabase
};