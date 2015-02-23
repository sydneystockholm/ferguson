var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , format = require('util').format
  , minimatch = require('minimatch')
  , express = require('express')
  , assert = require('assert')
  , async = require('async')
  , path = require('path')
  , mkdirp = require('mkdirp')
  , fs = require('fs')
  , debug = require('debug')('ferguson')
  , utils = require('./utils')
  , tags = require('./tags')
  , inline = require('./inline')
  , compressors = require('./compressors');

/**
 * Default asset manager options.
 */

var defaultOptions = {
    assetPrefix: 'asset'
  , hash: 'md5'
  , hashLength: 16
  , viewHelper: 'asset'
  , manifest: '.asset-manifest'
  , servePrefix: '/'
  , urlPrefix: ''
  , tags: tags
  , inline: inline
  , compilers: {}
  , compressors: compressors
  , maxAge: 4 * 7 * 24 * 60 * 60 * 1000
  , compress: false
  , hotReload: false
  , wrapJavascript: false
  , javascriptIIFE: '!function(){%s}();'
  , separateBundles: false
  , html5: false
  , outputDir: null
};

/**
 * Create a new Ferguson instance.
 *
 * @param {String} dir - the directory where static assets live
 * @param {Object} options (optional)
 */

function Ferguson(dir, options) {
    this.inputDir = dir;
    this.options = utils.mergeDefaults(options, utils.copy(defaultOptions));
    
    if(this.options.outputDir === null) {
        this.options.outputDir = dir;
    }
    this.outputDir = this.options.outputDir;
    
    this.compiledPattern = new RegExp(format('^%s-%s-',
        utils.escapeRegex(this.options.assetPrefix)
      , '[0-9a-f]+?'
    ));
    this.assets = {};
    this.compiledAssets = {};
    this.pendingAssets = {};
    this.compilingNow = {};
    this.reverseCompilerIndex = {};
}

inherits(Ferguson, EventEmitter);

exports.Ferguson = Ferguson;

/**
 * Initialise the asset manager.
 */

Ferguson.prototype.init = function () {
    if (this.initialised) {
        return;
    }
    this.buildReverseCompilerIndex();
    this.indexAssets();
    this.hashAssets();
    if (this.options.hotReload) {
        this.watchDirectory();
    }
    this.initialised = true;
};

/**
 * Bind the instance to an express application.
 *
 * @param {Express} app
 * @return {Ferguson} this
 */

Ferguson.prototype.bind = function (app) {
    this.init();

    //Serve existing assets using the express static middleware
    var staticAssets = express.static(this.outputDir, {
        maxAge: this.options.maxAge
    });
    app.use(this.options.servePrefix, staticAssets);

    //Bind view helpers
    var helperName = this.options.viewHelper
      , helper = app.asset = this.asset.bind(this);
    helper.path = this.assetPath.bind(this);
    helper.url = this.assetUrl.bind(this);
    helper.inline = this.assetInline.bind(this);
    Object.defineProperty(helper, 'prefix', {
        get: this.assetPrefix.bind(this)
    });
    app.use(function (request, response, next) {
        response.locals[helperName] = response.asset = helper;
        next();
    });

    //Compile assets. Concurrent requests to the same asset are queued while
    //the first request does the actual compilation
    var self = this;
    app.use(this.options.servePrefix, function (request, response, next) {
        if (!self.isCompiledAsset(request.url)) {
            return next();
        }
        var canonical = self.getCanonicalPath(request.url).slice(1)
          , asset = self.pendingAssets[canonical];
        if (!asset || path.join(self.options.servePrefix, request.url) !== asset.path) {
            return next();
        }
        debug('Compiling %s (%s)', request.url, canonical);
        if (!(canonical in self.compilingNow)) {
            self.compilingNow[canonical] = [];
            request._canonicalAssetName = canonical;
            self.compileAsset(asset, next);
        } else {
            self.compilingNow[canonical].push(next);
        }
    });

    //Resume each request that was waiting on compilation to finish
    function resume(next) {
        next();
    }
    app.use(this.options.servePrefix, function (request, response, next) {
        if (!request._canonicalAssetName) {
            return next();
        }
        var canonical = request._canonicalAssetName
          , pendingRequests = self.compilingNow[canonical];
        delete self.compilingNow[canonical];
        debug('Wrote compiled %s (%s) to disk', request.url, canonical);
        pendingRequests.forEach(resume);
        next();
    });

    //Handle compilation failures
    app.use(this.options.servePrefix, function (err, request, response, next) {
        if (!request._canonicalAssetName) {
            return next(err);
        }
        var canonical = request._canonicalAssetName
          , pendingRequests = self.compilingNow[canonical];
        delete self.compilingNow[canonical];
        debug('Failed to compile %s (%s)', request.url, canonical);
        pendingRequests.forEach(function (resume) {
            resume(err);
        });
        next(err);
    });

    app.use(this.options.servePrefix, staticAssets);

    return this;
};

