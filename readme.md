#node-inline

inline all images, stylesheets and scripts of a webpage.

This is a (partial) port of [`remy/node-inliner`](https://github.com/remy/inliner) to my [`htmlparser2`](http://npm.im/htmlparser) module.

####installation

    npm i inline

####usage

```js
var Inline = require("inline"),
    minreq = require("minreq");

minreq.get("http://feedic.com/").pipe(
  new Inline("http://feedic.com/", {
    //default options:
    images: true, //inline images
    scripts: true, //inline scripts
    stylesheets: true //inline stylesheets
  }, function(err, data){
    if(err) throw err;
    require("fs").writeFileSync("index.html", data);
  }
));
```

####todo

`inline` currently doesn't minify inlined scripts & stylesheets, and also doesn't support gzip compressed sources. At least support for gzip compression is planned.

----

License: BSD-like
