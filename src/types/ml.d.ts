// Type declarations for ML libraries
declare module "@tensorflow/tfjs" {
  export interface LayersModel {
    fit: (xs: unknown[], ys: unknown[], config?: Record<string, unknown>) => Promise<unknown>;
    predict: (xs: unknown[]) => unknown[];
    compile: (config: Record<string, unknown>) => void;
    save: (handler?: Record<string, unknown>) => Promise<unknown>;
  }

  export interface Sequential extends LayersModel {
    add: (layer: Record<string, unknown>) => void;
  }

  export interface Tensor {
    dataSync(): Float32Array;
    shape: number[];
    dispose(): void;
  }

  export interface Tensor2D extends Tensor {
    shape: [number, number];
  }

  export namespace layers {
    export function dense(config: Record<string, unknown>): Record<string, unknown>;
    export function dropout(config: Record<string, unknown>): Record<string, unknown>;
    export function lstm(config: Record<string, unknown>): Record<string, unknown>;
  }

  export function sequential(config?: Record<string, unknown>): Sequential;
  export function tensor2d(values: number[][], shape?: [number, number]): Tensor2D;
  export function tensor(values: number[], shape?: number[]): Tensor;

  export const train: {
    adam: Record<string, unknown>;
    categoricalCrossentropy: string;
  };
}

declare module "brain.js" {
  export interface NeuralNetwork {
    train: (data: unknown[], options?: Record<string, unknown>) => void;
    run: (input: number[]) => number[];
    toJSON(): Record<string, unknown>;
    fromJSON(json: Record<string, unknown>): void;
  }

  export interface Brain {
    NeuralNetwork: new (config?: Record<string, unknown>) => NeuralNetwork;
    recurrent: Record<string, unknown>;
    LSTM: Record<string, unknown>;
    GRU: Record<string, unknown>;
  }

  const brain: Brain;
  export default brain;
}

// Additional types for the app
declare global {
  interface Window {
    tf: typeof import("@tensorflow/tfjs");
    brain: typeof import("brain.js");
  }
}

export {};
