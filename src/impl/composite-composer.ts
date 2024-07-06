import {Class, combine} from '../common/multi-class';
import {AfterAfterComposer} from './composer/AfterAfterComposer';
import {AfterBodyComposer} from './composer/AfterBodyComposer';
import {AfterFramesetComposer} from './composer/AfterFramesetComposer';
import {AfterHeadComposer} from './composer/AfterHeadComposer';
import {BaseComposer} from './composer/BaseComposer';
import {BeforeHeadComposer} from './composer/BeforeHeadComposer';
import {BeforeHtmlComposer} from './composer/BeforeHtmlComposer';
import {InBodyComposer} from './composer/InBodyComposer';
import {InCaptionComposer} from './composer/InCaptionComposer';
import {InCellComposer} from './composer/InCellComposer';
import {InColumnGroupComposer} from './composer/InColumnGroupComposer';
import {InForeignContentComposer} from './composer/InForeignContentComposer';
import {InFramesetComposer} from './composer/InFramesetComposer';
import {InHeadComposer} from './composer/InHeadComposer';
import {InHeadNoscriptComposer} from './composer/InHeadNoscriptComposer';
import {InitialComposer} from './composer/InitialComposer';
import {InRowComposer} from './composer/InRowComposer';
import {InSelectComposer} from './composer/InSelectComposer';
import {InSelectInTableComposer} from './composer/InSelectInTableComposer';
import {InTableBodyComposer} from './composer/InTableBodyComposer';
import {InTableComposer} from './composer/InTableComposer';
import {InTemplateComposer} from './composer/InTemplateComposer';
import {TokenAdjustingComposer} from './composer/TokenAdjustingComposer';

const SyntheticComposerClass = combine('SyntheticComposerClass',
    BaseComposer,
    TokenAdjustingComposer,
    InitialComposer,
    BeforeHtmlComposer,
    BeforeHeadComposer,
    InHeadComposer,
    InHeadNoscriptComposer,
    AfterHeadComposer,
    InBodyComposer,
    InTableComposer,
    InCaptionComposer,
    InColumnGroupComposer,
    InTableBodyComposer,
    InRowComposer,
    InCellComposer,
    InSelectComposer,
    InSelectInTableComposer,
    InTemplateComposer,
    InFramesetComposer,
    AfterBodyComposer,
    AfterFramesetComposer,
    AfterAfterComposer,
    InForeignContentComposer
) as Class<BaseComposer &
    TokenAdjustingComposer &
    InitialComposer &
    BeforeHtmlComposer &
    BeforeHeadComposer &
    InHeadComposer &
    InHeadNoscriptComposer &
    AfterHeadComposer &
    InBodyComposer &
    InTableComposer &
    InCaptionComposer &
    InColumnGroupComposer &
    InTableBodyComposer &
    InRowComposer &
    InCellComposer &
    InSelectComposer &
    InSelectInTableComposer &
    InTemplateComposer &
    InFramesetComposer &
    AfterBodyComposer &
    AfterFramesetComposer &
    AfterAfterComposer &
    InForeignContentComposer>;

export class CompositeComposer extends SyntheticComposerClass {
}