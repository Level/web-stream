// Assumed to be installed side-by-side, declared as an optional peerDependency.
import {
  AbstractLevel,
  AbstractIteratorOptions,
  AbstractKeyIteratorOptions,
  AbstractValueIteratorOptions
} from 'abstract-level'

/**
 * A {@link ReadableStream} that yields entries.
 */
export class EntryStream<K, V, TDatabase = AbstractLevel<any, any, any>> extends ReadableStream<{ key: K, value: V }> {
  /**
   * Create a {@link ReadableStream} that yields entries from {@link db}.
   * @param db Database to read from.
   * @param options Options for the stream and its underlying iterator.
   */
  constructor (db: TDatabase, options?: (LevelReadableStreamOptions & Omit<AbstractIteratorOptions<K, V>, 'keys' | 'values'>) | undefined)

  // TODO: support passing in an iterator so that its implementation-specific options are typed?
  // constructor (iterator: AbstractIterator<TDatabase, K, V>, ...)
}

/**
 * A {@link ReadableStream} that yields keys.
 */
export class KeyStream<K, TDatabase = AbstractLevel<any, any, any>> extends ReadableStream<K> {
  /**
   * Create a {@link ReadableStream} that yields keys from {@link db}.
   * @param db Database to read from.
   * @param options Options for the stream and its underlying iterator.
   */
  constructor (db: TDatabase, options?: (LevelReadableStreamOptions & AbstractKeyIteratorOptions<K>) | undefined)
}

/**
 * A {@link ReadableStream} that yields values.
 */
export class ValueStream<K, V, TDatabase = AbstractLevel<any, any, any>> extends ReadableStream<V> {
  /**
   * Create a {@link ReadableStream} that yields values from {@link db}.
   * @param db Database to read from.
   * @param options Options for the stream and its underlying iterator.
   */
  constructor (db: TDatabase, options?: (LevelReadableStreamOptions & AbstractValueIteratorOptions<K, V>) | undefined)
}

declare interface LevelReadableStreamOptions {
  /**
   * The maximum number of items to buffer internally before ceasing to read further
   * items.
   *
   * @defaultValue `1000`
   */
  highWaterMark?: number | undefined

  /**
   * Limit the amount of data that the underlying iterator will hold in memory.
   *
   * Only supported by [`classic-level`][1] and [`rocks-level`][2], and possibly by
   * similar `abstract-level` implementations that are backed by a database on disk.
   *
   * [1]: https://github.com/Level/classic-level
   * [2]: https://github.com/Level/rocks-level
   */
  highWaterMarkBytes?: number | undefined

  /**
   * Only supported by [`classic-level`][1] and [`rocks-level`][2], and possibly by
   * similar `abstract-level` implementations that are backed by a database on disk.
   *
   * [1]: https://github.com/Level/classic-level
   * [2]: https://github.com/Level/rocks-level
   */
  fillCache?: boolean | undefined
}
