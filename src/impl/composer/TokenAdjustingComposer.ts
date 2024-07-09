import {NamespacedAttribute, TagToken} from '../tokens';
import {BaseComposer, NS_XLINK, NS_XML, NS_XMLNS} from './BaseComposer';

export class TokenAdjustingComposer extends BaseComposer {
  protected adjustMathMLAttributes(token: TagToken) {
    const attributes = token.attributes;
    const len = attributes.length;
    for (let i = 0; i < len; ++i) {
      const attr = attributes[i];
      if (attr.name === 'definitionurl')
        attr.name = 'definitionURL';
    }
  }

  protected adjustSvgAttributes(token: TagToken) {
    const attributes = token.attributes;
    const len = attributes.length;
    for (let i = 0; i < len; ++i) {
      const attr = attributes[i];
      switch (attr.name) {
// @formatter:off
        case 'attributename': attr.name = 'attributeName'; break;
        case 'attributetype': attr.name = 'attributeType'; break;
        case 'basefrequency': attr.name = 'baseFrequency'; break;
        case 'baseprofile': attr.name = 'baseProfile'; break;
        case 'calcmode': attr.name = 'calcMode'; break;
        case 'clippathunits': attr.name = 'clipPathUnits'; break;
        case 'diffuseconstant': attr.name = 'diffuseConstant'; break;
        case 'edgemode': attr.name = 'edgeMode'; break;
        case 'filterunits': attr.name = 'filterUnits'; break;
        case 'glyphref': attr.name = 'glyphRef'; break;
        case 'gradienttransform': attr.name = 'gradientTransform'; break;
        case 'gradientunits': attr.name = 'gradientUnits'; break;
        case 'kernelmatrix': attr.name = 'kernelMatrix'; break;
        case 'kernelunitlength': attr.name = 'kernelUnitLength'; break;
        case 'keypoints': attr.name = 'keyPoints'; break;
        case 'keysplines': attr.name = 'keySplines'; break;
        case 'keytimes': attr.name = 'keyTimes'; break;
        case 'lengthadjust': attr.name = 'lengthAdjust'; break;
        case 'limitingconeangle': attr.name = 'limitingConeAngle'; break;
        case 'markerheight': attr.name = 'markerHeight'; break;
        case 'markerunits': attr.name = 'markerUnits'; break;
        case 'markerwidth': attr.name = 'markerWidth'; break;
        case 'maskcontentunits': attr.name = 'maskContentUnits'; break;
        case 'maskunits': attr.name = 'maskUnits'; break;
        case 'numoctaves': attr.name = 'numOctaves'; break;
        case 'pathlength': attr.name = 'pathLength'; break;
        case 'patterncontentunits': attr.name = 'patternContentUnits'; break;
        case 'patterntransform': attr.name = 'patternTransform'; break;
        case 'patternunits': attr.name = 'patternUnits'; break;
        case 'pointsatx': attr.name = 'pointsAtX'; break;
        case 'pointsaty': attr.name = 'pointsAtY'; break;
        case 'pointsatz': attr.name = 'pointsAtZ'; break;
        case 'preservealpha': attr.name = 'preserveAlpha'; break;
        case 'preserveaspectratio': attr.name = 'preserveAspectRatio'; break;
        case 'primitiveunits': attr.name = 'primitiveUnits'; break;
        case 'refx': attr.name = 'refX'; break;
        case 'refy': attr.name = 'refY'; break;
        case 'repeatcount': attr.name = 'repeatCount'; break;
        case 'repeatdur': attr.name = 'repeatDur'; break;
        case 'requiredextensions': attr.name = 'requiredExtensions'; break;
        case 'requiredfeatures': attr.name = 'requiredFeatures'; break;
        case 'specularconstant': attr.name = 'specularConstant'; break;
        case 'specularexponent': attr.name = 'specularExponent'; break;
        case 'spreadmethod': attr.name = 'spreadMethod'; break;
        case 'startoffset': attr.name = 'startOffset'; break;
        case 'stddeviation': attr.name = 'stdDeviation'; break;
        case 'stitchtiles': attr.name = 'stitchTiles'; break;
        case 'surfacescale': attr.name = 'surfaceScale'; break;
        case 'systemlanguage': attr.name = 'systemLanguage'; break;
        case 'tablevalues': attr.name = 'tableValues'; break;
        case 'targetx': attr.name = 'targetX'; break;
        case 'targety': attr.name = 'targetY'; break;
        case 'textlength': attr.name = 'textLength'; break;
        case 'viewbox': attr.name = 'viewBox'; break;
        case 'viewtarget': attr.name = 'viewTarget'; break;
        case 'xchannelselector': attr.name = 'xChannelSelector'; break;
        case 'ychannelselector': attr.name = 'yChannelSelector'; break;
        case 'zoomandpan': attr.name = 'zoomAndPan';
// @formatter:on
      }
    }
  }

