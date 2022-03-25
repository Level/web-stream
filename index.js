'use strict'

const { ReadableStream, CountQueuingStrategy, WritableStream } = require('./streams')

const kCanceled = Symbol('canceled')
const kIterator = Symbol('iterator')
const kOperations = Symbol('operations')
const kBatchSize = Symbol('batchSize')
const kBatchType = Symbol('batchType')
const kBatchOptions = Symbol('batchOptions')
const kDb = Symbol('db')

class LevelSource {
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
    const source = new LevelSource(iterator)
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

class LevelSink {
  constructor (db, batchSize, batchType, batchOptions) {
    this[kDb] = db
    this[kOperations] = []
    this[kBatchSize] = batchSize
    this[kBatchType] = batchType
    this[kBatchOptions] = batchOptions
  }

  write (operation) {
    if (Array.isArray(operation)) {
      operation = {
        key: operation[0],
        value: operation[1],
        type: this[kBatchType]
      }
    } else if (operation.type == null) {
      operation = Object.assign({}, operation, {
        type: this[kBatchType]
      })
    }

    const length = this[kOperations].push(operation)

    // Flush if we have a full batch
    if (length >= this[kBatchSize]) {
      const operations = this[kOperations].splice(0, length)
      return this[kDb].batch(operations, this[kBatchOptions])
    }
  }

  close () {
    // Flush remainder if any, returning a promise
    if (this[kOperations].length > 0) {
      return this[kDb].batch(this[kOperations], this[kBatchOptions])
    }
  }
}

class BatchStream extends WritableStream {
  constructor (db, options) {
    let { highWaterMark, type, ...batchOptions } = options || {}

    // Note there are two buffers. Unfortunately Web Streams have no _writev() equivalent
    highWaterMark = highWaterMark || 500
    type = type || 'put'

    const sink = new LevelSink(db, highWaterMark, type, batchOptions)
    const queueingStrategy = new CountQueuingStrategy({ highWaterMark })

    super(sink, queueingStrategy)
  }
}

exports.EntryStream = EntryStream
exports.KeyStream = KeyStream
exports.ValueStream = ValueStream
exports.BatchStream = BatchStream
