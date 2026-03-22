function e(e,t,r,n){var i,o=arguments.length,a=o<3?t:null===n?n=Object.getOwnPropertyDescriptor(t,r):n;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)a=Reflect.decorate(e,t,r,n);else for(var s=e.length-1;s>=0;s--)(i=e[s])&&(a=(o<3?i(a):o>3?i(t,r,a):i(t,r))||a);return o>3&&a&&Object.defineProperty(t,r,a),a}"function"==typeof SuppressedError&&SuppressedError;
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,r=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,n=Symbol(),i=new WeakMap;let o=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==n)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(r&&void 0===e){const r=void 0!==t&&1===t.length;r&&(e=i.get(t)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),r&&i.set(t,e))}return e}toString(){return this.cssText}};const a=(e,...t)=>{const r=1===e.length?e[0]:t.reduce((t,r,n)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+e[n+1],e[0]);return new o(r,e,n)},s=r?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const r of e.cssRules)t+=r.cssText;return(e=>new o("string"==typeof e?e:e+"",void 0,n))(t)})(e):e,{is:l,defineProperty:c,getOwnPropertyDescriptor:d,getOwnPropertyNames:h,getOwnPropertySymbols:p,getPrototypeOf:u}=Object,m=globalThis,f=m.trustedTypes,g=f?f.emptyScript:"",v=m.reactiveElementPolyfillSupport,y=(e,t)=>e,_={toAttribute(e,t){switch(t){case Boolean:e=e?g:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=null!==e;break;case Number:r=null===e?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch(e){r=null}}return r}},b=(e,t)=>!l(e,t),w={attribute:!0,type:String,converter:_,reflect:!1,useDefault:!1,hasChanged:b};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),m.litPropertyMetadata??=new WeakMap;let A=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=w){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const r=Symbol(),n=this.getPropertyDescriptor(e,r,t);void 0!==n&&c(this.prototype,e,n)}}static getPropertyDescriptor(e,t,r){const{get:n,set:i}=d(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:n,set(t){const o=n?.call(this);i?.call(this,t),this.requestUpdate(e,o,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??w}static _$Ei(){if(this.hasOwnProperty(y("elementProperties")))return;const e=u(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(y("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(y("properties"))){const e=this.properties,t=[...h(e),...p(e)];for(const r of t)this.createProperty(r,e[r])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,r]of t)this.elementProperties.set(e,r)}this._$Eh=new Map;for(const[e,t]of this.elementProperties){const r=this._$Eu(e,t);void 0!==r&&this._$Eh.set(r,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const r=new Set(e.flat(1/0).reverse());for(const e of r)t.unshift(s(e))}else void 0!==e&&t.push(s(e));return t}static _$Eu(e,t){const r=t.attribute;return!1===r?void 0:"string"==typeof r?r:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const r of t.keys())this.hasOwnProperty(r)&&(e.set(r,this[r]),delete this[r]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((e,n)=>{if(r)e.adoptedStyleSheets=n.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const r of n){const n=document.createElement("style"),i=t.litNonce;void 0!==i&&n.setAttribute("nonce",i),n.textContent=r.cssText,e.appendChild(n)}})(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,r){this._$AK(e,r)}_$ET(e,t){const r=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,r);if(void 0!==n&&!0===r.reflect){const i=(void 0!==r.converter?.toAttribute?r.converter:_).toAttribute(t,r.type);this._$Em=e,null==i?this.removeAttribute(n):this.setAttribute(n,i),this._$Em=null}}_$AK(e,t){const r=this.constructor,n=r._$Eh.get(e);if(void 0!==n&&this._$Em!==n){const e=r.getPropertyOptions(n),i="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:_;this._$Em=n;const o=i.fromAttribute(t,e.type);this[n]=o??this._$Ej?.get(n)??o,this._$Em=null}}requestUpdate(e,t,r){if(void 0!==e){const n=this.constructor,i=this[e];if(r??=n.getPropertyOptions(e),!((r.hasChanged??b)(i,t)||r.useDefault&&r.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,r))))return;this.C(e,t,r)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:r,reflect:n,wrapped:i},o){r&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,o??t??this[e]),!0!==i||void 0!==o)||(this._$AL.has(e)||(this.hasUpdated||r||(t=void 0),this._$AL.set(e,t)),!0===n&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,r]of e){const{wrapped:e}=r,n=this[t];!0!==e||this._$AL.has(t)||void 0===n||this.C(t,void 0,r,n)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};A.elementStyles=[],A.shadowRootOptions={mode:"open"},A[y("elementProperties")]=new Map,A[y("finalized")]=new Map,v?.({ReactiveElement:A}),(m.reactiveElementVersions??=[]).push("2.1.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const x=globalThis,$=x.trustedTypes,T=$?$.createPolicy("lit-html",{createHTML:e=>e}):void 0,E="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,S="?"+C,k=`<${S}>`,N=document,D=()=>N.createComment(""),O=e=>null===e||"object"!=typeof e&&"function"!=typeof e,M=Array.isArray,R="[ \t\n\f\r]",L=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,z=/-->/g,P=/>/g,U=RegExp(`>|${R}(?:([^\\s"'>=/]+)(${R}*=${R}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),I=/'/g,H=/"/g,F=/^(?:script|style|textarea|title)$/i,B=(e=>(t,...r)=>({_$litType$:e,strings:t,values:r}))(1),W=Symbol.for("lit-noChange"),j=Symbol.for("lit-nothing"),G=new WeakMap,Y=N.createTreeWalker(N,129);function Z(e,t){if(!M(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==T?T.createHTML(t):t}const q=(e,t)=>{const r=e.length-1,n=[];let i,o=2===t?"<svg>":3===t?"<math>":"",a=L;for(let t=0;t<r;t++){const r=e[t];let s,l,c=-1,d=0;for(;d<r.length&&(a.lastIndex=d,l=a.exec(r),null!==l);)d=a.lastIndex,a===L?"!--"===l[1]?a=z:void 0!==l[1]?a=P:void 0!==l[2]?(F.test(l[2])&&(i=RegExp("</"+l[2],"g")),a=U):void 0!==l[3]&&(a=U):a===U?">"===l[0]?(a=i??L,c=-1):void 0===l[1]?c=-2:(c=a.lastIndex-l[2].length,s=l[1],a=void 0===l[3]?U:'"'===l[3]?H:I):a===H||a===I?a=U:a===z||a===P?a=L:(a=U,i=void 0);const h=a===U&&e[t+1].startsWith("/>")?" ":"";o+=a===L?r+k:c>=0?(n.push(s),r.slice(0,c)+E+r.slice(c)+C+h):r+C+(-2===c?t:h)}return[Z(e,o+(e[r]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),n]};class V{constructor({strings:e,_$litType$:t},r){let n;this.parts=[];let i=0,o=0;const a=e.length-1,s=this.parts,[l,c]=q(e,t);if(this.el=V.createElement(l,r),Y.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(n=Y.nextNode())&&s.length<a;){if(1===n.nodeType){if(n.hasAttributes())for(const e of n.getAttributeNames())if(e.endsWith(E)){const t=c[o++],r=n.getAttribute(e).split(C),a=/([.?@])?(.*)/.exec(t);s.push({type:1,index:i,name:a[2],strings:r,ctor:"."===a[1]?ee:"?"===a[1]?te:"@"===a[1]?re:J}),n.removeAttribute(e)}else e.startsWith(C)&&(s.push({type:6,index:i}),n.removeAttribute(e));if(F.test(n.tagName)){const e=n.textContent.split(C),t=e.length-1;if(t>0){n.textContent=$?$.emptyScript:"";for(let r=0;r<t;r++)n.append(e[r],D()),Y.nextNode(),s.push({type:2,index:++i});n.append(e[t],D())}}}else if(8===n.nodeType)if(n.data===S)s.push({type:2,index:i});else{let e=-1;for(;-1!==(e=n.data.indexOf(C,e+1));)s.push({type:7,index:i}),e+=C.length-1}i++}}static createElement(e,t){const r=N.createElement("template");return r.innerHTML=e,r}}function X(e,t,r=e,n){if(t===W)return t;let i=void 0!==n?r._$Co?.[n]:r._$Cl;const o=O(t)?void 0:t._$litDirective$;return i?.constructor!==o&&(i?._$AO?.(!1),void 0===o?i=void 0:(i=new o(e),i._$AT(e,r,n)),void 0!==n?(r._$Co??=[])[n]=i:r._$Cl=i),void 0!==i&&(t=X(e,i._$AS(e,t.values),i,n)),t}class K{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:r}=this._$AD,n=(e?.creationScope??N).importNode(t,!0);Y.currentNode=n;let i=Y.nextNode(),o=0,a=0,s=r[0];for(;void 0!==s;){if(o===s.index){let t;2===s.type?t=new Q(i,i.nextSibling,this,e):1===s.type?t=new s.ctor(i,s.name,s.strings,this,e):6===s.type&&(t=new ne(i,this,e)),this._$AV.push(t),s=r[++a]}o!==s?.index&&(i=Y.nextNode(),o++)}return Y.currentNode=N,n}p(e){let t=0;for(const r of this._$AV)void 0!==r&&(void 0!==r.strings?(r._$AI(e,r,t),t+=r.strings.length-2):r._$AI(e[t])),t++}}class Q{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,r,n){this.type=2,this._$AH=j,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=r,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=X(this,e,t),O(e)?e===j||null==e||""===e?(this._$AH!==j&&this._$AR(),this._$AH=j):e!==this._$AH&&e!==W&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):(e=>M(e)||"function"==typeof e?.[Symbol.iterator])(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==j&&O(this._$AH)?this._$AA.nextSibling.data=e:this.T(N.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:r}=e,n="number"==typeof r?this._$AC(e):(void 0===r.el&&(r.el=V.createElement(Z(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===n)this._$AH.p(t);else{const e=new K(n,this),r=e.u(this.options);e.p(t),this.T(r),this._$AH=e}}_$AC(e){let t=G.get(e.strings);return void 0===t&&G.set(e.strings,t=new V(e)),t}k(e){M(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let r,n=0;for(const i of e)n===t.length?t.push(r=new Q(this.O(D()),this.O(D()),this,this.options)):r=t[n],r._$AI(i),n++;n<t.length&&(this._$AR(r&&r._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=e.nextSibling;e.remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}}class J{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,r,n,i){this.type=1,this._$AH=j,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=i,r.length>2||""!==r[0]||""!==r[1]?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=j}_$AI(e,t=this,r,n){const i=this.strings;let o=!1;if(void 0===i)e=X(this,e,t,0),o=!O(e)||e!==this._$AH&&e!==W,o&&(this._$AH=e);else{const n=e;let a,s;for(e=i[0],a=0;a<i.length-1;a++)s=X(this,n[r+a],t,a),s===W&&(s=this._$AH[a]),o||=!O(s)||s!==this._$AH[a],s===j?e=j:e!==j&&(e+=(s??"")+i[a+1]),this._$AH[a]=s}o&&!n&&this.j(e)}j(e){e===j?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class ee extends J{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===j?void 0:e}}class te extends J{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==j)}}class re extends J{constructor(e,t,r,n,i){super(e,t,r,n,i),this.type=5}_$AI(e,t=this){if((e=X(this,e,t,0)??j)===W)return;const r=this._$AH,n=e===j&&r!==j||e.capture!==r.capture||e.once!==r.once||e.passive!==r.passive,i=e!==j&&(r===j||n);n&&this.element.removeEventListener(this.name,this,r),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class ne{constructor(e,t,r){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(e){X(this,e)}}const ie=x.litHtmlPolyfillSupport;ie?.(V,Q),(x.litHtmlVersions??=[]).push("3.3.1");const oe=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */let ae=class extends A{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,r)=>{const n=r?.renderBefore??t;let i=n._$litPart$;if(void 0===i){const e=r?.renderBefore??null;n._$litPart$=i=new Q(t.insertBefore(D(),e),e,void 0,r??{})}return i._$AI(e),i})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return W}};ae._$litElement$=!0,ae.finalized=!0,oe.litElementHydrateSupport?.({LitElement:ae});const se=oe.litElementPolyfillSupport;se?.({LitElement:ae}),(oe.litElementVersions??=[]).push("4.2.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const le=e=>(t,r)=>{void 0!==r?r.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)},ce={attribute:!0,type:String,converter:_,reflect:!1,hasChanged:b},de=(e=ce,t,r)=>{const{kind:n,metadata:i}=r;let o=globalThis.litPropertyMetadata.get(i);if(void 0===o&&globalThis.litPropertyMetadata.set(i,o=new Map),"setter"===n&&((e=Object.create(e)).wrapped=!0),o.set(r.name,e),"accessor"===n){const{name:n}=r;return{set(r){const i=t.get.call(this);t.set.call(this,r),this.requestUpdate(n,i,e)},init(t){return void 0!==t&&this.C(n,void 0,e,t),t}}}if("setter"===n){const{name:n}=r;return function(r){const i=this[n];t.call(this,r),this.requestUpdate(n,i,e)}}throw Error("Unsupported decorator location: "+n)};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function he(e){return(t,r)=>"object"==typeof r?de(e,t,r):((e,t,r)=>{const n=t.hasOwnProperty(r);return t.constructor.createProperty(r,e),n?Object.getOwnPropertyDescriptor(t,r):void 0})(e,t,r)}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function pe(e){return he({...e,state:!0,attribute:!1})}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ue=2;class me{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,r){this._$Ct=e,this._$AM=t,this._$Ci=r}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class fe extends me{constructor(e){if(super(e),this.it=j,e.type!==ue)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===j||null==e)return this._t=void 0,this.it=e;if(e===W)return e;if("string"!=typeof e)throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;const t=[e];return t.raw=t,this._t={_$litType$:this.constructor.resultType,strings:t,values:[]}}}fe.directiveName="unsafeHTML",fe.resultType=1;const ge=(e=>(...t)=>({_$litDirective$:e,values:t}))(fe),{entries:ve,setPrototypeOf:ye,isFrozen:_e,getPrototypeOf:be,getOwnPropertyDescriptor:we}=Object;
/*! @license DOMPurify 3.3.3 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.3.3/LICENSE */let{freeze:Ae,seal:xe,create:$e}=Object,{apply:Te,construct:Ee}="undefined"!=typeof Reflect&&Reflect;Ae||(Ae=function(e){return e}),xe||(xe=function(e){return e}),Te||(Te=function(e,t){for(var r=arguments.length,n=new Array(r>2?r-2:0),i=2;i<r;i++)n[i-2]=arguments[i];return e.apply(t,n)}),Ee||(Ee=function(e){for(var t=arguments.length,r=new Array(t>1?t-1:0),n=1;n<t;n++)r[n-1]=arguments[n];return new e(...r)});const Ce=Be(Array.prototype.forEach),Se=Be(Array.prototype.lastIndexOf),ke=Be(Array.prototype.pop),Ne=Be(Array.prototype.push),De=Be(Array.prototype.splice),Oe=Be(String.prototype.toLowerCase),Me=Be(String.prototype.toString),Re=Be(String.prototype.match),Le=Be(String.prototype.replace),ze=Be(String.prototype.indexOf),Pe=Be(String.prototype.trim),Ue=Be(Object.prototype.hasOwnProperty),Ie=Be(RegExp.prototype.test),He=(Fe=TypeError,function(){for(var e=arguments.length,t=new Array(e),r=0;r<e;r++)t[r]=arguments[r];return Ee(Fe,t)});var Fe;function Be(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);for(var r=arguments.length,n=new Array(r>1?r-1:0),i=1;i<r;i++)n[i-1]=arguments[i];return Te(e,t,n)}}function We(e,t){let r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:Oe;ye&&ye(e,null);let n=t.length;for(;n--;){let i=t[n];if("string"==typeof i){const e=r(i);e!==i&&(_e(t)||(t[n]=e),i=e)}e[i]=!0}return e}function je(e){for(let t=0;t<e.length;t++){Ue(e,t)||(e[t]=null)}return e}function Ge(e){const t=$e(null);for(const[r,n]of ve(e)){Ue(e,r)&&(Array.isArray(n)?t[r]=je(n):n&&"object"==typeof n&&n.constructor===Object?t[r]=Ge(n):t[r]=n)}return t}function Ye(e,t){for(;null!==e;){const r=we(e,t);if(r){if(r.get)return Be(r.get);if("function"==typeof r.value)return Be(r.value)}e=be(e)}return function(){return null}}const Ze=Ae(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),qe=Ae(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),Ve=Ae(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),Xe=Ae(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),Ke=Ae(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),Qe=Ae(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),Je=Ae(["#text"]),et=Ae(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns","slot"]),tt=Ae(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),rt=Ae(["accent","accentunder","align","bevelled","close","columnsalign","columnlines","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lspace","lquote","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),nt=Ae(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),it=xe(/\{\{[\w\W]*|[\w\W]*\}\}/gm),ot=xe(/<%[\w\W]*|[\w\W]*%>/gm),at=xe(/\$\{[\w\W]*/gm),st=xe(/^data-[\-\w.\u00B7-\uFFFF]+$/),lt=xe(/^aria-[\-\w]+$/),ct=xe(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),dt=xe(/^(?:\w+script|data):/i),ht=xe(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),pt=xe(/^html$/i),ut=xe(/^[a-z][.\w]*(-[.\w]+)+$/i);var mt=Object.freeze({__proto__:null,ARIA_ATTR:lt,ATTR_WHITESPACE:ht,CUSTOM_ELEMENT:ut,DATA_ATTR:st,DOCTYPE_NAME:pt,ERB_EXPR:ot,IS_ALLOWED_URI:ct,IS_SCRIPT_OR_DATA:dt,MUSTACHE_EXPR:it,TMPLIT_EXPR:at});const ft=1,gt=3,vt=7,yt=8,_t=9,bt=function(){return"undefined"==typeof window?null:window};var wt=function e(){let t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:bt();const r=t=>e(t);if(r.version="3.3.3",r.removed=[],!t||!t.document||t.document.nodeType!==_t||!t.Element)return r.isSupported=!1,r;let{document:n}=t;const i=n,o=i.currentScript,{DocumentFragment:a,HTMLTemplateElement:s,Node:l,Element:c,NodeFilter:d,NamedNodeMap:h=t.NamedNodeMap||t.MozNamedAttrMap,HTMLFormElement:p,DOMParser:u,trustedTypes:m}=t,f=c.prototype,g=Ye(f,"cloneNode"),v=Ye(f,"remove"),y=Ye(f,"nextSibling"),_=Ye(f,"childNodes"),b=Ye(f,"parentNode");if("function"==typeof s){const e=n.createElement("template");e.content&&e.content.ownerDocument&&(n=e.content.ownerDocument)}let w,A="";const{implementation:x,createNodeIterator:$,createDocumentFragment:T,getElementsByTagName:E}=n,{importNode:C}=i;let S={afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]};r.isSupported="function"==typeof ve&&"function"==typeof b&&x&&void 0!==x.createHTMLDocument;const{MUSTACHE_EXPR:k,ERB_EXPR:N,TMPLIT_EXPR:D,DATA_ATTR:O,ARIA_ATTR:M,IS_SCRIPT_OR_DATA:R,ATTR_WHITESPACE:L,CUSTOM_ELEMENT:z}=mt;let{IS_ALLOWED_URI:P}=mt,U=null;const I=We({},[...Ze,...qe,...Ve,...Ke,...Je]);let H=null;const F=We({},[...et,...tt,...rt,...nt]);let B=Object.seal($e(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),W=null,j=null;const G=Object.seal($e(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let Y=!0,Z=!0,q=!1,V=!0,X=!1,K=!0,Q=!1,J=!1,ee=!1,te=!1,re=!1,ne=!1,ie=!0,oe=!1,ae=!0,se=!1,le={},ce=null;const de=We({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","style","svg","template","thead","title","video","xmp"]);let he=null;const pe=We({},["audio","video","img","source","image","track"]);let ue=null;const me=We({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),fe="http://www.w3.org/1998/Math/MathML",ge="http://www.w3.org/2000/svg",ye="http://www.w3.org/1999/xhtml";let _e=ye,be=!1,we=null;const xe=We({},[fe,ge,ye],Me);let Te=We({},["mi","mo","mn","ms","mtext"]),Ee=We({},["annotation-xml"]);const Fe=We({},["title","style","font","a","script"]);let Be=null;const je=["application/xhtml+xml","text/html"];let it=null,ot=null;const at=n.createElement("form"),st=function(e){return e instanceof RegExp||e instanceof Function},lt=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};if(!ot||ot!==e){if(e&&"object"==typeof e||(e={}),e=Ge(e),Be=-1===je.indexOf(e.PARSER_MEDIA_TYPE)?"text/html":e.PARSER_MEDIA_TYPE,it="application/xhtml+xml"===Be?Me:Oe,U=Ue(e,"ALLOWED_TAGS")?We({},e.ALLOWED_TAGS,it):I,H=Ue(e,"ALLOWED_ATTR")?We({},e.ALLOWED_ATTR,it):F,we=Ue(e,"ALLOWED_NAMESPACES")?We({},e.ALLOWED_NAMESPACES,Me):xe,ue=Ue(e,"ADD_URI_SAFE_ATTR")?We(Ge(me),e.ADD_URI_SAFE_ATTR,it):me,he=Ue(e,"ADD_DATA_URI_TAGS")?We(Ge(pe),e.ADD_DATA_URI_TAGS,it):pe,ce=Ue(e,"FORBID_CONTENTS")?We({},e.FORBID_CONTENTS,it):de,W=Ue(e,"FORBID_TAGS")?We({},e.FORBID_TAGS,it):Ge({}),j=Ue(e,"FORBID_ATTR")?We({},e.FORBID_ATTR,it):Ge({}),le=!!Ue(e,"USE_PROFILES")&&e.USE_PROFILES,Y=!1!==e.ALLOW_ARIA_ATTR,Z=!1!==e.ALLOW_DATA_ATTR,q=e.ALLOW_UNKNOWN_PROTOCOLS||!1,V=!1!==e.ALLOW_SELF_CLOSE_IN_ATTR,X=e.SAFE_FOR_TEMPLATES||!1,K=!1!==e.SAFE_FOR_XML,Q=e.WHOLE_DOCUMENT||!1,te=e.RETURN_DOM||!1,re=e.RETURN_DOM_FRAGMENT||!1,ne=e.RETURN_TRUSTED_TYPE||!1,ee=e.FORCE_BODY||!1,ie=!1!==e.SANITIZE_DOM,oe=e.SANITIZE_NAMED_PROPS||!1,ae=!1!==e.KEEP_CONTENT,se=e.IN_PLACE||!1,P=e.ALLOWED_URI_REGEXP||ct,_e=e.NAMESPACE||ye,Te=e.MATHML_TEXT_INTEGRATION_POINTS||Te,Ee=e.HTML_INTEGRATION_POINTS||Ee,B=e.CUSTOM_ELEMENT_HANDLING||{},e.CUSTOM_ELEMENT_HANDLING&&st(e.CUSTOM_ELEMENT_HANDLING.tagNameCheck)&&(B.tagNameCheck=e.CUSTOM_ELEMENT_HANDLING.tagNameCheck),e.CUSTOM_ELEMENT_HANDLING&&st(e.CUSTOM_ELEMENT_HANDLING.attributeNameCheck)&&(B.attributeNameCheck=e.CUSTOM_ELEMENT_HANDLING.attributeNameCheck),e.CUSTOM_ELEMENT_HANDLING&&"boolean"==typeof e.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements&&(B.allowCustomizedBuiltInElements=e.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements),X&&(Z=!1),re&&(te=!0),le&&(U=We({},Je),H=$e(null),!0===le.html&&(We(U,Ze),We(H,et)),!0===le.svg&&(We(U,qe),We(H,tt),We(H,nt)),!0===le.svgFilters&&(We(U,Ve),We(H,tt),We(H,nt)),!0===le.mathMl&&(We(U,Ke),We(H,rt),We(H,nt))),Ue(e,"ADD_TAGS")||(G.tagCheck=null),Ue(e,"ADD_ATTR")||(G.attributeCheck=null),e.ADD_TAGS&&("function"==typeof e.ADD_TAGS?G.tagCheck=e.ADD_TAGS:(U===I&&(U=Ge(U)),We(U,e.ADD_TAGS,it))),e.ADD_ATTR&&("function"==typeof e.ADD_ATTR?G.attributeCheck=e.ADD_ATTR:(H===F&&(H=Ge(H)),We(H,e.ADD_ATTR,it))),e.ADD_URI_SAFE_ATTR&&We(ue,e.ADD_URI_SAFE_ATTR,it),e.FORBID_CONTENTS&&(ce===de&&(ce=Ge(ce)),We(ce,e.FORBID_CONTENTS,it)),e.ADD_FORBID_CONTENTS&&(ce===de&&(ce=Ge(ce)),We(ce,e.ADD_FORBID_CONTENTS,it)),ae&&(U["#text"]=!0),Q&&We(U,["html","head","body"]),U.table&&(We(U,["tbody"]),delete W.tbody),e.TRUSTED_TYPES_POLICY){if("function"!=typeof e.TRUSTED_TYPES_POLICY.createHTML)throw He('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if("function"!=typeof e.TRUSTED_TYPES_POLICY.createScriptURL)throw He('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');w=e.TRUSTED_TYPES_POLICY,A=w.createHTML("")}else void 0===w&&(w=function(e,t){if("object"!=typeof e||"function"!=typeof e.createPolicy)return null;let r=null;const n="data-tt-policy-suffix";t&&t.hasAttribute(n)&&(r=t.getAttribute(n));const i="dompurify"+(r?"#"+r:"");try{return e.createPolicy(i,{createHTML:e=>e,createScriptURL:e=>e})}catch(e){return console.warn("TrustedTypes policy "+i+" could not be created."),null}}(m,o)),null!==w&&"string"==typeof A&&(A=w.createHTML(""));Ae&&Ae(e),ot=e}},dt=We({},[...qe,...Ve,...Xe]),ht=We({},[...Ke,...Qe]),ut=function(e){Ne(r.removed,{element:e});try{b(e).removeChild(e)}catch(t){v(e)}},wt=function(e,t){try{Ne(r.removed,{attribute:t.getAttributeNode(e),from:t})}catch(e){Ne(r.removed,{attribute:null,from:t})}if(t.removeAttribute(e),"is"===e)if(te||re)try{ut(t)}catch(e){}else try{t.setAttribute(e,"")}catch(e){}},At=function(e){let t=null,r=null;if(ee)e="<remove></remove>"+e;else{const t=Re(e,/^[\r\n\t ]+/);r=t&&t[0]}"application/xhtml+xml"===Be&&_e===ye&&(e='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+e+"</body></html>");const i=w?w.createHTML(e):e;if(_e===ye)try{t=(new u).parseFromString(i,Be)}catch(e){}if(!t||!t.documentElement){t=x.createDocument(_e,"template",null);try{t.documentElement.innerHTML=be?A:i}catch(e){}}const o=t.body||t.documentElement;return e&&r&&o.insertBefore(n.createTextNode(r),o.childNodes[0]||null),_e===ye?E.call(t,Q?"html":"body")[0]:Q?t.documentElement:o},xt=function(e){return $.call(e.ownerDocument||e,e,d.SHOW_ELEMENT|d.SHOW_COMMENT|d.SHOW_TEXT|d.SHOW_PROCESSING_INSTRUCTION|d.SHOW_CDATA_SECTION,null)},$t=function(e){return e instanceof p&&("string"!=typeof e.nodeName||"string"!=typeof e.textContent||"function"!=typeof e.removeChild||!(e.attributes instanceof h)||"function"!=typeof e.removeAttribute||"function"!=typeof e.setAttribute||"string"!=typeof e.namespaceURI||"function"!=typeof e.insertBefore||"function"!=typeof e.hasChildNodes)},Tt=function(e){return"function"==typeof l&&e instanceof l};function Et(e,t,n){Ce(e,e=>{e.call(r,t,n,ot)})}const Ct=function(e){let t=null;if(Et(S.beforeSanitizeElements,e,null),$t(e))return ut(e),!0;const n=it(e.nodeName);if(Et(S.uponSanitizeElement,e,{tagName:n,allowedTags:U}),K&&e.hasChildNodes()&&!Tt(e.firstElementChild)&&Ie(/<[/\w!]/g,e.innerHTML)&&Ie(/<[/\w!]/g,e.textContent))return ut(e),!0;if(e.nodeType===vt)return ut(e),!0;if(K&&e.nodeType===yt&&Ie(/<[/\w]/g,e.data))return ut(e),!0;if(!(G.tagCheck instanceof Function&&G.tagCheck(n))&&(!U[n]||W[n])){if(!W[n]&&kt(n)){if(B.tagNameCheck instanceof RegExp&&Ie(B.tagNameCheck,n))return!1;if(B.tagNameCheck instanceof Function&&B.tagNameCheck(n))return!1}if(ae&&!ce[n]){const t=b(e)||e.parentNode,r=_(e)||e.childNodes;if(r&&t){for(let n=r.length-1;n>=0;--n){const i=g(r[n],!0);i.__removalCount=(e.__removalCount||0)+1,t.insertBefore(i,y(e))}}}return ut(e),!0}return e instanceof c&&!function(e){let t=b(e);t&&t.tagName||(t={namespaceURI:_e,tagName:"template"});const r=Oe(e.tagName),n=Oe(t.tagName);return!!we[e.namespaceURI]&&(e.namespaceURI===ge?t.namespaceURI===ye?"svg"===r:t.namespaceURI===fe?"svg"===r&&("annotation-xml"===n||Te[n]):Boolean(dt[r]):e.namespaceURI===fe?t.namespaceURI===ye?"math"===r:t.namespaceURI===ge?"math"===r&&Ee[n]:Boolean(ht[r]):e.namespaceURI===ye?!(t.namespaceURI===ge&&!Ee[n])&&!(t.namespaceURI===fe&&!Te[n])&&!ht[r]&&(Fe[r]||!dt[r]):!("application/xhtml+xml"!==Be||!we[e.namespaceURI]))}(e)?(ut(e),!0):"noscript"!==n&&"noembed"!==n&&"noframes"!==n||!Ie(/<\/no(script|embed|frames)/i,e.innerHTML)?(X&&e.nodeType===gt&&(t=e.textContent,Ce([k,N,D],e=>{t=Le(t,e," ")}),e.textContent!==t&&(Ne(r.removed,{element:e.cloneNode()}),e.textContent=t)),Et(S.afterSanitizeElements,e,null),!1):(ut(e),!0)},St=function(e,t,r){if(j[t])return!1;if(ie&&("id"===t||"name"===t)&&(r in n||r in at))return!1;if(Z&&!j[t]&&Ie(O,t));else if(Y&&Ie(M,t));else if(G.attributeCheck instanceof Function&&G.attributeCheck(t,e));else if(!H[t]||j[t]){if(!(kt(e)&&(B.tagNameCheck instanceof RegExp&&Ie(B.tagNameCheck,e)||B.tagNameCheck instanceof Function&&B.tagNameCheck(e))&&(B.attributeNameCheck instanceof RegExp&&Ie(B.attributeNameCheck,t)||B.attributeNameCheck instanceof Function&&B.attributeNameCheck(t,e))||"is"===t&&B.allowCustomizedBuiltInElements&&(B.tagNameCheck instanceof RegExp&&Ie(B.tagNameCheck,r)||B.tagNameCheck instanceof Function&&B.tagNameCheck(r))))return!1}else if(ue[t]);else if(Ie(P,Le(r,L,"")));else if("src"!==t&&"xlink:href"!==t&&"href"!==t||"script"===e||0!==ze(r,"data:")||!he[e]){if(q&&!Ie(R,Le(r,L,"")));else if(r)return!1}else;return!0},kt=function(e){return"annotation-xml"!==e&&Re(e,z)},Nt=function(e){Et(S.beforeSanitizeAttributes,e,null);const{attributes:t}=e;if(!t||$t(e))return;const n={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:H,forceKeepAttr:void 0};let i=t.length;for(;i--;){const o=t[i],{name:a,namespaceURI:s,value:l}=o,c=it(a),d=l;let h="value"===a?d:Pe(d);if(n.attrName=c,n.attrValue=h,n.keepAttr=!0,n.forceKeepAttr=void 0,Et(S.uponSanitizeAttribute,e,n),h=n.attrValue,!oe||"id"!==c&&"name"!==c||(wt(a,e),h="user-content-"+h),K&&Ie(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,h)){wt(a,e);continue}if("attributename"===c&&Re(h,"href")){wt(a,e);continue}if(n.forceKeepAttr)continue;if(!n.keepAttr){wt(a,e);continue}if(!V&&Ie(/\/>/i,h)){wt(a,e);continue}X&&Ce([k,N,D],e=>{h=Le(h,e," ")});const p=it(e.nodeName);if(St(p,c,h)){if(w&&"object"==typeof m&&"function"==typeof m.getAttributeType)if(s);else switch(m.getAttributeType(p,c)){case"TrustedHTML":h=w.createHTML(h);break;case"TrustedScriptURL":h=w.createScriptURL(h)}if(h!==d)try{s?e.setAttributeNS(s,a,h):e.setAttribute(a,h),$t(e)?ut(e):ke(r.removed)}catch(t){wt(a,e)}}else wt(a,e)}Et(S.afterSanitizeAttributes,e,null)},Dt=function e(t){let r=null;const n=xt(t);for(Et(S.beforeSanitizeShadowDOM,t,null);r=n.nextNode();)Et(S.uponSanitizeShadowNode,r,null),Ct(r),Nt(r),r.content instanceof a&&e(r.content);Et(S.afterSanitizeShadowDOM,t,null)};return r.sanitize=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=null,o=null,s=null,c=null;if(be=!e,be&&(e="\x3c!--\x3e"),"string"!=typeof e&&!Tt(e)){if("function"!=typeof e.toString)throw He("toString is not a function");if("string"!=typeof(e=e.toString()))throw He("dirty is not a string, aborting")}if(!r.isSupported)return e;if(J||lt(t),r.removed=[],"string"==typeof e&&(se=!1),se){if(e.nodeName){const t=it(e.nodeName);if(!U[t]||W[t])throw He("root node is forbidden and cannot be sanitized in-place")}}else if(e instanceof l)n=At("\x3c!----\x3e"),o=n.ownerDocument.importNode(e,!0),o.nodeType===ft&&"BODY"===o.nodeName||"HTML"===o.nodeName?n=o:n.appendChild(o);else{if(!te&&!X&&!Q&&-1===e.indexOf("<"))return w&&ne?w.createHTML(e):e;if(n=At(e),!n)return te?null:ne?A:""}n&&ee&&ut(n.firstChild);const d=xt(se?e:n);for(;s=d.nextNode();)Ct(s),Nt(s),s.content instanceof a&&Dt(s.content);if(se)return e;if(te){if(re)for(c=T.call(n.ownerDocument);n.firstChild;)c.appendChild(n.firstChild);else c=n;return(H.shadowroot||H.shadowrootmode)&&(c=C.call(i,c,!0)),c}let h=Q?n.outerHTML:n.innerHTML;return Q&&U["!doctype"]&&n.ownerDocument&&n.ownerDocument.doctype&&n.ownerDocument.doctype.name&&Ie(pt,n.ownerDocument.doctype.name)&&(h="<!DOCTYPE "+n.ownerDocument.doctype.name+">\n"+h),X&&Ce([k,N,D],e=>{h=Le(h,e," ")}),w&&ne?w.createHTML(h):h},r.setConfig=function(){lt(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}),J=!0},r.clearConfig=function(){ot=null,J=!1},r.isValidAttribute=function(e,t,r){ot||lt({});const n=it(e),i=it(t);return St(n,i,r)},r.addHook=function(e,t){"function"==typeof t&&Ne(S[e],t)},r.removeHook=function(e,t){if(void 0!==t){const r=Se(S[e],t);return-1===r?void 0:De(S[e],r,1)[0]}return ke(S[e])},r.removeHooks=function(e){S[e]=[]},r.removeAllHooks=function(){S={afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},r}();const At=["a","b","br","em","i","li","ol","p","strong","ul"];wt.addHook("afterSanitizeAttributes",e=>{"A"===e.tagName&&(e.setAttribute("target","_blank"),e.setAttribute("rel","noopener noreferrer"))});const xt=[[["tornado"],"mdi:weather-tornado"],[["thunderstorm","t-storm"],"mdi:weather-lightning"],[["flood","hydrologic"],"mdi:home-flood"],[["snow","blizzard","winter"],"mdi:weather-snowy-heavy"],[["ice","freeze","frost"],"mdi:snowflake"],[["landslide","avalanche"],"mdi:landslide"],[["wind"],"mdi:weather-windy"],[["fire","red flag"],"mdi:fire"],[["heat"],"mdi:weather-sunny-alert"],[["fog"],"mdi:weather-fog"],[["hurricane","tropical"],"mdi:weather-hurricane"],[["sheep","grazier"],"mdi:weather-windy-variant"],[["surf","marine","coastal"],"mdi:waves"],[["cyclone"],"mdi:weather-hurricane"]];function $t(e){const t=e.toLowerCase();for(const[e,r]of xt)if(e.some(e=>t.includes(e)))return r;return"mdi:alert-circle-outline"}const Tt=[[["likely"],"mdi:check-decagram"],[["observed"],"mdi:eye-check"],[["possible","unlikely"],"mdi:help-circle-outline"]];const Et=[[["tornado warning"],"#FF0000","255, 0, 0"],[["tornado watch"],"#FFFF00","255, 255, 0"],[["extreme wind warning"],"#FF8C00","255, 140, 0"],[["hurricane warning"],"#DC143C","220, 20, 60"],[["excessive heat warning"],"#C71585","199, 21, 133"],[["flash flood warning","flash flood stmt"],"#8B0000","139, 0, 0"],[["flash flood watch"],"#2E8B57","46, 139, 87"],[["flash flood advisory"],"#00FF7F","0, 255, 127"],[["severe thunderstorm warning"],"#FFA500","255, 165, 0"],[["severe thunderstorm watch"],"#DB7093","219, 112, 147"],[["blizzard warning"],"#FF4500","255, 69, 0"],[["ice storm warning"],"#8B008B","139, 0, 139"],[["winter storm warning"],"#FF69B4","255, 105, 180"],[["winter storm watch"],"#4682B4","70, 130, 180"],[["high wind warning"],"#DAA520","218, 165, 32"],[["wind chill warning"],"#B0C4DE","176, 196, 222"],[["red flag warning","fire weather watch"],"#FF4500","255, 69, 0"],[["tsunami warning"],"#FD6347","253, 99, 71"],[["heat advisory"],"#FF7F50","255, 127, 80"],[["dense fog advisory"],"#708090","112, 128, 144"],[["frost advisory"],"#6495ED","100, 149, 237"],[["freeze warning"],"#483D8B","72, 61, 139"],[["wind advisory"],"#D2B48C","210, 180, 140"],[["winter weather advisory"],"#7B68EE","123, 104, 238"],[["tornado"],"#FF0000","255, 0, 0"],[["hurricane","typhoon","tropical storm"],"#DC143C","220, 20, 60"],[["flood"],"#228B22","34, 139, 34"],[["blizzard","ice storm"],"#FF4500","255, 69, 0"],[["snow","winter","blizzard"],"#1E90FF","30, 144, 255"],[["freeze","frost","ice"],"#6495ED","100, 149, 237"],[["wind"],"#D2B48C","210, 180, 140"],[["heat"],"#FF7F50","255, 127, 80"],[["fire","red flag"],"#FF4500","255, 69, 0"],[["fog"],"#708090","112, 128, 144"],[["tsunami"],"#FD6347","253, 99, 71"]];function Ct(e){const t=parseInt(e.slice(1,3),16)/255,r=parseInt(e.slice(3,5),16)/255,n=parseInt(e.slice(5,7),16)/255,i=e=>e<=.04045?e/12.92:((e+.055)/1.055)**2.4;return.2126*i(t)+.7152*i(r)+.0722*i(n)>.18?"#1a1a1a":"var(--text-primary-color, white)"}function St(e){if(!e||"None"===e||""===e.trim())return 0;const t=new Date(e.trim());return isNaN(t.getTime())?0:t.getTime()/1e3}function kt(e,t){if(!t?.timeZone)return"";const r=new Intl.DateTimeFormat(t.language,{timeZoneName:"short",timeZone:t.timeZone}).formatToParts(e);return r.find(e=>"timeZoneName"===e.type)?.value??""}function Nt(e,t){const r=t?.language,n=t?.date_format,i=t?.timeZone;if(!n||"language"===n)return e.toLocaleDateString(r,{timeZone:i});const o=new Intl.DateTimeFormat(r,{day:"numeric",month:"numeric",year:"numeric",timeZone:i}).formatToParts(e),a=o.find(e=>"day"===e.type)?.value??"",s=o.find(e=>"month"===e.type)?.value??"",l=o.find(e=>"year"===e.type)?.value??"";switch(n){case"DMY":return`${a}/${s}/${l}`;case"MDY":return`${s}/${a}/${l}`;case"YMD":return`${l}/${s}/${a}`;default:return e.toLocaleDateString(r,{timeZone:i})}}function Dt(e,t,r){const n=function(e){if(!e)return{locale:void 0};const t=e.language;return"12"===e.time_format?{locale:t,hour12:!0}:"24"===e.time_format?{locale:t,hour12:!1}:{locale:t}}(t),i={hour:r,minute:"2-digit",timeZone:t?.timeZone};return void 0!==n.hour12&&(i.hour12=n.hour12),e.toLocaleTimeString(n.locale,i)}function Ot(e,t){if(e<=0)return"N/A";const r=new Date(1e3*e),n=new Date,i=kt(r,t),o=Dt(r,t,"2-digit"),a=i?`${o} ${i}`:o;return function(e,t,r){const n=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:r});return n.format(e)===n.format(t)}(r,n,t?.timeZone)?a:`${a} (${Nt(r,t)})`}function Mt(e,t){if(e<=100)return"N/A";const r=new Date(1e3*e),n=kt(r,t),i=Dt(r,t,"numeric"),o=n?`${i} ${n}`:i;return`${Nt(r,t)}, ${o}`}function Rt(e,t=Date.now()/1e3){const r=e-t,n=Math.abs(r),i=r<0;if(n<60)return i?"just now":"in <1m";if(n<3600){const e=Math.floor(n/60);return i?`${e}m ago`:`in ${e}m`}if(n<86400){const e=Math.floor(n/3600),t=Math.floor(n%3600/60),r=t>0?`${e}h ${t}m`:`${e}h`;return i?`${r} ago`:`in ${r}`}const o=Math.floor(n/86400);return i?`${o}d ago`:`in ${o}d`}function Lt(e){const t=(e||"").toLowerCase().replace(/\s/g,"");return["extreme","severe","moderate","minor"].includes(t)?t:"unknown"}const zt={extreme:0,severe:1,moderate:2,minor:3,unknown:4};function Pt(e){const t=e.split("/");return t[t.length-1].toUpperCase()}function Ut(e){const t=[];if(e.AffectedZones)for(const r of e.AffectedZones)t.push(Pt(r));if(e.Geocode?.UGC)for(const r of e.Geocode.UGC){const e=r.toUpperCase();t.includes(e)||t.push(e)}return t}function It(e){if(e.area_id&&e.id.startsWith(e.area_id+"_")){const t=e.id.slice(e.area_id.length+1);return`https://www.bom.gov.au/warning/${e.type.replace(/_/g,"-")}/${t}`}return"https://www.bom.gov.au/weather-and-climate/warnings-and-alerts"}const Ht={new:"New",update:"Updated",renewal:"Renewed",upgrade:"Upgraded",downgrade:"Downgraded",final:"Final"};function Ft(e){return"string"==typeof e?e:""}const Bt=[new class{constructor(){this.provider="nws"}canHandle(e){const t=e.Alerts;if(!Array.isArray(t))return!1;if(0===t.length)return!0;const r=t[0];return"object"==typeof r&&null!==r&&"Event"in r&&"Severity"in r}parseAlerts(e){const t=e.Alerts;return Array.isArray(t)?t.map(e=>this._normalize(e)):[]}_normalize(e){const t=Lt(e.Severity);return{id:e.ID,event:e.Event||"Unknown",severity:t,severityLabel:e.Severity&&"unknown"!==Lt(e.Severity)?e.Severity:t.charAt(0).toUpperCase()+t.slice(1),certainty:e.Certainty||"",urgency:e.Urgency||"",sentTs:St(e.Sent),onsetTs:St(e.Onset),endsTs:St(e.Ends)||St(e.Expires),description:e.Description||"",instruction:e.Instruction||"",url:e.URL||"",headline:e.Headline||"",areaDesc:e.AreaDesc||e.AreasAffected||"",zones:Ut(e),provider:"nws",phase:""}}},new class{constructor(){this.provider="bom"}canHandle(e){const t=e.warnings;if(!Array.isArray(t))return!1;if(0===t.length)return"string"==typeof e.attribution&&e.attribution.toLowerCase().includes("bureau of meteorology");const r=t[0];return"object"==typeof r&&null!==r&&"warning_group_type"in r&&"issue_time"in r}parseAlerts(e){const t=e.warnings;return Array.isArray(t)?t.filter(e=>"cancelled"!==e.phase).map(e=>this._normalize(e)):[]}_normalize(e){const t=St(e.issue_time),r=St(e.expiry_time),n=(i=e).title||i.short_title||i.type.replace(/_/g," ");var i;const{severity:o,label:a}=function(e,t,r){const n=e.toLowerCase();if(n.includes("extreme")||n.includes("tropical cyclone"))return{severity:"extreme",label:(n.includes("extreme"),"Extreme")};if(n.includes("severe"))return{severity:"severe",label:"Severe"};if(n.includes("major"))return{severity:"severe",label:"Major"};if(n.includes("moderate"))return{severity:"moderate",label:"Moderate"};if(n.includes("minor")||n.includes("initial"))return{severity:"minor",label:"Minor"};const i=t.toLowerCase();if(i.includes("tropical_cyclone"))return{severity:"extreme",label:"Extreme"};if(i.includes("severe")||i.includes("fire_weather"))return{severity:"severe",label:"Severe"};const o=r.charAt(0).toUpperCase()+r.slice(1);return"major"===r?{severity:"moderate",label:o}:{severity:"minor",label:o}}(n,e.type,e.warning_group_type);return{id:e.id,event:n,severity:o,severityLabel:a,certainty:"",urgency:"",sentTs:t,onsetTs:t,endsTs:r,description:"",instruction:"",url:It(e),headline:e.short_title||n,areaDesc:e.state||"",zones:e.area_id?[e.area_id.toUpperCase()]:[],provider:"bom",phase:(s=e.phase,Ht[s.toLowerCase()]||"")};var s}},new class{constructor(){this.provider="meteoalarm"}canHandle(e){return!("string"!=typeof e.attribution||!e.attribution.toLowerCase().includes("meteoalarm"))||"string"==typeof e.awareness_level&&"string"==typeof e.awareness_type}parseAlerts(e){const t=Ft(e.event),r=Ft(e.headline);if(!t&&!r)return[];const n=Ft(e.awareness_level),i=function(e){if(!e||"string"!=typeof e)return;const t=parseInt(e.split(";")[0].trim(),10);return t>=4?"extreme":3===t?"severe":2===t?"moderate":1===t?"minor":void 0}(n)||Lt(Ft(e.severity)),o=function(e){if(!e||"string"!=typeof e)return"";const t=e.split(";");return t.length>=3?t[2].trim():""}(n)||Ft(e.severity)||i.charAt(0).toUpperCase()+i.slice(1),a=St(Ft(e.onset)||Ft(e.effective)),s=St(Ft(e.expires)),l=St(Ft(e.effective)),c=function(e){if(!e||"string"!=typeof e)return"";const t=e.split(";");return t.length>1?t.slice(1).join(";").trim():""}(Ft(e.awareness_type)),d=t||c||r;return[{id:`meteoalarm_${d}_${a}`,event:d,severity:i,severityLabel:o,certainty:Ft(e.certainty),urgency:Ft(e.urgency),sentTs:l,onsetTs:a||l,endsTs:s,description:Ft(e.description),instruction:Ft(e.instruction),url:"",headline:r||d,areaDesc:Ft(e.senderName),zones:[],provider:"meteoalarm",phase:""}]}}];const Wt=a`
  @keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 rgba(var(--color-rgb), 0.7); }
    70% { box-shadow: 0 0 0 6px rgba(var(--color-rgb), 0); }
    100% { box-shadow: 0 0 0 0 rgba(var(--color-rgb), 0); }
  }

  @keyframes ongoing-pulse {
    0% { background: rgba(var(--color-rgb), 0.8); }
    50% { background: rgba(var(--color-rgb), 0.5); }
    100% { background: rgba(var(--color-rgb), 0.8); }
  }

  :host {
    display: block;
  }

  .error {
    padding: 16px;
    color: var(--error-color, red);
  }

  .sensor-unavailable {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--secondary-text-color);
    font-style: italic;
  }

  /* --- COLOR MAPPING --- */
  .severity-extreme,
  .severity-severe { --color: var(--error-color); --color-rgb: 244, 67, 54; --badge-text: var(--text-primary-color, white); }
  .severity-moderate { --color: var(--warning-color); --color-rgb: 255, 152, 0; --badge-text: var(--text-primary-color, white); }
  .severity-minor { --color: var(--info-color); --color-rgb: 33, 150, 243; --badge-text: var(--text-primary-color, white); }
  .severity-unknown { --color: var(--secondary-text-color); --color-rgb: 128, 128, 128; --badge-text: var(--text-primary-color, white); }

  @media (prefers-color-scheme: dark) {
    .severity-extreme, .severity-severe,
    .severity-moderate, .severity-minor, .severity-unknown {
      --badge-text: var(--card-background-color, #1a1a1a);
    }
  }

  /* --- CARD CONTAINER --- */
  .alert-card {
    position: relative;
    margin-bottom: 16px;
    padding: 0;
    border-radius: 12px;
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    box-shadow: var(--ha-card-box-shadow, 0 2px 5px rgba(0,0,0,0.1));
    overflow: hidden;
    transition: all 0.2s ease-in-out;
  }

  .alert-card:last-child {
    margin-bottom: 0;
  }

  .alert-card::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 6px;
    background: var(--color);
  }

  .alert-card.severity-extreme,
  .alert-card.severity-severe {
    animation: pulse-border 2s infinite;
    border-color: var(--color);
  }

  /* --- HEADER --- */
  .alert-header-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 16px;
  }

  .icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--color-rgb), 0.1);
    color: var(--color);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .icon-box ha-icon { --mdc-icon-size: 26px; }

  .info-box { flex-grow: 1; }

  .title-row { margin-bottom: 4px; }
  .alert-title {
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--primary-text-color);
  }

  .area-desc {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
    max-width: 100%;
    opacity: 0.85;
  }
  .area-desc ha-icon {
    flex-shrink: 0;
    margin-top: 1px;
    --mdc-icon-size: 13px;
    width: 13px;
    height: 13px;
    opacity: 0.7;
  }
  .area-desc-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Compact expanded area-desc gets consistent inner padding */
  .compact .alert-expanded .area-desc {
    padding: 4px 12px 0;
    margin-bottom: 4px;
  }

  .badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .severity-badge {
    background: var(--color);
    color: var(--badge-text, var(--text-primary-color, white));
    font-weight: 700;
  }
  .certainty-badge {
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
    border: 1px solid var(--divider-color);
  }
  .active-badge {
    background: rgba(var(--color-rgb), 0.12);
    color: var(--primary-text-color);
    font-weight: 700;
    border: 1px solid rgba(var(--color-rgb), 0.4);
  }
  .prep-badge {
    background: var(--primary-background-color);
    color: var(--secondary-text-color);
    border: 1px solid var(--divider-color);
    font-style: italic;
  }
  .phase-badge {
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
    border: 1px solid var(--divider-color);
  }
  .zones-badge {
    background: transparent;
    color: var(--secondary-text-color);
    border: none;
    padding: 2px 0;
    font-weight: 400;
  }
  .zones-badge::before { content: '('; opacity: 0.5; }
  .zones-badge::after { content: ')'; opacity: 0.5; }

  /* --- PROGRESS --- */
  .progress-section {
    padding: 0 16px 16px 16px;
  }

  .progress-labels {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 0.85rem;
    color: var(--primary-text-color);
    margin-bottom: 6px;
  }

  .label-sub {
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    text-transform: uppercase;
  }
  .label-center {
    font-weight: bold;
    color: var(--color);
  }
  .label-right { text-align: right; }

  .progress-track {
    height: 8px;
    background: var(--secondary-background-color);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    position: absolute;
    top: 0;
    transition: width 0.3s ease;
  }

  .active .progress-fill {
    background: linear-gradient(90deg, var(--color) 0%, rgba(var(--color-rgb), 0.6) 100%);
  }

  .preparation .progress-fill {
    background-color: transparent;
    background-image: repeating-linear-gradient(
      -45deg,
      var(--color) 0,
      var(--color) 8px,
      transparent 8px,
      transparent 16px
    );
    opacity: 0.6;
  }

  /* --- DETAILS (custom toggle, not native <details>) --- */
  .alert-details-section {
    border-top: 1px solid var(--divider-color);
    background: rgba(var(--rgb-primary-text-color), 0.02);
  }

  .details-summary {
    padding: 10px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--secondary-text-color);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s;
    user-select: none;
  }
  .details-summary:hover {
    background: rgba(var(--color-rgb), 0.05);
    color: var(--primary-text-color);
  }

  .chevron {
    transition: transform 0.2s;
  }
  .chevron.expanded {
    transform: rotate(180deg);
  }

  .details-content {
    padding: 16px;
    font-size: 0.9rem;
  }

  /* Details Grid */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--divider-color);
  }

  .meta-item { display: flex; flex-direction: column; }
  .meta-label {
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    text-transform: uppercase;
  }
  .meta-value {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .meta-relative {
    font-size: 0.75rem;
    color: var(--secondary-text-color);
    font-style: italic;
  }

  .text-block { margin-bottom: 16px; }
  .text-label {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--primary-text-color);
  }
  .text-body {
    white-space: pre-wrap;
    color: var(--secondary-text-color);
    line-height: 1.5;
    background: var(--primary-background-color);
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
  }

  .footer-link { text-align: right; margin-top: 10px; }
  .footer-link a {
    color: var(--color);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.85rem;
  }

  /* --- COMPACT LAYOUT --- */
  .compact .alert-card {
    margin-bottom: 4px;
    border-radius: 8px;
  }

  .compact .alert-card::before {
    display: none;
  }

  .compact .alert-header-row.compact-row {
    padding: 8px 12px;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .compact .alert-header-row.compact-row:hover {
    background: rgba(var(--color-rgb), 0.05);
  }

  .compact .icon-box {
    width: 32px;
    height: 32px;
  }
  .compact .icon-box ha-icon {
    --mdc-icon-size: 18px;
  }

  .compact .alert-title {
    font-size: 0.95rem;
    flex-grow: 1;
  }

  .compact-chevron {
    color: var(--secondary-text-color);
    transition: transform 0.2s;
    flex-shrink: 0;
    --mdc-icon-size: 20px;
  }
  .compact-chevron.expanded {
    transform: rotate(180deg);
  }

  .compact .alert-expanded {
    padding-top: 4px;
    border-top: 1px solid var(--divider-color);
  }

  /* --- NO ANIMATIONS --- */
  .no-animations .alert-card {
    animation: none !important;
  }
  .no-animations .progress-fill {
    animation: none !important;
    transition: none !important;
  }

  /* --- EMPTY STATE --- */
  .no-alerts {
    padding: 20px;
    opacity: 0.6;
    text-align: center;
    font-style: italic;
  }
  .no-alerts ha-icon {
    margin-bottom: 10px;
  }
`;let jt=class extends ae{setConfig(e){this._config=e}_fireConfigChanged(e){this._config=e;const t=new CustomEvent("config-changed",{detail:{config:e},bubbles:!0,composed:!0});this.dispatchEvent(t)}_entityChanged(e){const t=e.detail.value;t!==this._config.entity&&this._fireConfigChanged({...this._config,entity:t})}_titleChanged(e){const t=e.target.value;if(t===(this._config.title||""))return;const r={...this._config};t?r.title=t:delete r.title,this._fireConfigChanged(r)}_providerChanged(e){const t=e.detail.value;if(t===(this._config.provider||"auto"))return;const r={...this._config};"auto"===t?delete r.provider:r.provider=t,this._fireConfigChanged(r)}_animationsChanged(e){const t=e.target.checked;if(t===(!1!==this._config.animations))return;const r={...this._config};t?delete r.animations:r.animations=!1,this._fireConfigChanged(r)}_deduplicateChanged(e){const t=e.target.checked;if(t===(!1!==this._config.deduplicate))return;const r={...this._config};t?delete r.deduplicate:r.deduplicate=!1,this._fireConfigChanged(r)}_layoutChanged(e){const t=e.target.checked;if(t===("compact"===this._config.layout))return;const r={...this._config};t?r.layout="compact":delete r.layout,this._fireConfigChanged(r)}_zonesChanged(e){const t=e.target.value,r={...this._config};t.trim()?r.zones=t.split(",").map(e=>e.trim()).filter(Boolean):delete r.zones,this._fireConfigChanged(r)}_sortOrderChanged(e){const t=e.detail.value;if(t===(this._config.sortOrder||"default"))return;const r={...this._config};"default"===t?delete r.sortOrder:r.sortOrder=t,this._fireConfigChanged(r)}_colorThemeChanged(e){const t=e.detail.value;if(t===(this._config.colorTheme||"severity"))return;const r={...this._config};"severity"===t?delete r.colorTheme:r.colorTheme=t,this._fireConfigChanged(r)}_minSeverityChanged(e){const t=e.detail.value;if(t===(this._config.minSeverity||""))return;const r={...this._config};t?r.minSeverity=t:delete r.minSeverity,this._fireConfigChanged(r)}render(){if(!this.hass||!this._config)return B``;const e=this._config.zones?this._config.zones.join(", "):"";return B`
      <div class="editor">
        <ha-selector
          .hass=${this.hass}
          .selector=${{entity:{domain:["sensor","binary_sensor"]}}}
          .value=${this._config.entity}
          .label=${"Entity (required)"}
          .required=${!0}
          @value-changed=${this._entityChanged}
        ></ha-selector>

        <ha-textfield
          .label=${"Title (optional)"}
          .value=${this._config.title||""}
          @change=${this._titleChanged}
        ></ha-textfield>

        <ha-select
          .label=${"Alert provider"}
          .value=${this._config.provider||"auto"}
          @selected=${this._providerChanged}
        >
          <ha-dropdown-item value="auto">Auto-detect</ha-dropdown-item>
          <ha-dropdown-item value="nws">NWS (United States)</ha-dropdown-item>
          <ha-dropdown-item value="bom">BoM (Australia)</ha-dropdown-item>
          <ha-dropdown-item value="meteoalarm">MeteoAlarm (Europe)</ha-dropdown-item>
        </ha-select>

        <ha-textfield
          .label=${"Zones (optional)"}
          .value=${e}
          .helper=${"Comma-separated zone codes, e.g. COC059, COZ039 (NWS) or NSW_FL049 (BoM)"}
          .helperPersistent=${!0}
          @change=${this._zonesChanged}
        ></ha-textfield>

        <ha-select
          .label=${"Sort order"}
          .value=${this._config.sortOrder||"default"}
          @selected=${this._sortOrderChanged}
        >
          <ha-dropdown-item value="default">Default</ha-dropdown-item>
          <ha-dropdown-item value="onset">Onset time</ha-dropdown-item>
          <ha-dropdown-item value="severity">Severity</ha-dropdown-item>
        </ha-select>

        <ha-select
          .label=${"Color theme"}
          .value=${this._config.colorTheme||"severity"}
          @selected=${this._colorThemeChanged}
        >
          <ha-dropdown-item value="severity">Severity-based</ha-dropdown-item>
          <ha-dropdown-item value="nws">NWS Official</ha-dropdown-item>
        </ha-select>

        <ha-select
          .label=${"Minimum severity"}
          .value=${this._config.minSeverity||""}
          @selected=${this._minSeverityChanged}
        >
          <ha-dropdown-item value="">All severities</ha-dropdown-item>
          <ha-dropdown-item value="minor">Minor or higher</ha-dropdown-item>
          <ha-dropdown-item value="moderate">Moderate or higher</ha-dropdown-item>
          <ha-dropdown-item value="severe">Severe or higher</ha-dropdown-item>
          <ha-dropdown-item value="extreme">Extreme only</ha-dropdown-item>
        </ha-select>

        <ha-formfield .label=${"Enable animations"}>
          <ha-switch
            .checked=${!1!==this._config.animations}
            @change=${this._animationsChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield .label=${"Deduplicate alerts"}>
          <ha-switch
            .checked=${!1!==this._config.deduplicate}
            @change=${this._deduplicateChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield .label=${"Compact layout"}>
          <ha-switch
            .checked=${"compact"===this._config.layout}
            @change=${this._layoutChanged}
          ></ha-switch>
        </ha-formfield>
      </div>
    `}};jt.styles=a`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }
  `,e([he({attribute:!1})],jt.prototype,"hass",void 0),e([pe()],jt.prototype,"_config",void 0),jt=e([le("weather-alerts-card-editor")],jt);customElements.define("nws-alerts-card-editor",class extends jt{});console.info("%c  WEATHER-ALERTS-CARD  %c  Version 2.0.0-alpha.1  ","color: white; background: #555; font-weight: bold;","color: white; background: #007acc; font-weight: bold;");const Gt={nws:"NWS",bom:"BoM",meteoalarm:"MeteoAlarm"};let Yt=class extends ae{constructor(){super(...arguments),this._expandedAlerts=new Map,this._motionQuery=window.matchMedia("(prefers-reduced-motion: reduce)"),this._onMotionChange=()=>this.requestUpdate()}connectedCallback(){super.connectedCallback(),this._motionQuery.addEventListener("change",this._onMotionChange)}disconnectedCallback(){super.disconnectedCallback(),this._motionQuery.removeEventListener("change",this._onMotionChange)}setConfig(e){if(!e.entity)throw new Error("You need to define an entity");this._config=e}getCardSize(){const e=this._getAlerts(),t=this._isCompact?1:3;return Math.max(1,e.length*t)}static getConfigElement(){return document.createElement("weather-alerts-card-editor")}static getStubConfig(){return{entity:"sensor.nws_alerts_alerts"}}_getAlerts(){if(!this.hass||!this._config)return[];const e=this.hass.states[this._config.entity];if(!e)return[];const t=function(e,t){if(e){const t=Bt.find(t=>t.provider===e);if(t)return t}for(const e of Bt)if(e.canHandle(t))return e;return Bt[0]}(this._config.provider,e.attributes);let r=t.parseAlerts(e.attributes);if(!1!==this._config.deduplicate&&(r=function(e){const t=new Map,r=[];for(const n of e){const e=`${n.event}\0${n.severity}\0${n.onsetTs}\0${n.endsTs}\0${n.provider}`,i=t.get(e);i?i.push(n):(t.set(e,[n]),r.push(e))}return r.map(e=>{const r=t.get(e);if(1===r.length)return r[0];const n={...r[0]},i=new Set,o=new Set;for(const e of r){for(const t of e.zones)i.add(t.toUpperCase());e.areaDesc&&o.add(e.areaDesc)}return n.zones=[...i],n.areaDesc=[...o].join("; "),n.mergedCount=r.length,n})}(r)),this._config.zones&&this._config.zones.length>0){const e=new Set(this._config.zones.map(e=>e.toUpperCase()));r=r.filter(t=>{return r=e,t.zones.some(e=>r.has(e.toUpperCase()));var r})}if(this._config.minSeverity){const e={extreme:0,severe:1,moderate:2,minor:3,unknown:4},t=e[this._config.minSeverity]??4;r=r.filter(r=>(e[r.severity]??4)<=t)}return function(e,t){return"onset"===t?[...e].sort((e,t)=>(e.onsetTs||1/0)-(t.onsetTs||1/0)):"severity"===t?[...e].sort((e,t)=>{const r=(zt[e.severity]??4)-(zt[t.severity]??4);return 0!==r?r:(e.onsetTs||1/0)-(t.onsetTs||1/0)}):e}(r,this._config.sortOrder||"default")}get _locale(){return{...this.hass.locale,timeZone:this.hass.config?.time_zone}}get _animationsEnabled(){return!0===this._config?.animations||!1!==this._config?.animations&&!this._motionQuery.matches}get _isCompact(){return"compact"===this._config?.layout}get _colorTheme(){return this._config?.colorTheme||"severity"}_alertColorStyle(e){if("nws"!==this._colorTheme||"nws"!==e.provider)return"";const{color:t,rgb:r,textColor:n}=function(e){const t=e.toLowerCase();for(const[e,r,n]of Et)if(e.some(e=>t.includes(e)))return{color:r,rgb:n,textColor:Ct(r)};return{color:"#808080",rgb:"128, 128, 128",textColor:Ct("#808080")}}(e.event);return`--color: ${t}; --color-rgb: ${r}; --badge-text: ${n};`}_normalizeText(e){return(e||"").replace(/\n{2,}/g,"\n\n").trim()}_toggleDetails(e){const t=new Map(this._expandedAlerts);t.set(e,!t.get(e)),this._expandedAlerts=t}_sourceLinkLabel(e){return`Open ${Gt[e.provider]||"Alert"} Source`}render(){if(!this._config||!this.hass)return B``;const e=this.hass.states[this._config.entity];if(!e)return B`
        <ha-card .header=${this._config.title||""}>
          <div class="error">
            Entity not found: ${this._config.entity}
          </div>
        </ha-card>
      `;const t=e.state;if("unavailable"===t||"unknown"===t)return B`
        <ha-card .header=${this._config.title||""}>
          <div class="sensor-unavailable">
            <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            Alert sensor is ${t}.
          </div>
        </ha-card>
      `;const r=this._getAlerts(),n=this._animationsEnabled?"":"no-animations",i=this._isCompact?"compact":"";return B`
      <ha-card .header=${this._config.title||""} class="${n} ${i}">
        ${0===r.length?this._renderNoAlerts():r.map(e=>this._renderAlert(e))}
      </ha-card>
    `}_renderNoAlerts(){return B`
      <div class="no-alerts">
        <ha-icon icon="mdi:weather-sunny"></ha-icon><br>
        No active alerts.
      </div>
    `}_renderAlert(e){const t=`severity-${e.severity}`,r=function(e){const t=Date.now()/1e3,r=e.sentTs,n=r>0?r:t;let i=e.onsetTs;0===i&&(i=n);const o=i+3600;let a=e.endsTs;0===a&&(a=o);const s=e.endsTs>0,l=t>=i;let c,d,h,p;l?(c=i,d=a,h=t,p="Active"):(c=t,d=a,h=i,p="Preparation");const u=d-c,m=(h-c)/(u>0?u:1)*100;return{isActive:l,phaseText:p,progressPct:Math.max(0,Math.min(100,Math.round(10*m)/10)),remainingHours:Math.round((a-t)/3600*10)/10,onsetHours:Math.round((i-t)/3600*10)/10,onsetMinutes:Math.round((i-t)/60),onsetTs:i,endsTs:a,sentTs:r,nowTs:t,hasEndTime:s}}(e),n=r.phaseText.toLowerCase(),i=this._expandedAlerts.get(e.id)||!1;return this._isCompact?this._renderCompactAlert(e,t,n,r,i):this._renderFullAlert(e,t,n,r,i)}_renderCompactAlert(e,t,r,n,i){return B`
      <div class="alert-card ${t} ${r}" style=${this._alertColorStyle(e)}>
        <div
          class="alert-header-row compact-row"
          @click=${()=>this._toggleDetails(e.id)}
        >
          <div class="icon-box">
            <ha-icon icon=${$t(e.event)}></ha-icon>
          </div>
          <span class="alert-title">${e.event}</span>
          <ha-icon
            icon="mdi:chevron-down"
            class="compact-chevron ${i?"expanded":""}"
          ></ha-icon>
        </div>
        ${i?this._renderExpandedContent(e,n):j}
      </div>
    `}_renderExpandedContent(e,t){return B`
      <div class="alert-expanded">
        ${e.areaDesc?B`
          <div class="area-desc" title=${e.areaDesc}>
            <ha-icon icon="mdi:map-marker"></ha-icon>
            <span class="area-desc-text">${e.areaDesc}</span>
          </div>
        `:j}
        <div class="badges-row" style="padding: 0 12px 8px;">
          ${this._renderBadgesRow(e,t)}
        </div>

        ${this._renderProgressSection(e,t)}

        <div class="alert-details-section">
          <div
            class="details-summary"
            @click=${()=>this._toggleDetails(e.id+"_details")}
          >
            <span>Read Details</span>
            <ha-icon
              icon="mdi:chevron-down"
              class="chevron ${this._expandedAlerts.get(e.id+"_details")?"expanded":""}"
            ></ha-icon>
          </div>
          ${this._expandedAlerts.get(e.id+"_details")?this._renderDetailsContent(e,t):j}
        </div>
      </div>
    `}_renderFullAlert(e,t,r,n,i){return B`
      <div class="alert-card ${t} ${r}" style=${this._alertColorStyle(e)}>
        <div class="alert-header-row">
          <div class="icon-box">
            <ha-icon icon=${$t(e.event)}></ha-icon>
          </div>
          <div class="info-box">
            <div class="title-row">
              <span class="alert-title">${e.event}</span>
            </div>
            ${e.areaDesc?B`
              <div class="area-desc" title=${e.areaDesc}>
                <ha-icon icon="mdi:map-marker"></ha-icon>
                <span class="area-desc-text">${e.areaDesc}</span>
              </div>
            `:j}
            <div class="badges-row">
              ${this._renderBadgesRow(e,n)}
            </div>
          </div>
        </div>

        ${this._renderProgressSection(e,n)}

        <div class="alert-details-section">
          <div
            class="details-summary"
            @click=${()=>this._toggleDetails(e.id)}
          >
            <span>Read Details</span>
            <ha-icon
              icon="mdi:chevron-down"
              class="chevron ${i?"expanded":""}"
            ></ha-icon>
          </div>
          ${i?this._renderDetailsContent(e,n):j}
        </div>
      </div>
    `}_renderBadgesRow(e,t){return B`
      <span class="badge severity-badge">${e.severityLabel}</span>
      ${e.certainty?B`
        <span class="badge certainty-badge">
          <ha-icon
            icon=${function(e){const t=e.toLowerCase();for(const[e,r]of Tt)if(e.some(e=>t.includes(e)))return r;return"mdi:bullseye-arrow"}(e.certainty)}
            style="--mdc-icon-size: 14px; width: 14px; height: 14px;"
          ></ha-icon>
          ${e.certainty}
        </span>
      `:j}
      ${e.phase?B`
        <span class="badge phase-badge">${e.phase}</span>
      `:j}
      ${t.isActive?B`<span class="badge active-badge">Active</span>`:B`<span class="badge prep-badge">In Prep</span>`}
      ${e.mergedCount&&e.mergedCount>1?B`<span class="badge zones-badge">${e.mergedCount} zones</span>`:j}
    `}_renderTextBlock(e,t){return t?B`
      <div class="text-block">
        <div class="text-label">${e}</div>
        <div class="text-body">${ge(function(e){return e?wt.sanitize(e,{ALLOWED_TAGS:At,ALLOWED_ATTR:["href"]}):""}(t))}</div>
      </div>
    `:j}_renderDetailsContent(e,t){const r=this._normalizeText(e.description),n=this._normalizeText(e.instruction);return B`
      <div class="details-content">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Issued</span>
            <span class="meta-value">${Mt(t.sentTs,this._locale)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Onset</span>
            <span class="meta-value">${Mt(t.onsetTs,this._locale)}</span>
            <span class="meta-relative">${Rt(t.onsetTs,t.nowTs)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Expires</span>
            <span class="meta-value">${Mt(t.endsTs,this._locale)}</span>
            ${t.hasEndTime?B`<span class="meta-relative">${Rt(t.endsTs,t.nowTs)}</span>`:j}
          </div>
          ${e.areaDesc?B`
            <div class="meta-item" style="grid-column: 1 / -1;">
              <span class="meta-label">Area</span>
              <span class="meta-value">${e.areaDesc}</span>
            </div>
          `:j}
        </div>

        ${this._renderTextBlock("Description",r)}
        ${this._renderTextBlock("Instructions",n)}

        ${e.url?B`
          <div class="footer-link">
            <a href=${e.url} target="_blank" rel="noopener noreferrer">
              ${this._sourceLinkLabel(e)}
              <ha-icon icon="mdi:open-in-new" style="width:14px;"></ha-icon>
            </a>
          </div>
        `:j}
      </div>
    `}_renderProgressSection(e,t){const{isActive:r,progressPct:n,hasEndTime:i,onsetTs:o,endsTs:a,nowTs:s}=t,l=!this._animationsEnabled,c=r&&!i?l?"width: 100%; left: 0; opacity: 0.8;":"width: 100%; left: 0; animation: ongoing-pulse 5s infinite; opacity: 0.8;":`width: ${100-n}%; left: ${n}%;`;return B`
      <div class="progress-section">
        <div class="progress-labels">
          <div class="label-left">
            <span class="label-sub">${r?"Start":"Now"}</span><br>
            ${Ot(r?o:s,this._locale)}
          </div>
          <div class="label-center">
            ${i?r?B`expires <b>${Rt(a,s)}</b>`:B`starts <b>${Rt(o,s)}</b>`:B`<span style="color: var(--color);"><b>Ongoing</b></span>`}
          </div>
          <div class="label-right">
            <span class="label-sub">End</span><br>
            ${i?Ot(a,this._locale):"TBD"}
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style=${c}></div>
        </div>
      </div>
    `}};Yt.styles=Wt,e([he({attribute:!1})],Yt.prototype,"hass",void 0),e([pe()],Yt.prototype,"_config",void 0),e([pe()],Yt.prototype,"_expandedAlerts",void 0),Yt=e([le("weather-alerts-card")],Yt);customElements.define("nws-alerts-card",class extends Yt{connectedCallback(){super.connectedCallback(),console.warn('nws-alerts-card is deprecated and will be removed in v3.0. Update your dashboard YAML to use "custom:weather-alerts-card".')}});const Zt=window;Zt.customCards=Zt.customCards||[],Zt.customCards.push({type:"weather-alerts-card",name:"Weather Alerts Card",description:"A card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), and MeteoAlarm (Europe)."}),Zt.customCards.push({type:"nws-alerts-card",name:"NWS Alerts Card (Deprecated)",description:'Deprecated — use "Weather Alerts Card" instead. Will be removed in v3.0.'});export{Yt as WeatherAlertsCard};
