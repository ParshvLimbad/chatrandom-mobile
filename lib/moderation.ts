export interface PredictionLike {
  className: string;
  probability: number;
}

export async function classifyCapturedFrame(_uri: string): Promise<PredictionLike[]> {
  return [];
}

export function isExplicitContent(predictions: PredictionLike[]): boolean {
  return predictions.some(
    (prediction) =>
      (prediction.className === "Porn" || prediction.className === "Hentai") &&
      prediction.probability >= 0.8,
  );
}
