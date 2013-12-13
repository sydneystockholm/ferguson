var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , format = require('util').format
  , minimatch = require('minimatch')
  , express = require('express')
  , assert = require('assert')
  , async = require('async')
  , path = require('path')
  , fs = require('fs')
  , utils = require('./utils')
  , tags = require('./tags')
  , compressors = require('./compressors');

/**
 * Default asset manager options.
 */

var defaultOptions = {
    assetPrefix: 'asset'
  , hash: 'md5'
  , hashLength: 32
  , viewHelper: 'asset'
  , manifest: '.asset-manifest'
  , servePrefix: '/'
  , tagFormats: tags
  , compilers: {}
  , compressors: compressors
  , compress: false
  , html5: false
};

/**
 * Create a new Manager instance.
 *
 * @param {String} dir - the directory where static assets live
 * @param {Object} options (optional)
 */

function Manager(dir, options) {
    this.dir = dir;
    this.options = utils.mergeDefaults(options, defaultOptions);
    this.compiledPattern = new RegExp(format('^%s-%s-',
        utils.escapeRegex(this.options.assetPrefix)
      , '[0-9a-f]+?'
    ));
    this.assets = {};
    this.compiledAssets = {};
    this.pendingAssets = {};
}

inherits(Manager, EventEmitter);

exports.Manager = Manager;

/**
 * Initialse the asset manager and bind it to an express app.
 *
 * @param {Express} app
 */

Manager.prototype.init = function (app) {
    this.indexAssets();
    this.hashAssets();
    var helperName = this.options.viewHelper
      , helper = this.asset.bind(this)
      , self = this;
    var staticAssets = express.static(this.dir, {
        maxAge: this.options.maxAge
    });
    app.use(this.options.servePrefix, staticAssets);
    app.use(function (request, response, next) {
        response.locals[helperName] = helper;
        next();
    });
    app.use(this.options.servePrefix, function (request, response, next) {
        if (!self.isCompiledAsset(request.url)) {
            return next();
        }
        var canonical = self.getCanonicalPath(request.url).slice(1)
          , asset = self.pendingAssets[canonical];
        if (!asset) {
            return next();
        }
        self.compileAsset(asset, next);
    });
    app.use(this.options.servePrefix, staticAssets);
};

/**
 * Compile an asset and write it to the static directory.
 *
 * @param {Object} file
 * @param {Function} callback
 */

Manager.prototype.compileAsset = function (file, callback) {
    var contents = [], self = this;
    async.eachSeries(file.assets, function (asset, next) {
        var assetPath = path.join(self.dir, asset.name);
        //TODO: Compile?
        fs.readFile(assetPath, function (err, buffer) {
            if (err) {
                var message = format('Failed to read file "%s": %s',
                    assetPath, err.message);
                return next(new Error(message));
            }
            contents.push(buffer.toString());
            next();
        });
    }, function (err) {
        if (err) return callback(err);
        contents = contents.join('');
        var outputPath = path.join(self.dir, file.path)
          , extname = path.extname(outputPath);
        if (!self.options.compress || !(extname in self.options.compressors)) {
            return fs.writeFile(outputPath, contents, callback);
        }
        self.options.compressors[extname](contents, self.options, function (err, compressed) {
            if (err) {
                var message = format('Failed to compress asset "%s": %s',
                    file.path, err.message);
                return callback(new Error(message));
            }
            return fs.writeFile(outputPath, compressed, callback);
        });
    });
};

/**
 * Index the directory of static assets.
 */

Manager.prototype.indexAssets = function () {
    var self = this;
    this.getAssets().forEach(function (file) {
        if (self.isCompiledAsset(file.name)) {
            var canonical = self.getCanonicalPath(file.name);
            if (!(canonical in self.compiledAssets)) {
                self.compiledAssets[canonical] = [];
            }
            self.compiledAssets[canonical].push(file.name);
        } else if (file.name !== self.options.manifest) {
            self.assets[file.name.toLowerCase()] = file;
        }
    });
};

/**
 * Get a list of all static assets and their mtimes.
 *
 * @return {Array} files
 */

Manager.prototype.getAssets = function () {
    var assets;
    try {
        assets = utils.walkDirectory(this.dir);
    } catch (err) {
        var message = 'Failed to locate assets: ' + err.toString();
        this.emit('error', new Error(message));
    }
    return assets;
};

/**
 * Calculate asset hashes based on file contents.
 */

Manager.prototype.hashAssets = function () {
    var manifestPath = path.join(this.dir, this.options.manifest)
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
            file.hash = utils.hashFile(path.join(this.dir, filename), this.options.hash);
            outdated = true;
        }
    }
    if (outdated) {
        try {
            fs.writeFileSync(manifestPath, JSON.stringify(this.assets));
        } catch (err) {
            var message = 'Failed to write the assets manifest: ' + err.toString();
            this.emit('error', new Error(message));
        }
    }
    return outdated;
};

/**
 * Define assets and return the resulting tags.
 *
 * This function also serves as the view helper available to templates.
 *
 * @param {String} identifier
 * @param {Object} options (optional)
 * @return {String} html
 */

