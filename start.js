$( document ).ready( function ( ) {
    var me = $( '#baseContainer' ).magicEraser( );

    $( document ).on( 'click', '#btnLoad', function ( ) {
        $( '#imgfile' ).click( );
    }).on( 'click', '#drawingModeF', function ( ) {
        me.setFreeDrawingMode( !me.getFreeDrawingMode( 1 ), 1 )
    }).on( 'click', '#drawingModeB', function ( ) {
        me.setFreeDrawingMode( !me.getFreeDrawingMode( 2 ), 2 )
    }).on( 'click', '#segment', function ( ) {
        me.segment( );
    }).on( 'click', '#clear', function ( ) {
        me.confirmClear( )
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
});
