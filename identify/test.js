const lambdaFunction = require('./index');

lambdaFunction.handle({}, {}, function(){
	process.exit();
}, true);