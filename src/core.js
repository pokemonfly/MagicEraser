// import dat from 'dat.gui' import fabric from 'fabric'
import SLICSegmentation from './slic-segmentation'
const fabric = window.fabric;
let canvas,
    output_canvas;
class Core {
    constructor( opt ) {
        canvas = new fabric.Canvas( opt.canvas )
        output_canvas = document.getElementById( opt.outputCanvas )

        this.width = canvas.getWidth( )
        this.height = canvas.getHeight( )

        this.delta_left = 0
        this.delta_top = 0
        this.network_editor
        this.network_train_editor
        this.network_test_editor
        this.state = {
            'images': [],
            'masks_present': false,
            'recompute': true,
            'results': {},
            canvas_data: null,
            mask_data: null,
            'options': {
                'pf': null,
                'slic': {
                    regionSize: 30,
                    minSize: 20
                }
            },
            current_mode: null,
            convnet_mode: false,
            freeDrawingMode: 'Pencil'
        }
    }

    init( ) {
        canvas.on( 'object:selected', this.updateScope ).on( 'group:selected', this.updateScope ).on( 'path:created', this.updateScope ).on( 'selection:cleared', this.updateScope );

        this.$window = $( window )
        this.$canvas = $( '#canvas' )
        this.$outputCanvas = $( '#output_canvas' )
        this.$yax = $( '#yaxis' );
        canvas.backgroundColor = '#ffffff';
        $( '#bg-color' ).val( '#ffffff' );
        canvas.renderAll( );

        this.delta_left = this.$outputCanvas.offset( ).left - this.$canvas.offset( ).left + this.$window.scrollLeft( );
        this.delta_top = this.$outputCanvas.offset( ).top - this.$canvas.offset( ).top + this.$window.scrollTop( );
        this.$window.scroll(( ) => {
            this.delta_left = this.$outputCanvas.offset( ).left - this.$canvas.offset( ).left + this.$window.scrollLeft( );
            this.delta_top = this.$outputCanvas.offset( ).top - this.$canvas.offset( ).top + this.$window.scrollTop( );
        });
    }
    updateScope( ) {
        canvas.renderAll( );
    }
    addPic( src ) {
        fabric.Image.fromURL(src, ( oImg ) => {
            canvas.add( oImg );
        });
    }
    mover_cursor = ( options ) => {
        this.$yax.css({
            'top': options.e.y + this.delta_top,
            'left': options.e.x + this.delta_left
        });
    }
    getActiveStyle( styleName, object ) {
        object = object || canvas.getActiveObject( );
        if ( !object )
            return '';
        return ( object.getSelectionStyles && object.isEditing ) ? ( object.getSelectionStyles( )[ styleName ] || '') : ( object[styleName] || '' );
    }
    setActiveStyle( styleName, value, object ) {
        object = object || canvas.getActiveObject( );
        if ( !object )
            return;

        if ( object.setSelectionStyles && object.isEditing ) {
            var style = {}
            style[styleName] = value;
            object.setSelectionStyles( style );
            object.setCoords( );
        } else {
            object[styleName] = value;
        }

        object.setCoords( );
        canvas.renderAll( );
    }

    getActiveProp( name ) {
        var object = canvas.getActiveObject( );
        if ( !object )
            return '';
        return object[name] || '';
    }
    setActiveProp( name, value ) {
        var object = canvas.getActiveObject( );
        if ( !object )
            return;
        object.set( name, value ).setCoords( );
        canvas.renderAll( );
    }

    getOpacity( ) {
        return getActiveStyle( 'opacity' ) * 100;
    }
    setOpacity( value ) {
        setActiveStyle( 'opacity', parseInt( value, 10 ) / 100 );
    }

    getScale( ) {
        return (getActiveStyle( 'scaleX' ) + getActiveStyle( 'scaleY' )) * 50;
    }
    setScale( value ) {
        setActiveStyle( 'scaleX', parseInt( value, 10 ) / 100 );
        setActiveStyle( 'scaleY', parseInt( value, 10 ) / 100 );
    }

