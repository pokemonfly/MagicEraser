// import dat from 'dat.gui' import fabric from 'fabric'
import SLICSegmentation from './slic-segmentation'
const fabric = window.fabric;
let canvas,
    outputCanvas;
class Core {
    constructor( opt ) {
        $.extend( this, {
            scale: 1,
            delta_left: 0,
            delta_top: 0
        }, opt )
        const { canvasScale, width, height } = this
        canvas = new fabric.Canvas(this.canvas, {
            scale: canvasScale,
            width,
            height
        })
        // outputCanvas = document.getElementById( this.outputCanvas )
        outputCanvas = new fabric.Canvas(this.outputCanvas, {
            scale: canvasScale,
            width,
            height
        })

        this.state = {
            history: [],
            historyCur: -1,
            'images': [],
            'masks_present': false,
            'recompute': true,
            'results': {},
            canvas_data: null,
            mask_data: null,
            'options': {
                'pf': null,
                'slic': {
                    regionSize: 40
                }
            },
            current_mode: null,
            convnet_mode: false,
            freeDrawingMode: 'Pencil'
        }
        window.c = canvas;
    }

    init( ) {
        canvas.on( 'object:selected', this.updateScope )
        canvas.on( 'group:selected', this.updateScope )
        // canvas.on( 'path:created', this.updateScope )
        canvas.on( 'selection:cleared', this.updateScope );
        canvas.on( 'object:moving', this.moveHandler )
        canvas.on( 'mouse:move', this.mover_cursor );
        canvas.on( 'path:created', this._pathCreatedHandler );

        this.$window = $( window )
        this.$canvas = $( '#canvas' )
        this.$outputCanvas = $( '#' + this.outputCanvas )
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
    moveHandler = ({ target }) => {
        // this._checkPos( target ); 遍历其他的图层 同步移动缩放
        canvas.forEachObject(( obj ) => {
            if ( obj._type != 'main' ) {
                obj.setLeft(target.getLeft( ))
                obj.setTop(target.getTop( ))
            }
        });
        canvas.sendToBack( target );
        this.deselect( );
        this.renderOutput( );
    }

    setZoom( scale ) {
        this.scale = scale || this.scale
        canvas.setZoom( this.scale );
        this.updateScope( )
    }
    // TODO
    _checkPos( obj ) {
        var left = obj.getLeft( ),
            top = obj.getTop( ),
            vp = this.scale,
            cleft = obj.left,
            ctop = obj.top;
        if ( left > 0 ) {
            obj.left = 0;
        } else if (obj.left * vp < canvas.width * ( 1 - vp )) {
            obj.left = canvas.width * ( 1 - vp ) / vp;
        }
        if ( top > 0 ) {
            obj.setTop( 0 );
        } else if (obj.top * vp < canvas.height * ( 1 - vp )) {
            obj.top = canvas.height * ( 1 - vp ) / vp;
        }
        if ( cleft != obj.left || ctop != obj.top ) {
            setTimeout( function ( ) {
                canvas.deactivateAll( ).renderAll( );
            }, 50);
        }
    }
    addPic( src ) {
        if ( this.mainPic ) {
            console.log( 'replace old main pic' )
            canvas.remove( this.mainPic )
        }
        fabric.Image.fromURL(src, ( oImg ) => {
            oImg.evented = false;
            oImg.selectable = false;
            oImg._type = 'main'
            this.mainPic = oImg;
            canvas.add( oImg );
            canvas.sendBackwards( oImg )
            this.state.recompute = true;
        });
    }
    activeMainPic( ) {
        this.mainPic.selectable = true;
        this.mainPic.evented = true;
        canvas.isDrawingMode = false;
    }
    mover_cursor = ( options ) => {
        this.$yax.css({
            'top': options.e.y + this.delta_top,
            'left': options.e.x + this.delta_left
        });
    }
    // 撤销与重做
    backward( ) {
        if (this.hasPrevStep( )) {
            const { state } = this
            let { history } = state
            state.historyCur--;
            state.mask_data = history[state.historyCur];
            this._renderMask( state.mask_data )
            this.onHistoryChange && this.onHistoryChange( )
        }
    }
    forward( ) {
        if (this.hasNextStep( )) {
            const { state } = this
            let { history } = state
            state.historyCur++;
            state.mask_data = history[state.historyCur];
            this._renderMask( state.mask_data )
            this.onHistoryChange && this.onHistoryChange( )
        }
    }
    hasNextStep( ) {
        const { history, historyCur } = this.state
        return history.length - 1 > historyCur
    }
    hasPrevStep( ) {
        const { history, historyCur } = this.state
        return history.length - 1 >= historyCur && historyCur >= 0
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

    clear( ) {
        canvas.clear( );
    }
    clearMasks( ) {
        canvas.forEachObject( function ( obj ) {
            if ( !obj._type != 'main' ) {
                obj.remove( )
            }
        });
        state.masks_present = false;
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

    getResult( ) {
        return outputCanvas.toDataURL( 'png' );
    }
    export( ) {
        if (!fabric.Canvas.supports( 'toDataURL' )) {
            alert( 'This browser doesn\'t provide means to serialize canvas to an image' );
        } else {
            fabric.Image.fromURL( outputCanvas.toDataURL( ), function ( img ) {
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
            var win = window.open( );
            win.document.write( '<iframe src="' + this.getResult( ) + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>' )
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
        const { state } = this;
        canvas.absolutePan({ x: 0, y: 0 });
        canvas.setZoom( 1 )
        state.recompute = true;
        return false;
    }
    zoomToPoint( ) {
        canvas.zoomToPoint.apply( canvas, arguments )
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
    setFreeDrawingMode({ value, mode, color, cursor, width }) {
        if ( this.mainPic ) {
            this.mainPic.selectable = false;
            this.mainPic.evented = false;
        }
        if ( mode == 3 ) {
            color = '#ffffff'
        }
        canvas.isDrawingMode = !!value;
        canvas.freeDrawingBrush.color = color || ( mode == 1 ? 'green' : 'red' );
        canvas.freeDrawingCursor = cursor || canvas.freeDrawingCursor;
        canvas.freeDrawingBrush.width = width || canvas.freeDrawingBrush.width;
        canvas.freeDrawingBrush.width /= this.scale
        if ( canvas.isDrawingMode ) {
            this.$yax.show( );
        } else {
            this.$yax.hide( );
        }
        this.state.current_mode = mode;
        canvas.deactivateAll( ).renderAll( );
    }
    _pathCreatedHandler = ( ) => {
        const { state } = this;
        // 保存当前缩放状态
        let left = 0,
            top = 0;
        if ( this.mainPic ) {
            left = this.mainPic.getLeft( ),
            top = this.mainPic.getTop( )
        }
        this.resetZoom( );
        // 融合到mask层
        canvas.forEachObject( function ( obj ) {
            // if (!obj.isType( 'image' )) {
            if ( obj._type != 'main' ) {
                obj.opacity = 1.0;
            } else {
                obj.opacity = 0;
            }
        });
        canvas.renderAll( );
        const pathData = canvas.getContext( '2d' ).getImageData( 0, 0, this.height, this.width );
        // state.mask_data = this.mergeData( state.mask_data, pathData )
        state.mask_data = pathData
        this.setZoom( )
        this._renderMask( state.mask_data )

        // 保存为历史
        let { history, historyCur } = this.state
        if ( historyCur != history.length - 1 ) {
            // 删除后续的
            history.splice( historyCur - history.length + 1 )
        }
        history.push( state.mask_data );
        this.state.historyCur++;
        this.onHistoryChange && this.onHistoryChange( )
    }
    _renderMask( maskData ) {
        let _d = [ ];
        canvas.forEachObject( function ( obj ) {
            if ( obj._type == 'main' ) {
                obj.opacity = 1.0;
            } else {
                _d.push( obj )
            }
        });
        _d.forEach(i => {
            i.remove( )
        });
        if ( maskData ) {
            fabric.Image.fromURL( this._getPicFromData( maskData ), function ( oImg ) {
                oImg.selectable = false
                oImg.evented = false
                oImg.opacity = 0.6;
                canvas.add( oImg );
                canvas.renderAll( );
            });
        } else {
            canvas.renderAll( );
        }
    }
    // 把 data 数组 转换为base64
    _getPicFromData({ data, width, height }) {
        let c = document.createElement( 'canvas' );
        c.setAttribute( 'id', '_temp_canvas' );
        c.width = width;
        c.height = height;

        var context = c.getContext( '2d' ),
            imageData = context.createImageData( c.width, c.height );
        context.imageSmoothingEnabled = false;
        for ( let i = 0; i < data.length; i += 4 ) {
            let ind = i;
            let r = data[i],
                g = data[i + 1],
                b = data[i + 2];
            if ( data[ind] != 255 || data[ind + 1] != 255 || data[ind + 2] != 255 ) {
                imageData.data[ind] = data[ind]
                imageData.data[ind + 1] = data[ind + 1]
                imageData.data[ind + 2] = data[ind + 2]
                imageData.data[ind + 3] = data[ind + 3]
            } else {
                imageData.data[ind + 3] = 0
            }
        }

        context.putImageData( imageData, 0, 0 );
        let r = c.toDataURL( 'image/png' )
        c = null;
        return r;
    }
    //  画笔内容覆盖
    mergeData( base, override ) {
        if ( !base )
            return override
        let obj = base,
            data = obj.data,
            o_data = override.data;
        for ( var i = 0; i < data.length; i += 4 ) {
            if ( o_data[i] != 255 && o_data[i + 1] != 255 && o_data[i + 2] != 255 ) {
                data[i] = o_data[i];
                data[i + 1] = o_data[i + 1];
                data[i + 2] = o_data[i + 2];
                data[i + 3] = o_data[i + 3];
            }
        }
        return obj
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

    // 输出结果作为输入
    updateCanvas( ) {
        fabric.Image.fromURL( outputCanvas.toDataURL( 'png' ), function ( oImg ) {
            canvas.add( oImg );
        });
    }

    labelUnknown( ) {
        console.time( 'labelUnknown cost:' );
        const { state } = this
        const { results } = state
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

            // 加入距离比较
            let fgDis,
                bgDis,
                centerPox = {
                    x: ( seg.max_x + seg.min_x ) / 2,
                    y: ( seg.max_y + seg.min_y ) / 2
                },
                start_x = Math.ceil( centerPox.x - results.width / 4 ),
                end_x = Math.ceil( centerPox.x + results.width / 4 ),
                start_y = Math.ceil( centerPox.y - results.height / 4 ),
                end_y = Math.ceil( centerPox.y + results.height / 4 ),
                mask = state.mask_data.data,
                min_f = results.height / 4,
                min_b = results.height / 4;
            start_x = start_x < 0 ? 0 : start_x;
            start_y = start_y < 0 ? 0 : start_y;
            end_x = end_x > results.width ? results.width : end_x;
            end_y = end_y > results.height ? results.height : end_y;
            for ( let x = start_x; x < end_x; x++ ) {
                for ( let y = start_y; y < end_y; y++ ) {
                    let ind = x + y * results.width
                    let dis = Math.abs( centerPox.x - x ) + Math.abs( centerPox.y - y )
                    if ( mask[4 * ind + 0] == 0 && mask[4 * ind + 1] == 128 ) {
                        // f
                        if ( dis < min_f ) {
                            min_f = dis
                        }
                    }
                    if ( mask[4 * ind + 0] > 0 && mask[4 * ind + 1] == 0 ) {
                        // b
                        if ( dis < min_b ) {
                            min_b = dis
                        }
                    }
                }
            }
            // 均衡下距离和色差
            fgDist = min_f / results.height / 4 + fgDist / 10
            bgDist = min_b / results.height / 4 + bgDist / 10
            if ( fgDist > bgDist ) {
                seg.foreground = false;
                seg.background = true
            }
        }
        console.timeEnd( 'labelUnknown cost:' );
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
                if ( seg.mask.b > seg.mask.f ) {
                    seg.background = true;
                    state.results.background.push( s )
                } else {
                    seg.foreground = true;
                    state.results.foreground.push( s )
                }
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
        var context = outputCanvas.getContext( '2d' );
        var imageData = context.createImageData( this.width, this.height );
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
        // context.putImageData( imageData, 0, 0 );
        this.outputImage = this._getPicFromData( imageData )
        this.renderOutput( )
    }
    renderOutput( ) {
        if ( this.outputImage ) {
            outputCanvas.clear( )
            outputCanvas.setZoom( this.scale );
            fabric.Image.fromURL(this.outputImage, ( oImg ) => {
                // oImg.selectable = false oImg.evented = false
                oImg.left = this.mainPic.left
                oImg.top = this.mainPic.top
                outputCanvas.add( oImg );
                outputCanvas.renderAll( );
            });
        }
    }

    refreshData( ) {
        const { state } = this
        if ( state.recompute ) {
            this.resetZoom( )
            this.deselect( )
            canvas.forEachObject( function ( obj ) {
                if ( obj._type != 'main' ) {
                    obj.opacity = 0;
                }
            });
            canvas.renderAll( );
            state.canvas_data = canvas.getContext( '2d' ).getImageData( 0, 0, this.height, this.width );
            canvas.forEachObject( function ( obj ) {
                if ( obj._type != 'main' ) {
                    obj.opacity = 0.6;
                }
            });
            this.setZoom( )
            canvas.renderAll( );
        } else {
            console.log( "did not recompute" )
        }
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
            if ( obj._type != 'main' ) {
                state.masks_present = true;
            }
        });
        let old_positions_joined = state.images.join( );
        state.images = [ ];
        canvas.forEachObject( function ( obj ) {
            if ( obj._type != 'main' ) {
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
                this.deselect( )
            }
            this.refreshData( );
            if ( state.recompute ) {
                state.options.slic.callback = this.callbackSegmentation;
                // 计算超像素点
                SLICSegmentation( state.canvas_data, state.options.slic );
                console.log( "recomputing segmentation" )
            } else {
                console.log( "Did not recompute, using previously computed superpixels." )
            }
            this.updateClusters( );
            this.renderResults( );
            state.recompute = false;
        }
    }

    renderSuperpixels( ) {
        const { state } = this;
        var results = state.results;
        var context = outputCanvas.getContext( '2d' );
        var imageData = context.createImageData( outputCanvas.width, outputCanvas.height );
        var data = imageData.data;
        var seg;
        for ( var i = 0; i < results.indexMap.length; ++i ) {
            seg = results.segments[results.indexMap[i]];
            data[4 * i + 3] = 255;
            if (results.indexMap[i] == results.indexMap[i + 1]) { // Extremely naive pixel bondary
                data[4 * i + 0] = seg.mp[0];
                data[4 * i + 1] = seg.mp[1];
                data[4 * i + 2] = seg.mp[2];
            } else {
                data[4 * i + 0] = 0;
                data[4 * i + 1] = 0;
                data[4 * i + 2] = 0;
            }
        }
        context.putImageData( imageData, 0, 0 );
    }
    renderMixed( ) {
        const { state } = this;
        var results = state.results;
        var context = outputCanvas.getContext( '2d' );
        var imageData = context.createImageData( outputCanvas.width, outputCanvas.height );
        var data = imageData.data;
        for ( var i = 0; i < results.indexMap.length; ++i ) {
            if ( results.segments[results.indexMap[i]].mixed ) {
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

    renderUnknown( ) {
        const { state } = this;
        var results = state.results;
        var context = outputCanvas.getContext( '2d' );
        var imageData = context.createImageData( outputCanvas.width, outputCanvas.height );
        var data = imageData.data;
        for ( var i = 0; i < results.indexMap.length; ++i ) {
            if ( results.segments[results.indexMap[i]].unknown ) {
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
