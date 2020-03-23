
export * from './types';

import {createHash} from 'crypto';
import * as querystring from 'querystring';
import {Request, RequestHandler} from 'express';

import * as Types from './types';

const EQ = encodeURIComponent(':');
const SEP = encodeURIComponent(';');
class Signature implements Types.Signature {
    private secret : string[];
    private ttl : number;

    constructor(options: Types.SignatureOptions) {
        this.secret = Array.isArray(options.secret) ? options.secret : [options.secret];
        this.ttl = options.ttl;
    };

    sign(url: string, options: Types.SignMethodOptions = {}): string {
        const data : {
            e?: number,
            a?: string,
            r: string,
            m?: string
        } = {
            r: Math.floor(Math.random()*10000000000).toString()
        };

        const exp = (options.ttl ? Math.ceil(+new Date()/1000)+options.ttl : null) ||
            options.exp ||
            (this.ttl ? Math.ceil(+new Date()/1000)+this.ttl : null);
        if(exp) {
            data.e = exp;
        }

        if(options.addr) {
            data.a = options.addr;
        }

        if(options.method) {
            data.m = (Array.isArray(options.method) ? options.method.join(',') : options.method).toUpperCase();
        }

        url += (url.indexOf('?') == -1 ? '?' : '&') + 'signed='+querystring.stringify(data, SEP, EQ) + SEP;

        const hash = createHash('md5');
        hash.update(url, 'utf8');
        hash.update(this.secret[0]);

        url += hash.digest('hex');

        return url;
    }

    verifyString(str: string, sign: string): boolean {
        for(let i = 0; i < this.secret.length; i++) {
            const hash = createHash('md5');
            hash.update(str, 'utf8');
            hash.update(this.secret[i], 'utf8');
            if(hash.digest('hex') == sign)
                return true;
        }
        return false;
    }

    verifyUrl(req: Request, addressReader?: Types.AddressReader): Types.VerifyResult {
        const url = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.url}`;

        if( url.length < 33  ||  !this.verifyString( url.substring(0, url.length-32), url.substr(-32) ) ) {
            return Types.VerifyResult.blackholed;
        }

        // get signed data
        let lastAmpPos = url.lastIndexOf('&signed=');
        if(lastAmpPos == -1) {
            lastAmpPos = url.lastIndexOf('?signed=');
        }
        if(lastAmpPos == -1) {
            return Types.VerifyResult.blackholed;
        }
        const data = querystring.parse( url.substring(lastAmpPos+8, url.length-33), SEP, EQ);
        req.url = url.substr(0, lastAmpPos);

        // check additional conditions
        if(data.a  &&  addressReader  &&  data.a != addressReader(req)) {
            return Types.VerifyResult.blackholed;
        }
        if(data.m  &&  data.m.indexOf(req.method) == -1) {
            return Types.VerifyResult.blackholed;
        }
        if(data.e  &&  data.e < Math.ceil(+new Date()/1000)) {
            return Types.VerifyResult.expired;
        }
        return Types.VerifyResult.ok;
    }

    verifier({
        blackholed = (req, res, next) => {
            const err = new Error('Blackholed');
            (err as any).status = 403;
            next(err);
        },
        expired = (req, res, next) => {
            const err = new Error('Expired');
            (err as any).status = 410;
            next(err);
        },
        addressReader = req => req.connection.remoteAddress
    }: Types.VerifierMethodOptions = {}): RequestHandler {
        return (req, res, next) => {
            switch(this.verifyUrl(req, addressReader)) {
                case Types.VerifyResult.ok:
                    next();
                    break;
                case Types.VerifyResult.blackholed:
                    return blackholed(req, res, next);
                case Types.VerifyResult.expired:
                    return expired(req, res, next);
            }
        }
    };
}

export default function(options: Types.SignatureOptions) {
    return new Signature(options);
}
