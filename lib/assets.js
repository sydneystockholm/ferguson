var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , format = require('util').format
  , assert = require('assert')
  , path = require('path')
  , fs = require('fs')
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
    this.hash = options.hash || 'md5';
    this.manifest = options.manifest || '.asset-manifest';
    this.compiledPattern = new RegExp(format('^%s-%s-',
        utils.escapeRegex(this.prefix)
      , '[0-9a-f]+?'
    ));
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
        if (self.isCompiledAsset(file.name)) {
            var canonical = self.getCanonicalName(file.name);
            if (!(canonical in self.compiledAssets)) {
                self.compiledAssets[canonical] = [];
            }
            self.compiledAssets[canonical].push(file.name);
        } else if (file.name !== self.manifest) {
            self.assets[file.name] = file;
            delete file.name;
        }
    });
};

/**
 * Calculate asset hashes based on file contents.
 */

AssetManager.prototype.hashAssets = function () {
    var manifestPath = path.join(this.dir, this.manifest)
      , manifest, outdated = false;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath).toString());
        assert.equal(typeof manifest, 'object');
    } catch (err) {
        manifest = {};
    }
    var file, filename;
    for (filename in this.assets) {
        file = this.assets[filename];
        if (filename in manifest && manifest[filename].mtime === file.mtime) {
            file.hash = manifest[filename].hash;
        } else {
            file.hash = utils.hashFile(path.join(this.dir, filename), this.hash);
            outdated = true;
        }
    }
    if (outdated) {
        try {
            fs.writeFileSync(manifestPath, JSON.stringify(this.assets));
        } catch (err) {
            this.emit('error', err);
        }
    }
    return outdated;
};

/**
 * Initialse the asset manager and bind it to an express app.
 *
 * @param {Express} app
 */

AssetManager.prototype.init = function (app) {
    this.indexAssets();
    this.hashAssets();
    var helperName = this.options.viewHelper || 'asset'
      , helper = this.asset.bind(this);
    app.use(function (request, response, next) {
        response.locals[helperName] = helper;
        next();
    });
};

/**
 * The view helper for defining assets and outputting asset tags.
 *
 * @param {String} filename
 * @param {Object} options (optional)
 * @return {String} html
 */

AssetManager.prototype.asset = function (filename, options) {
    options = options || {};
    //TODO
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
