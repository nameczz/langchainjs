import { BaseLanguageModel } from "../../base_language/index.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { ChainValues } from "../../schema/index.js";
import { BaseChain, ChainInputs } from "../base.js";
import { LLMChain } from "../llm_chain.js";
import { SerializedBaseChain } from "../serde.js";
import {
  ConstitutionalPrinciple,
  PRINCIPLES,
} from "./constitutional_principle.js";
import { CRITIQUE_PROMPT, REVISION_PROMPT } from "./constitutional_prompts.js";

export interface ConstitutionalChainInput extends ChainInputs {
  chain: LLMChain;
  constitutionalPrinciples: ConstitutionalPrinciple[];
  critiqueChain: LLMChain;
  revisionChain: LLMChain;
}

export class ConstitutionalChain
  extends BaseChain
  implements ConstitutionalChainInput
{
  static lc_name() {
    return "ConstitutionalChain";
  }

  chain: LLMChain;

  constitutionalPrinciples: ConstitutionalPrinciple[];

  critiqueChain: LLMChain;

  revisionChain: LLMChain;

  get inputKeys(): string[] {
    return this.chain.inputKeys;
  }

  get outputKeys(): string[] {
    return ["output"];
  }

  constructor(fields: ConstitutionalChainInput) {
    super(fields);
    this.chain = fields.chain;
    this.constitutionalPrinciples = fields.constitutionalPrinciples;
    this.critiqueChain = fields.critiqueChain;
    this.revisionChain = fields.revisionChain;
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    let { [this.chain.outputKey]: response } = await this.chain.call(
      values,
      runManager?.getChild("original")
    );
    const inputPrompt = await this.chain.prompt.format(values);

    for (let i = 0; i < this.constitutionalPrinciples.length; i += 1) {
      const { [this.critiqueChain.outputKey]: rawCritique } =
        await this.critiqueChain.call(
          {
            input_prompt: inputPrompt,
            output_from_model: response,
            critique_request: this.constitutionalPrinciples[i].critiqueRequest,
          },
          runManager?.getChild("critique")
        );

      const critique = ConstitutionalChain._parseCritique(rawCritique);

      const { [this.revisionChain.outputKey]: revisionRaw } =
        await this.revisionChain.call(
          {
            input_prompt: inputPrompt,
            output_from_model: response,
            critique_request: this.constitutionalPrinciples[i].critiqueRequest,
            critique,
            revision_request: this.constitutionalPrinciples[i].revisionRequest,
          },
          runManager?.getChild("revision")
        );
      response = revisionRaw;
    }

    return {
      output: response,
    };
  }

  static getPrinciples(names?: string[]) {
    if (names) {
      return names.map((name) => PRINCIPLES[name]);
    }
    return Object.values(PRINCIPLES);
  }

  static fromLLM(
    llm: BaseLanguageModel,
    options: Omit<
      ConstitutionalChainInput,
      "critiqueChain" | "revisionChain"
    > & {
      critiqueChain?: LLMChain;
      revisionChain?: LLMChain;
    }
  ) {
    const critiqueChain =
      options.critiqueChain ??
      new LLMChain({
        llm,
        prompt: CRITIQUE_PROMPT,
      });
    const revisionChain =
      options.revisionChain ??
      new LLMChain({
        llm,
        prompt: REVISION_PROMPT,
      });
    return new this({
      ...options,
      chain: options.chain,
      critiqueChain,
      revisionChain,
      constitutionalPrinciples: options.constitutionalPrinciples ?? [],
    });
  }

  private static _parseCritique(outputString: string): string {
    let output = outputString;
    if (!output.includes("Revision request")) {
      return output;
    }

    // eslint-disable-next-line prefer-destructuring
    output = output.split("Revision request:")[0];
    if (output.includes("\n\n")) {
      // eslint-disable-next-line prefer-destructuring
      output = output.split("\n\n")[0];
    }
    return output;
  }

  _chainType() {
    return "constitutional_chain" as const;
  }

  serialize(): SerializedBaseChain {
    return {
      _type: this._chainType(),
      chain: this.chain.serialize(),
      ConstitutionalPrinciple: this.constitutionalPrinciples.map((principle) =>
        principle.serialize()
      ),
      critiqueChain: this.critiqueChain.serialize(),
      revisionChain: this.revisionChain.serialize(),
    };
  }
}
