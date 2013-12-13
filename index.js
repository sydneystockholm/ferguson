var Manager = require('./lib/manager').Manager;

function ferguson(dir, options) {
    return new Manager(dir, options);
}

module.exports = ferguson;

ferguson.Manager = Manager;
ferguson.tags = require('./lib/tags');
ferguson.compressors = require('./lib/compressors');
ferguson.utils = require('./lib/utils');
