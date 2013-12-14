var Ferguson = require('./lib/ferguson').Ferguson;

var ferguson = module.exports = function (dir, options) {
    return new Ferguson(dir, options);
};

ferguson.Ferguson = Ferguson;
ferguson.tags = require('./lib/tags');
ferguson.compressors = require('./lib/compressors');
ferguson.utils = require('./lib/utils');
