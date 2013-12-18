var format = require('util').format
  , tags = require('./tags')
  , mime = require('mime')
  , inline = exports;

/**
 * Generate a <script> tag for inline JavaScript.
 *
 * @param {String} filename
 * @param {String} buffer
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

inline['.js'] = function (filename, buffer, options, attributes) {
    if (!options.html5 && !('type' in attributes)) {
        attributes.type = 'text/javascript';
    }
    return format('<script%s>%s</script>',
        tags.stringify(attributes, options), buffer);
};

/**
 * Generate a <style> tag for inline CSS.
 *
 * @param {String} filename
 * @param {String} buffer
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

inline['.css'] = function (filename, buffer, options, attributes) {
    if (!options.html5 && !('type' in attributes)) {
        attributes.type = 'text/css';
    }
    return format('<style%s>%s</style>',
        tags.stringify(attributes, options), buffer);
};

/**
 * Create an <img> with a base64-encoded inline image.
 *
 * @param {String} filename
 * @param {String} buffer
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

function image(filename, buffer, options, attributes) {
    return format('<img src="data:%s;base64,%s"%s />',
        mime.lookup(filename),
        buffer.toString('base64'),
        tags.stringify(attributes, options));
}

['.jpg', '.jpeg', '.gif', '.png', '.bmp', '.svg'].forEach(function (ext) {
    inline[ext] = image;
});