/**
 * Compile an asset and write it to the static directory.
 *
 * @param {Object} file
 * @param {Function} callback
 */

Ferguson.prototype.compileAsset = function (file, callback) {
    var buffers = [], self = this;
    async.eachSeries(file.assets, function (asset, next) {
        var assetPath = path.join(self.inputDir, asset.name)
          , extname = path.extname(asset.name);
        debug('Loading file %s', asset.name);
        fs.readFile(assetPath, function (err, buffer) {
            if (err) {
                var message = format('Failed to read file "%s": %s',
                    asset.name, err.message);
                return next(new Error(message));
            }
            var compiler = self.options.compilers[extname];
            if (!compiler) {
                buffers.push(buffer);
                return next();
            }
            //Is the compiler synchronous?
            if (compiler.compile.length <= 3) {
                debug('Using synchronous %s compiler to compile %s', extname, asset.name);
                try {
                    var compiled = compiler.compile(assetPath, buffer, self.options);
                    buffers.push(compiled);
                    next();
                } catch (err) {
                    var message = format('Failed to compile file "%s": %s',
                        asset.name, err.message);
                    next(new Error(message));
                }
            } else {
                debug('Using asynchronous %s compiler to compile %s', extname, asset.name);
                compiler.compile(assetPath, buffer, self.options, function (err, compiled) {
                    if (err) {
                        var message = format('Failed to compile file "%s": %s',
                            asset.name, err.message);
                        return next(new Error(message));
                    }
                    buffers.push(compiled);
                    next();
                });
            }
        });
    }, function (err) {
        if (err) return callback(err);
        var buffer;
        if (buffers.length > 1) {
            buffer = new Buffer(buffers.map(function (content) {
                return content.toString();
            }).join(''));
        } else {
            buffer = buffers[0];
        }
        var outputPath = path.join(self.outputDir, file.path)
          , outputDir = path.dirname(outputPath)
          , extname = path.extname(outputPath);
        if (extname === '.js' && self.options.wrapJavascript) {
            buffer = format(self.options.javascriptIIFE, buffer);
        }
        var compressor = self.options.compressors[extname];
        mkdirp(outputDir, function () {
            if (!self.options.compress || !compressor) {
                return fs.writeFile(outputPath, buffer, { encoding: null }, callback);
            }
            //In the compressor synchronous?
            if (compressor.length <= 2) {
                debug('Compressing the result with the synchronous %s compressor', extname);
                try {
                    var compressed = compressor(buffer, self.options)
                      , encoding = !Buffer.isBuffer(compressed) ? 'utf8' : null;
                    return fs.writeFile(outputPath, compressed, { encoding: encoding }, callback);
                } catch (err) {
                    var message = format('Failed to compress asset "%s": %s',
                        file.path, err.message);
                    callback(new Error(message));
                }
            } else {
                debug('Compressing the result with the asynchronous %s compressor', extname);
                compressor(buffer, self.options, function (err, compressed) {
                    if (err) {
                        var message = format('Failed to compress asset "%s": %s',
                            file.path, err.message);
                        return callback(new Error(message));
                    }
                    var encoding = !Buffer.isBuffer(compressed) ? 'utf8' : null;
                    return fs.writeFile(outputPath, compressed, { encoding: encoding }, callback);
                });
            }
        });
    });
};

