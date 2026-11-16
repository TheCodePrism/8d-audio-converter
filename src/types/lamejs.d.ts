// Minimal type declaration for lamejs (no @types/lamejs package available for React 19)
declare module "lamejs" {
  export class Mp3Encoder {
    /**
     * @param channels  Number of channels (1 = mono, 2 = stereo)
     * @param sampleRate  Sample rate in Hz (e.g. 44100)
     * @param kbps  Target bitrate in kbps (e.g. 192)
     */
    constructor(channels: number, sampleRate: number, kbps: number);

    /**
     * Encode a block of PCM Int16 samples.
     * For stereo pass both left and right; for mono pass the same array twice.
     * Returns an Int8Array containing the encoded MP3 bytes for this block.
     */
    encodeBuffer(left: Int16Array, right: Int16Array): Int8Array;

    /**
     * Flush any remaining buffered samples and return the final MP3 bytes.
     */
    flush(): Int8Array;
  }
}
