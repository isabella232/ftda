require('dotenv').config();
let credentials;
const AWS_BUCKET = process.env.AWS_BUCKET || '<Insert value here for distribution>';
const AWS_REGION = process.env.AWS_REGION || '<Insert value here for distribution>';
const KEY_FETCH_URL = process.env.KEY_FETCH_URL || '<Insert value here for distribution>';

function setKeys(keys) {
	credentials = keys;
}

function getSecret() {
	return credentials.secret || null;
}

function getKey() {
	return credentials.key || null;
}


module.exports = {
	set: setKeys,
	secret: getSecret,
	key: getKey,
	AWS_BUCKET: AWS_BUCKET,
	AWS_REGION: AWS_REGION,
	KEY_FETCH_URL: KEY_FETCH_URL
}