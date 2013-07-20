Signed
======

Signed is tiny node.js/express library for signing urls and validating them based on secret key.

It may be used for secure sharing urls for users, without need to check permissions on resources server.

E.g.

You have front server, which generates html or supports RESTFull API. And you have data server, which provides some resources.

With the help of this library you may sign urls on front server and give its to end users. After that you may verify signature on data server.

So, sessions or storing additional data aren't needed for this purpose.

Let's start
===========

It's only few lines.

To install library type in your console

```
npm install signed
```

Create signature object based on secret.

Secret string should not be known for anyone else, except your servers

```js
var signed = require('signed');
var signature = signed({
    secret: 'secret string'
});
```

Sign url

```js
var signedUrl = signature.sign('http://example.com/resource');
```

Verify url on resource side

```js
app.get('/resource', signature.verifier(), function(req, res) {
    res.send('ok');
});
```

Sample application
------------------

```js
var express = require('express');

// Create signature
var signed = require('signed');
var signature = signed({
    secret: 'Xd<dMf72sj;6'
});

var app = express();

// Index with signed link
app.get('/', function(res, req) {
    var s = signature.sign('http://localhost:8080/source/a');
    req.send('<a href="'+s+'">'+s+'</a><br/>');
    // It outs something like http://localhost:8080/source/a?signed=r:1422553972;e8d071f5ae64338e3d3ac8ff0bcc583b
});

// Validating
app.get('/source/:a', signature.verifier(), function(res, req) {
    req.send(res.params.a);
});

app.listen(8080);
```

API
===

signed(options)
------------------

Library exports function which takes _options_ and returns signature object.

```js
var signed = require('signed');
var signature = signed({
    secret: 'secret string',
        // secret is required param
    ttl: 60
        // if it's set, default ttl of signed urls will be 60 sec
});
```

signature.sign(url, options)
----------------------------

This method signs url and returns signed one. You also may pass additional object _options_.

```js
var signedUrl = signature.sign('http://example.com/resource', {
    method: 'get',
        // if specified, only this method will be allowed
        // may be string of few methods separated by comma, or array of strings
    ttl: 50,
        // time to live for url, started from now
    exp: 1374269431,
        // expiration timestamp (if ttl isn't specified)
    addr: '127.0.0.1'
        // if set, only request from this address will be allowed
});
```

signature.verifier(options)
---------------------------

Returns express middleware for validate incoming requests.

```js
app.get('/resource', signature.verifier({

    blackholed: function(req, resp) {
        resp.send(403);
    },
    // if specified, this middleware will be called when request isn't valid
    // default behavior is to send empty request with 403 status code

    expired: function(req, resp) {
        resp.send(410);
    }
    // if specified, this middleware will be called if request is valid, but it's expired
    // default behavior is to send empty request with 410 status code

}), function(req, res) {
    res.send('ok');
});
```