/**
 * Compile an asset synchronously.
 *
 * @param {Object} file
 * @return {Buffer}
 */

Ferguson.prototype.compileAssetSync = function (file) {
    var buffers = [], self = this;
    file.assets.forEach(function (asset) {
        var assetPath = path.join(self.inputDir, asset.name)
          , extname = path.extname(asset.name);
        debug('Loading file %s', asset.name);
        var buffer;
        try {
            buffer = fs.readFileSync(assetPath);
        } catch (err) {
            var message = format('Failed to read file "%s": %s',
                asset.name, err.message);
            throw new Error(message);
        }
        var compiler = self.options.compilers[extname];
        if (!compiler) {
            buffers.push(buffer);
            return;
        }
        if (compiler.compile.length === 4) {
            var message = format('Cannot compile "%s" synchronously because ' +
                'the %s compiler is async', asset.name, compiler.extname);
            throw new Error(message);
        }
        debug('Using synchronous %s compiler to compile %s', extname, asset.name);
        try {
            var compiled = compiler.compile(assetPath, buffer, self.options);
            buffers.push(compiled);
        } catch (err) {
            var message = format('Failed to compile file "%s": %s',
                asset.name, err.message);
            throw new Error(message);
        }
    });
    var buffer;
    if (buffers.length > 1) {
        buffer = new Buffer(buffers.map(function (content) {
            return content.toString();
        }).join(''));
    } else {
        buffer = buffers[0];
    }
    var extname = path.extname(file.path);
    if (extname === '.js' && self.options.wrapJavascript) {
        buffer = format(self.options.javascriptIIFE, buffer);
    }
    var compressor = self.options.compressors[extname];
    if (self.options.compress && compressor) {
        if (compressor.length === 3) {
            var message = format('Cannot compress "%s" synchronously because ' +
                'the %s compressor is async', file.path, extname);
            throw new Error(message);
        }
        debug('Compressing the result with the synchronous %s compressor', extname);
        try {
            buffer = compressor(buffer, self.options);
            if (!Buffer.isBuffer(buffer)) {
                buffer = new Buffer(buffer);
            }
        } catch (err) {
            var message = format('Failed to compress asset "%s": %s',
                file.path, err.message);
            throw new Error(message);
        }
    }
    return buffer;
};

/**
 * Index the directory of static assets.
 */

Ferguson.prototype.indexAssets = function () {
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

Ferguson.prototype.getAssets = function () {
    var assets;
    try {
        assets = utils.walkDirectory(this.inputDir);
    } catch (err) {
        var message = 'Failed to locate assets: ' + err.toString();
        this.emit('error', new Error(message));
    }
    return assets;
};

/**
 * Calculate asset hashes based on file contents.
 *
 * @return {Boolean} outdated - true if at least one file had to be hashed
 */

Ferguson.prototype.hashAssets = function () {
    var manifestPath = path.join(this.inputDir, this.options.manifest)
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
            debug('Hashing file %s', filename);
            file.hash = utils.hashFile(path.join(this.inputDir, filename), this.options.hash);
            outdated = true;
        }
    }
    if (outdated) {
        this.writeManifest();
    }
    return outdated;
};

/**
 * Cache the in-memory index to a manifest file.
 */

