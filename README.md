Signed
======

_signed_ is tiny node.js/express library for signing urls and validating them based on secret key.

It can be used for sharing url for the user securely, without need to check permissions when they use this url after.

No session needed. You can sign and verify url on different servers.

> Important!!!
> 
> Urls signed by version 1.x.x of this library are not be valid with 2.x.x

How to use
===========

```bash
npm i signed
```

### Let's create signature object based on secret.

Signature object will be needed later to sign url, or to validate it.

```ts
import signed from 'signed';
const signature = signed({
    secret: 'secret string',
});
```

Possible options:
  - `secret: string` It MUST NOT be known for anyone else except you servers.
  - `ttl?: number` Default time to live for signed url (in seconds). If not set, signed url will be valid forever by default
  - `hash: string | HashFunction` What type of hash function should be used to sign url. `sha1` is used by default.
    But you can pass any other algorithm supported by [crypto.createHash()](https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options).
    You can also pass your own hashing function `(input: string, secret: string) => string`.

### Let's sign url

```ts
const signedUrl = signature.sign('http://example.com/resource');
```
You also can optionally pass object with options:

```ts
const signedUrl = signature.sign('http://example.com/resource', {
    method: 'get',
});
```

Possible options:

 - `method?: string | string[]` List of http methods (as array, or separated by comma), which can be used.
   If not passed - any http method will be allowed.
 - `ttl?: number` Time to live for url starting from now (in seconds).
 - `exp?: number` Expiration unix timestamp (in seconds). Can be passed instead of ttl 
 - `addr?: string` Only this user's address will be allowed.
   You can pass user's address here to prevent sharing signed url with anyone else.
   
### Let's verify signature

So now, when you sent signed url to user, it's time to add verification for endpoints which should be accessible only with valid signature.

```ts
app.get('/resource', signature.verifier(), (req, res, next) => {
    res.send('ok');
});
```

You can also pass object with additional options to _verifier_ method.
Possible options:

 - `addressReader?: (req: Request) => string` Function which will be used to retrieve user's address (for the cases when you added address to signature).
   By default, `req => req.socket.remoteAddress` is be used.
 - `blackholed?: RequestHandler` Handler to use in the case of wrong signature.

      (It's added for backward compatibility. It's better to not use it. See [#Error handling]()).
 
 - `expired?: RequestHandler` Handler to use in the case of valid, but expired signature.

     (It's added for backward compatibility. It's better to not use it. See [#Error handling]()).

### Using without express middleware

If you don't want to use it with express, you can just validate url with .verify(url, options) method:

```ts
const url = signature.sign('http://localhost:8080');

// ...

signature.verify(url);
```

or:

```ts
const url = signature.sign('http://localhost:8080', {
    method: ['get', 'post'],
    address: '127.0.0.1',
});

// ...

signature.verify(url, {
    method: 'get',
    address: '127.0.0.1',
});
```

### Error handling

By default, if there is bad signature, verifier middleware throws SignatureError to the express _next_ function.

403 http status will be sent for bad signature and 410 if signature is expired.

You can handle these errors yourself, using express error handler middleware:  

```ts
import {SignatureError} from 'signed';

// ...

app.use((req, res, next, err) => {
    if (err instanceof SignatureError) {
        // signature is not valid or expired
    }
});
```

Or you can differentiate bad signature and expired signature this way:

```ts
import {BlackholedSignatureError, ExpiredSignatureError} from 'signed';

// ...

app.use((req, res, next, err) => {
    if (err instanceof BlackholedSignatureError) {
        // signature is not valid
    }
    if (err instanceof ExpiredSignatureError) {
        // signature is expired
    }
});
```

Example of application
----------------------

```ts
import * as express from 'express';
import signed from 'signed';

// Create signature
const signature = signed({
    secret: 'Xd<dMf72sj;6'
});

const app = express();

// Index with signed link
app.get('/', (req, res, next) => {
    const s = signature.sign('http://localhost:8080/source/a');
    res.send('<a href="'+s+'">'+s+'</a><br/>');
    // It prints something like http://localhost:8080/source/a?signed=r_1422553972-e8d071f5ae64338e3d3ac8ff0bcc583b
});

// Validating
app.get('/source/:a', signature.verifier(), (req, res, next) => {
    res.send(req.params.a);
});

app.listen(8080);
```

License
=======

MIT
