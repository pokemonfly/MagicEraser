import Core from './core';
import template from './template';

(( $, fabric ) => {
    'use strict';
    const magicEraser = ( opt ) => {
        opt = $.extend( true, {
            template: template,
            pic: null,
            canvas: 'canvas',
            outputCanvas: 'output_canvas',
            fabric: fabric,
            width: 800,
            height: 800,
            canvasScale: 0.625,
            onHistoryChange: null
        }, opt );
        let core = new Core( opt );
        core.init( );
        return core;
    };
    $.fn.magicEraser = magicEraser
})( jQuery, fabric );
