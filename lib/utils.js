var path = require('path')
  , fs = require('fs')
  , utils = exports;

/**
 * Recursively walk a directory to return an array of files
 * and their mtimes.
 *
 * @param {String} directory
 * @param {String} prefix (optional)
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
