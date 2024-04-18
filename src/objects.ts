import type * as FS from 'fs';

// default fs for FileMap
let _fs: typeof FS;
import('fs').then(_ => (_fs = _));

export function filterObject<T extends object, K extends keyof T>(object: T, ...keys: K[]): Omit<T, K> {
	const entries = <[K, T[K]][]>Object.entries(object);
	return <Omit<T, K>>(<unknown>Object.fromEntries(entries.filter(([key]) => keys.includes(key))));
}

export function isJSON(str: string) {
	try {
		JSON.parse(str);
		return true;
	} catch (e) {
		return false;
	}
}

export abstract class FileMap<V> implements Map<string, V> {
	public get [Symbol.toStringTag](): string {
		return 'FileMap';
	}

	public constructor(
		protected readonly path: string,
		protected fs: typeof FS = _fs
	) {
		if (!path) {
			throw new ReferenceError('No path specified');
		}

		if (!fs) {
			throw new ReferenceError('No filesystem API');
		}
	}

	protected abstract readonly _map: Map<string, V>;

	public abstract clear(): void;

	public abstract delete(key: string): boolean;

	public abstract get(key: string): V;

	public abstract has(key: string): boolean;

	public abstract set(key: string, value: V): this;

	public get size() {
		return this._map.size;
	}

	public get [Symbol.iterator]() {
		return this._map[Symbol.iterator].bind(this._map);
	}

	public get keys(): typeof this._map.keys {
		return this._map.keys.bind(this._map);
	}

	public get values(): typeof this._map.values {
		return this._map.values.bind(this._map);
	}

	public get entries(): typeof this._map.entries {
		return this._map.entries.bind(this._map);
	}

	public get forEach(): typeof this._map.forEach {
		return this._map.forEach.bind(this._map);
	}
}

export type JSONObject<Key extends string | number | symbol = string> = { [K in Key]: JSONValue };

export type JSONValue<Key extends string | number | symbol = string> = string | number | boolean | JSONObject<Key> | Array<JSONValue>;

export interface JSONFileMapOptions {
	/**
	 * Should an invalid JSON file be overwritten
	 */
	overwrite_invalid_json: boolean;

	/**
	 *
	 */
	fs: typeof FS;
}

/**
 * A Map overlaying a JSON file
 */
export class JSONFileMap<T extends JSONValue = JSONValue> extends FileMap<T> {
	public get [Symbol.toStringTag](): 'JSONFileMap' {
		return 'JSONFileMap';
	}

	public constructor(
		path: string,
		public readonly options: JSONFileMapOptions
	) {
		super(path, options.fs);
		if (!this.fs.existsSync(path)) {
			this.fs.writeFileSync(path, '{}');
		}
	}

	public get _map(): Map<string, T> {
		const content = this.fs.readFileSync(this.path, 'utf8');
		if (!isJSON(content)) {
			if (!this.options.overwrite_invalid_json) {
				throw new SyntaxError('Invalid JSON file: ' + this.path);
			}
			console.warn('Invalid JSON file (overwriting): ' + this.path);
			this.clear();
			return new Map();
		}
		return new Map(Object.entries(JSON.parse(content)));
	}

	public _write(map: Map<string, T>) {
		if (!this.fs.existsSync(this.path)) {
			this.fs.writeFileSync(this.path, '{}');
		}
		const content = JSON.stringify(Object.fromEntries(map));
		this.fs.writeFileSync(this.path, content);
	}

	public clear() {
		this.fs.writeFileSync(this.path, '{}');
	}

	public delete(key: string): boolean {
		const map = this._map;
		const rt = map.delete(key);
		this._write(map);
		return rt;
	}

	public get<U extends T>(key: string): U {
		return this._map.get(key) as U;
	}

	public has(key: string): boolean {
		return this._map.has(key);
	}

	public set(key: string, value: T): this {
		const map = this._map;
		map.set(key, value);
		this._write(map);
		return this;
	}
}

export interface FolderMapOptions {
	/**
	 * Suffix to append to keys to resolve file names
	 */
	suffix: string;

	fs?: typeof FS;
}

/**
 * A Map overlaying a folder
 */
export class FolderMap extends FileMap<string> {
	public get [Symbol.toStringTag](): 'FolderMap' {
		return 'FolderMap';
	}

	public constructor(
		path: string,
		public readonly options: Partial<FolderMapOptions>
	) {
		super(path, options.fs);
	}

	protected get _names(): string[] {
		return this.fs
			.readdirSync(this.path)
			.filter(p => p.endsWith(this.options.suffix))
			.map(p => p.slice(0, -this.options.suffix.length));
	}

	protected _join(path: string): string {
		return `${this.path}/${path}${this.options.suffix}`;
	}

	protected get _map(): Map<string, string> {
		const entries = [];
		for (const name of this._names) {
			const content = this.fs.readFileSync(this._join(name), 'utf8');
			entries.push([name, content]);
		}
		return new Map(entries);
	}

	public clear(): void {
		for (const name of this._names) {
			this.fs.unlinkSync(this._join(name));
		}
	}

	public delete(key: string): boolean {
		if (!this.has(key)) {
			return false;
		}

		this.fs.unlinkSync(this._join(key));
		return true;
	}

	public get(key: string): string {
		if (this.has(key)) {
			return this.fs.readFileSync(this._join(key), 'utf8');
		}
	}

	public has(key: string): boolean {
		return this._names.includes(key);
	}

	public set(key: string, value: string): this {
		this.fs.writeFileSync(this._join(key), value);
		return this;
	}
}

export function resolveConstructors(object: object): string[] {
	const constructors = [];
	let prototype = object;
	while (prototype && !['Function', 'Object'].includes(prototype.constructor.name)) {
		prototype = Object.getPrototypeOf(prototype);
		constructors.push(prototype.constructor.name);
	}
	return constructors;
}

/**
 * Gets a random int, r, with the probability P(r) = (base)**r
 * For example, with a probability of 1/2: P(1) = 1/2, P(2) = 1/4, etc.
 * @param probability the probability
 */
export function getRandomIntWithRecursiveProbability(probability = 0.5): number {
	return -Math.floor(Math.log(Math.random()) / Math.log(1 / probability));
}
