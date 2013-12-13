var Manager = require('./lib/manager').Manager;

function assets(dir, options) {
    return new Manager(dir, options);
}

module.exports = assets;

assets.Manager = Manager;
assets.tags = require('./lib/tags');
assets.compressors = require('./lib/compressors');
assets.utils = require('./lib/utils');
