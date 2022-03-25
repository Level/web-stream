# level-web-stream

**Read and write to an [`abstract-level`](https://github.com/Level/abstract-level) database using [Web Streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API).** Compatible with browsers and Node.js.

> :pushpin: To instead consume data using Node.js streams, see [`level-read-stream`](https://github.com/Level/read-stream). On Node.js 16, `level-read-stream` is ~3 times faster than `level-web-stream` and the performance of Web Streams isn't likely to improve anytime soon. On the other hand, Web Streams are a step towards a standard library for JavaScript (across Node.js, Deno and browsers).

[![level badge][level-badge]](https://github.com/Level/awesome)
[![npm](https://img.shields.io/npm/v/level-web-stream.svg)](https://www.npmjs.com/package/level-web-stream)
[![Node version](https://img.shields.io/node/v/level-web-stream.svg)](https://www.npmjs.com/package/level-web-stream)
[![Test](https://img.shields.io/github/workflow/status/Level/web-stream/Test?label=test)](https://github.com/Level/web-stream/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/codecov/c/github/Level/web-stream?label=&logo=codecov&logoColor=fff)](https://codecov.io/gh/Level/web-stream)
[![Standard](https://img.shields.io/badge/standard-informational?logo=javascript&logoColor=fff)](https://standardjs.com)
[![Common Changelog](https://common-changelog.org/badge.svg)](https://common-changelog.org)
[![Donate](https://img.shields.io/badge/donate-orange?logo=open-collective&logoColor=fff)](https://opencollective.com/level)

## Usage

### Reading

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

### Writing

```js
const { EntryStream, BatchStream } = require('level-web-stream')

// Copy entries from db to db
const src = new EntryStream(db1)
const dst = new BatchStream(db2, { type: 'put' })

await src.pipeTo(dst)
```

## Install

With [npm](https://npmjs.org) do:

```
npm install level-web-stream
```

## API

### `stream = new EntryStream(db[, options])`

Create a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) that will yield entries. An entry is an array with two elements: a `key` and `value`. The `db` argument must be an `abstract-level` database. The optional `options` object may contain:

- `highWaterMark` (number): the maximum number of entries to buffer internally before ceasing to read further entries. Default 1000.

Any other options are forwarded to `db.iterator(options)`. The stream wraps that iterator. If you prefer to consume entries with `for await...of` then it's recommended to directly use `db.iterator()`. In either case, most databases will read from a snapshot (thus unaffected by simultaneous writes) as indicated by `db.supports.snapshots`.

### `stream = new KeyStream(db[, options])`

Same as `EntryStream` but yields keys instead of entries, using `db.keys()` instead of `db.iterator()`. If only keys are needed, using `KeyStream` may increase performance because values won't have to be fetched.

### `stream = new ValueStream(db[, options])`

Same as `EntryStream` but yields values instead of entries, using `db.values()` instead of `db.iterator()`. If only values are needed, using `ValueStream` may increase performance because keys won't have to be fetched.

### `stream = new BatchStream(db[, options])`

Create a [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream) that takes _operations_ or _entries_, to be written to the database in batches of fixed size using `db.batch()`. If a batch fails the stream will be aborted but previous batches that did succeed will not be reverted.

An _operation_ is an object containing:

- A `key` property (required)
- A `type` property (optional, one of `'put'`, `'del'`)
- A `value` property (required if type is `'put'`, ignored if type is `'del'`)
- Other operation properties accepted by `db.batch()`.

An _entry_ is an array with two elements: a `key` and `value`. This allows piping a readable `EntryStream` into a writable `BatchStream`. Writing `[key, value]` is the same as writing `{ key, value }`.

The `db` argument must be an `abstract-level` database. The optional `options` object may contain:

- `highWaterMark` (number, default 500): the maximum number of operations to buffer internally before committing them to the database with `db.batch()`. No data will be committed until `highWaterMark` is reached or until the stream is closing. Increasing `highWaterMark` can improve throughput at the cost of memory usage and at risk of blocking the JavaScript event loop while `db.batch()` is copying data.
- `type` (string, default `'put'`): default operation `type` if not set on individual operations or entries (which can't set it). Must be `'put'` or `'del'`.

Any other options are forwarded to the `options` argument of `db.batch(operations, options)` thus following the same rules of precedence (of options versus operation properties).

## Contributing

[`Level/web-stream`](https://github.com/Level/web-stream) is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See the [Contribution Guide](https://github.com/Level/community/blob/master/CONTRIBUTING.md) for more details.

## License

[MIT](LICENSE)

[level-badge]: https://leveljs.org/img/badge.svg
