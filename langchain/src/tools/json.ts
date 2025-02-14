import jsonpointer from "jsonpointer";
import { Tool, ToolParams } from "./base.js";
import { Serializable } from "../load/serializable.js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type JsonObject = { [key: string]: Json };

export class JsonSpec extends Serializable {
  lc_namespace = ["langchain", "tools", "json"];

  obj: JsonObject;

  maxValueLength = 4000;

  constructor(obj: JsonObject, max_value_length = 4000) {
    super(...arguments);
    this.obj = obj;
    this.maxValueLength = max_value_length;
  }

  public getKeys(input: string): string {
    const pointer = jsonpointer.compile(input);
    const res = pointer.get(this.obj) as Json;
    if (typeof res === "object" && !Array.isArray(res) && res !== null) {
      return Object.keys(res)
        .map((i) => i.replaceAll("~", "~0").replaceAll("/", "~1"))
        .join(", ");
    }

    throw new Error(
      `Value at ${input} is not a dictionary, get the value directly instead.`
    );
  }

  public getValue(input: string): string {
    const pointer = jsonpointer.compile(input);
    const res = pointer.get(this.obj) as Json;

    if (res === null || res === undefined) {
      throw new Error(`Value at ${input} is null or undefined.`);
    }

    const str = typeof res === "object" ? JSON.stringify(res) : res.toString();
    if (
      typeof res === "object" &&
      !Array.isArray(res) &&
      str.length > this.maxValueLength
    ) {
      return `Value is a large dictionary, should explore its keys directly.`;
    }

    if (str.length > this.maxValueLength) {
      return `${str.slice(0, this.maxValueLength)}...`;
    }
    return str;
  }
}

export interface JsonToolFields extends ToolParams {
  jsonSpec: JsonSpec;
}

export class JsonListKeysTool extends Tool {
  static lc_name() {
    return "JsonListKeysTool";
  }

  name = "json_list_keys";

  jsonSpec: JsonSpec;

  constructor(jsonSpec: JsonSpec);

  constructor(fields: JsonToolFields);

  constructor(fields: JsonSpec | JsonToolFields) {
    if (!("jsonSpec" in fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { jsonSpec: fields };
    }
    super(fields);

    this.jsonSpec = fields.jsonSpec;
  }

  /** @ignore */
  async _call(input: string) {
    try {
      return this.jsonSpec.getKeys(input);
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Can be used to list all keys at a given path.
    Before calling this you should be SURE that the path to this exists.
    The input is a text representation of the path to the json as json pointer syntax (e.g. /key1/0/key2).`;
}

export class JsonGetValueTool extends Tool {
  static lc_name() {
    return "JsonGetValueTool";
  }

  name = "json_get_value";

  constructor(public jsonSpec: JsonSpec) {
    super();
  }

  /** @ignore */
  async _call(input: string) {
    try {
      return this.jsonSpec.getValue(input);
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Can be used to see value in string format at a given path.
    Before calling this you should be SURE that the path to this exists.
    The input is a text representation of the path to the json as json pointer syntax (e.g. /key1/0/key2).`;
}
