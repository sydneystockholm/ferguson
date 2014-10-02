var format = require('util').format
  , entities = require('entities')
  , tags = exports;

/**
 * A list of types that should have escaped entities
 */
var encoded_attributes = {
    'alt': true
  , 'title': true
};

/**
 * Generate a <script> tag for a JavaScript asset.
 *
 * @param {String} url
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

tags['.js'] = function (url, options, attributes) {
    if (!options.html5 && !('type' in attributes)) {
        attributes.type = 'text/javascript';
    }
    return format('<script src="%s"%s></script>',
        url, tags.stringify(attributes, options));
};

/**
 * Generate a <link> tag for a CSS stylesheet.
 *
 * @param {String} url
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

tags['.css'] = function (url, options, attributes) {
    attributes.rel = attributes.rel || 'stylesheet';
    return format('<link href="%s"%s />',
        url, tags.stringify(attributes, options));
};

/**
 * Generate a <link> tag for a favicon.
 *
 * @param {String} url
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

tags['.ico'] = function (url, options, attributes) {
    attributes.rel = attributes.rel || 'shortcut icon';
    return format('<link href="%s"%s />',
        url, tags.stringify(attributes, options));
};

/**
 * Generate a <img> tag for various types of images.
 *
 * @param {String} url
 * @param {Object} options
 * @param {Object} attributes
 * @return {String} html
 */

function image(url, options, attributes) {
    return format('<img src="%s"%s />',
        url, tags.stringify(attributes, options));
}

['.jpg', '.jpeg', '.gif', '.png', '.bmp', '.svg'].forEach(function (ext) {
    tags[ext] = image;
});

/**
 * Stringify an object containing HTML attributes.
 *
 * @param {Object} attributes
 * @param {Object} options
 * @return {String}
 */

tags.stringify = function (attributes, options) {
    var level = options.html5 ? 2 : 1;
    return Object.keys(attributes).sort().reduce(function (accumulator, key) {
        var value = attributes[key];
        if(key in encoded_attributes) {
            value = entities.encode(value + '', level);
        }
        var attribute = format(' %s="%s"', key, value);
        return accumulator + attribute;
    }, '');
};