  protected adjustForeignAttributes(token: TagToken) {
    // TODO test it
    const attributes = token.attributes;
    const len = attributes.length;
    for (let i = 0; i < len; ++i) {
      const attr = attributes[i];
      switch (attr.name) {
        case 'xlink:actuate':
          attributes[i] = {
            name: 'xlink:actuate',
            value: attr.value,
            prefix: 'xlink',
            localName: 'actuate',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:arcrole':
          attributes[i] = {
            name: 'xlink:arcrole',
            value: attr.value,
            prefix: 'xlink',
            localName: 'arcrole',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:href':
          attributes[i] = {
            name: 'xlink:href',
            value: attr.value,
            prefix: 'xlink',
            localName: 'href',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:role':
          attributes[i] = {
            name: 'xlink:role',
            value: attr.value,
            prefix: 'xlink',
            localName: 'role',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:show':
          attributes[i] = {
            name: 'xlink:show',
            value: attr.value,
            prefix: 'xlink',
            localName: 'show',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:title':
          attributes[i] = {
            name: 'xlink:title',
            value: attr.value,
            prefix: 'xlink',
            localName: 'title',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xlink:type':
          attributes[i] = {
            name: 'xlink:type',
            value: attr.value,
            prefix: 'xlink',
            localName: 'type',
            namespaceURI: NS_XLINK
          } as NamespacedAttribute;
          break;
        case 'xml:lang':
          attributes[i] = {
            name: 'xml:lang',
            value: attr.value,
            prefix: 'xml',
            localName: 'lang',
            namespaceURI: NS_XML
          } as NamespacedAttribute;
          break;
        case 'xml:space':
          attributes[i] = {
            name: 'xml:space',
            value: attr.value,
            prefix: 'xml',
            localName: 'space',
            namespaceURI: NS_XML
          } as NamespacedAttribute;
          break;
        case 'xmlns':
          attributes[i] = {
            name: 'xmlns',
            value: attr.value,
            prefix: undefined,
            localName: 'xmlns',
            namespaceURI: NS_XMLNS
          } as NamespacedAttribute;
          break;
        case 'xmlns:xlink':
          attributes[i] = {
            name: 'xmlns:xlink',
            value: attr.value,
            prefix: 'xmlns',
            localName: 'xlink',
            namespaceURI: NS_XMLNS
          } as NamespacedAttribute;
          break;
      }
    }
  }

  protected adjustSvgTagName(token: TagToken) {
    switch (token.name) {
// @formatter:off
      case 'altglyph': token.name = 'altGlyph'; break;
      case 'altglyphdef': token.name = 'altGlyphDef'; break;
      case 'altglyphitem': token.name = 'altGlyphItem'; break;
      case 'animatecolor': token.name = 'animateColor'; break;
      case 'animatemotion': token.name = 'animateMotion'; break;
      case 'animatetransform': token.name = 'animateTransform'; break;
      case 'clippath': token.name = 'clipPath'; break;
      case 'feblend': token.name = 'feBlend'; break;
      case 'fecolormatrix': token.name = 'feColorMatrix'; break;
      case 'fecomponenttransfer': token.name = 'feComponentTransfer'; break;
      case 'fecomposite': token.name = 'feComposite'; break;
      case 'feconvolvematrix': token.name = 'feConvolveMatrix'; break;
      case 'fediffuselighting': token.name = 'feDiffuseLighting'; break;
      case 'fedisplacementmap': token.name = 'feDisplacementMap'; break;
      case 'fedistantlight': token.name = 'feDistantLight'; break;
      case 'fedropshadow': token.name = 'feDropShadow'; break;
      case 'feflood': token.name = 'feFlood'; break;
      case 'fefunca': token.name = 'feFuncA'; break;
      case 'fefuncb': token.name = 'feFuncB'; break;
      case 'fefuncg': token.name = 'feFuncG'; break;
      case 'fefuncr': token.name = 'feFuncR'; break;
      case 'fegaussianblur': token.name = 'feGaussianBlur'; break;
      case 'feimage': token.name = 'feImage'; break;
      case 'femerge': token.name = 'feMerge'; break;
      case 'femergenode': token.name = 'feMergeNode'; break;
      case 'femorphology': token.name = 'feMorphology'; break;
      case 'feoffset': token.name = 'feOffset'; break;
      case 'fepointlight': token.name = 'fePointLight'; break;
      case 'fespecularlighting': token.name = 'feSpecularLighting'; break;
      case 'fespotlight': token.name = 'feSpotLight'; break;
      case 'fetile': token.name = 'feTile'; break;
      case 'feturbulence': token.name = 'feTurbulence'; break;
      case 'foreignobject': token.name = 'foreignObject'; break;
      case 'glyphref': token.name = 'glyphRef'; break;
      case 'lineargradient': token.name = 'linearGradient'; break;
      case 'radialgradient': token.name = 'radialGradient'; break;
      case 'textpath': token.name = 'textPath';
// @formatter:on
    }
  }
}