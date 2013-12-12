var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , utils = require('./utils');

/**
 * Create a new AssetManager instance.
 *
 * @param {String} dir - the directory where static assets live
 * @param {Object} options (optional)
 */

function AssetManager(dir, options) {
    this.dir = dir;
    this.options = options || {};
}

inherits(AssetManager, EventEmitter);

exports.AssetManager = AssetManager;

/**
 * Get a list of all static assets and their mtimes.
 *
 * @return {Array} files
 */

AssetManager.prototype.getStaticAssets = function () {
    var files;
    try {
        files = utils.walkDirectory(this.dir);
    } catch (err) {
        this.emit('error', err);
    }
    return files;
};


