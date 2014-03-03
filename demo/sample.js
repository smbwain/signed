
var express = require('express');

// Create signature
var signed = require('./../lib/signed');
var signature = signed({
    secret: 'Xd<dMf72sj;6'
});

var app = express();

// Index with signed link
app.get('/', function(res, req) {
    var s = signature.sign('http://localhost:8080/source/a', {ttl: 5});
    req.send('<a href="'+s+'">'+s+'</a><br/>');
    // It prints something like http://localhost:8080/source/a?signed=r:1422553972;e8d071f5ae64338e3d3ac8ff0bcc583b
});

// Validating
app.get('/source/:a', signature.verifier(), function(res, req) {
    req.send(res.params.a);
});

app.listen(8080);