    confirmClear( ) {
        if (confirm( 'Remove everything including images. Are you sure?' )) {
            canvas.clear( );
        }
    }
    confirmClearMasks( ) {
        if (confirm( 'Remove all masks. Are you sure?' )) {
            canvas.forEachObject( function ( obj ) {
                if (!obj.isType( 'image' )) {
                    obj.remove( )
                }
            });
            state.masks_present = false;
        }
    }

    getConvnet( ) {
        return this.state.convnet_mode
    }

    getFill( ) {
        return getActiveStyle( 'fill' );
    }
    setFill( value ) {
        setActiveStyle( 'fill', value );
    }

    getBgColor( ) {
        return getActiveProp( 'backgroundColor' );
    }
    setBgColor( value ) {
        setActiveProp( 'backgroundColor', value );
    }

    getStrokeColor( ) {
        return getActiveStyle( 'stroke' );
    }
    setStrokeColor( value ) {
        setActiveStyle( 'stroke', value );
    }

    getStrokeWidth( ) {
        return getActiveStyle( 'strokeWidth' );
    }
    setStrokeWidth( value ) {
        setActiveStyle('strokeWidth', parseInt( value, 10 ));
    }

    getCanvasBgColor( ) {
        return canvas.backgroundColor;
    }
    setCanvasBgColor( value ) {
        canvas.backgroundColor = value;
        canvas.renderAll( );
    }

    export( ) {
        if (!fabric.Canvas.supports( 'toDataURL' )) {
            alert( 'This browser doesn\'t provide means to serialize canvas to an image' );
        } else {
            fabric.Image.fromURL( output_canvas.toDataURL( ), function ( img ) {
                canvas.add( img );
                img.bringToFront( );
                canvas.renderAll( );
                state.recompute = true;
            });
        }
    }

    download( ) {
        if (!fabric.Canvas.supports( 'toDataURL' )) {
            alert( 'This browser doesn\'t provide means to serialize canvas to an image' );
        } else {
            window.open(output_canvas.toDataURL( 'png' ));
        }
    }

    getSelected( ) {
        return canvas.getActiveObject( ) || canvas.getActiveGroup( );
    }
    removeSelected( ) {
        var activeObject = canvas.getActiveObject( ),
            activeGroup = canvas.getActiveGroup( );
        if ( activeGroup ) {
            var objectsInGroup = activeGroup.getObjects( );
            canvas.discardActiveGroup( );
            objectsInGroup.forEach(( object ) => {
                canvas.remove( object );
            });
        } else if ( activeObject ) {
            canvas.remove( activeObject );
        }
    }

    resetZoom( ) {
        var newZoom = 1.0;
        canvas.absolutePan({ x: 0, y: 0 });
        canvas.setZoom( newZoom );
        state.recompute = true;
        renderVieportBorders( );
        console.log( "zoom reset" );
        return false;
    }

    sendBackwards( ) {
        var activeObject = canvas.getActiveObject( );
        if ( activeObject ) {
            canvas.sendBackwards( activeObject );
        }
    }
    sendToBack( ) {
        var activeObject = canvas.getActiveObject( );
        if ( activeObject ) {
            canvas.sendToBack( activeObject );
        }
    }
    bringForward( ) {
        var activeObject = canvas.getActiveObject( );
        if ( activeObject ) {
            canvas.bringForward( activeObject );
        }
    }
    bringToFront( ) {
        var activeObject = canvas.getActiveObject( );
        if ( activeObject ) {
            canvas.bringToFront( activeObject );
        }
    }

    getFreeDrawingMode( mode ) {
        if ( mode ) {
            return canvas.isDrawingMode == false || mode != this.state.current_mode ? false : true;
        } else {
            return canvas.isDrawingMode
        }
    }
    setFreeDrawingMode( value, mode ) {
        canvas.isDrawingMode = !!value;
        canvas.freeDrawingBrush.color = mode == 1 ? 'green' : 'red';
        if ( canvas.isDrawingMode ) {
            this.$yax.show( );
            canvas.on( 'mouse:move', this.mover_cursor );
        } else {
            this.$yax.hide( );
            canvas.off( 'mouse:move', this.mover_cursor );
        }
        canvas.freeDrawingBrush.width = 5;
        this.state.current_mode = mode;
        canvas.deactivateAll( ).renderAll( );
    }

