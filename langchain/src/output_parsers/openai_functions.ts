import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";
import { ChatGeneration, Generation } from "../schema/index.js";
import { Optional } from "../types/type-utils.js";
import { BaseLLMOutputParser } from "../schema/output_parser.js";

export type FunctionParameters = Optional<
  JsonSchema7ObjectType,
  "additionalProperties"
>;

export class OutputFunctionsParser extends BaseLLMOutputParser<string> {
  static lc_name() {
    return "OutputFunctionsParser";
  }

  lc_namespace = ["langchain", "chains", "openai_functions"];

  lc_serializable = true;

  argsOnly = true;

  constructor(config?: { argsOnly: boolean }) {
    super();
    this.argsOnly = config?.argsOnly ?? this.argsOnly;
  }

  async parseResult(
    generations: Generation[] | ChatGeneration[]
  ): Promise<string> {
    if ("message" in generations[0]) {
      const gen = generations[0] as ChatGeneration;
      const functionCall = gen.message.additional_kwargs.function_call;
      if (!functionCall) {
        throw new Error(
          `No function_call in message ${JSON.stringify(generations)}`
        );
      }
      if (!functionCall.arguments) {
        throw new Error(
          `No arguments in function_call ${JSON.stringify(generations)}`
        );
      }
      if (this.argsOnly) {
        return functionCall.arguments;
      }
      return JSON.stringify(functionCall);
    } else {
      throw new Error(
        `No message in generations ${JSON.stringify(generations)}`
      );
    }
  }
}

export class JsonOutputFunctionsParser extends BaseLLMOutputParser<object> {
  static lc_name() {
    return "JsonOutputFunctionsParser";
  }

  lc_namespace = ["langchain", "chains", "openai_functions"];

  lc_serializable = true;

  outputParser: OutputFunctionsParser;

  argsOnly = true;

  constructor(config?: { argsOnly: boolean }) {
    super();
    this.argsOnly = config?.argsOnly ?? this.argsOnly;
    this.outputParser = new OutputFunctionsParser(config);
  }

  async parseResult(
    generations: Generation[] | ChatGeneration[]
  ): Promise<object> {
    const result = await this.outputParser.parseResult(generations);
    if (!result) {
      throw new Error(
        `No result from "OutputFunctionsParser" ${JSON.stringify(generations)}`
      );
    }
    const parsedResult = JSON.parse(result);
    if (this.argsOnly) {
      return parsedResult;
    }
    parsedResult.arguments = JSON.parse(parsedResult.arguments);
    return parsedResult;
  }
}

export class JsonKeyOutputFunctionsParser<
  T = object
> extends BaseLLMOutputParser<T> {
  static lc_name() {
    return "JsonKeyOutputFunctionsParser";
  }

  lc_namespace = ["langchain", "chains", "openai_functions"];

  lc_serializable = true;

  outputParser = new JsonOutputFunctionsParser();

  attrName: string;

  constructor(fields: { attrName: string }) {
    super(fields);
    this.attrName = fields.attrName;
  }

  async parseResult(generations: Generation[] | ChatGeneration[]): Promise<T> {
    const result = await this.outputParser.parseResult(generations);
    return result[this.attrName as keyof typeof result] as T;
  }
}
