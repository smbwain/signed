import {createHash} from 'crypto';
import * as querystring from 'querystring';
import {Request, RequestHandler} from 'express';

export type HashFunction = (input: string, secret: string) => string;

export interface SignatureOptions {
    secret: string;
    ttl?: number;
    hash?: string | HashFunction;
}

export interface SignMethodOptions {
    method?: string | string[];
    ttl?: number;
    exp?: number;
    addr?: string;
}

export interface VerifierMethodOptions {
    blackholed?: RequestHandler;
    expired?: RequestHandler;
    addressReader?: AddressReader;
}

export type AddressReader = (req: Request) => string;

interface SignatureData {
    e?: number; // exp timestamp
    a?: string; // address
    r: string; // random number
    m?: string; // allowed method(s)
}

export class SignatureError extends Error {
    public readonly status;
    constructor(message: string, httpStatus: number) {
        super(message);
        Object.setPrototypeOf(this, SignatureError.prototype);
        this.status = httpStatus;
    }
}
export class BlackholedSignatureError extends SignatureError {
    constructor() {
        super('Request blackholed', 403);
        Object.setPrototypeOf(this, BlackholedSignatureError.prototype);
    }
}
export class ExpiredSignatureError extends SignatureError {
    constructor() {
        super('Request expired', 410);
        Object.setPrototypeOf(this, ExpiredSignatureError.prototype);
    }
}

export class Signature {
    private readonly secrets: string[];
    private readonly ttl: number;
    private readonly hash: HashFunction;

    constructor(options: SignatureOptions) {
        const {
            secret,
            ttl = 0,
            hash = 'sha1',
        } = options;
        this.secrets = Array.isArray(secret) ? secret : [secret];
        this.ttl = ttl;
        if (typeof hash === 'string') {
            this.hash = (input: string, secret: string) => createHash(hash).update(input).update(secret).digest('hex');
        } else {
            this.hash = hash;
        }
    };

    public sign(url: string, options: SignMethodOptions = {}): string {
        const data: SignatureData = {
            r: Math.floor(Math.random() * 10000000000).toString(),
        };

        if (options.ttl) {
            data.e = Math.ceil(+new Date() / 1000) + options.ttl;
        } else if (options.exp) {
            data.e = options.exp;
        } else if (this.ttl) {
            data.e = Math.ceil(+new Date() / 1000) + this.ttl;
        }

        if (options.addr) {
            data.a = options.addr;
        }

        if (options.method) {
            data.m = (Array.isArray(options.method) ? options.method.join(',') : options.method).toUpperCase();
        }

        const prefixSign = url.indexOf('?') == -1 ? '?' : '&';
        url += `${prefixSign}signed=${querystring.stringify(data as any, '-', '_')}`;
        url += `-${this.hash(url, this.secrets[0])}`;

        return url;
    }

    private checkStringSignature(str: string, sign: string): void {
        if (!this.secrets.some(secret => this.hash(str, secret) === sign)) {
            throw new BlackholedSignatureError();
        }
    }

    private extractSignature(str: string): [url: string, sign: string] {
        const pos = str.lastIndexOf('-');
        if (pos === -1) {
            throw new BlackholedSignatureError();
        }
        return [str.substr(0, pos), str.substr(pos + 1)];
    }

    private extractSignatureData(url: string): [url: string, signatureData: SignatureData] {
        let pos = url.lastIndexOf('&signed=');
        if(pos === -1) {
            pos = url.lastIndexOf('?signed=');
        }
        if(pos === -1) {
            throw new BlackholedSignatureError();
        }
        return [
            url.substr(0, pos),
            querystring.parse( url.substr(pos + 8), '-', '_') as any,
        ];
    }

    public verify(
        url: string,
        {method, addr}: {
            method?: string;
            addr?: string;
        } = {},
    ): string {
        const [urlWithoutSignature, sign] = this.extractSignature(url);
        this.checkStringSignature(urlWithoutSignature, sign);
        const [originalUrl, data] = this.extractSignatureData(urlWithoutSignature);

        // check additional conditions
        if (data.a && (!addr || data.a !== addr)) {
            throw new BlackholedSignatureError();
        }
        if (data.m && (!method || data.m.indexOf(method.toUpperCase()) == -1)) {
            throw new BlackholedSignatureError();
        }
        if (data.e && data.e < Math.ceil(+new Date()/1000)) {
            throw new ExpiredSignatureError();
        }

        return originalUrl;
    }

    public verifier({blackholed, expired, addressReader}: VerifierMethodOptions = {}): RequestHandler {
        addressReader ??= req => req.socket.remoteAddress;
        return (req, res, next) => {
            try {
                req.url = this.verify(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
                    method: req.method,
                    addr: addressReader(req),
                });
            } catch (err) {
                if (blackholed && err instanceof BlackholedSignatureError) {
                    blackholed(req, res, next);
                    return;
                }
                if (expired && err instanceof ExpiredSignatureError) {
                    expired(req, res, next);
                    return;
                }
                next(err);
                return;
            }
            next();
        }
    }
}

export default function(options: SignatureOptions) {
    return new Signature(options);
}