    getDrawingMode( ) {
        return this.state.freeDrawingMode;
    }
    setDrawingMode( type ) {
        this.state.freeDrawingMode = type;
    }

    getDrawingLineWidth( ) {
        if ( canvas.freeDrawingBrush ) {
            return canvas.freeDrawingBrush.width;
        }
    }
    setDrawingLineWidth( value ) {
        if ( canvas.freeDrawingBrush ) {
            canvas.freeDrawingBrush.width = parseInt( value, 10 ) || 1;
        }
    }

    getDrawingLineColor( ) {
        if ( canvas.freeDrawingBrush ) {
            return canvas.freeDrawingBrush.color;
        }
    }
    setDrawingLineColor( value ) {
        if ( canvas.freeDrawingBrush ) {
            canvas.freeDrawingBrush.color = value;
        }
    }

    duplicate( ) {
        var obj = fabric.util.object.clone(canvas.getActiveObject( ));
        obj.set( "top", obj.top + 12 );
        obj.set( "left", obj.left + 9 );
        canvas.add( obj );
    }

    updateCanvas( ) {
        fabric.Image.fromURL( output_canvas.toDataURL( 'png' ), function ( oImg ) {
            canvas.add( oImg );
        });
    }

    labelUnknown( ) {
        const { state } = this
        var segments = state.results.segments;
        if ( !state.results.background.length || !state.results.background.length ) {
            console.log( "Please mark both Background and Foreground" );
            _.each( state.results.unknown, function ( k ) {
                segments[k].foreground = true
            });
            return
        }
        let seg;
        for ( var index = 0; index < state.results.unknown.length; index++ ) {
            seg = segments[state.results.unknown[index]];
            seg.foreground = true;
            var fgList = _.map( state.results.foreground, function ( e ) {
                return seg.edges[e] * (Math.abs(segments[e].mp[0] - seg.mp[0]) + Math.abs(segments[e].mp[1] - seg.mp[1]) + Math.abs(segments[e].mp[2] - seg.mp[2]))
            });
            var bgList = _.map( state.results.background, function ( e ) {
                return seg.edges[e] * (Math.abs(segments[e].mp[0] - seg.mp[0]) + Math.abs(segments[e].mp[1] - seg.mp[1]) + Math.abs(segments[e].mp[2] - seg.mp[2]))
            });
            var fgDist = Math.min.apply( null, fgList ); // _.reduce(fgList, function(memo, num){ return memo + num; }, 0) / fgList.length;
            var bgDist = Math.min.apply( null, bgList ); //_.reduce(bgList, function(memo, num){ return memo + num; }, 0) / bgList.length;
            if ( fgDist > bgDist ) {
                seg.foreground = false;
                seg.background = true
            }
        }
    }

    updateClusters( ) {
        const { state } = this;
        var mask = state.mask_data.data,
            segments = state.results.segments,
            indexMap = state.results.indexMap;
        state.results.unknown = [ ];
        state.results.mixed = [ ];
        state.results.foreground = [ ];
        state.results.background = [ ];
        let seg;
        for ( var s in segments ) {
            seg = segments[s];
            seg.mask = {
                'f': 0,
                'b': 0
            };
            seg.foreground = false;
            seg.background = false;
            seg.unknown = false;
            seg.mixed = false;
        }

        for ( var i = 0; i < indexMap.length; ++i ) {
            var value = indexMap[i];
            if ( mask[4 * i + 0] == 0 && mask[4 * i + 1] == 128 ) {
                segments[value].mask.f++;
            }
            if ( mask[4 * i + 0] > 0 && mask[4 * i + 1] == 0 ) {
                segments[value].mask.b++;
            }
        }
        for ( var s in segments ) {
            seg = segments[s];
            if ( seg.mask.f > 0 && seg.mask.b == 0 ) {
                seg.foreground = true;
                seg.background = false;
                seg.unknown = false;
                seg.mixed = false;
                state.results.foreground.push( s )
            } else if ( seg.mask.b > 0 && seg.mask.f == 0 ) {
                seg.foreground = false;
                seg.background = true;
                seg.unknown = false;
                seg.mixed = false;
                state.results.background.push( s )
            } else if ( seg.mask.b > 0 && seg.mask.f > 0 ) {
                seg.foreground = false;
                seg.background = false;
                seg.unknown = false;
                seg.mixed = true;
                state.results.mixed.push( s )
            } else {
                seg.unknown = true;
                state.results.unknown.push( s )
            }
        }
        this.labelUnknown( );
    }

