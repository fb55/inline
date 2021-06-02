# inline

inline all images, stylesheets and scripts of a webpage.

This is a (partial) port of [`remy/node-inliner`](https://github.com/remy/inliner) to my [`htmlparser2`](http://npm.im/htmlparser) module.

#### installation

    npm i inline

#### usage

```js
const Inline = require("inline");
const minreq = require("minreq");

minreq.get("http://feedic.com/").pipe(
    new Inline(
        "http://feedic.com/",
        {
            // Default options:
            images: true, // Inline images
            scripts: true, // Inline scripts
            stylesheets: true, // Inline stylesheets
        },
        (err, data) => {
            if (err) throw err;
            require("fs").writeFileSync("index.html", data);
        }
    )
);
```

#### todo

`inline` currently doesn't minify inlined scripts & stylesheets, and also doesn't support gzip compressed sources. At least support for gzip compression is planned.

---

License: BSD-like
