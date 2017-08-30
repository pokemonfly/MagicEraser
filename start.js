$( document ).ready( function ( ) {
    var me = $( '#baseContainer' ).magicEraser( );

    $( document ).on( 'click', '#btnLoad', function ( ) {
        $( '#imgfile' ).click( );
    }).on( 'click', '#drawingModeF', function ( ) {
        me.setFreeDrawingMode({
            value: !me.getFreeDrawingMode( 1 ),
            mode: 1,
            width: 20
        })
    }).on( 'click', '#drawingModeB', function ( ) {
        me.setFreeDrawingMode({
            value: !me.getFreeDrawingMode( 2 ),
            mode: 2,
            width: 20
        })
    }).on( 'click', '#drawingModeE', function ( ) {
        me.setFreeDrawingMode({
            value: !me.getFreeDrawingMode( 3 ),
            mode: 3,
            width: 20
        })
    }).on( 'change', '#scale', function ( ) {
        var val = $( this ).val( );
        me.setZoom( val / 100 )
        // me.zoomToPoint( {     x: 400,     y: 400 }, val / 100 );
        me.activeMainPic( )
    }).on( 'click', '#backward', function ( ) {
        me.backward( );
    }).on( 'click', '#download', function ( ) {
        me.download( );
    }).on( 'click', '#forward', function ( ) {
        me.forward( );
    }).on( 'click', '#segment', function ( ) {
        me.segment( );
    }).on( 'click', '#clear', function ( ) {
        me.confirmClear( )
    }).on( 'click', '#resetZoom', function ( ) {
        me.resetZoom( )
    }).on( 'change', '#imgfile', function ( ) {
        file = this.files[0];
        fr = new FileReader( );
        fr.onload = function ( ) {
            img = new Image( );
            img.onload = function ( ) {
                me.addPic( img.src );
            };
            img.src = fr.result;
        };
        fr.readAsDataURL( file );
    });
    window.me = me;
});
