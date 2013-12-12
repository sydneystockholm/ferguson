var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , format = require('util').format
  , path = require('path')
  , utils = require('./utils');

/**
 * Create a new AssetManager instance.
 *
 * @param {String} dir - the directory where static assets live
 * @param {Object} options (optional)
 */

function AssetManager(dir, options) {
    this.dir = dir;
    this.options = options || (options = {});

    this.prefix = options.prefix || 'asset';
    this.manifestFilename = this.prefix + '-manifest';
    this.compiledPattern = new RegExp(format('^%s-%s-',
        utils.escapeRegex(this.prefix)
      , '[0-9a-f]+?'
    ));

    this.manifest = null;
    this.assets = {};
    this.compiledAssets = {};
}

inherits(AssetManager, EventEmitter);

exports.AssetManager = AssetManager;

/**
 * Get a list of all static assets and their mtimes.
 *
 * @return {Array} files
 */

AssetManager.prototype.getAssets = function () {
    var assets;
    try {
        assets = utils.walkDirectory(this.dir);
    } catch (err) {
        this.emit('error', err);
    }
    return assets;
};

/**
 * Index the directory of static assets.
 */

AssetManager.prototype.indexAssets = function () {
    var self = this;
    this.getAssets().forEach(function (file) {
        if (file.name === self.manifestFilename) {
            self.manifest = file.name;
        } else if (self.isCompiledAsset(file.name)) {
            var canonical = self.getCanonicalName(file.name);
            if (!(canonical in self.compiledAssets)) {
                self.compiledAssets[canonical] = [];
            }
            self.compiledAssets[canonical].push(file.name);
        } else {
            self.assets[file.name] = file;
        }
    });
};

/**
 * Check whether a file is a compiled asset.
 *
 * @param {String} file
 */

AssetManager.prototype.isCompiledAsset = function (file) {
    return this.compiledPattern.test(path.basename(file));
};

/**
 * Get the canonical name of a compiled asset.
 *
 * @param {String} file
 * @return {String} canonicalFilename
 */

AssetManager.prototype.getCanonicalName = function (file) {
    var dir = path.dirname(file)
      , filename = path.basename(file)
      , canonical = filename.split('-').slice(2).join('-');
    return path.join(dir, canonical);
};