Ferguson.prototype.writeManifest = function () {
    var manifestPath = path.join(this.inputDir, this.options.manifest);
    try {
        debug('Writing to the manifest file');
        fs.writeFileSync(manifestPath, JSON.stringify(this.assets));
    } catch (err) {
        var message = 'Failed to write the assets manifest: ' + err.toString();
        this.emit('error', new Error(message));
    }
};

/**
 * Define assets and return the resulting tags.
 *
 * This function also serves as the view helper available to templates.
 *
 * @param {String} identifier
 * @param {Object} options (optional)
 * @param {Boolean} force (optional) - ignore any existing asset definitions
 * @return {String} html
 */

Ferguson.prototype.asset = function (identifier, options, force) {
    this.init();
    options = options || {};
    identifier = identifier.toLowerCase();

    //Have we already defined the asset?
    if (!force && identifier in this.pendingAssets) {
        var existingOptions = this.pendingAssets[identifier].options;
        options = utils.mergeDefaults(utils.copy(options), existingOptions);
        return this.asset(identifier, options, true);
    }

    if (this.options.separateBundles && options.include) {
        debug('Calculating includes for %s', identifier);
        var include;
        try {
            include = this.expandGlobs(options.include);
        } catch (err) {
            message = err.message + format(' when building asset "%s"', identifier);
            this.emit('error', new Error(message));
            return '';
        }
        options = utils.copy(options);
        delete options.include;
        var self = this;
        debug('Separating bundle %s into multiple tags', identifier);
        return include.map(function (identifier) {
            return self.asset(identifier, options);
        }).join('\n');
    }

    var attributes = options.attributes || {};

    //Should we inline the asset?
    if (options.inline) {
        identifier = this.defineAsset(identifier, options);
        if (!identifier) {
            return '';
        }
        var inlineFormat = this.options.inline[path.extname(identifier)]
          , inline = this.assetInline(identifier, options);
        if (!inlineFormat) {
            return inline.toString();
        }
        return inlineFormat(identifier, inline, this.options, attributes);
    }

    var url = this.assetUrl(identifier, options)
      , extname = path.extname(url);
    if (!(extname in this.options.tags)) {
        var message = format('Unable to create an HTML tag for type "%s"', extname);
        this.emit('error', new Error(message));
        return '';
    }
    return this.options.tags[extname](url, this.options, attributes);
};

/**
 * Get the URL of a compiled asset.
 *
 * @param {String} identifier
 * @param {Object} options (optional)
 * @param {Boolean} force (optional) - ignore any existing asset definitions
 * @return {String} path
 */

Ferguson.prototype.assetUrl = function (identifier, options, force) {
    this.init();
    identifier = identifier.toLowerCase();
    options = options || {};

    //Have we already defined the asset?
    if (!force && identifier in this.pendingAssets) {
        var existingOptions = this.pendingAssets[identifier].options;
        options = utils.mergeDefaults(utils.copy(options), existingOptions);
        return this.assetUrl(identifier, options, true);
    }
    var url = this.assetPath(identifier, options);
    if (!url) {
        return '';
    }
    var prefix = options.urlPrefix || this.options.urlPrefix;
    if (prefix) {
        if (url[0] === '/' && prefix[prefix.length - 1] === '/') {
            prefix = prefix.slice(0, -1);
        }
        url = prefix + url;
    }
    debug('Asset url is %s', url);
    return url;
};

/**
 * Get the path of a compiled asset.
 *
 * @param {String} identifier
 * @param {Object} options (optional)
 * @param {Boolean} force (optional) - ignore any existing asset definitions
 * @return {String} path
 */

Ferguson.prototype.assetPath = function (identifier, options, force) {
    this.init();
    //Have we already defined the asset?
    options = options || {};
    identifier = identifier.toLowerCase();
    if (!force && identifier in this.pendingAssets) {
        var existingOptions = this.pendingAssets[identifier].options;
        options = utils.mergeDefaults(utils.copy(options), existingOptions);
        return this.assetPath(identifier, options, true);
    }
    identifier = this.defineAsset(identifier, options);
    if (!identifier) {
        return '';
    }
    return this.pendingAssets[identifier].path;
};

