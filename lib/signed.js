
module.exports = function(options) {
    return new Signature(options);
};

var crypto = require('crypto');
var querystring = require('querystring');

var Signature = function(options) {
    this.secret = Array.isArray(options.secret) ? options.secret : [options.secret];
    this.ttl = options.ttl;
};

/**
 * Generates secure link
 * @param {string} url
 * @param {object} [options]
 *   secret - secret string
 *   ttl - time to live in seconds
 * @returns {string}
 */
Signature.prototype.sign = function(url, options) {
    options = options || {};

    var data = {};

    var exp = (options.ttl ? Math.floor(+new Date()/1000)+options.ttl : null) ||
        options.exp ||
        (this.ttl ? Math.floor(+new Date()/1000)+this.ttl : null);
    if(exp) {
        data.e = exp;
    }

    if(options.addr) {
        data.a = options.addr;
    }

    data.r = Math.floor(Math.random()*10000000000);

    if(options.method) {
        data.m = (Array.isArray(options.method) ? options.method.join(',') : options.method).toUpperCase();
    }

    url += (url.indexOf('?') == -1 ? '?' : '&') + 'signed='+querystring.stringify(data, ';', ':') + ';';

    var hash = crypto.createHash('md5');
    hash.update(url, 'utf8');
    hash.update(this.secret[0]);

    url += hash.digest('hex');

    return url;
};

/**
 * Checks whether string sign is valid
 * @param {string} str
 * @param {string} sign
 * @returns {boolean}
 */
Signature.prototype.verifyString = function(str, sign) {
    for(var i = 0; i < this.secret.length; i++) {
        var hash = crypto.createHash('md5');
        hash.update(str, 'utf8');
        hash.update(this.secret[i], 'utf8');
        if(hash.digest('hex') == sign)
            return true;
    }
    return false;
};

/**
 * Checks url
 * @param {object} req
 * @returns {*}
 */
Signature.prototype.verifyUrl = function(req) {
    var url = req.protocol+'://'+req.get('host')+req.url;

    if( url.length < 33  ||  !this.verifyString( url.substring(0, url.length-32), url.substr(-32) ) ) {
        return 'blackholed';
    }

    // get signed data
    var lastAmpPos = url.lastIndexOf('&signed=');
    if(lastAmpPos == -1) {
        lastAmpPos = url.lastIndexOf('?signed=');
    }
    if(lastAmpPos == -1) {
        return 'blackholed';
    }
    var data = querystring.parse( url.substring(lastAmpPos+8, url.length-33), ';', ':');
    req.url = url.substr(0, lastAmpPos);

    // check additional conditions
    if(data.a  &&  data.a != req.socket.remoteAddress) {
        return 'blackholed';
    }
    if(data.m  &&  data.m.indexOf(req.method) == -1) {
        return 'blackholed';
    }
    if(data.e  &&  data.e < Math.ceil(+new Date()/1000)) {
        return 'expired';
    }
    return true;
};

/**
 * Returns express middleware
 * @param {object} [options]
 *  method - http method
 *  ttl - time to live in seconds
 *  exp - expiration timestamp
 *  addr - allowed ip
 * @returns {Function}
 */
Signature.prototype.verifier = function(options) {
    var self = this;
    options = options || {};
    var on = {
        blackholed: options.blackholed || function(req, resp) {
            resp.send(403);
        },
        expired: options.expired || function(req, resp) {
            resp.send(410);
        }
    };

    return function(req, resp, next) {

        var res = self.verifyUrl(req);

        if(res === true) {
            next();
        } else {
            on[res](req, resp);
        }
    }

};