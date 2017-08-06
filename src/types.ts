import {Request, RequestHandler} from 'express';

export type SignatureOptions = {
    secret: string,
    ttl?: number
}

export type SignMethodOptions = {
    method?: string | string[],
    ttl?: number,
    exp?: number,
    addr?: string
}

export type AddressReader = (req: Request) => string

export type VerifierMethodOptions = {
    blackholed?: RequestHandler,
    expired?: RequestHandler,
    addressReader?: AddressReader
}

export enum VerifyResult {
    ok,
    blackholed,
    expired
}

export interface Signature {

    /**
     * Generate secure link
     */
    sign(url: string, options?: SignMethodOptions): string;

    /**
     * Check whether string sign is valid
     */
    verifyString(str: string, sign: string): boolean;

    /**
     * Check url
     */
    verifyUrl(req: Request, addressReader?: AddressReader): VerifyResult;

    /**
     * Create express middleware
     */
    verifier(options?: VerifierMethodOptions): RequestHandler;
}