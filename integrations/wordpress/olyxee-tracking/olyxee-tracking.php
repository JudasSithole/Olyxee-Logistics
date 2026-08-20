<?php
/**
 * Plugin Name:       Olyxee Tracking
 * Plugin URI:        https://logistics.olyxee.com
 * Description:        Show live shipment tracking from Olyxee Logistics on your website. Add the [olyxee_tracking] shortcode (or the "Olyxee Tracking" block) to any page. No API keys, no setup.
 * Version:           1.0.0
 * Author:            Olyxee
 * Author URI:        https://olyxee.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Text Domain:       olyxee-tracking
 *
 * How it works:
 *   The customer's browser only ever talks to THIS WordPress site. When a
 *   tracking number is looked up, WordPress makes the request to Olyxee
 *   server-side (see olyxee_tracking_proxy) and returns only the customer-safe
 *   shipment status. That means no CORS to configure, no API key, and no
 *   Olyxee implementation details exposed to the site owner. A shipment's
 *   tracking number is globally unique, so the correct business is resolved
 *   automatically — nothing to connect or configure.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

if ( ! defined( 'OLYXEE_TRACKING_API_BASE' ) ) {
	// The Olyxee base URL this plugin talks to (server-side only). Self-hosting
	// Olyxee? Override with the `olyxee_tracking_api_base` filter — you never
	// need to touch this to use the hosted service.
	define( 'OLYXEE_TRACKING_API_BASE', 'https://logistics.olyxee.com' );
}

define( 'OLYXEE_TRACKING_VERSION', '1.0.0' );
define( 'OLYXEE_TRACKING_DIR', plugin_dir_path( __FILE__ ) );
define( 'OLYXEE_TRACKING_URL', plugin_dir_url( __FILE__ ) );

/**
 * Resolve the Olyxee API base, trimmed and filterable.
 *
 * @return string
 */
function olyxee_tracking_api_base() {
	return rtrim( apply_filters( 'olyxee_tracking_api_base', OLYXEE_TRACKING_API_BASE ), '/' );
}

/* -------------------------------------------------------------------------
 * Front-end assets
 * ---------------------------------------------------------------------- */

/**
 * Register (not enqueue) assets. They are enqueued only when the shortcode or
 * block actually renders, so pages without tracking stay lean.
 */
function olyxee_tracking_register_assets() {
	wp_register_style(
		'olyxee-tracking',
		OLYXEE_TRACKING_URL . 'assets/olyxee-tracking.css',
		array(),
		OLYXEE_TRACKING_VERSION
	);
	wp_register_script(
		'olyxee-tracking',
		OLYXEE_TRACKING_URL . 'assets/olyxee-tracking.js',
		array(),
		OLYXEE_TRACKING_VERSION,
		true
	);
	wp_localize_script(
		'olyxee-tracking',
		'OlyxeeTracking',
		array(
			// The browser calls THIS WordPress endpoint, which proxies to Olyxee.
			'endpoint' => esc_url_raw( rest_url( 'olyxee/v1/track' ) ),
		)
	);
}
add_action( 'init', 'olyxee_tracking_register_assets' );

/* -------------------------------------------------------------------------
 * Server-side proxy — keeps the browser same-origin (no CORS) and hides all
 * Olyxee implementation details from the site owner.
 * ---------------------------------------------------------------------- */

function olyxee_tracking_register_routes() {
	register_rest_route(
		'olyxee/v1',
		'/track',
		array(
			'methods'             => 'GET',
			'permission_callback' => '__return_true', // Public, read-only status.
			'args'                => array(
				'code' => array(
					'required' => true,
					'type'     => 'string',
				),
			),
			'callback'            => 'olyxee_tracking_proxy',
		)
	);
}
add_action( 'rest_api_init', 'olyxee_tracking_register_routes' );

/**
 * Proxy a tracking lookup to Olyxee and return only customer-safe fields.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response
 */
