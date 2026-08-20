/**
 * Editor registration for the "Olyxee Tracking" block. The front end is
 * rendered server-side (render_callback -> [olyxee_tracking]); in the editor we
 * just show a friendly placeholder. No build step — plain wp.* globals.
 */
( function ( blocks, element ) {
	if ( ! blocks || ! element ) {
		return;
	}
	var el = element.createElement;

	blocks.registerBlockType( 'olyxee/tracking', {
		edit: function () {
			return el(
				'div',
				{
					style: {
						border: '1px dashed #cbd5e1',
						borderRadius: '10px',
						padding: '18px',
						textAlign: 'center',
						color: '#475569',
						fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					},
				},
				el( 'strong', { style: { display: 'block', color: '#1a1a1a' } }, 'Olyxee Tracking' ),
				el(
					'span',
					{ style: { fontSize: '13px' } },
					'Your live shipment tracking box will appear here on the published page.'
				)
			);
		},
		save: function () {
			return null; // Dynamic block — rendered by PHP.
		},
	} );
} )( window.wp && window.wp.blocks, window.wp && window.wp.element );
