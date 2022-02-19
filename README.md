# level-web-stream

**Read from an [`abstract-level`](https://github.com/Level/abstract-level) database using [Web Streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API).** Compatible with browsers and Node.js.

> :pushpin: To instead consume data using Node.js streams, see [`level-read-stream`](https://github.com/Level/read-stream).

[![level badge][level-badge]](https://github.com/Level/awesome)
[![npm](https://img.shields.io/npm/v/level-web-stream.svg)](https://www.npmjs.com/package/level-web-stream)
[![Node version](https://img.shields.io/node/v/level-web-stream.svg)](https://www.npmjs.com/package/level-web-stream)
[![Test](https://img.shields.io/github/workflow/status/Level/web-stream/Test?label=test)](https://github.com/Level/web-stream/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/codecov/c/github/Level/web-stream?label=&logo=codecov&logoColor=fff)](https://codecov.io/gh/Level/web-stream)
[![Standard](https://img.shields.io/badge/standard-informational?logo=javascript&logoColor=fff)](https://standardjs.com)
[![Common Changelog](https://common-changelog.org/badge.svg)](https://common-changelog.org)
[![Donate](https://img.shields.io/badge/donate-orange?logo=open-collective&logoColor=fff)](https://opencollective.com/level)

## Usage

```js
const { EntryStream } = require('level-web-stream')
const { MemoryLevel } = require('memory-level')

const db = new MemoryLevel()

// Write sample data
await db.put('a', '1')
await db.put('b', '2')
await db.put('c', '3')

// Create a ReadableStream
const src = new EntryStream(db, {
  gte: 'b'
})

// Pipe to a stream of choice
const dst = new WritableStream({
  write ([key, value]) {
    console.log('%s: %s', key, value)
  }
})

await src.pipeTo(dst)
```

Yields:

```
b: 2
c: 3
```

To only read keys or values rather than entries:

```js
const { KeyStream, ValueStream } = require('level-web-stream')

await new KeyStream(db).pipeTo(new WritableStream({
  write (key) {
    console.log(key)
  }
}))
```

Note that [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream) is a global in browsers. In Node.js it can be imported from [`stream/web`](https://nodejs.org/api/webstreams.html).

## Install

With [npm](https://npmjs.org) do:

```
npm install level-web-stream
```

## API

### `stream = new EntryStream(db[, options])`

Create a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) that will yield entries. An entry is an array with `key` and `value` properties. The `db` argument must be an `abstract-level` database. The optional `options` object may contain:

- `highWaterMark` (number): the maximum number of entries to buffer internally before ceasing to read further entries. Default 1000.

Any other options are forwarded to `db.iterator(options)`. The stream wraps that iterator. If you prefer to consume entries with `for await...of` then it's recommended to directly use `db.iterator()`. In either case, most databases will read from a snapshot (thus unaffected by simultaneous writes) as indicated by `db.supports.snapshots`.

### `stream = new KeyStream(db[, options])`

Same as `EntryStream` but yields keys instead of entries, using `db.keys()` instead of `db.iterator()`. If only keys are needed, using `KeyStream` may increase performance because values won't have to be fetched.

### `stream = new ValueStream(db[, options])`

Same as `EntryStream` but yields values instead of entries, using `db.values()` instead of `db.iterator()`. If only values are needed, using `ValueStream` may increase performance because keys won't have to be fetched.

## Contributing

[`Level/web-stream`](https://github.com/Level/web-stream) is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See the [Contribution Guide](https://github.com/Level/community/blob/master/CONTRIBUTING.md) for more details.

## License

[MIT](LICENSE)

[level-badge]: https://leveljs.org/img/badge.svg
