import { Embeddings, EmbeddingsParams } from "./base.js";
import {
  GoogleVertexAIBasePrediction,
  GoogleVertexAIConnectionParams,
} from "../types/googlevertexai-types.js";
import { GoogleVertexAIConnection } from "../util/googlevertexai-connection.js";
import { AsyncCallerCallOptions } from "../util/async_caller.js";
import { chunkArray } from "../util/chunk.js";

export interface GoogleVertexAIEmbeddingsParams
  extends EmbeddingsParams,
    GoogleVertexAIConnectionParams {}

interface GoogleVertexAILLMEmbeddingsOptions extends AsyncCallerCallOptions {}

interface GoogleVertexAILLMEmbeddingsInstance {
  content: string;
}

interface GoogleVertexEmbeddingsResults extends GoogleVertexAIBasePrediction {
  embeddings: {
    statistics: {
      token_count: number;
      truncated: boolean;
    };
    values: number[];
  };
}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * the embeddings generated by Large Language Models.
 *
 * To use, you will need to have one of the following authentication
 * methods in place:
 * - You are logged into an account permitted to the Google Cloud project
 *   using Vertex AI.
 * - You are running this on a machine using a service account permitted to
 *   the Google Cloud project using Vertex AI.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the
 *   Google Cloud project using Vertex AI.
 */
export class GoogleVertexAIEmbeddings
  extends Embeddings
  implements GoogleVertexAIEmbeddingsParams
{
  model = "textembedding-gecko";

  private connection: GoogleVertexAIConnection<
    GoogleVertexAILLMEmbeddingsOptions,
    GoogleVertexAILLMEmbeddingsInstance,
    GoogleVertexEmbeddingsResults
  >;

  constructor(fields?: GoogleVertexAIEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;

    this.connection = new GoogleVertexAIConnection(
      { ...fields, ...this },
      this.caller
    );
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const instanceChunks: GoogleVertexAILLMEmbeddingsInstance[][] = chunkArray(
      documents.map((document) => ({
        content: document,
      })),
      5
    ); // Vertex AI accepts max 5 instances per prediction
    const parameters = {};
    const options = {};
    const responses = await Promise.all(
      instanceChunks.map((instances) =>
        this.connection.request(instances, parameters, options)
      )
    );
    const result: number[][] =
      responses
        ?.map(
          (response) =>
            response.data?.predictions?.map(
              (result) => result.embeddings.values
            ) ?? []
        )
        .flat() ?? [];
    return result;
  }

  async embedQuery(document: string): Promise<number[]> {
    const data = await this.embedDocuments([document]);
    return data[0];
  }
}
