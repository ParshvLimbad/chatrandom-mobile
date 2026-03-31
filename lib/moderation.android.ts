import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { bundleResourceIO, decodeJpeg } from "@tensorflow/tfjs-react-native";
import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";

import type { PredictionLike } from "./moderation";

import modelJson from "../assets/nsfw/nsfw-model.json";
import modelWeights from "../assets/nsfw/nsfw-weights.bin";

interface ModerationModelLike {
  classify: (image: tf.Tensor3D) => Promise<PredictionLike[]>;
}

let modelPromise: Promise<ModerationModelLike> | null = null;

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

async function loadModel(): Promise<ModerationModelLike> {
  await tf.ready();

  const resource = bundleResourceIO(
    modelJson as unknown as Parameters<typeof bundleResourceIO>[0],
    modelWeights,
  );

  return (await nsfwjs.load(resource as unknown as string, {
    size: 224,
  })) as ModerationModelLike;
}

async function ensureModel(): Promise<ModerationModelLike> {
  if (!modelPromise) {
    modelPromise = loadModel();
  }

  return modelPromise;
}

export async function classifyCapturedFrame(uri: string): Promise<PredictionLike[]> {
  const model = await ensureModel();
  const imageBase64 = await readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
  });
  const imageTensor = decodeJpeg(base64ToUint8Array(imageBase64));

  try {
    return await model.classify(imageTensor);
  } finally {
    imageTensor.dispose();
  }
}

export function isExplicitContent(predictions: PredictionLike[]): boolean {
  return predictions.some(
    (prediction) =>
      (prediction.className === "Porn" || prediction.className === "Hentai") &&
      prediction.probability >= 0.8,
  );
}
