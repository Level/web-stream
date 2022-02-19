'use strict'

const test = require('tape')
const { MemoryLevel } = require('memory-level')
const { WritableStream } = require('./streams')
const { EntryStream, KeyStream, ValueStream } = require('.')

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

test('teardown', function (t) {
  return db.close()
})

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