    callbackSegmentation = ( results ) => {
        results.segments = {};
        const { state } = this;
        var w = this.width,
            h = this.height,
            l = results.indexMap.length;
        for ( var i = 0; i < l; ++i ) {
            var current = results.indexMap[i];
            if (!results.segments.hasOwnProperty( current )) {
                results.segments[current] = {
                    'min_pixel': i,
                    'max_pixel': i,
                    'min_x': w + 1,
                    'min_y': h + 1,
                    'max_x': -1,
                    'max_y': -1,
                    'mask': {
                        'b': 0,
                        'f': 0
                    },
                    'count': 0,
                    'mp': [
                        0, 0, 0
                    ],
                    'hred': new Uint32Array( 256 ),
                    'hgreen': new Uint32Array( 256 ),
                    'hblue': new Uint32Array( 256 )
                }
            }
            var y = Math.floor( i / w ),
                x = ( i % w );
            if ( i != x + y * w ) {
                console.log([
                    "Error?", i, x + y * w
                ])
            }
            results.segments[current].count += 1;
            results.segments[current].mp[0] += results.rgbData[4 * i];
            results.segments[current].mp[1] += results.rgbData[4 * i + 1];
            results.segments[current].mp[2] += results.rgbData[4 * i + 2];
            results.segments[current].hred[results.rgbData[4 * i]] += 1;
            results.segments[current].hgreen[results.rgbData[4 * i + 1]] += 1;
            results.segments[current].hblue[results.rgbData[4 * i + 2]] += 1;
            results.segments[current].max_pixel = i;
            if ( x > results.segments[current].max_x ) {
                results.segments[current].max_x = x
            }
            if ( x < results.segments[current].min_x ) {
                results.segments[current].min_x = x
            }
            if ( y > results.segments[current].max_y ) {
                results.segments[current].max_y = y
            }
            if ( y < results.segments[current].min_y ) {
                results.segments[current].min_y = y
            }
        }
        for ( var s in results.segments ) {
            results.segments[s].mp[0] = results.segments[s].mp[0] / results.segments[s].count;
            results.segments[s].mp[1] = results.segments[s].mp[1] / results.segments[s].count;
            results.segments[s].mp[2] = results.segments[s].mp[2] / results.segments[s].count;
            results.segments[s].edges = {};
            for ( var k in results.segments ) {
                if ( s != k ) {
                    results.segments[s].edges[k] = 1.0;
                }
            }
        }
        state.results = results;
    }

    deselect( ) {
        canvas.deactivateAll( ).renderAll( );
    }

    renderResults( ) {
        var results = this.state.results;
        var context = output_canvas.getContext( '2d' );
        var imageData = context.createImageData( output_canvas.width, output_canvas.height );
        var data = imageData.data;
        for ( var i = 0; i < results.indexMap.length; ++i ) {
            if ( results.segments[results.indexMap[i]].foreground ) {
                data[4 * i + 0] = results.rgbData[4 * i + 0];
                data[4 * i + 1] = results.rgbData[4 * i + 1];
                data[4 * i + 2] = results.rgbData[4 * i + 2];
                data[4 * i + 3] = 255;
            } else {
                data[4 * i + 3] = 0;
            }
        }
        context.putImageData( imageData, 0, 0 );
    }

