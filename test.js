'use strict'

const test = require('tape')
const { MemoryLevel } = require('memory-level')
const { ReadableStream, WritableStream } = require('./streams')
const { EntryStream, KeyStream, ValueStream, BatchStream } = require('.')

let db
let lastIterator

const data = [
  { key: 'a', value: '1' },
  { key: 'b', value: '2' },
  { key: 'c', value: '3' }
]

test('setup', function (t) {
  db = new MemoryLevel()

  // Keep track of last created iterator for test purposes
  for (const method of ['iterator', 'keys', 'values']) {
    const original = db[method]

    db[method] = function (...args) {
      const it = lastIterator = original.apply(this, args)
      return it
    }
  }

  db.open(function (err) {
    t.error(err, 'no error')
    db.batch(data.map(x => ({ type: 'put', ...x })), function (err) {
      t.error(err, 'no error')
      t.end()
    })
  })
})

test('EntryStream', async function (t) {
  t.same(await concat(new EntryStream(db)), data.map(kv => [kv.key, kv.value]))
})

test('KeyStream', async function (t) {
  t.same(await concat(new KeyStream(db)), data.map(kv => kv.key))
})

test('ValueStream', async function (t) {
  t.same(await concat(new ValueStream(db)), data.map(kv => kv.value))
})

for (const Ctor of [EntryStream, KeyStream, ValueStream]) {
  const name = Ctor.name

  test(name + ': natural end closes iterator', async function (t) {
    const stream = new Ctor(db)
    const order = monitor()
    const items = await concat(stream)

    t.is(items.length, 3, 'got items')
    t.same(order, ['_nextv', '_nextv', '_close'], 'order was ok')
  })

  test(name + ': bubbles up error from iterator.nextv', async function (t) {
    t.plan(2)

    const stream = new Ctor(db)
    const order = monitor()

    lastIterator._nextv = function (size, options, cb) {
      process.nextTick(cb, new Error('nextv test error'))
    }

    try {
      await concat(stream)
    } catch (err) {
      t.is(err.message, 'nextv test error', 'got error')
      t.same(order, ['_close'], 'order was ok')
    }
  })

  test(name + ': cancelation closes iterator', async function (t) {
    t.plan(3)

    const stream = new Ctor(db, { highWaterMark: 1 })
    const order = monitor()

    let count = 0

    try {
      await stream.pipeTo(new WritableStream({
        write (entry) {
          if (++count > 1) throw new Error('test error')
        }
      }))
    } catch (err) {
      t.is(count, 2)
      t.is(err.message, 'test error')
      t.is(order.pop(), '_close', 'iterator was closed')
    }
  })

  test(name + ': signal abort closes iterator', async function (t) {
    const stream = new Ctor(db)
    const order = monitor()
    const controller = new AbortController()

    try {
      await stream.pipeTo(new WritableStream({
        write (item) {
          controller.abort()
        }
      }), { signal: controller.signal })
    } catch (err) {
      t.is(err.name, 'AbortError')
      t.is(order[order.length - 1], '_close', 'iterator was closed')
    }
  })
}

// Done with readable stream tests; subsequent tests use a fresh db
test('teardown', function (t) {
  return db.close()
})

test('BatchStream: basic default operation', async function (t) {
  const { db, batchCalls } = await monkeyBatched()
  const stream = new BatchStream(db)

  await from([{ key: 'a', value: '1' }]).pipeTo(stream)

  t.same(await db.iterator().all(), [['a', '1']])
  t.same(batchCalls, [[[{ key: 'a', value: '1', type: 'put' }], {}]])
})

test('BatchStream: basic put operation', async function (t) {
  const { db, batchCalls } = await monkeyBatched()

  await from([{ type: 'put', key: 'a', value: '1' }]).pipeTo(new BatchStream(db))
  await from([{ key: 'b', value: '2' }]).pipeTo(new BatchStream(db, { type: 'put' }))

  t.same(await db.iterator().all(), [['a', '1'], ['b', '2']])
  t.same(batchCalls, [
    [[{ key: 'a', value: '1', type: 'put' }], {}],
    [[{ key: 'b', value: '2', type: 'put' }], {}]
  ])
})

test('BatchStream: basic del operation', async function (t) {
  const { db, batchCalls } = await monkeyBatched()

  await db.put('a', '1')
  await db.put('b', '2')

  t.same(await db.iterator().all(), [['a', '1'], ['b', '2']])

  await from([{ type: 'del', key: 'a' }]).pipeTo(new BatchStream(db))
  await from([{ key: 'b' }]).pipeTo(new BatchStream(db, { type: 'del' }))

  t.same(await db.iterator().all(), [])
  t.same(batchCalls, [
    [[{ key: 'a', type: 'del' }], {}],
    [[{ key: 'b', type: 'del' }], {}]
  ])
})

