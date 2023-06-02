export declare const CookieJar: any;
export type CookieJarType = typeof CookieJar;
export declare class HermesError extends Error {
    body: any;
    constructor(message: any, body: any);
}
declare const fetch: any;
export declare class HermesSession {
    jar: CookieJarType;
    userAgent: string;
    constructor(userAgent?: string);
    _call(uri: any, config: any): Promise<Awaited<ReturnType<typeof fetch>>>;
    checkout({ user, pass, token }: {
        user: any;
        pass: any;
        token: any;
    }): Promise<string>;
}
export declare const checkout: ({ user, pass, token }: {
    user: any;
    pass: any;
    token: any;
}) => Promise<string>;
export {};
