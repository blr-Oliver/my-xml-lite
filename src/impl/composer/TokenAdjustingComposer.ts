import {Attribute, NamespacedAttribute, TagToken} from '../tokens';
import {BaseComposer, NS_XLINK, NS_XML, NS_XMLNS} from './BaseComposer';

const SVG_TAG_ADJUSTMENT: { [key: string]: string } = {
  altglyph: 'altGlyph',
  altglyphdef: 'altGlyphDef',
  altglyphitem: 'altGlyphItem',
  animatecolor: 'animateColor',
  animatemotion: 'animateMotion',
  animatetransform: 'animateTransform',
  clippath: 'clipPath',
  feblend: 'feBlend',
  fecolormatrix: 'feColorMatrix',
  fecomponenttransfer: 'feComponentTransfer',
  fecomposite: 'feComposite',
  feconvolvematrix: 'feConvolveMatrix',
  fediffuselighting: 'feDiffuseLighting',
  fedisplacementmap: 'feDisplacementMap',
  fedistantlight: 'feDistantLight',
  fedropshadow: 'feDropShadow',
  feflood: 'feFlood',
  fefunca: 'feFuncA',
  fefuncb: 'feFuncB',
  fefuncg: 'feFuncG',
  fefuncr: 'feFuncR',
  fegaussianblur: 'feGaussianBlur',
  feimage: 'feImage',
  femerge: 'feMerge',
  femergenode: 'feMergeNode',
  femorphology: 'feMorphology',
  feoffset: 'feOffset',
  fepointlight: 'fePointLight',
  fespecularlighting: 'feSpecularLighting',
  fespotlight: 'feSpotLight',
  fetile: 'feTile',
  feturbulence: 'feTurbulence',
  foreignobject: 'foreignObject',
  glyphref: 'glyphRef',
  lineargradient: 'linearGradient',
  radialgradient: 'radialGradient',
  textpath: 'textPath'
};

const SVG_ATTR_ADJUSTMENT: { [key: string]: string } = {
  attributename: 'attributeName',
  attributetype: 'attributeType',
  basefrequency: 'baseFrequency',
  baseprofile: 'baseProfile',
  calcmode: 'calcMode',
  clippathunits: 'clipPathUnits',
  diffuseconstant: 'diffuseConstant',
  edgemode: 'edgeMode',
  filterunits: 'filterUnits',
  glyphref: 'glyphRef',
  gradienttransform: 'gradientTransform',
  gradientunits: 'gradientUnits',
  kernelmatrix: 'kernelMatrix',
  kernelunitlength: 'kernelUnitLength',
  keypoints: 'keyPoints',
  keysplines: 'keySplines',
  keytimes: 'keyTimes',
  lengthadjust: 'lengthAdjust',
  limitingconeangle: 'limitingConeAngle',
  markerheight: 'markerHeight',
  markerunits: 'markerUnits',
  markerwidth: 'markerWidth',
  maskcontentunits: 'maskContentUnits',
  maskunits: 'maskUnits',
  numoctaves: 'numOctaves',
  pathlength: 'pathLength',
  patterncontentunits: 'patternContentUnits',
  patterntransform: 'patternTransform',
  patternunits: 'patternUnits',
  pointsatx: 'pointsAtX',
  pointsaty: 'pointsAtY',
  pointsatz: 'pointsAtZ',
  preservealpha: 'preserveAlpha',
  preserveaspectratio: 'preserveAspectRatio',
  primitiveunits: 'primitiveUnits',
  refx: 'refX',
  refy: 'refY',
  repeatcount: 'repeatCount',
  repeatdur: 'repeatDur',
  requiredextensions: 'requiredExtensions',
  requiredfeatures: 'requiredFeatures',
  specularconstant: 'specularConstant',
  specularexponent: 'specularExponent',
  spreadmethod: 'spreadMethod',
  startoffset: 'startOffset',
  stddeviation: 'stdDeviation',
  stitchtiles: 'stitchTiles',
  surfacescale: 'surfaceScale',
  systemlanguage: 'systemLanguage',
  tablevalues: 'tableValues',
  targetx: 'targetX',
  targety: 'targetY',
  textlength: 'textLength',
  viewbox: 'viewBox',
  viewtarget: 'viewTarget',
  xchannelselector: 'xChannelSelector',
  ychannelselector: 'yChannelSelector',
  zoomandpan: 'zoomAndPan'
};

type NamespaceAdjustment = Pick<NamespacedAttribute, Exclude<keyof NamespacedAttribute, keyof Attribute>>;
const FOREIGN_ATTR_ADJUSTMENT: { [key: string]: NamespaceAdjustment } = {
  'xlink:actuate': {
    prefix: 'xlink',
    localName: 'actuate',
    namespaceURI: NS_XLINK
  },
  'xlink:arcrole': {
    prefix: 'xlink',
    localName: 'arcrole',
    namespaceURI: NS_XLINK
  },
  'xlink:href': {
    prefix: 'xlink',
    localName: 'href',
    namespaceURI: NS_XLINK
  },
  'xlink:role': {
    prefix: 'xlink',
    localName: 'role',
    namespaceURI: NS_XLINK
  },
  'xlink:show': {
    prefix: 'xlink',
    localName: 'show',
    namespaceURI: NS_XLINK
  },
  'xlink:title': {
    prefix: 'xlink',
    localName: 'title',
    namespaceURI: NS_XLINK
  },
  'xlink:type': {
    prefix: 'xlink',
    localName: 'type',
    namespaceURI: NS_XLINK
  },
  'xml:lang': {
    prefix: 'xml',
    localName: 'lang',
    namespaceURI: NS_XML
  },
  'xml:space': {
    prefix: 'xml',
    localName: 'space',
    namespaceURI: NS_XML
  },
  'xmlns': {
    localName: 'xmlns',
    namespaceURI: NS_XMLNS
  },
  'xmlns:xlink': {
    prefix: 'xmlns',
    localName: 'xlink',
    namespaceURI: NS_XMLNS
  }
};

export class TokenAdjustingComposer extends BaseComposer {
  protected adjustMathMLAttributes(token: TagToken) {
    for (let attr of token.attributes) {
      if (attr.name === 'definitionurl')
        token.name = 'definitionUrl';
    }
  }

  protected adjustSvgAttributes(token: TagToken) {
    for (let attr of token.attributes) {
      const replacement = SVG_ATTR_ADJUSTMENT[attr.name];
      if (replacement)
        attr.name = replacement;
    }
  }

  protected adjustForeignAttributes(token: TagToken) {
    for (let attr of token.attributes) {
      const adjustment = FOREIGN_ATTR_ADJUSTMENT[attr.name];
      if (adjustment)
        Object.assign(attr, adjustment);
    }
  }

  protected adjustSvgTagName(token: TagToken) {
    const replacement = SVG_TAG_ADJUSTMENT[token.name];
    if (replacement)
      token.name = replacement;
  }
}