/**
 * Get an inline asset.
 *
 * @param {String} identifier
 * @param {Object} options
 * @param {Boolean} force (optional) - ignore any existing asset definitions
 * @return {String} contents
 */

Ferguson.prototype.assetInline = function (identifier, options, force) {
    this.init();
    //Have we already defined the asset?
    options = options || {};
    identifier = identifier.toLowerCase();
    if (!force && identifier in this.pendingAssets) {
        var existingOptions = this.pendingAssets[identifier].options;
        options = utils.mergeDefaults(utils.copy(options), existingOptions);
        return this.assetInline(identifier, options, true);
    }
    debug('Inlining asset %s', identifier);
    identifier = this.defineAsset(identifier, options);
    if (!identifier) {
        return new Buffer(0);
    }
    var asset = this.pendingAssets[identifier];
    if (asset.cachedInline) {
        return asset.cachedInline;
    }
    var contents;
    try {
        contents = this.compileAssetSync(asset);
        asset.cachedInline = contents;
    } catch (err) {
        this.emit('error', err);
        contents = new Buffer(0);
    }
    return contents;
};

/**
 * Define an asset.
 *
 * @param {String} identifier
 * @param {Object} options
 * @param {Boolean} force (optional) - ignore any existing asset definitions
 * @return {String} path
 */

