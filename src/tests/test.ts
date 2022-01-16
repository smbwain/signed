import signed, {BlackholedSignatureError, ExpiredSignatureError, Signature, SignatureError} from '../index';
import * as express from 'express';
import fetch from 'node-fetch';
import {Server} from 'http';
import * as assert from 'assert';
import {ErrorRequestHandler, RequestHandler} from 'express';

const TEST_PORT = 23001;

async function makeRequest(
    url: string,
    {
        expectedCode = 200,
    } = {},
): Promise<string> {
    console.log(`url: ${url}`);
    const req = await fetch(url);
    if (req.status !== expectedCode) {
        throw new Error(`Status code: ${req.status}. Expected: ${expectedCode}`);
    }
    return req.text();
}

describe('test1', function() {
    this.timeout(10000);

    let signature: Signature;
    let app: express.Application;
    let server: Server;

    it('should create signature', () => {
        signature = signed({
            secret: 'Xd<dMf72sj;6'
        });
    });

    it('should start server', async () => {
        app = express();
        app.get('/try', signature.verifier(), function(res, req) {
            req.send('ok');
        });

        app.get('/try-with-error-handler-1', signature.verifier(), ((req, res, next) => {
            res.send('ok');
        }) as RequestHandler, ((err, req, res, next) => {
            if (err instanceof BlackholedSignatureError) {
                res.statusCode = 411;
                res.send();
                return;
            }
            if (err instanceof ExpiredSignatureError) {
                res.statusCode = 412;
                res.send();
                return;
            }
            res.statusCode = 500;
            res.send();
        }) as ErrorRequestHandler);

        app.get('/try-with-error-handler-2', signature.verifier(), ((req, res, next) => {
            res.send('ok');
        }) as RequestHandler, ((err, req, res, next) => {
            if (err instanceof SignatureError) {
                res.statusCode = 413;
                res.send();
                return;
            }
            res.statusCode = 500;
            res.send();
        }) as ErrorRequestHandler);

        app.get('/try-blackholed', signature.verifier({
            blackholed: (req, res, next) => {
                res.statusCode = 400;
                res.send();
            },
        }), function(res, req) {
            req.send('ok');
        });
        
        const v1 = express.Router();
        v1.get('/try', signature.verifier(), (_, req) => req.send('ok'));
        app.use('/v1', v1);

        await new Promise<void>((resolve) => {
            server = app.listen(TEST_PORT, () => {
                resolve();
            });
        });
    });

    it('should be 200', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`));
    });

    it('should be 200 (with baseUrl)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/v1/try`));
    });

    it('should be 200 (address check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            addr: '::ffff:127.0.0.1',
        }));
    });

    it('should be 200 (method check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            method: 'get,post',
        }));
    });

    it('should be 200 (ttl check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            ttl: 5,
        }));
    });

    it('should be 200 (expiration check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            exp: Math.floor(Date.now()/1000) + 5,
        }));
    });

    it('should be 403 (bad token)', async() => {
        await makeRequest(
            signature.sign(`http://localhost:${TEST_PORT}/try`)+'1',
            {expectedCode: 403},
        );
    });

    it('should be 403 (address check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            addr: '127.0.0.2'
        }), {
            expectedCode: 403,
        });
    });

    it('should be 403 (method check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            method: 'post,delete'
        }), {
            expectedCode: 403,
        });
    });

    it('should be 410 (ttl check)', async() => {
        const link = signature.sign(`http://localhost:${TEST_PORT}/try`, {
            ttl: 1
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await makeRequest(
            link,
            {expectedCode: 410},
        );
    });

    it('should be 410 (expiration check)', async() => {
        const link = signature.sign(`http://localhost:${TEST_PORT}/try`, {
            exp: Math.floor(Date.now()/1000)
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await makeRequest(
            link,
            {expectedCode: 410},
        );
    });

    it('should be 400 (custom blackholed callback)', async() => {
        await makeRequest(
            `http://localhost:${TEST_PORT}/try-blackholed`,
            {expectedCode: 400},
        );
    });

    it('should check custom error handler', async () => {
        await makeRequest(
            `http://localhost:${TEST_PORT}/try-with-error-handler-1`,
            {expectedCode: 411},
        );
        await makeRequest(
            signature.sign(`http://localhost:${TEST_PORT}/try-with-error-handler-1`, {
                exp: Math.floor(Date.now()/1000) - 1,
            }),
            {expectedCode: 412},
        );
        await makeRequest(
            `http://localhost:${TEST_PORT}/try-with-error-handler-2`,
            {expectedCode: 413},
        );
    })

    it('should stop server', async () => {
        await new Promise<void>(resolve => {
            server.close(() => {
                resolve();
            });
        })
    });

    it('should verify with .verify method', () => {
        const url = signature.sign('http://localhost:8080', {
            method: ['get', 'post'],
            addr: '127.0.0.1',
        });

        console.log(url);

        assert(signature.verify(url, {
            method: 'get',
            addr: '127.0.0.1',
        }) === 'http://localhost:8080');
    });
});
