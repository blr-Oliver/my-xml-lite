import {Class, combine} from '../common/multi-class';
import {AfterAfterComposer} from './composer/AfterAfterComposer';
import {AfterBodyComposer} from './composer/AfterBodyComposer';
import {AfterFramesetComposer} from './composer/AfterFramesetComposer';
import {BaseComposer} from './composer/BaseComposer';
import {BeforeHeadComposer} from './composer/BeforeHeadComposer';
import {HeadComposer} from './composer/HeadComposer';
import {InBodyComposer} from './composer/InBodyComposer';
import {InCellComposer} from './composer/InCellComposer';
import {InRowComposer} from './composer/InRowComposer';
import {InSelectComposer} from './composer/InSelectComposer';
import {InSelectInTableComposer} from './composer/InSelectInTableComposer';
import {InTableComposer} from './composer/InTableComposer';
import {InTemplateComposer} from './composer/InTemplateComposer';
import {TokenAdjustingComposer} from './composer/TokenAdjustingComposer';

const SyntheticComposerClass = combine('SyntheticComposerClass',
    BaseComposer,
    TokenAdjustingComposer,
    BeforeHeadComposer,
    HeadComposer,
    InBodyComposer,
    InTableComposer,
    InRowComposer,
    InCellComposer,
    InSelectComposer,
    InSelectInTableComposer,
    InTemplateComposer,
    AfterBodyComposer,
    AfterFramesetComposer,
    AfterAfterComposer
) as Class<BaseComposer &
    TokenAdjustingComposer &
    BeforeHeadComposer &
    HeadComposer &
    InBodyComposer &
    InTableComposer &
    InRowComposer &
    InCellComposer &
    InSelectComposer &
    InSelectInTableComposer &
    InTemplateComposer &
    AfterBodyComposer &
    AfterFramesetComposer &
    AfterAfterComposer>;

export class CompositeComposer extends SyntheticComposerClass {
}