Manager.prototype.asset = function (identifier, options) {
    options = options || {};
    var url = this.assetPath(identifier, options);
    if (!url) {
        return '';
    }
    if (options.prefix) {
        if (url[0] === '/' && options.prefix[options.prefix.length - 1] === '/') {
            options.prefix = options.prefix.slice(0, -1);
        }
        url = options.prefix + url;
    }
    var extname = path.extname(url);
    if (!(extname in this.options.tagFormats)) {
        var message = format('Unable to create an HTML tag for type "%s"', extname);
        this.emit('error', new Error(message));
        return '';
    }
    return this.options.tagFormats[extname](url, this.options, options.attributes || {});
};

/**
 * Generate an asset filename and return the asset's path.
 *
 * @param {String} identifier
 * @param {Object} options (optional)
 * @return {String} filename
 */

Manager.prototype.assetPath = function (identifier, options) {
    identifier = identifier.toLowerCase();
    if (identifier in this.pendingAssets) {
        return this.pendingAssets[identifier].path;
    }
    options = options || {};
    var filenames = []
      , assets = []
      , message;

    //Is the asset a bundle?
    if (options.include) {
        try {
            filenames = filenames.concat(this.expandGlobs(options.include));
        } catch (err) {
            message = err.message + format(' when building asset "%s"', identifier);
            this.emit('error', new Error(message));
            return '';
        }
    } else {
        filenames.push(identifier);
    }

    //TODO: Add options.dependencies to the list

    filenames = utils.stripDuplicates(filenames);
    if (!filenames.length) {
        this.emit('error', new Error('No assets were defined'));
        return '';
    }

    var compilers, base, extname, dirname, tried, foundUncompiled
      , uncompiledFilename;

    //Make sure each asset exists
    for (var filename, i = 0, len = filenames.length; i < len; i++) {
        filename = filenames[i].toLowerCase();

        //If the asset doesn't exist, check if one of the compilers claims it,
        //e.g. foo.css might exist as foo.less.
        if (!(filename in this.assets)) {
            extname = path.extname(filename);
            dirname = filename.indexOf(path.sep) >= 0 ? path.dirname(filename) : '';
            base = path.join(dirname, path.basename(filename, extname));
            compilers = this.options.compilers[extname];
            foundUncompiled = tried = false;
            if (compilers) {
                tried = [];
                for (var ext in compilers) {
                    uncompiledFilename = base + ext;
                    if (uncompiledFilename === filename) {
                        continue;
                    }
                    if (uncompiledFilename in this.assets) {
                        foundUncompiled = true;
                        filename = uncompiledFilename;
                        break;
                    }
                    tried.push(uncompiledFilename);
                }
            }
            if (!foundUncompiled) {
                message = format('Asset "%s" could not be found', filename);
                if (options.include) {
                    message += format(' when building asset "%s"', identifier);
                }
                if (tried && tried.length) {
                    message += format(' (tried "%s")', tried.join('", "'));
                }
                this.emit('error', new Error(message));
                return '';
            }
        }
        assets.push(this.assets[filename]);
    }

    //Generate a cache-busting hash based on each file's contents
    var assetHashes = assets.map(function (asset) {
        return asset.hash;
    }).join(':');
    var hash = utils.hashString(assetHashes, this.options.hash)
        .slice(0, this.options.hashLength);

    var assetFilename = this.getCompiledAssetFilename(identifier, hash)
      , assetPath = path.join(this.options.servePrefix, assetFilename);
    this.pendingAssets[identifier] = {
        path: assetPath
      , assets: assets
    };
    return assetPath;
};

/**
 * Expand an array of glob patterns.
 *
 * @param {String|Array} glob(s)
 * @return {Array} files
 */

var isGlob = /[*?{}]/;

Manager.prototype.expandGlobs = function (globs) {
    if (!Array.isArray(globs)) {
        globs = [ globs ];
    }
    var filenames = [];
    for (var matched, filename, i = 0, len = globs.length; i < len; i++) {
        if (!isGlob.test(globs[i])) {
            filenames.push(globs[i]);
            continue;
        }
        matched = false;
        for (filename in this.assets) {
            if (minimatch(filename, globs[i])) {
                matched = true;
                filenames.push(filename);
            }
        }
        if (!matched) {
            throw new Error(format('No assets matched the pattern "%s"', globs[i]));
        }
    }
    return filenames;
};

/**
 * Get a compiled asset filename.
 *
 * @param {String} filename
 * @param {String} hash
 */

Manager.prototype.getCompiledAssetFilename = function (filename, hash) {
    return format('%s-%s-%s', this.options.assetPrefix, hash, filename);
};

/**
 * Check whether a file is a compiled asset.
 *
 * @param {String} file
 */

Manager.prototype.isCompiledAsset = function (file) {
    return this.compiledPattern.test(path.basename(file));
};

/**
 * Get the canonical path of a compiled asset.
 *
 * @param {String} file
 * @return {String}
 */

Manager.prototype.getCanonicalPath = function (file) {
    var dir = path.dirname(file)
      , filename = path.basename(file)
      , canonical = filename.split('-').slice(2).join('-');
    return path.join(dir, canonical);
};
