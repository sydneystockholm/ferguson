var format = require('util').format
  , entities = require('entities')
  , tags = exports;

tags['.js'] = function (url, options, attributes) {
    if (!options.html5 && !('type' in attributes)) {
        attributes.type = 'text/javascript';
    }
    return format('<script src="%s"%s></script>',
        url, stringify(attributes, options));
};

tags['.css'] = function (url, options, attributes) {
    if (!('rel' in attributes)) {
        attributes.rel = 'stylesheet';
    }
    return format('<link href="%s"%s />',
        url, stringify(attributes, options));
};

function stringify(attributes, options) {
    if (!attributes) {
        return '';
    }
    var level = options.html5 ? 2 : 1;
    return Object.keys(attributes).sort().reduce(function (accumulator, key) {
        var attribute = format(' %s="%s"', key, entities.encode(attributes[key], level));
        return accumulator + attribute;
    }, '');
}
