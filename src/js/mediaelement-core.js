/**
 * MediaElement core
 *
 * This file is the foundation to create/render the media.
 */
(((win, doc, mejs, undefined) => {
    // Basic HTML5 settings
    mejs.html5media = {
		/**
		 * @type {String[]}
		 */
		properties: [
			// GET/SET
			'volume', 'src', 'currentTime', 'muted',

			// GET only
			'duration', 'paused', 'ended',

			// OTHERS
			'error', 'currentSrc', 'networkState', 'preload', 'buffered', 'bufferedBytes', 'bufferedTime', 'readyState', 'seeking',
			'initialTime', 'startOffsetTime', 'defaultPlaybackRate', 'playbackRate', 'played', 'seekable', 'autoplay', 'loop', 'controls'
		],
		/**
		 * @type {String[]}
		 */
		methods: [
			'load', 'play', 'pause', 'canPlayType'
		],
		/**
		 * @type {String[]}
		 */
		events: [
			'loadstart', 'progress', 'suspend', 'abort', 'error', 'emptied', 'stalled', 'play', 'pause', 'loadedmetadata',
			'loadeddata', 'waiting', 'playing', 'canplay', 'canplaythrough', 'seeking', 'seeked', 'timeupdate', 'ended',
			'ratechange', 'durationchange', 'volumechange'
		],
		/**
		 * @type {String[]}
		 */
		mediaTypes: [
			'audio/mp3', 'audio/ogg', 'audio/oga', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/x-pn-wav', 'audio/mpeg', 'audio/mp4',
			'video/mp4', 'video/webm', 'video/ogg'
		]
	};


    // List of possible renderers (HTML5, Flash, YouTube, Soundcloud, pure JS, etc.)
    mejs.Renderers = {

		/**
		 * Store render(s) data
		 * @type {Object[]}
		 */
		renderers: {},

		/**
		 * List the specific renders to be used; ordered as they are processed
		 *
		 * @type {String[]}
		 */
		order: [],

		/**
		 * Register a new renderer
		 * @param {Object} renderer - An object with all the rendered information (name REQUIRED)
		 */
		add(renderer) {
			this.renderers[renderer.name] = renderer;
			this.order.push(renderer.name);
		},

		/**
		 * Loop through renderers available and determine the proper one to use
		 *
		 * The mechanism that will determine if the renderer is the correct one is the `canPlay` method
		 * inside of each renderer file.
		 * @param {Object[]} mediaFiles - A list of source and type obtained from video/audio/source tags: [{src:'',type:''}]
		 * @param {?String[]} renderers - Optional list of pre-selected renderers
		 * @return {?Object}
		 */
		selectRenderer(mediaFiles, renderers) {
            const t = this;
            let i;
            let il;
            let j;
            let jl;
            let rendererName;
            let renderer;

            // First attempt: check if there are matches with specified ones
            if (renderers !== undefined && renderers !== null) {
				for (i = 0, il = renderers.length; i < il; i++) {
					rendererName = renderers[i];
					renderer = t.renderers[rendererName];

					for (j = 0, jl = mediaFiles.length; j < jl; j++) {
						if (renderer.canPlayType(mediaFiles[j].type)) {
							return {
								rendererName: rendererName,
								src: mediaFiles[j].src
							};
						}
					}
				}
			}
			// Second attempt: check matches with all available renderers specified via `mejs.Renderers.order`
			else {
				for (i = 0, il = t.order.length; i < il; i++) {
					rendererName = t.order[i];
					renderer = t.renderers[rendererName];

					for (j = 0, jl = mediaFiles.length; j < jl; j++) {
						if (renderer.canPlayType(mediaFiles[j].type)) {
							 return {
								rendererName: rendererName,
								src: mediaFiles[j].src
							};
						}
					}
				}
			}

            return null;
        }
	};

    // Basic defaults for MediaElement
    mejs.MediaElementOptionsDefaults = {
		/**
		 * List of the renderers to use
		 * @type {String[]}
		 */
		renderers: [],
		/**
		 * Name of MediaElement container
		 * @type {String}
		 */
		fakeNodeName: 'mediaelementwrapper',
		/**
		 * The path where shims are located
		 * @type {String}
		 */
		pluginPath: 'build/'
	};

    /**
	 * Create a fake DOM element with properties that look like a real HTMLMediaElement
	 * with all its methods/properties/events.
	 *
	 * @constructor
	 * @param {{String|HTMLElement}} idOrNode
	 * @param {Object} options
	 * @return {HTMLElement}
	 */
    mejs.MediaElement = (idOrNode, options) => {
        options = mejs.Utils.extend(mejs.MediaElementOptionsDefaults, options);

        // create our node (note: older versions of iOS don't support Object.defineProperty on DOM nodes)
        const mediaElement = doc.createElement(options.fakeNodeName);

        mediaElement.options = options;

        let id = idOrNode;

        if (typeof idOrNode === 'string') {
			mediaElement.originalNode = doc.getElementById(idOrNode);
		} else {
			mediaElement.originalNode = idOrNode;
			id = idOrNode.id;
		}

        id = id || `mejs_${Math.random().toString().slice(2)}`;

        if (mediaElement.originalNode !== undefined && mediaElement.originalNode !== null && mediaElement.appendChild) {
			// change id
			mediaElement.originalNode.setAttribute('id', `${id}_from_mejs`);

			// add next to this one
			mediaElement.originalNode.parentNode.insertBefore(mediaElement, mediaElement.originalNode);

			// insert this one inside
			mediaElement.appendChild(mediaElement.originalNode);
		} else {
			// TODO: where to put the node?
		}

        mediaElement.id = id;

        mediaElement.renderers = {};
        mediaElement.renderer = null;
        mediaElement.rendererName = null;

        // add properties get/set
        const props = mejs.html5media.properties;

        let i;
        let il;

        const assignGettersSetters = propName => {
            // src is a special one below
            if (propName !== 'src') {

                const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1),
                      getFn = () => {
                          //console.log('[wrapper get]: ' + propName);

                          if (mediaElement.renderer !== undefined && mediaElement.renderer !== null) {
                              return mediaElement.renderer[`get${capName}`]();

                              //return mediaElement.renderer[propName];
                          } else {
                              return null;
                          }
                      },
                      setFn = value => {
                          //console.log('[wrapper set]: ' + propName + ' = ' + value);

                          if (mediaElement.renderer !== undefined && mediaElement.renderer !== null) {
                              mediaElement.renderer[`set${capName}`](value);

                              //mediaElement.renderer[propName] = value;
                          }
                      };

                mejs.Utils.addProperty(mediaElement, propName, getFn, setFn);

                mediaElement[`get${capName}`] = getFn;
                mediaElement[`set${capName}`] = setFn;
            }
        };

        for (i = 0, il = props.length; i < il; i++) {
			assignGettersSetters(props[i]);
		}

        // special .src property
        const getSrc = () => {

				if (mediaElement.renderer !== undefined && mediaElement.renderer !== null) {
					return mediaElement.renderer.getSrc();
				} else {
					return null;
				}
			};

        const setSrc = value => {
            let renderInfo;
            const mediaFiles = [];

            // clean up URLs
            if (typeof value === 'string') {
                mediaFiles.push({
                    src: value,
                    type: mejs.Utils.getTypeFromFile(value)
                });
            } else {
                for (i = 0, il = value.length; i < il; i++) {

                    const src = mejs.Utils.absolutizeUrl(value[i].src), type = value[i].type;

                    mediaFiles.push({
                        src: src,
                        type: (type === '' || type === null || type === undefined) ? mejs.Utils.getTypeFromFile(src) : type
                    });

                }
            }

            //console.log('SRC test', mediaFiles);

            // find a renderer and URL match
            renderInfo = mejs.Renderers.selectRenderer(mediaFiles,
                (options.renderers.length ? options.renderers : null));

            //console.log('SRC selection', renderInfo);
            let event;

            // did we find a renderer?
            if (renderInfo === null) {
                event = doc.createEvent("HTMLEvents");
                event.initEvent('error', false, false);
                event.message = 'No renderer found';
                mediaElement.dispatchEvent(event);
                return;
            }

            // turn on the renderer (this checks for the existing renderer already)
            mediaElement.changeRenderer(renderInfo.rendererName, mediaFiles);

            if (mediaElement.renderer === undefined || mediaElement.renderer === null) {
                event = doc.createEvent("HTMLEvents");
                event.initEvent('error', false, false);
                event.message = 'Error creating renderer';
                mediaElement.dispatchEvent(event);
            }
        };

        mejs.Utils.addProperty(mediaElement, 'src', getSrc, setSrc);
        mediaElement.getSrc = getSrc;
        mediaElement.setSrc = setSrc;

        // add methods
        const methods = mejs.html5media.methods;

        const assignMethods = methodName => {
            // run the method on the current renderer
            mediaElement[methodName] = function(...args) {
                console.log(`[wrapper ${mediaElement.id}.${methodName}()]`, mediaElement.renderer);
                if (mediaElement.renderer !== undefined && mediaElement.renderer !== null) {
                    return mediaElement.renderer[methodName](args);
                } else {
                    return null;
                }
            };

        };

        for (i = 0, il = methods.length; i < il; i++) {
			assignMethods(methods[i]);
		}

        // IE && iOS
        if (!mediaElement.addEventListener) {

			mediaElement.events = {};

			// start: fake events
			mediaElement.addEventListener = (eventName, callback) => {
				// create or find the array of callbacks for this eventName
				mediaElement.events[eventName] = mediaElement.events[eventName] || [];

				// push the callback into the stack
				mediaElement.events[eventName].push(callback);
			};
			mediaElement.removeEventListener = (eventName, callback) => {
				// no eventName means remove all listeners
				if (!eventName) {
					mediaElement.events = {};
					return true;
				}

				// see if we have any callbacks for this eventName
				const callbacks = mediaElement.events[eventName];
				if (!callbacks) {
					return true;
				}

				// check for a specific callback
				if (!callback) {
					mediaElement.events[eventName] = [];
					return true;
				}

				// remove the specific callback
				for (let i = 0, il = callbacks.length; i < il; i++) {
					if (callbacks[i] === callback) {
						mediaElement.events[eventName].splice(i, 1);
						return true;
					}
				}
				return false;
			};

			/**
			 *
			 * @param {Event} event
			 */
			mediaElement.dispatchEvent = event => {
                let i;

                const //args,
                callbacks = mediaElement.events[event.type];

                //console.log('mejs event', event, mediaElement.events);

                if (callbacks) {
					//args = Array.prototype.slice.call(arguments, 1);
					for (i = 0, il = callbacks.length; i < il; i++) {

						//console.log('--event', event.type, callbacks[i]);

						callbacks[i].apply(null, [event]);
					}
				}
            };
		}

        /**
		 * Determine whether the renderer was found or not
		 *
		 * @param {String} rendererName
		 * @param {Object[]} mediaFiles
		 * @return {Boolean}
		 */
        mediaElement.changeRenderer = (rendererName, mediaFiles) => {
            // check for a match on the current renderer
            if (mediaElement.renderer !== undefined && mediaElement.renderer !== null && mediaElement.renderer.name === rendererName) {

				console.log(`Already using: ${rendererName}`);

				mediaElement.renderer.show();
				mediaElement.renderer.setSrc(mediaFiles[0].src);

				return true;
			}

            // if existing renderer is not the right one, then hide it
            if (mediaElement.renderer !== undefined && mediaElement.renderer !== null) {

				console.log('Stopping and hiding: ', mediaElement.renderer);

				mediaElement.renderer.pause();
				if (mediaElement.renderer.stop) {
					mediaElement.renderer.stop();
				}
				mediaElement.renderer.hide();
			}

            // see if we have the renderer already created
            let newRenderer = mediaElement.renderers[rendererName];

            let newRendererType = null;

            if (newRenderer !== undefined && newRenderer !== null) {
				console.log('restoring: ', newRenderer.name);

				newRenderer.show();

				newRenderer.setSrc(mediaFiles[0].src);

				mediaElement.renderer = newRenderer;
				return true;
			}

            const rendererArray = mediaElement.options.renderers.length > 0 ? mediaElement.options.renderers : mejs.Renderers.order;

            // find the desired renderer in the array of possible ones
            for (const index in rendererArray) {

				if (rendererArray[index] === rendererName) {

					// create the renderer
					newRendererType = mejs.Renderers.renderers[rendererArray[index]];

					const renderOptions = mejs.Utils.extend({}, mediaElement.options, newRendererType.options);
					newRenderer = newRendererType.create(mediaElement, renderOptions, mediaFiles);
					newRenderer.name = rendererName;

					//console.log('Switching to: ', newRendererType);

					// store for later
					mediaElement.renderers[newRendererType.name] = newRenderer;
					mediaElement.renderer = newRenderer;
					mediaElement.rendererName = rendererName;
					newRenderer.show();


					return true;
				}
			}

            console.log(`-- ERROR finding: ${rendererName}`);

            return false;
        };

        /**
		 * Set the element dimensions based on selected renderer's setSize method
		 *
		 * @param {number} width
		 * @param {number} height
		 */
        mediaElement.setSize = (width, height) => {
			if (mediaElement.renderer !== undefined && mediaElement.renderer !== null) {
				mediaElement.renderer.setSize(width, height);
			}
		};

        // find <source> elements
        if (mediaElement.originalNode !== null) {
			const mediaFiles = [];

			switch (mediaElement.originalNode.nodeName.toLowerCase()) {

				case 'iframe':
					mediaFiles.push({type: '', src: mediaElement.originalNode.getAttribute('src')});

					break;

				case 'audio':
				case 'video':
                    let n;
                    let src;
                    let type;
                    const sources = mediaElement.originalNode.childNodes.length;
                    const nodeSource = mediaElement.originalNode.getAttribute('src');

                    // Consider if node contains the `src` and `type` attributes
                    if (nodeSource) {
						mediaFiles.push({
							type: mejs.Utility.getTypeFromFile(nodeSource) || '',
							src: nodeSource
						});
					}

                    // test <source> types to see if they are usable
                    for (i = 0; i < sources; i++) {
						n = mediaElement.originalNode.childNodes[i];
						if (n.nodeType == 1 && n.tagName.toLowerCase() === 'source') {
							src = n.getAttribute('src');
							type = mejs.Utils.formatType(src, n.getAttribute('type'));

							mediaFiles.push({type: type, src: src});
						}
					}
                    break;
			}

			if (mediaFiles.length > 0) {
				console.log('initializing src', mediaFiles[0].src);

				// set src
				mediaElement.src = mediaFiles;
			}
		}

        // TEMP
        //mediaElement.load();

        if (options.success) {
			options.success(mediaElement, mediaElement.originalNode);
		}

        // if (options.error) {
        // 	options.error(mediaElement, mediaElement.originalNode);
        // }

        return mediaElement;
    };

    /**
	 * Export MediaElement variable globally
	 * @type {MediaElement}
	 */
    window.MediaElement = mejs.MediaElement;
}))(window, document, window.mejs || {});