const { Parser } = require("htmlparser2");
const { ElementType } = require("htmlparser2");
const Cornet = require("cornet");
const DomUtils = require("domutils");
const fs = require("fs");
const minreq = require("minreq");
const url = require("url");
const { EventEmitter } = require("events");

class Inline extends EventEmitter {
    constructor(url, options, cb) {
        super();

        if (typeof options === "function") {
            cb = options;
            options = {};
        } else if (!options) {
            options = {};
        }
        this.url = url;
        this.cb = cb;
        this.options = options;
        this._cache = {};
        this._pending = 1;

        const handler = new Cornet(options);
        this.handler = handler;
        this.parser = new Parser(handler, options);

        if (!("images" in options) || options.images) {
            // Inline images
            handler.select("img[src]:not([src^='data:'])", (elem) =>
                this.getDataURI(elem.attribs.src, (err, uri) => {
                    if (err) return; // Do nothing
                    elem.attribs.src = uri;
                })
            );
        }

        if (!("scripts" in options) || options.scripts) {
            // Inline scripts
            handler.select(
                "script[src]:not([src*='google-analytics.com'])",
                (elem) =>
                    this.load(elem.attribs.src, (err, resp, body) => {
                        if (err) return; // Do nothing
                        if (
                            resp &&
                            resp.headers["content-type"] === "text/html"
                        ) {
                            return; // Also ignore it
                        }

                        elem.children = [
                            {
                                type: ElementType.Text,
                                data: body
                                    .toString("utf-8")
                                    .replace(/<\/script>/gi, "<\\/script>"),
                            },
                        ];
                        delete elem.attribs.src; // Remove the attribute
                        this.minifyScript(elem);
                    })
            );

            // Minify scripts
            handler.select("script:not([src])", (elem) =>
                this.minifyScript(elem)
            );
        }

        if (!("stylesheets" in options) || options.stylesheets) {
            // Inline stylesheets
            handler.select("link[rel=stylesheet][href]", (elem) =>
                this.load(elem.attribs.href, (err, resp, body) => {
                    if (err) return; // Do nothing
                    const idx = elem.parent.children.lastIndexOf(elem);
                    // Replace the element
                    elem.parent.children.splice(idx, 1, {
                        type: ElementType.Style,
                        children: [
                            {
                                type: ElementType.Text,
                                data: body.toString("utf-8"),
                            },
                        ],
                    });
                    this.processStyleElement(elem.parent.children[idx]);
                })
            );
            // Inline url() and @import
            handler.select("style", (elem) => this.processStyleElement(elem));
        }

        this.dom = null;
        handler.on("dom", (dom) => {
            this.dom = dom;
            if (!--this._pending) {
                this.done();
            }
        });
    }
    load(path, cb) {
        path = url.resolve(this.url, path);

        if (path in this._cache && this._cache[path] !== null) {
            cb.apply(null, this._cache[path]);
            return;
        }

        this.on(`l ${path}`, cb);

        if (path in this._cache) return;

        this._cache[path] = null;
        this._pending++;

        if (!/^https?:\/\//.test(path)) {
            fs.readFile(path, (err, data) =>
                this.emit(`l ${path}`, err, null, data)
            );
        } else {
            minreq({ uri: path, only2xx: true }, (err, resp, data) =>
                this.emit(`l ${path}`, err, resp, data)
            );
        }

        this.on(`l ${path}`, (err, resp, data) => {
            if (--this._pending === 0) {
                this.done();
            } else {
                this._cache[path] = [err, resp, data]; // Cache it
            }
        });
    }
    write(c) {
        this.parser.write(c);
    }
    end(c) {
        this.parser.end(c);
    }
    done() {
        if (this.dom) {
            this.cb(null, this.dom.map(DomUtils.getOuterHTML).join(""));
        }
    }
    processStyleElement(elem) {
        // TODO
    }
    minifyScript(elem) {
        // TODO
    }
    getDataURI(path, cb) {
        this.load(path, (err, res, body) => {
            if (err) cb(err);
            else if (!res || !("content-type" in res.headers)) {
                cb(Error("no content-type was specified"));
            } else {
                cb(
                    null,
                    `data:${res.headers["content-type"]};base64,${body.toString(
                        "base64"
                    )}`
                );
            }
        });
    }
}

Inline.prototype.writable = true;

module.exports = Inline;
