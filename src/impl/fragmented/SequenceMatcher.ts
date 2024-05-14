import {EOC, isAsciiUpperAlpha} from '../../common/code-points';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from '../states';

export class SequenceMatcher extends BaseTokenizer {
  sequenceData!: readonly number[];
  sequenceIndex!: number;
  sequenceCI!: boolean;
  sequencePositiveState!: State;
  sequenceNegativeState!: State;

  matchSequence(code: number, seq: readonly number[], caseInsensitive: boolean, positiveState: State, negativeState: State): State {
    this.state = 'sequence';
    this.sequenceBufferOffset = this.env.buffer.position;
    this.sequenceData = seq;
    this.sequenceIndex = 0;
    this.sequencePositiveState = positiveState;
    this.sequenceNegativeState = negativeState;
    return (this.sequenceCI = caseInsensitive) ? this.sequenceCaseInsensitive(code) : this.sequenceCaseSensitive(code);
  }

  sequence(code: number): State {
    return this.sequenceCI ? this.sequenceCaseInsensitive(code) : this.sequenceCaseSensitive(code);
  }

  sequenceCaseSensitive(code: number): State {
    const seqData = this.sequenceData;
    const buffer = this.env.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === EOC) return 'sequence';
      if (code !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code);
      code = this.nextCode();
    }
    return this.callState(this.sequencePositiveState, code);
  }

  sequenceCaseInsensitive(code: number): State {
    const seqData = this.sequenceData;
    const buffer = this.env.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === EOC) return 'sequence';
      let ciCode = code;
      if (isAsciiUpperAlpha(ciCode)) ciCode += 0x20;
      if (ciCode !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code);
      code = this.nextCode();
    }
    return this.callState(this.sequencePositiveState, code);
  }

}