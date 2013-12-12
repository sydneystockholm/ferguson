var crypto = require('crypto')
  , path = require('path')
  , fs = require('fs')
  , utils = exports;

/**
 * Recursively walk a directory to return an array of files
 * and their mtimes.
 *
 * @param {String} directory
 * @param {String} prefix (optional)
 * @return {Array} files - [{ name: <filename>, mtime: <milliseconds> }, ...]
 */

utils.walkDirectory = function (dir, prefix) {
    var files = [];
    prefix = prefix || '';
    fs.readdirSync(dir).forEach(function (filename) {
        var file = path.join(dir, filename)
          , stat = fs.statSync(file);
        if (stat.isDirectory()) {
            var dirFiles = utils.walkDirectory(file, path.join(prefix, filename));
            files = files.concat(dirFiles);
        } else {
            files.push({
                name: path.join(prefix, filename)
              , mtime: stat.mtime.getTime()
            });
        }
    });
    return files;
};

/**
 * Hash the contents of a file.
 *
 * @param {String} path
 * @param {String} hash - e.g. md5
 */

utils.hashFile = function (path, hash) {
    return utils.hashString(fs.readFileSync(path), hash);
};

/**
 * Hash a string.
 *
 * @param {String} str
 * @param {String} hash
 */

utils.hashString = function (str, hash) {
    return crypto.createHash(hash).update(str).digest('hex');
};

/**
 * Escape regular expression tokens in a string.
 *
 * @param {String} str
 * @return {String}
 */

utils.escapeRegex = function (str) {
    return str.replace(new RegExp('[.*+?|()\\[\\]{}]', 'g'), '\\$&');
};

/**
 * Merge defaults into an options object.
 *
 * @param {Object} options
 * @param {Object] defaults
 */

utils.mergeDefaults = function (options, defaults) {
    options = options || {};
    for (var key in defaults) {
        if (typeof options[key] === 'undefined') {
            options[key] = defaults[key];
        } else if (typeof defaults[key] === 'object') {
            utils.mergeDefaults(options[key], defaults[key]);
        }
    }
    return options;
};