    refreshData( ) {
        const { state } = this
        if ( state.recompute ) {
            canvas.deactivateAll( ).renderAll( );
            canvas.forEachObject( function ( obj ) {
                if (!obj.isType( 'image' )) {
                    obj.opacity = 0;
                }
            });
            canvas.renderAll( );
            state.canvas_data = canvas.getContext( '2d' ).getImageData( 0, 0, this.height, this.width );
        } else {
            console.log( "did not recompute" )
        }
        canvas.forEachObject( function ( obj ) {
            if (!obj.isType( 'image' )) {
                obj.opacity = 1.0;
            } else {
                obj.opacity = 0;
            }
        });
        canvas.renderAll( );
        state.mask_data = canvas.getContext( '2d' ).getImageData( 0, 0, this.height, this.width );
        canvas.forEachObject( function ( obj ) {
            if (obj.isType( 'image' )) {
                obj.opacity = 1.0;
            } else {
                obj.opacity = 0.6;
            }
        });
        canvas.renderAll( );
    }

    checkStatus( ) {
        return this.status;
    };

    disableStatus( ) {
        this.status = "";
    }

    check_movement( ) {
        const { state } = this

        canvas.forEachObject( function ( obj ) {
            if (!obj.isType( 'image' )) {
                state.masks_present = true;
            }
        });
        let old_positions_joined = state.images.join( );
        state.images = [ ];
        canvas.forEachObject( function ( obj ) {
            if (obj.isType( 'image' )) {
                state.images.push([ obj.scaleX, obj.scaleY, obj.top, obj.left, obj.opacity ])
            }
        });
        if ( !state.recompute ) { // if recompute is true let it remain true.
            state.recompute = state.images.join( ) != old_positions_joined;
        }
    }

    segment( ) {
        const { state } = this;
        this.setFreeDrawingMode( false, this.state.current_mode );
        this.check_movement( );
        if ( state.masks_present ) {
            if ( canvas.isDrawingMode ) {
                canvas.isDrawingMode = false;
                canvas.deactivateAll( ).renderAll( );
            }
            this.refreshData( );
            if ( state.recompute ) {
                state.options.slic.callback = this.callbackSegmentation;
                SLICSegmentation( state.canvas_data, state.mask_data, state.options.slic );
                console.log( "recomputing segmentation" )
            } else {
                console.log( "Did not recompute, using previously computed superpixels." )
            }
            this.updateClusters( );
            this.renderResults( );
            state.recompute = false;
        }
    }

    // del ??
    addOnClick( event ) {
        if ( event.layerX || event.layerX == 0 ) { // Firefox
            mouseX = event.layerX;
            mouseY = event.layerY;
        } else if ( event.offsetX || event.offsetX == 0 ) { // Opera
            mouseX = event.offsetX;
            mouseY = event.offsetY;
        }
        if ( state.results ) {
            var segment = state.results.segments[state.results.indexMap[width * mouseY + mouseX]],
                segment_index = state.results.indexMap[width * mouseY + mouseX],
                c = document.createElement( 'canvas' );
            c.setAttribute( 'id', '_temp_canvas' );
            c.width = segment.max_x - segment.min_x + 1;
            c.height = segment.max_y - segment.min_y + 1;
            var context = c.getContext( '2d' ),
                imageData = context.createImageData( c.width, c.height ),
                data = imageData.data,
                indexMap = state.results.indexMap,
                rgbData = state.canvas_data.data;
            var i_x,
                i_y;
            k = 0;
            for ( var i = 0; i < indexMap.length; ++i ) {
                i_y = Math.floor( i / width );
                i_x = ( i % width );
                if ( i_x >= segment.min_x && i_x <= segment.max_x && i_y >= segment.min_y && i_y <= segment.max_y ) {
                    if (segment_index == indexMap[i]) {
                        data[4 * k + 0] = rgbData[4 * i + 0];
                        data[4 * k + 1] = rgbData[4 * i + 1];
                        data[4 * k + 2] = rgbData[4 * i + 2];
                        data[4 * k + 3] = 255;
                    } else {
                        data[4 * k + 0] = 0;
                        data[4 * k + 1] = 0;
                        data[4 * k + 2] = 0;
                        data[4 * k + 3] = 0;
                    }
                    k++;
                }
            }
            context.putImageData( imageData, 0, 0 );
            fabric.Image.fromURL( c.toDataURL( ), function ( img ) {
                img.left = segment.min_x;
                img.top = segment.min_y;
                canvas.add( img );
                img.bringToFront( );
                c = null;
                $( '#_temp_canvas' ).remove( );
                canvas.renderAll( );
            })
        }
    }
}

export default Core;
