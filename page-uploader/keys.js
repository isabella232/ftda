let credentials;

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
	key: getKey
}