test('BatchStream: operation type takes precedence', async function (t) {
  const { db } = await monkeyBatched()

  await db.put('a', '1')
  t.same(await db.values().all(), ['1'])

  await from([{ type: 'put', key: 'a', value: '2' }]).pipeTo(new BatchStream(db, { type: 'del' }))
  t.same(await db.values().all(), ['2'])
})

test('BatchStream: basic operation with custom property', async function (t) {
  const { db, batchCalls } = await monkeyBatched()
  const stream = new BatchStream(db)
  await from([{ key: 'a', value: '1', foo: 123 }]).pipeTo(stream)
  t.same(batchCalls, [[[{ key: 'a', value: '1', foo: 123, type: 'put' }], {}]])
})

test('BatchStream: basic operation with options', async function (t) {
  const { db, batchCalls } = await monkeyBatched()
  const stream = new BatchStream(db, { foo: 123 })
  await from([{ key: 'a', type: 'del' }]).pipeTo(stream)
  t.same(batchCalls, [[[{ key: 'a', type: 'del' }], { foo: 123 }]])
})

test('BatchStream: basic entry', async function (t) {
  const { db, batchCalls } = await monkeyBatched()
  await from([['a', '1']]).pipeTo(new BatchStream(db))

  t.same(await db.iterator().all(), [['a', '1']])
  t.same(batchCalls, [[[{ key: 'a', value: '1', type: 'put' }], {}]])
})

test('BatchStream: basic entry with del type', async function (t) {
  const { db, batchCalls } = await monkeyBatched()

  await db.put('a', '1')
  await db.put('b', '2')

  t.same(await db.iterator().all(), [['a', '1'], ['b', '2']])

  await from([['a', '1']]).pipeTo(new BatchStream(db, { type: 'del' }))
  await from([['b']]).pipeTo(new BatchStream(db, { type: 'del' }))

  t.same(await db.iterator().all(), [])
  t.same(batchCalls, [
    [[{ key: 'a', value: '1', type: 'del' }], {}],
    [[{ key: 'b', value: undefined, type: 'del' }], {}]
  ])
})

test('BatchStream: uses batches of fixed size', async function (t) {
  const { db, batchCalls } = await monkeyBatched()
  const entries = new Array(17).fill().map((_, i) => [String(i), String(i)])

  await from(entries).pipeTo(new BatchStream(db, { highWaterMark: 5 }))

  t.is(batchCalls.length, 4, '4 batches')
  t.same(batchCalls.map(args => args[0].length), [5, 5, 5, 2], 'batch size is fixed')
})

test('BatchStream: flushes remainder on close', async function (t) {
  const { db, batchCalls } = await monkeyBatched()
  const entries = new Array(5).fill().map((_, i) => [String(i), String(i)])

  await from(entries).pipeTo(new BatchStream(db, { highWaterMark: 1e3 }))

  t.is(batchCalls.length, 1, '1 batch')
  t.is(batchCalls[0][0].length, 5, '5 operations')
})

test('BatchStream: does not batch() in parallel', async function (t) {
  t.plan(5)

  const db = new MemoryLevel()
  const originalBatch = db.batch
  const entries = new Array(10).fill().map((_, i) => [String(i), String(i)])

  // Our monkey-patched batch() does not handle deferred open
  await db.open()

  let inflight = 0

  db.batch = async function (...args) {
    t.is(inflight++, 0, 'not parallel')

    await originalBatch.apply(this, args)
    await new Promise((resolve) => setTimeout(resolve, 50))

    inflight = 0
  }

  await from(entries).pipeTo(new BatchStream(db, { highWaterMark: 2 }))
})

// Create a fresh db with a spy on batch()
const monkeyBatched = async function () {
  const db = new MemoryLevel()
  const originalBatch = db.batch
  const batchCalls = []

  db.batch = function (...args) {
    batchCalls.push(args)
    return originalBatch.apply(this, args)
  }

  // Our monkey-patched batch() does not handle deferred open
  await db.open()

  return { db, batchCalls }
}

const monitor = function () {
  const order = []

  ;['_next', '_nextv', '_close'].forEach(function (method) {
    const original = lastIterator[method]

    lastIterator[method] = function () {
      order.push(method)
      original.apply(this, arguments)
    }
  })

  return order
}

const concat = async function (stream) {
  const items = []

  await stream.pipeTo(new WritableStream({
    write (item) {
      items.push(item)
    }
  }))

  return items
}

// Create a readable stream from an array of items
const from = function (items) {
  let position = 0

  return new ReadableStream({
    pull (controller) {
      if (position >= items.length) {
        controller.close()
      } else {
        controller.enqueue(items[position++])
      }
    }
  })
}
