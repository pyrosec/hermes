"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkout = exports.HermesSession = exports.HermesError = exports.CookieJar = void 0;
const cheerio_1 = __importDefault(require("cheerio"));
const uuid_1 = __importDefault(require("uuid"));
const fetch_cookie_1 = __importDefault(require("fetch-cookie"));
const url_1 = __importDefault(require("url"));
const user_agents_1 = require("user-agents");
const querystring_1 = __importDefault(require("querystring"));
exports.CookieJar = fetch_cookie_1.default.toughCookie.CookieJar;
class HermesError extends Error {
    constructor(message, body) {
        super(message);
        this.body = body;
    }
}
exports.HermesError = HermesError;
const getCsrf = (response) => [...response.headers].find(([key]) => key === "x-csrf-jwt")[1];
const fetch = (function () {
    return this.fetch;
})();
class HermesSession {
    constructor(userAgent) {
        if (!userAgent)
            userAgent = new user_agents_1.UserAgent().toString();
        this.userAgent = userAgent;
        this.jar = new fetch_cookie_1.default.toughCookie.CookieJar.jar();
    }
    async _call(uri, config) {
        const cloned = { ...config };
        if (!cloned.headers)
            cloned.headers = {};
        else
            cloned.headers = { ...cloned.headers };
        if (!cloned.headers["User-Agent"] && !cloned.headers["user-agent"])
            cloned.headers["User-Agent"] = this.userAgent;
        if (!cloned.redirect)
            cloned.redirect = "follow";
        const fetchCookie = (0, fetch_cookie_1.default)(fetch, this.jar);
        return await fetchCookie(uri, cloned);
    }
    async checkout({ user, pass, token }) {
        let pre, buyerId, csrf, csci = uuid_1.default.v4().replace("-", ""), corrId = uuid_1.default.v1().split("-")[0] + uuid_1.default.v4().split("-")[0].substr(0, 5), meta;
        const checkoutnowResponse = await this._call(url_1.default.format({
            protocol: "https:",
            hostname: "www.paypal.com",
            pathname: "/checkoutnow",
            search: "?" + querystring_1.default.stringify({ token }),
        }), {
            method: "GET",
        });
        const checkoutnowResponseBody = await checkoutnowResponse.text();
        csrf = getCsrf(checkoutnowResponse);
        let $ = cheerio_1.default.load(checkoutnowResponseBody);
        const script = $("script").eq(9).text();
        const parts = /window\.pre\s+=\s+(\{[\s\S]*\})/.exec(script);
        if (parts === null)
            throw new HermesError("Unexpected response.", checkoutnowResponseBody);
        try {
            pre = JSON.parse(parts[1]);
        }
        catch (e) {
            throw new HermesError("JSON parse error.", checkoutnowResponseBody);
        }
        const signinInjectUri = url_1.default.format({
            hostname: "www.paypal.com",
            protocol: "https:",
            pathname: "/signin/inject/",
            search: "?" +
                querystring_1.default.stringify({
                    stsRedirectUri: "https://www.paypal.com/checkoutnow/2",
                    "country.x": pre.locale.res.data.country,
                    "locale.x": pre.locale.res.data.lang + "_" + pre.locale.res.data.country,
                    returnUri: "https://www.paypal.com/checkoutnow/2",
                    state: "?flow=1-P&token=" + token,
                    forceLogin: "false",
                    flowId: token,
                    correlationId: corrId,
                    rememberMe: "true",
                    rememberMeContent: "1",
                }),
        });
        const signinInjectResponse = await this._call(signinInjectUri, {
            method: "GET",
            compress: true,
            headers: { Referer: "https://www.paypal.com/checkoutnow?token=" + token },
        });
        const signinInjectHeadersJwt = getCsrf(signinInjectResponse);
        if (signinInjectHeadersJwt)
            csrf = signinInjectHeadersJwt;
        const signinInjectResponseBody = await signinInjectResponse.text();
        $ = cheerio_1.default.load(signinInjectResponseBody);
        const lcsrf = $('form[name="login"] input#token').attr("value");
        const session = $('form[name="login"] input#session').attr("value");
        const locale = $('form[name="login"] input[name="locale.x"]').attr("value");
        const signinBody = new URLSearchParams();
        signinBody.append("_csrf", lcsrf);
        signinBody.append("_sessionID", session);
        signinBody.append(".locale.x", locale);
        signinBody.append("login_email", user);
        signinBody.append("login_password", pass);
        const signinResponse = await this._call(url_1.default.format({
            protocol: "https:",
            hostname: "www.paypal.com",
            pathname: "/signin",
        }), {
            method: "POST",
            headers: {
                Referer: signinInjectUri,
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json, text/javascript, */*; q=0.01",
            },
            body: signinBody,
        });
        const response = await signinResponse.json();
        if (response.notifications)
            throw new HermesError(response.notifications.msg, response);
        meta = {
            token: token,
            calc: pre.checkoutAppData.res.meta.calc,
            csci: csci,
            locale: pre.locale.res.data,
            state: "ui_checkout_login",
            app_name: "hermesnodeweb",
        };
        const signinResponseJwt = getCsrf(signinResponse);
        if (signinResponseJwt)
            csrf = signinResponseJwt;
        const securityCtxResponse = await this._call(url_1.default.format({
            protocol: "https:",
            hostname: "www.paypal.com",
            pathname: "/webapps/hermes/api/auth/securityCtx",
            search: "?" + querystring_1.default.stringify({ meta: JSON.stringify(meta) }),
        }), {
            method: "GET",
            headers: {
                "x-csrf-jwt": csrf,
                "X-Requested-With": "XMLHttpRequest",
                Referer: "https://www.paypal.com/checkoutnow?token=" + token,
            },
        });
        const securityCtxResponseJwt = getCsrf(securityCtxResponse);
        if (securityCtxResponseJwt)
            csrf = securityCtxResponseJwt;
        const sessionCreateResponse = await this._call(url_1.default.format({
            protocol: "https:",
            hostname: "www.paypal.com",
            pathname: "/webapps/hermes/api/checkout/" + token + "/session/create",
        }), {
            method: "POST",
            compress: true,
            headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json;charset=UTF-8",
                "x-csrf-jwt": csrf,
                Referer: "https://www.paypal.com/checkoutnow?token=" + token,
                "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({
                data: {},
                meta: {
                    calc: meta.calc,
                    csci: csci,
                    app_name: "hermesnodeweb",
                    state: "ui_checkout_login",
                    locale: pre.locale.res.data,
                    token: token,
                },
            }),
        });
        const sessionCreateResponseBody = await sessionCreateResponse.json();
        if (sessionCreateResponseBody.ack !== "success")
            throw new HermesError("Hermes session could not be created.", sessionCreateResponseBody);
        buyerId = sessionCreateResponseBody.data.payer.id;
        const sessionCreateResponseJwt = getCsrf(sessionCreateResponse);
        if (sessionCreateResponseJwt)
            csrf = sessionCreateResponseJwt;
        const authorizeResponse = await this._call(url_1.default.format({
            protocol: "https:",
            hostname: "www.paypal.com",
            pathname: "/webapps/hermes/api/checkout/" + token + "/session/authorize",
        }), {
            method: "POST",
            headers: {
                "x-csrf-jwt": csrf,
            },
            body: JSON.stringify({
                meta: {
                    app_name: "hermesnodeweb",
                    locale: pre.locale.res.data,
                    csci: csci,
                    state: "ui_checkout_review",
                    token: token,
                    calc: sessionCreateResponseBody.meta.calc,
                },
            }),
        });
        const authorizeResponseBody = await authorizeResponse.json();
        const returnUrl = pre.checkoutAppData.res.data.urls.return_url;
        if (authorizeResponseBody.ack !== "success")
            throw new HermesError("Could not authorize token with Hermes.", authorizeResponseBody);
        return (returnUrl + (~returnUrl.indexOf("?") ? "&" : "?") + "PayerID=" + buyerId);
    }
}
exports.HermesSession = HermesSession;
const checkout = async ({ user, pass, token }) => {
    return await new HermesSession().checkout({ user, pass, token });
};
exports.checkout = checkout;
//# sourceMappingURL=hermes.js.map