function olyxee_tracking_proxy( $request ) {
	$code = trim( (string) $request->get_param( 'code' ) );

	// Cheap shape guard mirrors the Olyxee endpoint (letters/numbers/hyphen).
	if ( '' === $code || strlen( $code ) > 40 || ! preg_match( '/^[A-Za-z0-9-]+$/', $code ) ) {
		return new WP_REST_Response( array( 'error' => 'not_found' ), 404 );
	}

	$url  = olyxee_tracking_api_base() . '/api/public/track/' . rawurlencode( $code );
	$resp = wp_remote_get(
		$url,
		array(
			'timeout' => 12,
			'headers' => array( 'Accept' => 'application/json' ),
		)
	);

	if ( is_wp_error( $resp ) ) {
		return new WP_REST_Response( array( 'error' => 'upstream_error' ), 502 );
	}

	$status = (int) wp_remote_retrieve_response_code( $resp );
	$body   = json_decode( wp_remote_retrieve_body( $resp ), true );

	if ( 404 === $status || ! is_array( $body ) ) {
		return new WP_REST_Response( array( 'error' => 'not_found' ), 404 );
	}
	if ( 200 !== $status ) {
		return new WP_REST_Response( array( 'error' => 'upstream_error' ), 502 );
	}

	// Defensive whitelist: forward ONLY the customer-facing shipment fields.
	// No pricing, no customer PII, no internal records — even if the upstream
	// payload were to grow new fields later.
	$allowed = array(
		'trackingId',
		'reference',
		'currentStatus',
		'statusLabel',
		'transportMode',
		'transportModeLabel',
		'flow',
		'estimatedDeliveryDate',
		'lastUpdated',
		'business',
		'events',
	);
	$safe = array();
	foreach ( $allowed as $key ) {
		if ( array_key_exists( $key, $body ) ) {
			$safe[ $key ] = $body[ $key ];
		}
	}

	$out = new WP_REST_Response( $safe, 200 );
	$out->header( 'Cache-Control', 'public, max-age=30' );
	return $out;
}

/* -------------------------------------------------------------------------
 * Shortcode: [olyxee_tracking]
 * ---------------------------------------------------------------------- */

/**
 * Render the tracking widget.
 *
 * @param array $atts Shortcode attributes (unused; kept for WP compatibility).
 * @return string
 */
function olyxee_tracking_shortcode( $atts = array() ) {
	wp_enqueue_style( 'olyxee-tracking' );
	wp_enqueue_script( 'olyxee-tracking' );

	$uid = 'olyxee-tracking-' . wp_rand( 1000, 9999 );

	ob_start();
	?>
	<div class="olyxee-tracking" id="<?php echo esc_attr( $uid ); ?>" data-olyxee-tracking>
		<form class="olyxee-tracking__form" data-olyxee-form novalidate>
			<label class="olyxee-tracking__label" for="<?php echo esc_attr( $uid ); ?>-input">
				<?php echo esc_html__( 'Track your shipment', 'olyxee-tracking' ); ?>
			</label>
			<div class="olyxee-tracking__row">
				<input
					class="olyxee-tracking__input"
					id="<?php echo esc_attr( $uid ); ?>-input"
					type="text"
					name="code"
					placeholder="<?php echo esc_attr__( 'Enter your tracking number', 'olyxee-tracking' ); ?>"
					autocomplete="off"
					spellcheck="false"
				/>
				<button class="olyxee-tracking__button" type="submit">
					<?php echo esc_html__( 'Track', 'olyxee-tracking' ); ?>
				</button>
			</div>
		</form>
		<div class="olyxee-tracking__result" data-olyxee-result aria-live="polite"></div>
	</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'olyxee_tracking', 'olyxee_tracking_shortcode' );

/* -------------------------------------------------------------------------
 * Optional Gutenberg block: "Olyxee Tracking" (renders the same shortcode).
 * ---------------------------------------------------------------------- */

function olyxee_tracking_register_block() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return; // Classic-editor / very old WP: shortcode still works.
	}
	register_block_type(
		OLYXEE_TRACKING_DIR . 'block',
		array(
			'render_callback' => 'olyxee_tracking_block_render',
		)
	);
}
add_action( 'init', 'olyxee_tracking_register_block' );

/**
 * Server render for the block == the shortcode output.
 *
 * @return string
 */
function olyxee_tracking_block_render() {
	return olyxee_tracking_shortcode( array() );
}
