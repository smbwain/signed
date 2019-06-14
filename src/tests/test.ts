
import signed, {Signature} from '../..';

import * as assert from 'assert';
import * as express from 'express';
import * as request from 'request';

const TEST_PORT = 23001;

function makeRequest(path, {expectedCode = 200} = {}) : Promise<string> {
    return new Promise((resolve, reject) => {
        request(path, (err, response, body) => {
            if (err) {
                reject(err);
                return;
            }
            if (response.statusCode != expectedCode) {
                err = new Error(`Wrong status code: ${response.statusCode}`);
                err.statusCode = response.statusCode;
                reject(err);
                return;
            }
            resolve(body);
        })
    });
}

describe('test1', function() {
    this.timeout(10000);

    let signature : Signature, app, server;

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
        
        const v1 = express.Router();
        v1.get('/try', signature.verifier(), (_, req) => req.send('ok'));
        app.use('/v1', v1);

        await new Promise((resolve, reject) => {
            server = app.listen(TEST_PORT, err => {
                err ? reject(err) : resolve();
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
            addr: '::ffff:127.0.0.1'
        }));
    });

    it('should be 200 (method check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            method: 'get,post'
        }));
    });

    it('should be 200 (ttl check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            ttl: 5
        }));
    });

    it('should be 200 (expiration check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            exp: Date.now()+5000
        }));
    });

    it('should be 403 (bad token)', async() => {
        await makeRequest(
            signature.sign(`http://localhost:${TEST_PORT}/try`)+'1',
            {expectedCode: 403}
        );
    });

    it('should be 403 (address check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            addr: '127.0.0.2'
        }), {
            expectedCode: 403
        });
    });

    it('should be 403 (method check)', async () => {
        await makeRequest(signature.sign(`http://localhost:${TEST_PORT}/try`, {
            method: 'post,delete'
        }), {
            expectedCode: 403
        });
    });

    it('should be 410 (ttl check)', async() => {
        const link = signature.sign(`http://localhost:${TEST_PORT}/try`, {
            ttl: 1
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await makeRequest(
            link,
            {expectedCode: 410}
        );
    });

    it('should be 410 (expiration check)', async() => {
        const link = signature.sign(`http://localhost:${TEST_PORT}/try`, {
            exp: Math.floor(Date.now()/1000)
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await makeRequest(
            link,
            {expectedCode: 410}
        );
    });

    it('should stop server', async () => {
        await new Promise(resolve => {
            server.close(() => {
                resolve();
            })
        })
    });
});