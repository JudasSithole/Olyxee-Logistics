/**
 * Olyxee Tracking — front-end widget.
 *
 * Talks ONLY to this WordPress site's REST proxy (OlyxeeTracking.endpoint),
 * which fetches the shipment status from Olyxee server-side. No API keys, no
 * CORS, no Olyxee URLs in the browser.
 */
( function () {
	'use strict';

	var CFG = window.OlyxeeTracking || {};
	var ENDPOINT = CFG.endpoint || '';

	function esc( value ) {
		return String( value == null ? '' : value ).replace( /[&<>"']/g, function ( c ) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ];
		} );
	}

	function readCodeFromUrl() {
		try {
			return new URLSearchParams( window.location.search ).get( 'code' ) || '';
		} catch ( e ) {
			return '';
		}
	}

	function fmtDate( iso ) {
		if ( ! iso ) {
			return '';
		}
		var d = new Date( iso );
		if ( isNaN( d.getTime() ) ) {
			return '';
		}
		return d.toLocaleDateString( undefined, { year: 'numeric', month: 'short', day: 'numeric' } );
	}

	function fmtDateTime( iso ) {
		if ( ! iso ) {
			return '';
		}
		var d = new Date( iso );
		if ( isNaN( d.getTime() ) ) {
			return '';
		}
		return d.toLocaleString( undefined, {
			year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
		} );
	}

	function setLoading( out ) {
		out.innerHTML =
			'<div class="olyxee-tracking__state olyxee-tracking__state--loading">' +
			'<span class="olyxee-tracking__spinner" aria-hidden="true"></span>' +
			'<span>Looking up your shipment…</span></div>';
	}

	function setNotFound( out ) {
		out.innerHTML =
			'<div class="olyxee-tracking__state olyxee-tracking__state--empty">' +
			'<strong>We couldn’t find that shipment.</strong>' +
			'<span>Please check the tracking number from your email and try again.</span></div>';
	}

	function setError( out ) {
		out.innerHTML =
			'<div class="olyxee-tracking__state olyxee-tracking__state--error">' +
			'<strong>Tracking is temporarily unavailable.</strong>' +
			'<span>Please try again in a moment.</span></div>';
	}

	function renderTimeline( data ) {
		// Prefer the ordered flow (checklist); fall back to the event history.
		if ( Array.isArray( data.flow ) && data.flow.length ) {
			var steps = data.flow.map( function ( step ) {
				var state = step.state || 'upcoming';
				var mark = state === 'completed' ? '✓' : ( state === 'current' ? '●' : '○' );
				return (
					'<li class="olyxee-tracking__step olyxee-tracking__step--' + esc( state ) + '">' +
					'<span class="olyxee-tracking__dot">' + mark + '</span>' +
					'<span class="olyxee-tracking__step-label">' + esc( step.label ) + '</span>' +
					'</li>'
				);
			} ).join( '' );
			return '<ul class="olyxee-tracking__timeline">' + steps + '</ul>';
		}

		if ( Array.isArray( data.events ) && data.events.length ) {
			var rows = data.events.map( function ( ev ) {
				var when = fmtDateTime( ev.at );
				var loc = ev.location ? ' · ' + esc( ev.location ) : '';
				var msg = ev.message ? '<span class="olyxee-tracking__event-msg">' + esc( ev.message ) + '</span>' : '';
				return (
					'<li class="olyxee-tracking__event">' +
					'<span class="olyxee-tracking__event-head">' + esc( ev.label ) + '</span>' +
					( when ? '<span class="olyxee-tracking__event-when">' + esc( when ) + loc + '</span>' : '' ) +
					msg +
					'</li>'
				);
			} ).join( '' );
			return '<ul class="olyxee-tracking__events">' + rows + '</ul>';
		}

		return '';
	}

	function renderResult( out, data ) {
		var biz = data.business || {};
		var accent = biz.primaryColor || '#1a1a1a';
		var header = '';

		if ( biz.logoUrl ) {
			header += '<img class="olyxee-tracking__logo" src="' + esc( biz.logoUrl ) + '" alt="' + esc( biz.name || '' ) + '" />';
		} else if ( biz.name ) {
			header += '<span class="olyxee-tracking__biz">' + esc( biz.name ) + '</span>';
		}

		var meta = [];
		meta.push( '<span class="olyxee-tracking__id">' + esc( data.trackingId || '' ) + '</span>' );
		if ( data.reference ) {
			meta.push( '<span class="olyxee-tracking__ref">Ref: ' + esc( data.reference ) + '</span>' );
		}
		if ( data.transportModeLabel ) {
			meta.push( '<span class="olyxee-tracking__mode">' + esc( data.transportModeLabel ) + '</span>' );
		}

		var eta = data.estimatedDeliveryDate ? fmtDate( data.estimatedDeliveryDate ) : '';
		var etaHtml = eta
			? '<div class="olyxee-tracking__eta">Estimated delivery: <strong>' + esc( eta ) + '</strong></div>'
			: '';

		out.innerHTML =
			'<div class="olyxee-tracking__card" style="--olyxee-accent:' + esc( accent ) + '">' +
			( header ? '<div class="olyxee-tracking__card-head">' + header + '</div>' : '' ) +
			'<div class="olyxee-tracking__status">' + esc( data.statusLabel || 'Pending' ) + '</div>' +
			'<div class="olyxee-tracking__meta">' + meta.join( '' ) + '</div>' +
			etaHtml +
			renderTimeline( data ) +
			'</div>';
	}

	function lookup( out, code ) {
		if ( ! ENDPOINT ) {
			setError( out );
			return;
		}
		setLoading( out );
		var url = ENDPOINT + ( ENDPOINT.indexOf( '?' ) === -1 ? '?' : '&' ) + 'code=' + encodeURIComponent( code );

		fetch( url, { headers: { Accept: 'application/json' } } )
			.then( function ( res ) {
				if ( res.status === 404 ) {
					return { __notFound: true };
				}
				if ( ! res.ok ) {
					throw new Error( 'http_' + res.status );
				}
				return res.json();
			} )
			.then( function ( data ) {
				if ( ! data || data.__notFound || data.error || ! data.trackingId ) {
					setNotFound( out );
					return;
				}
				renderResult( out, data );
			} )
			.catch( function () {
				setError( out );
			} );
	}

	function init( root ) {
		var form = root.querySelector( '[data-olyxee-form]' );
		var input = root.querySelector( 'input[name="code"]' );
		var out = root.querySelector( '[data-olyxee-result]' );
		if ( ! form || ! input || ! out ) {
			return;
		}

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			var code = ( input.value || '' ).trim();
			if ( code ) {
				lookup( out, code );
			}
		} );

		// If the link already carries ?code=, prefill and search automatically.
		var initial = readCodeFromUrl();
		if ( initial ) {
			input.value = initial;
			lookup( out, initial.trim() );
		}
	}

	function boot() {
		var roots = document.querySelectorAll( '[data-olyxee-tracking]' );
		for ( var i = 0; i < roots.length; i++ ) {
			init( roots[ i ] );
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )();