Ferguson.prototype.defineAsset = function (identifier, options, force) {
    this.init();

    identifier = identifier.toLowerCase();

    //Let users define assets using a compiler extension, e.g. "foo.less"
    var dirname, extname = path.extname(identifier);
    if (extname in this.options.compilers) {
        dirname = identifier.indexOf('/') >= 0 ? path.dirname(identifier) : '';
        var outputExt = this.options.compilers[extname].output;
        identifier = path.join(dirname, path.basename(identifier, extname) + outputExt);
    }

    //Have we already defined the asset?
    if (!force && identifier in this.pendingAssets) {
        var existingOptions = this.pendingAssets[identifier].options;
        options = utils.mergeDefaults(utils.copy(options), existingOptions);
        return this.defineAsset(identifier, options, true);
    }

    var filenames = []
      , dependencies = []
      , assets = []
      , message
      , self = this;

    //Is the asset a bundle?
    if (options.include) {
        debug('Calculating includes for %s', identifier);
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

    if (!filenames.length) {
        this.emit('error', new Error('No assets were defined'));
        return '';
    }

    var compilers, base, tried, foundUncompiled
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
            compilers = this.reverseCompilerIndex[extname];
            foundUncompiled = tried = false;
            if (compilers) {
                tried = [];
                for (var compiler, j = 0; j < compilers.length; j++) {
                    compiler = compilers[j];
                    uncompiledFilename = base + compiler.extname;
                    if (uncompiledFilename === filename) {
                        continue;
                    }
                    if (uncompiledFilename in this.assets) {
                        foundUncompiled = true;
                        debug('Asset %s exists as %s', filename, uncompiledFilename);
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

    //Let the user specify a list of assets that are included in the final asset
    //thay we wouldn't otherwise know about (e.g. files included via an @import in less)
    if (options.dependencies) {
        try {
            debug('Calculating dependencies for %s', identifier);
            var dependencyFilenames = this.expandGlobs(options.dependencies)
              , dependency, asset;
            dependencyFilenames = utils.stripDuplicates(dependencyFilenames);
            for (i = 0, len = dependencyFilenames.length; i < len; i++) {
                dependency = dependencyFilenames[i];
                asset = self.assets[dependency];
                if (!asset) {
                    throw new Error(format('Failed to locate "%s"', dependency));
                }
                dependencies.push(asset);
            }
        } catch (err) {
            message = format(' when finding dependencies for "%s"', identifier);
            this.emit('error', new Error(err.message + message));
            return '';
        }
    }

    //Generate a cache-busting hash based on the expected contents of the asset
    var toHash = assets.concat(dependencies);
    var assetHashes = toHash.map(function (asset) {
        return asset.hash;
    }).join(':');
    debug('Asset hash is based on the contents of %j', toHash.map(function (asset) {
        return asset.name;
    }));
    var hash = utils.hashString(assetHashes, this.options.hash)
        .slice(0, this.options.hashLength);

    //Generate the output filename and path
    var canonical = path.basename(identifier)
      , assetDirname = identifier.indexOf('/') >= 0 ? path.dirname(identifier) : ''
      , assetFilename = path.join(assetDirname, this.getCompiledAssetFilename(canonical, hash))
      , assetPath = path.join(this.options.servePrefix, assetFilename);
    debug('Asset path is %s', assetPath);

    //Keep track of the asset
    var existingAsset = this.pendingAssets[identifier];
    if (!existingAsset || existingAsset.path !== assetPath) {
        this.pendingAssets[identifier] = {
            path: assetPath
          , assets: assets
          , dependencies: dependencies
          , options: options
        };
    }

    //Cleanup any older versions of the asset
    var existing = this.compiledAssets[identifier];
    if (existing) {
        this.compiledAssets[identifier] = existing.filter(function (file) {
            if (file !== assetFilename) {
                debug('Removing old asset %s', file);
                self.emit('delete', file);
                delete self.pendingAssets[file];
                delete self.compiledAssets[file];
                fs.unlink(path.join(self.outputDir, file), utils.noop);
                return false;
            }
            return true;
        });
    }

    return identifier;
};

/**
 * Get the URL prefix of assets.
 *
 * @param {Object} options
 * @return {String} prefix
 */

Ferguson.prototype.assetPrefix = function (options) {
    options = options || {};
    var prefix = options.urlPrefix || this.options.urlPrefix;
    if (prefix[prefix.length - 1] === '/') {
        prefix = prefix.slice(0, -1);
    }
    prefix += this.options.servePrefix;
    if (prefix[prefix.length - 1] !== '/') {
        prefix += '/';
    }
    return prefix;
};

/**
 * Expand an array of glob patterns.
 *
 * @param {String|Array} glob(s)
 * @return {Array} files
 */

var isGlob = /[*?{}]/;

Ferguson.prototype.expandGlobs = function (globs) {
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
    debug('Expanded glob %j to filenames %j', globs, filenames);
    return filenames;
};

/**
 * Watch the static directory for updates.
 */

Ferguson.prototype.watchDirectory = function () {
    var locations = [];
    for (var file in this.assets) {
        locations.push(path.dirname(file));
    }
    debug('Watching directory %s for changes', this.inputDir);
    var self = this;
    this.watchers = utils.stripDuplicates(locations).map(function (dir) {
        return fs.watch(path.join(self.inputDir, dir), function (event, filename) {
            filename = path.join(dir, filename);
            if (self.isCompiledAsset(filename) || filename === self.options.manifest) {
                return;
            }
            debug('Detected a change in %s', filename);
            var filePath = path.join(self.inputDir, filename)
              , canonical = filename.toLowerCase();
            try {
                var stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    self.removeWatchers();
                    self.indexAssets();
                    self.hashAssets();
                    self.watchDirectory();
                } else {
                    debug('Hashing file %s', filename);
                    self.assets[canonical] = {
                        name: filename
                      , mtime: stat.mtime.getTime()
                      , hash: utils.hashFile(filePath, self.options.hash)
                    };
                }
            } catch (err) {
                delete self.assets[canonical];
            }
            self.writeManifest();
            self.emit('change', filename);
        });
    });
};

/**
 * Destroy the asset manager.
 */

Ferguson.prototype.destroy = function () {
    if (this.watchers) {
        this.removeWatchers();
    }
    this.initialised = false;
};

/**
 * Remove all directory watchers.
 */


Ferguson.prototype.removeWatchers = function () {
    this.watchers.forEach(function (watcher) {
        watcher.close();
    });
    this.watchers = [];
};

/**
 * Register a HTML tag format.
 *
 * @param {String} ext - e.g. ".js"
 * @param {Function} formatter
 * @return {Ferguson} this
 */

Ferguson.prototype.registerTagFormat = function (ext, formatter) {
    ext = utils.toExtname(ext);
    this.options.tags[ext] = formatter;
    debug('Registered %s tag format', ext);
    return this;
};

/**
 * Register a inline HTML format.
 *
 * @param {String} ext - e.g. ".js"
 * @param {Function} formatter
 * @return {Ferguson} this
 */

Ferguson.prototype.registerInlineFormat = function (ext, formatter) {
    ext = utils.toExtname(ext);
    this.options.inline[ext] = formatter;
    debug('Registered %s inline format', ext);
    return this;
};

/**
 * Register a compressor.
 *
 * @param {String} ext - e.g. ".js"
 * @param {Function} compressor
 * @return {Ferguson} this
 */

Ferguson.prototype.registerCompressor = function (ext, compressor) {
    ext = utils.toExtname(ext);
    this.options.compressors[ext] = compressor;
    debug('Registered %shronous %s compressor',
        compressor.length <= 2 ? 'sync' : 'async', ext);
    return this;
};

/**
 * Register a compiler.
 *
 * @param {String} inputExt - e.g. ".less"
 * @param {String} outputExt - e.g. ".css"
 * @param {Function} compiler
 * @return {Ferguson} this
 */

Ferguson.prototype.registerCompiler = function (inputExt, outputExt, compiler) {
    inputExt = utils.toExtname(inputExt);
    outputExt = utils.toExtname(outputExt);
    var arity = compiler.length;
    compiler = {
        output: outputExt
      , compile: compiler
      , extname: inputExt
    };
    this.options.compilers[inputExt] = compiler;
    if (outputExt in this.reverseCompilerIndex) {
        var compilers = this.reverseCompilerIndex[outputExt];
        this.reverseCompilerIndex[outputExt] = compilers.filter(function (compiler) {
            return compiler.extname !== inputExt;
        });
    } else {
        this.reverseCompilerIndex[outputExt] = [];
    }
    debug('Registered %shronous %s => %s compiler',
        arity <= 3 ? 'sync' : 'async', inputExt, outputExt);
    this.reverseCompilerIndex[outputExt].push(compiler);
    return this;
};

/**
 * Build a reverse index of compilers.
 */

Ferguson.prototype.buildReverseCompilerIndex = function () {
    var extname, compiler;
    for (extname in this.options.compilers) {
        compiler = this.options.compilers[extname];
        compiler.extname = extname;
        if (!(compiler.output in this.reverseCompilerIndex)) {
            this.reverseCompilerIndex[compiler.output] = [];
        }
        this.reverseCompilerIndex[compiler.output].push(compiler);
    }
};

/**
 * Get a compiled asset filename.
 *
 * @param {String} filename
 * @param {String} hash
 * @return {String} filename
 */

Ferguson.prototype.getCompiledAssetFilename = function (filename, hash) {
    return format('%s-%s-%s', this.options.assetPrefix, hash, filename);
};

/**
 * Check whether a file is a compiled asset.
 *
 * @param {String} file
 * @return {Boolean}
 */

Ferguson.prototype.isCompiledAsset = function (file) {
    return this.compiledPattern.test(path.basename(file));
};

/**
 * Get the canonical path of a compiled asset.
 *
 * @param {String} file
 * @return {String}
 */

Ferguson.prototype.getCanonicalPath = function (file) {
    var dir = path.dirname(file)
      , filename = path.basename(file)
      , canonical = filename.split('-').slice(2).join('-');
    return path.join(dir, canonical);
};
