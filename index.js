'use strict'

const { ReadableStream, CountQueuingStrategy } = require('./streams')

const kCanceled = Symbol('canceled')
const kIterator = Symbol('iterator')
const kDb = Symbol('db')

class LevelReadableSource {
  constructor (iterator) {
    this[kIterator] = iterator
    this[kCanceled] = false
  }

  /**
   * @param {ReadableStreamDefaultController} controller
   */
  async pull (controller) {
    let items

    try {
      items = await this[kIterator].nextv(controller.desiredSize)
    } catch (err) {
      await this[kIterator].close()
      throw err
    }

    // Nothing to do if cancel() was called
    if (this[kCanceled]) {
      return
    }

    if (items.length === 0) {
      // Reached the natural end of the iterator
      await this[kIterator].close()
      controller.close()
    } else {
      for (const item of items) {
        controller.enqueue(item)
      }
    }
  }

  cancel () {
    this[kCanceled] = true
    return this[kIterator].close()
  }
}

class LevelReadableStream extends ReadableStream {
  constructor (db, method, options) {
    const { highWaterMark, ...rest } = options || {}
    const iterator = db[method](rest)
    const source = new LevelReadableSource(iterator)
    const queueingStrategy = new CountQueuingStrategy({
      highWaterMark: highWaterMark || 1000
    })

    super(source, queueingStrategy)

    // Keep db around to prevent GC
    this[kDb] = db
  }
}

class EntryStream extends LevelReadableStream {
  constructor (db, options) {
    super(db, 'iterator', { ...options, keys: true, values: true })
  }
}

class KeyStream extends LevelReadableStream {
  constructor (db, options) {
    super(db, 'keys', options)
  }
}

class ValueStream extends LevelReadableStream {
  constructor (db, options) {
    super(db, 'values', options)
  }
}

exports.EntryStream = EntryStream
exports.KeyStream = KeyStream
exports.ValueStream = ValueStream
