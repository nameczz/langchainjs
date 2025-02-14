import { SerializedFields } from "../load/map_keys.js";
import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";

export interface RegExpFields {
  pattern: string;
  flags?: string;
}

export interface RegexParserFields {
  regex: string | RegExp | RegExpFields;
  outputKeys: string[];
  defaultOutputKey?: string;
}

/**
 * Class to parse the output of an LLM call into a dictionary.
 * @augments BaseOutputParser
 */
export class RegexParser extends BaseOutputParser<Record<string, string>> {
  static lc_name() {
    return "RegexParser";
  }

  lc_namespace = ["langchain", "output_parsers", "regex"];

  lc_serializable = true;

  get lc_attributes(): SerializedFields | undefined {
    return {
      regex: this.lc_kwargs.regex,
    };
  }

  regex: string | RegExp;

  outputKeys: string[];

  defaultOutputKey?: string;

  constructor(fields: RegexParserFields);

  constructor(
    regex: string | RegExp,
    outputKeys: string[],
    defaultOutputKey?: string
  );

  constructor(
    fields: string | RegExp | RegexParserFields,
    outputKeys?: string[],
    defaultOutputKey?: string
  ) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (typeof fields === "string" || fields instanceof RegExp) {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { regex: fields, outputKeys: outputKeys!, defaultOutputKey };
    }
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (fields.regex instanceof RegExp) {
      // eslint-disable-next-line no-param-reassign
      fields.regex = {
        pattern: fields.regex.source,
        flags: fields.regex.flags,
      };
    }
    super(fields);
    this.regex =
      // eslint-disable-next-line no-nested-ternary
      typeof fields.regex === "string"
        ? new RegExp(fields.regex)
        : "pattern" in fields.regex
        ? new RegExp(fields.regex.pattern, fields.regex.flags)
        : fields.regex;
    this.outputKeys = fields.outputKeys;
    this.defaultOutputKey = fields.defaultOutputKey;
  }

  _type() {
    return "regex_parser";
  }

  async parse(text: string): Promise<Record<string, string>> {
    const match = text.match(this.regex);
    if (match) {
      return this.outputKeys.reduce((acc, key, index) => {
        acc[key] = match[index + 1];
        return acc;
      }, {} as Record<string, string>);
    }

    if (this.defaultOutputKey === undefined) {
      throw new OutputParserException(`Could not parse output: ${text}`, text);
    }

    return this.outputKeys.reduce((acc, key) => {
      acc[key] = key === this.defaultOutputKey ? text : "";
      return acc;
    }, {} as Record<string, string>);
  }

  getFormatInstructions(): string {
    return `Your response should match the following regex: ${this.regex}`;
  }
}
